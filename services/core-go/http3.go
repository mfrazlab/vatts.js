/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 mfraz
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
	"net"
	"net/http"
	"net/http/httputil"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"github.com/quic-go/quic-go/http3"

	"core-go/cache"
	"core-go/security"
	"core-go/traffic"
)

// Interface genérica para tratar tanto HTTP padrão (Pipe) quanto WebSockets (net.Conn)
type ProxyConnection interface {
	Write(p []byte) (n int, err error)
	Close() error
}

var (
	conns        = make(map[int]ProxyConnection)
	nextID int64 = 0
	mutex  sync.Mutex
)

/* -----------------------------
    Helpers (ports)
------------------------------ */

func normalizeAddrPort(p string) string {
	p = strings.TrimSpace(p)
	if p == "" {
		return ""
	}
	// se vier só "443", vira ":443"
	if !strings.Contains(p, ":") {
		return ":" + p
	}
	// se vier "0.0.0.0:443" ou ":443" mantém
	return p
}

func extractPortOnly(addr string) string {
	// aceita ":443", "443", "0.0.0.0:443", "[::]:443"
	addr = strings.TrimSpace(addr)
	if addr == "" {
		return ""
	}
	if !strings.Contains(addr, ":") {
		return addr
	}
	// tenta net.SplitHostPort
	host, port, err := net.SplitHostPort(addr)
	_ = host
	if err == nil && port != "" {
		return port
	}
	// fallback: pega depois do último ':'
	parts := strings.Split(addr, ":")
	return parts[len(parts)-1]
}

//export StartServer
func StartServer(
	httpPortC *C.char,
	httpsPortC *C.char,
	certPathC *C.char,
	keyPathC *C.char,
	onData C.OnDataCallback,
	onClose C.OnCloseCallback,
	http3PortC *C.char,
	dev *C.char,
) *C.char {

	httpPort := normalizeAddrPort(C.GoString(httpPortC))
	httpsPort := normalizeAddrPort(C.GoString(httpsPortC))
	certPath := C.GoString(certPathC)
	keyPath := C.GoString(keyPathC)
	http3Port := normalizeAddrPort(C.GoString(http3PortC))

	devMode := C.GoString(dev) == "true"
	useSSL := certPath != "" && keyPath != ""

	if useSSL && httpsPort == "" {
		return C.CString("Error: HTTPS port required for SSL mode")
	}
	if !useSSL && httpPort == "" {
		return C.CString("Error: HTTP port required for Non-SSL mode")
	}

	// Validação de certificados SSL
	if useSSL {
		if _, err := os.Stat(certPath); err != nil {
			return C.CString(fmt.Sprintf("Error: Certificate file not found at %s: %v", certPath, err))
		}
		if _, err := os.Stat(keyPath); err != nil {
			return C.CString(fmt.Sprintf("Error: Key file not found at %s: %v", keyPath, err))
		}
	}

	// --- Preparação do Alt-Svc Header (Pré-calculado) ---
	var altSvcHeader string
	var debugH3Port string

	if http3Port != "" {
		h3PortOnly := extractPortOnly(http3Port)
		if h3PortOnly != "" {
			debugH3Port = h3PortOnly
			altSvcHeader = fmt.Sprintf(`h3=":%s"; ma=2592000, h3-29=":%s"; ma=2592000`, h3PortOnly, h3PortOnly)
		} else {
			utils.Warn("[Native] HTTP/3 Port string is invalid or empty.")
		}
	}

	// Inicia a limpeza do Cache em background
	cache.StartJanitor()

	// 1. Handler que faz a ponte real com o Node (Proxy Core)
	nodeBridgeHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := int(atomic.AddInt64(&nextID, 1))

		// WebSocket / Upgrade
		isUpgrade := false
		if strings.ToLower(r.Header.Get("Connection")) == "upgrade" &&
			strings.ToLower(r.Header.Get("Upgrade")) == "websocket" {
			isUpgrade = true
		}

		// WebSocket: Hijack
		if isUpgrade {
			hijacker, ok := w.(http.Hijacker)
			if !ok {
				http.Error(w, "Websocket not supported by server interface", http.StatusInternalServerError)
				return
			}

			clientConn, _, err := hijacker.Hijack()
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			mutex.Lock()
			conns[id] = clientConn
			mutex.Unlock()

			defer func() {
				mutex.Lock()
				delete(conns, id)
				mutex.Unlock()
				clientConn.Close()
				C.dispatch_close(onClose, C.int(id))
			}()

			// Força HTTP/1.1 no dump pro Node
			r.Proto = "HTTP/1.1"
			r.ProtoMajor = 1
			r.ProtoMinor = 1

			dump, err := httputil.DumpRequest(r, false)
			if err == nil {
				cHeaders := C.CBytes(dump)
				C.dispatch_data(onData, C.int(id), cHeaders, C.int(len(dump)))
				C.free(cHeaders)
			}

			// Loop Cliente -> Node
			buf := make([]byte, 32*1024)
			for {
				clientConn.SetReadDeadline(time.Now().Add(60 * time.Minute))
				n, err := clientConn.Read(buf)
				if n > 0 {
					chunk := C.CBytes(buf[:n])
					C.dispatch_data(onData, C.int(id), chunk, C.int(n))
					C.free(chunk)
				}
				if err != nil {
					break
				}
			}
			return
		}

		// HTTP normal (Pipe)
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

		// Cache write
		shouldCache := r.Method == "GET" && resp.StatusCode == 200 && cache.IsCacheable(r.URL.Path)
		var bodyReader io.Reader = resp.Body

		if shouldCache && !devMode {
			limitR := io.LimitReader(resp.Body, int64(cache.MaxFileSize)+1)
			b, err := io.ReadAll(limitR)
			if err == nil && len(b) <= cache.MaxFileSize {
				headerClone := make(http.Header)
				for k, vv := range resp.Header {
					lowerK := strings.ToLower(k)
					if lowerK == "connection" || lowerK == "keep-alive" || lowerK == "proxy-connection" ||
						lowerK == "transfer-encoding" || lowerK == "upgrade" || lowerK == "alt-svc" {
						continue
					}
					for _, v := range vv {
						headerClone.Add(k, v)
					}
				}

				cache.Store.Lock()
				cache.Store.Items[r.URL.String()] = &cache.Item{
					Body:       b,
					Headers:    headerClone,
					Expiration: time.Now().Add(cache.TTL),
				}
				cache.Store.Unlock()
				bodyReader = bytes.NewReader(b)
			} else {
				if len(b) > 0 {
					bodyReader = io.MultiReader(bytes.NewReader(b), resp.Body)
				}
			}
		}

		// Copia headers do Node (sem hop-by-hop e sem Alt-Svc)
		for k, v := range resp.Header {
			lowerK := strings.ToLower(k)
			if lowerK == "connection" || lowerK == "keep-alive" || lowerK == "proxy-connection" ||
				lowerK == "transfer-encoding" || lowerK == "upgrade" || lowerK == "alt-svc" {
				continue
			}
			for _, val := range v {
				w.Header().Add(k, val)
			}
		}

		// ✅ GARANTE Alt-Svc AQUI (isso entra no recorder do Fusion)
		if altSvcHeader != "" {
			w.Header().Set("Alt-Svc", altSvcHeader)
			if devMode && debugH3Port != "" {
				w.Header().Set("X-Vatts-H3-Port", debugH3Port)
			}
		}

		w.WriteHeader(resp.StatusCode)
		io.Copy(w, bodyReader)
	})

	// 2. Pipeline principal
	mainHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Security
		if err := security.AnalyzeRequest(r); err != nil {
			utils.Warn("[SECURITY] Blocked ", r.RemoteAddr, err)
			http.Error(w, "Vatts Shield: Request Blocked", http.StatusForbidden)
			return
		}

		// Cache HIT (só GET)
		if r.Method == "GET" && r.Header.Get("Upgrade") == "" && cache.IsCacheable(r.URL.Path) {
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

				// ✅ GARANTE Alt-Svc também no cache HIT (não passa pelo nodeBridgeHandler)
				if altSvcHeader != "" {
					w.Header().Set("Alt-Svc", altSvcHeader)
					if devMode && debugH3Port != "" {
						w.Header().Set("X-Vatts-H3-Port", debugH3Port)
					}
				}

				w.WriteHeader(http.StatusOK)
				w.Write(item.Body)
				return
			}
		}

		// Websocket bypass fusion
		if r.Header.Get("Upgrade") != "" {
			nodeBridgeHandler.ServeHTTP(w, r)
			return
		}

		// Fusion (GET) + Node bridge
		traffic.ServeFusion(w, r, nodeBridgeHandler)
	})

	go func() {
		errChan := make(chan error, 3)

		if useSSL {
			// HTTP/3 (UDP)
			if http3Port != "" {
				utils.Info("Starting HTTP/3 Server on " + http3Port + "...")
				go func() {
					serverH3 := http3.Server{
						Addr:    http3Port,
						Handler: mainHandler,
					}
					errChan <- serverH3.ListenAndServeTLS(certPath, keyPath)
				}()
			}

			// HTTPS (TCP)
			go func() {
				errChan <- http.ListenAndServeTLS(httpsPort, certPath, keyPath, mainHandler)
			}()

			// HTTP -> HTTPS redirect
			if httpPort != "" {
				go func() {
					redirectHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						target := "https://" + r.Host + r.URL.Path
						if len(r.URL.RawQuery) > 0 {
							target += "?" + r.URL.RawQuery
						}
						// (opcional) Alt-Svc no redirect também
						if altSvcHeader != "" {
							w.Header().Set("Alt-Svc", altSvcHeader)
						}
						http.Redirect(w, r, target, http.StatusMovedPermanently)
					})
					errChan <- http.ListenAndServe(httpPort, redirectHandler)
				}()
			}
		} else {
			errChan <- http.ListenAndServe(httpPort, mainHandler)
		}

		err := <-errChan
		if err != nil {
			utils.Error("Server Error:", err)
		}
	}()

	return nil
}

//export WriteToConn
func WriteToConn(connID C.int, dataPtr unsafe.Pointer, length C.int) *C.char {
	id := int(connID)
	data := C.GoBytes(dataPtr, length)

	mutex.Lock()
	conn, exists := conns[id]
	mutex.Unlock()

	if !exists {
		return C.CString("Connection not found (request ended)")
	}

	_, err := conn.Write(data)
	if err != nil {
		return C.CString(fmt.Sprintf("Write error: %v", err))
	}
	return nil
}

//export CloseConn
func CloseConn(connID C.int) {
	id := int(connID)

	mutex.Lock()
	conn, exists := conns[id]
	if exists {
		conn.Close()
		delete(conns, id)
	}
	mutex.Unlock()
}
