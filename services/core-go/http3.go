/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 mfraz
 */
package main

import "C"
import (
	"bytes"
	"context"
	"core-go/cache"
	"core-go/security"
	"core-go/traffic"
	"core-go/utils"
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
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

// getSocketPath define o caminho do socket (IPC) para o Zero-Link
// Funciona em Linux, Mac e Windows (Build 17063+)
func getSocketPath() string {
	cwd, _ := os.Getwd()
	// Cria a pasta oculta .vatts no diretório do projeto
	socketDir := filepath.Join(cwd, ".vatts")
	
	// Garante que o diretório existe
	if _, err := os.Stat(socketDir); os.IsNotExist(err) {
		os.Mkdir(socketDir, 0755)
	}

	return filepath.Join(socketDir, "vatts.sock")
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

	// --- CONFIGURAÇÃO ZERO-LINK (IPC) ---
	socketPath := getSocketPath()
	
	// Criamos um Dialer otimizado para IPC
	dialer := &net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ErrorLog = customErrorLog
	
	// Aqui a mágica acontece: Substituímos o transporte TCP padrão
	// por um que força a conexão no socket local.
	proxy.Transport = &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			// Ignoramos o 'network' (tcp) e 'addr' (127.0.0.1) originais.
			// Forçamos "unix" (mesmo no Windows moderno) para usar o arquivo .sock
			return dialer.DialContext(ctx, "unix", socketPath)
		},
		TLSClientConfig:       &tls.Config{InsecureSkipVerify: true},
		MaxIdleConns:          1000,             // Mantém muitas conexões abertas no socket
		IdleConnTimeout:       90 * time.Second, // Sockets locais são baratos, pode segurar
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
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
		if err := security.AnalyzeRequest(r); err != nil {
			utils.LogCustomLevel("", false, "", "", utils.FgRed+utils.Bright+"BLOCKED:"+utils.Reset,
				"Deep-Shield halted request from", r.RemoteAddr, "Reason:", err.Error())
			w.WriteHeader(http.StatusForbidden)
			return
		}

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
		traffic.ServeFusion(w, r, proxy)
	})

	go func() {
		errChan := make(chan error)

		if useSSL {
			// --- MODO SEGURO (HTTPS + H3) ---
			
			// Redirecionador HTTP -> HTTPS (Opcional)
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
			go func() {
				server := &http.Server{
					Addr:     httpPort,
					Handler:  mainHandler,
					ErrorLog: customErrorLog,
				}
				errChan <- server.ListenAndServe()
			}()
		}

		for err := range errChan {
			if err != nil {
				utils.Error("Error on proxy server: ", err)
			}
		}
	}()

	return nil
}