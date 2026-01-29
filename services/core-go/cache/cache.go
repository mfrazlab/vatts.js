/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 mfraz
 */
package cache

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	TTL             = 5 * time.Minute
	CleanupInterval = 1 * time.Minute
	MaxItems        = 5000
	MaxFileSize     = 5 * 1024 * 1024
)

type Item struct {
	Body        []byte
	ContentType string
	Encoding    string
	Headers     http.Header
	Expiration  time.Time
}

var Store = struct {
	sync.RWMutex
	Items map[string]*Item
}{
	Items: make(map[string]*Item),
}

func StartJanitor() {
	go func() {
		for {
			time.Sleep(CleanupInterval)
			now := time.Now()
			Store.Lock()
			for key, item := range Store.Items {
				if now.After(item.Expiration) {
					delete(Store.Items, key)
				}
			}
			Store.Unlock()
		}
	}()
}

func IsCacheable(path string) bool {
	exts := []string{".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".woff2", ".ttf", ".ico"}
	for _, ext := range exts {
		if strings.HasSuffix(path, ext) {
			return true
		}
	}
	return strings.Contains(path, "/_vatts/")
}