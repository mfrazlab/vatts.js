package main

/*
#include <stdlib.h>

// Callback para quando dados chegam: ID da conexão + Ponteiro binário + Tamanho
typedef void (*OnDataCallback)(int connID, void* data, int length);

// Callback para quando uma conexão fecha
typedef void (*OnCloseCallback)(int connID);

// Helper para chamar o ponteiro de função do C passando tamanho
static void dispatch_data(OnDataCallback cb, int connID, void* msg, int len) {
    if (cb) {
        cb(connID, msg, len);
    }
}

static void dispatch_close(OnCloseCallback cb, int connID) {
    if (cb) {
        cb(connID);
    }
}
*/
import "C"
import (
	"bufio"
	"bytes"
	"core-go/utils"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"github.com/quic-go/quic-go/http3"

	// Importando as novas packages
	"core-go/cache"
	"core-go/security"
	"core-go/traffic"
)

var (
	// Mapa que conecta o ID da requisição ao Pipe de resposta
	conns = make(map[int]*io.PipeWriter)

	// Contador atômico para gerar IDs únicos
	nextID int64 = 0

	mutex sync.Mutex
)

//export StartServer
func StartServer(httpPortC *C.char, httpsPortC *C.char, certPathC *C.char, keyPathC *C.char, onData C.OnDataCallback, onClose C.OnCloseCallback, http3PortC *C.char) *C.char {
	httpPort := C.GoString(httpPortC)
	httpsPort := C.GoString(httpsPortC)
	certPath := C.GoString(certPathC)
	keyPath := C.GoString(keyPathC)
	http3Port := C.GoString(http3PortC)

	useSSL := certPath != "" && keyPath != ""
	if useSSL && httpsPort == "" {
		return C.CString("Error: HTTPS port required for SSL mode")
	}
	if !useSSL && httpPort == "" {
		return C.CString("Error: HTTP port required for Non-SSL mode")
	}

	// Inicia a limpeza do Cache em background
	cache.StartJanitor()

	// 1. Handler que faz a ponte real com o Node (Proxy Core)
	nodeBridgeHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := int(atomic.AddInt64(&nextID, 1))

		pr, pw := io.Pipe()

		mutex.Lock()
		conns[id] = pw
		mutex.Unlock()

		defer func() {
			mutex.Lock()
			delete(conns, id)
			mutex.Unlock()
			pw.Close()
			C.dispatch_close(onClose, C.int(id))
		}()

		// Correção para o Node aceitar a request (HTTP/3 -> HTTP/1.1)
		r.Proto = "HTTP/1.1"
		r.ProtoMajor = 1
		r.ProtoMinor = 1

		dump, err := httputil.DumpRequest(r, false)
		if err != nil {
			http.Error(w, "Internal Proxy Error", http.StatusInternalServerError)
			return
		}

		cHeaders := C.CBytes(dump)
		C.dispatch_data(onData, C.int(id), cHeaders, C.int(len(dump)))
		C.free(cHeaders)

		go func() {
			buf := make([]byte, 32*1024)
			for {
				n, err := r.Body.Read(buf)
				if n > 0 {
					chunk := C.CBytes(buf[:n])
					C.dispatch_data(onData, C.int(id), chunk, C.int(n))
					C.free(chunk)
				}
				if err != nil {
					break
				}
			}
		}()

		resp, err := http.ReadResponse(bufio.NewReader(pr), r)
		if err != nil {
			utils.Error("Error reading response from Node: ", err)
			return
		}
		defer resp.Body.Close()

		// --- Lógica de Cache (Write) ---
		// Se for GET, 200 OK e uma rota cacheável, salvamos no cache
		shouldCache := r.Method == "GET" && resp.StatusCode == 200 && cache.IsCacheable(r.URL.Path)

		var bodyReader io.Reader = resp.Body
		var _ []byte

		if shouldCache {
			// Lemos o corpo para a memória (respeitando o limite) para poder salvar
			// Usamos LimitReader para evitar DOS de memória
			limitR := io.LimitReader(resp.Body, int64(cache.MaxFileSize)+1)
			b, err := io.ReadAll(limitR)
			if err == nil && len(b) <= cache.MaxFileSize {
				_ = b
				// Clona os headers para o cache (Aplicando filtro HTTP/3)
				headerClone := make(http.Header)
				for k, vv := range resp.Header {
					lowerK := strings.ToLower(k)
					// Remove headers proibidos no HTTP/2 e HTTP/3 que o Node (HTTP/1.1) pode ter enviado
					if lowerK == "connection" || lowerK == "keep-alive" || lowerK == "proxy-connection" || lowerK == "transfer-encoding" || lowerK == "upgrade" {
						continue
					}
					for _, v := range vv {
						headerClone.Add(k, v)
					}
				}

				// Salva no Store
				cache.Store.Lock()
				cache.Store.Items[r.URL.String()] = &cache.Item{
					Body:       b,
					Headers:    headerClone,
					Expiration: time.Now().Add(cache.TTL),
				}
				cache.Store.Unlock()

				// Agora usamos o buffer da memória para responder ao cliente
				bodyReader = io.NopCloser(bytes.NewReader(b))
			} else {
				// Se passou do tamanho ou erro, respondemos o que lemos + o resto original
				if len(b) > 0 {
					bodyReader = io.MultiReader(bytes.NewReader(b), resp.Body)
				}
			}
		}

		// Copia Headers
		for k, v := range resp.Header {
			lowerK := strings.ToLower(k)
			if lowerK == "connection" || lowerK == "keep-alive" || lowerK == "proxy-connection" || lowerK == "transfer-encoding" || lowerK == "upgrade" {
				continue
			}
			for _, val := range v {
				w.Header().Add(k, val)
			}
		}
		w.WriteHeader(resp.StatusCode)

		// Copia Body (Do reader preparado ou do original)
		io.Copy(w, bodyReader)
	})

	// 2. Montagem da Pipeline de Handlers
	// Ordem: Alt-Svc -> Security -> Cache (Read) -> Traffic Fusion -> Node Bridge

	mainHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Adiciona Alt-Svc para avisar que HTTP/3 está disponível
		if http3Port != "" {
			// Se a porta for ":443", o header fica h3=":443"; ma=86400
			w.Header().Set("Alt-Svc", fmt.Sprintf(`h3="%s"; ma=86400`, http3Port))
		}

		// A. Security Check
		if err := security.AnalyzeRequest(r); err != nil {
			utils.Warn("[SECURITY] Blocked ", r.RemoteAddr, err)
			http.Error(w, "Vatts Shield: Request Blocked", http.StatusForbidden)
			return
		}

		// B. Cache Read Check
		if r.Method == "GET" && cache.IsCacheable(r.URL.Path) {
			cache.Store.RLock()
			item, ok := cache.Store.Items[r.URL.String()]
			cache.Store.RUnlock()

			if ok {
				for k, v := range item.Headers {
					for _, val := range v {
						w.Header().Add(k, val)
					}
				}
				w.Header().Set("X-Vatts-Cache", "HIT")
				w.WriteHeader(http.StatusOK)
				w.Write(item.Body)
				return
			}
		}

		// C. Traffic Fusion (Coalescing) + D. Node Bridge
		// O Fusion vai agrupar requisições simultâneas para a mesma URL
		// e chamar o nodeBridgeHandler apenas uma vez.
		traffic.ServeFusion(w, r, nodeBridgeHandler)
	})

	go func() {
		errChan := make(chan error)

		if useSSL {
			if http3Port != "" {
				go func() {
					serverH3 := http3.Server{
						Addr:    http3Port,
						Handler: mainHandler, // Usa o handler com middleware
					}
					errChan <- serverH3.ListenAndServeTLS(certPath, keyPath)
				}()
			}

			go func() {
				errChan <- http.ListenAndServeTLS(httpsPort, certPath, keyPath, mainHandler)
			}()

			if httpPort != "" {
				go func() {
					errChan <- http.ListenAndServe(httpPort, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						target := "https://" + r.Host + r.URL.Path
						if len(r.URL.RawQuery) > 0 {
							target += "?" + r.URL.RawQuery
						}
						http.Redirect(w, r, target, http.StatusMovedPermanently)
					}))
				}()
			}

		} else {
			errChan <- http.ListenAndServe(httpPort, mainHandler)
		}

		err := <-errChan
		if err != nil {
			utils.Error("Server Error: %v", err)
		}
	}()

	return nil
}

//export WriteToConn
func WriteToConn(connID C.int, dataPtr unsafe.Pointer, length C.int) *C.char {
	id := int(connID)
	data := C.GoBytes(dataPtr, length)

	mutex.Lock()
	pw, exists := conns[id]
	mutex.Unlock()

	if !exists {
		return C.CString("Connection not found (request ended)")
	}

	_, err := pw.Write(data)
	if err != nil {
		return C.CString(fmt.Sprintf("Write error: %v", err))
	}

	return nil
}

//export CloseConn
func CloseConn(connID C.int) {
	id := int(connID)

	mutex.Lock()
	pw, exists := conns[id]
	if exists {
		pw.Close()
		delete(conns, id)
	}
	mutex.Unlock()
}