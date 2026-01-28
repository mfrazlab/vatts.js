/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 mfraz
 */
package main

import "C"
import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"

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

var memoryCache = struct {
	sync.RWMutex
	items map[string]*CacheItem
}{
	items: make(map[string]*CacheItem),
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
func StartServer(httpPortC *C.char, httpsPortC *C.char, backendUrlC *C.char, certPathC *C.char, keyPathC *C.char) *C.char {
	httpPort := C.GoString(httpPortC)
	httpsPort := C.GoString(httpsPortC)
	backendURL := C.GoString(backendUrlC)
	certPath := C.GoString(certPathC)
	keyPath := C.GoString(keyPathC)

	if backendURL == "" || httpsPort == "" || certPath == "" || keyPath == "" {
		return C.CString("Error: Missing required arguments")
	}

	target, err := url.Parse(backendURL)
	if err != nil {
		return C.CString(fmt.Sprintf("Error parsing backend URL: %v", err))
	}

	startCacheJanitor()

	proxy := httputil.NewSingleHostReverseProxy(target)
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
		w.Header().Set("Alt-Svc", fmt.Sprintf(`h3=":%s"; ma=2592000`, cleanPort))

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
				log.Printf("[Go Proxy] Redirector on %s", httpPort)
				errChan <- http.ListenAndServe(httpPort, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					host := strings.Split(r.Host, ":")[0]
					target := fmt.Sprintf("https://%s%s%s", host, httpsPort, r.URL.Path)
					if len(r.URL.RawQuery) > 0 {
						target += "?" + r.URL.RawQuery
					}
					http.Redirect(w, r, target, http.StatusMovedPermanently)
				}))
			}()
		}

		go func() {
			serverH3 := http3.Server{Addr: httpsPort, Handler: mainHandler}
			log.Printf("[Go Proxy] HTTP/3 (UDP) on %s", httpsPort)
			errChan <- serverH3.ListenAndServeTLS(certPath, keyPath)
		}()

		go func() {
			log.Printf("[Go Proxy] TCP (H1/H2) on %s", httpsPort)
			errChan <- http.ListenAndServeTLS(httpsPort, certPath, keyPath, mainHandler)
		}()

		for err := range errChan {
			if err != nil {
				log.Printf("[Go Proxy Error] %v", err)
			}
		}
	}()

	return nil
}
