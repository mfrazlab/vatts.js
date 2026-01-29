/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 mfraz
 */
package main

/*
#include <stdlib.h>

typedef void (*OnWebTransportMessage)(char* id, char* path, char* event, char* data);

static void CallCallback(OnWebTransportMessage p, char* id, char* path, char* event, char* data) {
    if (p != NULL) {
        p(id, path, event, data);
    }
}
*/
import "C"
import (
	"bytes"
	"context"
	"core-go/utils"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
	"unsafe"

	"github.com/quic-go/quic-go/http3"
)

const (
	CacheTTL        = 5 * time.Minute
	CleanupInterval = 1 * time.Minute
	MaxCacheItems   = 5000
	MaxFileSize     = 5 * 1024 * 1024
)

type CacheItem struct {
	Body        []byte
	ContentType string
	Encoding    string
	Headers     http.Header
	Expiration  time.Time
}

type errorLogWriter struct{}

func (w *errorLogWriter) Write(p []byte) (n int, err error) {
	utils.Error(strings.TrimSpace(string(p)))
	return len(p), nil
}

var memoryCache = struct {
	sync.RWMutex
	items map[string]*CacheItem
}{
	items: make(map[string]*CacheItem),
}

// Interface local para gerenciar a sessão de transporte sem depender de versões do quic-go
type TransportSession interface {
	Write(p []byte) (n int, err error)
	Close() error
}

var webTransportSessions = struct {
	sync.RWMutex
	items map[string]TransportSession
}{
	items: make(map[string]TransportSession),
}

var nodeCallback C.OnWebTransportMessage

//export RegisterWebTransportCallback
func RegisterWebTransportCallback(cb C.OnWebTransportMessage) {
	nodeCallback = cb
}

//export WebTransportSend
func WebTransportSend(idC *C.char, msgC *C.char) {
	id := C.GoString(idC)
	msg := C.GoString(msgC)

	// LOG: Debug de envio (opcional, pode comentar se ficar muito spam)
	// fmt.Printf("[Go] WebTransportSend para ID: %s\n", id)

	webTransportSessions.RLock()
	session, exists := webTransportSessions.items[id]
	webTransportSessions.RUnlock()

	if exists {
		// Envia para a sessão
		_, err := session.Write([]byte(msg))
		if err != nil {
			fmt.Printf("[Go] Erro ao enviar mensagem para %s: %v\n", id, err)
		}
	} else {
		fmt.Printf("[Go] Sessão %s não encontrada para envio\n", id)
	}
}

//export WebTransportClose
func WebTransportClose(idC *C.char) {
	id := C.GoString(idC)
	webTransportSessions.Lock()
	if session, exists := webTransportSessions.items[id]; exists {
		session.Close()
		delete(webTransportSessions.items, id)
		fmt.Printf("[Go] Sessão %s fechada via comando do Node\n", id)
	}
	webTransportSessions.Unlock()
}

func generateID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func notifyNode(id, path, event, data string) {
	if nodeCallback == nil {
		fmt.Println("[Go] AVISO: nodeCallback é nil (Node não registrou o callback)")
		return
	}
	cId := C.CString(id)
	cPath := C.CString(path)
	cEvent := C.CString(event)
	cData := C.CString(data)
	defer C.free(unsafe.Pointer(cId))
	defer C.free(unsafe.Pointer(cPath))
	defer C.free(unsafe.Pointer(cEvent))
	defer C.free(unsafe.Pointer(cData))

	C.CallCallback(nodeCallback, cId, cPath, cEvent, cData)
}

func startCacheJanitor() {
	go func() {
		for {
			time.Sleep(CleanupInterval)
			now := time.Now()
			memoryCache.Lock()
			for key, item := range memoryCache.items {
				if now.After(item.Expiration) {
					delete(memoryCache.items, key)
				}
			}
			memoryCache.Unlock()
		}
	}()
}

func isCacheable(path string) bool {
	exts := []string{".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".woff2", ".ttf", ".ico"}
	for _, ext := range exts {
		if strings.HasSuffix(path, ext) {
			return true
		}
	}
	return strings.Contains(path, "/_vatts/")
}

//export StartServer
func StartServer(httpPortC *C.char, httpsPortC *C.char, backendUrlC *C.char, certPathC *C.char, keyPathC *C.char, enableWebTransportC *C.char) *C.char {
	httpPort := C.GoString(httpPortC)
	httpsPort := C.GoString(httpsPortC)
	backendURL := C.GoString(backendUrlC)
	certPath := C.GoString(certPathC)
	keyPath := C.GoString(keyPathC)
	enableWebTransport := C.GoString(enableWebTransportC) == "true"

	fmt.Printf("[Go] StartServer Iniciado. HTTPS: %s, Backend: %s, WebTransport: %v\n", httpsPort, backendURL, enableWebTransport)

	if backendURL == "" || httpsPort == "" || certPath == "" || keyPath == "" {
		return C.CString("Error: Missing required arguments")
	}

	target, err := url.Parse(backendURL)
	if err != nil {
		return C.CString(fmt.Sprintf("Error parsing backend URL: %v", err))
	}

	// GERA E IMPRIME O HASH DO CERTIFICADO PARA FACILITAR O USO DE SELF-SIGNED
	if certPath != "" {
		printCertificateFingerprint(certPath)
	}

	startCacheJanitor()

	customErrorLog := log.New(&errorLogWriter{}, "", 0)

	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ErrorLog = customErrorLog
	proxy.Transport = &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		if resp.StatusCode == 200 && resp.Request.Method == "GET" && isCacheable(resp.Request.URL.Path) {
			if resp.ContentLength > MaxFileSize {
				return nil
			}
			bodyBytes, err := io.ReadAll(resp.Body)
			if err != nil {
				return nil
			}
			resp.Body.Close()
			resp.Body = io.NopCloser(bytes.NewReader(bodyBytes))

			memoryCache.Lock()
			if len(memoryCache.items) < MaxCacheItems {
				memoryCache.items[resp.Request.URL.Path] = &CacheItem{
					Body:        bodyBytes,
					ContentType: resp.Header.Get("Content-Type"),
					Encoding:    resp.Header.Get("Content-Encoding"),
					Headers:     resp.Header.Clone(),
					Expiration:  time.Now().Add(CacheTTL),
				}
			}
			memoryCache.Unlock()
		}
		return nil
	}

	cleanPort := strings.ReplaceAll(httpsPort, ":", "")

	mainHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Cabeçalho Alt-Svc para anunciar HTTP/3
		w.Header().Set("Alt-Svc", fmt.Sprintf(`h3=":%s"; ma=2592000`, cleanPort))

		// Lógica WebTransport
		if enableWebTransport && r.Method == "CONNECT" && r.Proto == "webtransport" {
			fmt.Printf("[Go] Conexão WebTransport RECEBIDA para %s\n", r.URL.Path)

			w.WriteHeader(http.StatusOK)
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
			fmt.Println("[Go] WebTransport Handshake OK (200)")

			sessionID := generateID()
			path := r.URL.Path

			notifyNode(sessionID, path, "CONNECT", "")
			fmt.Printf("[Go] Notificado Node sobre CONNECT. ID: %s\n", sessionID)

			// Prepara o canal de comunicação para escrita
			msgChan := make(chan []byte, 100)
			ctx, cancel := context.WithCancel(r.Context())

			// Implementação do TransportSession usando canais
			sender := &chanTransport{
				msgChan: msgChan,
				ctx:     ctx,
				cancel:  cancel,
			}

			webTransportSessions.Lock()
			webTransportSessions.items[sessionID] = sender
			webTransportSessions.Unlock()

			// Garante limpeza ao sair
			defer func() {
				fmt.Printf("[Go] Encerrando sessão %s\n", sessionID)
				webTransportSessions.Lock()
				delete(webTransportSessions.items, sessionID)
				webTransportSessions.Unlock()
				cancel()
				notifyNode(sessionID, path, "CLOSE", "")
			}()

			// Goroutine para leitura (Client -> Node)
			go func() {
				fmt.Printf("[Go] Iniciando leitura do stream %s\n", sessionID)
				buf := make([]byte, 4096)
				for {
					n, err := r.Body.Read(buf)
					if err != nil {
						fmt.Printf("[Go] Erro/Fim de leitura (%s): %v\n", sessionID, err)
						cancel()
						return
					}
					// fmt.Printf("[Go] Recebido %d bytes de %s\n", n, sessionID)
					notifyNode(sessionID, path, "MESSAGE", string(buf[:n]))
				}
			}()

			// Loop principal de escrita (Node -> Client)
			// Mantém o Handler vivo enquanto a conexão durar
			for {
				select {
				case <-ctx.Done():
					fmt.Printf("[Go] Contexto finalizado para %s\n", sessionID)
					return
				case msg := <-msgChan:
					_, err := w.Write(msg)
					if err != nil {
						fmt.Printf("[Go] Erro de escrita para %s: %v\n", sessionID, err)
						return
					}
					if f, ok := w.(http.Flusher); ok {
						f.Flush()
					}
				}
			}
		}

		if r.Method == "GET" {
			memoryCache.RLock()
			item, found := memoryCache.items[r.URL.Path]
			memoryCache.RUnlock()

			if found && !time.Now().After(item.Expiration) {
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

		w.Header().Set("X-Vatts-Cache", "MISS")
		proxy.ServeHTTP(w, r)
	})

	go func() {
		errChan := make(chan error)
		if httpPort != "" {
			go func() {
				fmt.Printf("[Go] Servidor HTTP iniciando em %s\n", httpPort)
				server := &http.Server{
					Addr: httpPort,
					Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						host := strings.Split(r.Host, ":")[0]
						target := fmt.Sprintf("https://%s%s%s", host, httpsPort, r.URL.Path)
						if len(r.URL.RawQuery) > 0 {
							target += "?" + r.URL.RawQuery
						}
						http.Redirect(w, r, target, http.StatusMovedPermanently)
					}),
					ErrorLog: customErrorLog,
				}
				errChan <- server.ListenAndServe()
			}()
		}

		go func() {
			fmt.Printf("[Go] Servidor HTTP/3 (QUIC) iniciando em %s\n", httpsPort)
			serverH3 := http3.Server{
				Addr:            httpsPort,
				Handler:         mainHandler,
				EnableDatagrams: true, // Necessário para WebTransport
			}
			errChan <- serverH3.ListenAndServeTLS(certPath, keyPath)
		}()

		go func() {
			fmt.Printf("[Go] Servidor HTTPS (Fallback TCP) iniciando em %s\n", httpsPort)
			server := &http.Server{
				Addr:     httpsPort,
				Handler:  mainHandler,
				ErrorLog: customErrorLog,
			}
			errChan <- server.ListenAndServeTLS(certPath, keyPath)
		}()

		for err := range errChan {
			if err != nil {
				utils.Error("Error on proxy: ", err)
			}
		}
	}()

	return nil
}

// Estrutura que implementa TransportSession
type chanTransport struct {
	msgChan chan []byte
	ctx     context.Context
	cancel  context.CancelFunc
}

func (t *chanTransport) Write(p []byte) (n int, err error) {
	select {
	case <-t.ctx.Done():
		return 0, t.ctx.Err()
	case t.msgChan <- append([]byte(nil), p...): // Cópia segura
		return len(p), nil
	}
}

func (t *chanTransport) Close() error {
	t.cancel()
	return nil
}

// Helper para calcular e imprimir o hash do certificado (ignore self-signed no client)
func printCertificateFingerprint(certPath string) {
	data, err := os.ReadFile(certPath)
	if err != nil {
		fmt.Printf("[Go] Aviso: Não foi possível ler o certificado para gerar o hash: %v\n", err)
		return
	}
	block, _ := pem.Decode(data)
	if block == nil {
		fmt.Println("[Go] Aviso: Falha ao decodificar PEM do certificado.")
		return
	}
	hash := sha256.Sum256(block.Bytes)

	// Formata array JS
	var parts []string
	for _, b := range hash {
		parts = append(parts, fmt.Sprintf("0x%02x", b))
	}
	jsArray := strings.Join(parts, ", ")

	fmt.Printf("\n[Go] ============================================\n")
	fmt.Printf("[Go]       CERTIFICADO SELF-SIGNED DETECTADO      \n")
	fmt.Printf("[Go] ============================================\n")
	fmt.Printf("Para corrigir o erro 'ERR_QUIC_PROTOCOL_ERROR' no browser,\n")
	fmt.Printf("adicione esta opção na criação do WebTransport no JS:\n\n")
	fmt.Printf("serverCertificateHashes: [{ algorithm: 'sha-256', value: new Uint8Array([%s]) }]\n\n", jsArray)
	fmt.Printf("==================================================\n")
}
