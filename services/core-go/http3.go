/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 mfraz
 */
package main

import "C"
import (
	"bytes"
	"core-go/cache"
	"core-go/security"
	"core-go/traffic"
	"core-go/utils"
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/quic-go/quic-go/http3"
)

// errorLogWriter implementa io.Writer para redirecionar logs internos
type errorLogWriter struct{}

func (w *errorLogWriter) Write(p []byte) (n int, err error) {
	utils.Error(strings.TrimSpace(string(p)))
	return len(p), nil
}

//export StartServer
func StartServer(httpPortC *C.char, httpsPortC *C.char, backendUrlC *C.char, certPathC *C.char, keyPathC *C.char, devC *C.char) *C.char {
	httpPort := C.GoString(httpPortC)
	httpsPort := C.GoString(httpsPortC)
	backendURL := C.GoString(backendUrlC)
	certPath := C.GoString(certPathC)
	keyPath := C.GoString(keyPathC)
	dev := C.GoString(devC) == "true"

	// Verifica se devemos usar SSL (se certificados foram fornecidos)
	useSSL := certPath != "" && keyPath != ""

	if backendURL == "" {
		return C.CString("Error: Missing backend URL")
	}

	if useSSL && httpsPort == "" {
		return C.CString("Error: HTTPS port required for SSL mode")
	}

	if !useSSL && httpPort == "" {
		return C.CString("Error: HTTP port required for Non-SSL mode")
	}

	target, err := url.Parse(backendURL)
	if err != nil {
		return C.CString(fmt.Sprintf("Error parsing backend URL: %v", err))
	}

	// Inicia o limpador de cache (no pacote cache)
	cache.StartJanitor()

	customErrorLog := log.New(&errorLogWriter{}, "", 0)

	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ErrorLog = customErrorLog
	proxy.Transport = &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	// Modifica a resposta para salvar no cache ETERNO se necessário
	proxy.ModifyResponse = func(resp *http.Response) error {
		if resp.StatusCode == 200 && resp.Request.Method == "GET" && cache.IsCacheable(resp.Request.URL.Path) && !dev {
			if resp.ContentLength > cache.MaxFileSize {
				return nil
			}
			bodyBytes, err := io.ReadAll(resp.Body)
			if err != nil {
				return nil
			}
			resp.Body.Close()
			resp.Body = io.NopCloser(bytes.NewReader(bodyBytes))

			cache.Store.Lock()
			if len(cache.Store.Items) < cache.MaxItems {
				cache.Store.Items[resp.Request.URL.Path] = &cache.Item{
					Body:        bodyBytes,
					ContentType: resp.Header.Get("Content-Type"),
					Encoding:    resp.Header.Get("Content-Encoding"),
					Headers:     resp.Header.Clone(),
					Expiration:  time.Now().Add(cache.TTL),
				}
			}
			cache.Store.Unlock()
		}
		return nil
	}

	cleanPort := strings.ReplaceAll(httpsPort, ":", "")

	mainHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. VATTS DEEP-SHIELD (Segurança)
		// Verifica payloads maliciosos antes de qualquer coisa
		if err := security.AnalyzeRequest(r); err != nil {
			utils.LogCustomLevel("", false, "", "", utils.FgRed+utils.Bright+"BLOCKED:"+utils.Reset,
				"Deep-Shield halted request from", r.RemoteAddr, "Reason:", err.Error())
			w.WriteHeader(http.StatusForbidden)
			return
		}

		// Se estiver usando SSL, anuncia o HTTP/3
		if useSSL {
			w.Header().Set("Alt-Svc", fmt.Sprintf(`h3=":%s"; ma=2592000`, cleanPort))
		}

		// 2. Verifica Cache de Arquivos Estáticos
		if r.Method == "GET" {
			cache.Store.RLock()
			item, found := cache.Store.Items[r.URL.Path]
			cache.Store.RUnlock()

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

		// 3. VATTS FUSION (Atomic Request Coalescing)
		// Protege o backend contra "Thundering Herd" (várias requisições iguais ao mesmo tempo)
		traffic.ServeFusion(w, r, proxy)
	})

	go func() {
		errChan := make(chan error)

		if useSSL {
			// --- MODO SEGURO (HTTPS + H3) ---
			
			// Redirecionador HTTP -> HTTPS (Opcional, só se porta HTTP for definida)
			if httpPort != "" {
				go func() {
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

			// Servidor HTTP/3 (UDP)
			go func() {
				serverH3 := http3.Server{
					Addr:    httpsPort,
					Handler: mainHandler,
				}
				errChan <- serverH3.ListenAndServeTLS(certPath, keyPath)
			}()

			// Servidor HTTPS (TCP/H2)
			go func() {
				server := &http.Server{
					Addr:     httpsPort,
					Handler:  mainHandler,
					ErrorLog: customErrorLog,
				}
				errChan <- server.ListenAndServeTLS(certPath, keyPath)
			}()

		} else {
			// --- MODO SIMPLES (HTTP Puro) ---
			// Sem SSL, sem HTTP/3, apenas o servidor proxy tunado
			go func() {
				server := &http.Server{
					Addr:     httpPort,
					Handler:  mainHandler,
					ErrorLog: customErrorLog,
				}
				errChan <- server.ListenAndServe()
			}()
		}

		// Monitora erros fatais
		for err := range errChan {
			if err != nil {
				utils.Error("Error on proxy server: ", err)
			}
		}
	}()

	return nil
}