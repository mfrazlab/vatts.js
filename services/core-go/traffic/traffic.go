/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 mfraz
 */
package traffic

import (
	"bytes"
	"core-go/utils"
	"net/http"
	"net/http/httputil"
	"sync"
)

type FusionGroup struct {
	mu sync.Mutex
	m  map[string]*call
}

type call struct {
	wg   sync.WaitGroup
	val  *ResponseSnapshot
	err  error
	dups int
}

type ResponseSnapshot struct {
	Code   int
	Header http.Header
	Body   []byte
}

var globalGroup = &FusionGroup{
	m: make(map[string]*call),
}

// ServeFusion tenta fundir requisições idênticas (GET)
func ServeFusion(w http.ResponseWriter, r *http.Request, proxy *httputil.ReverseProxy) {
	if r.Method != "GET" {
		proxy.ServeHTTP(w, r)
		return
	}

	key := r.URL.String()

	globalGroup.mu.Lock()
	if c, ok := globalGroup.m[key]; ok {
		c.dups++
		globalGroup.mu.Unlock()
		c.wg.Wait()

		if c.err != nil || c.val == nil {
			proxy.ServeHTTP(w, r)
			return
		}

		copyResponse(w, c.val, "FUSION")
		return
	}

	c := new(call)
	c.wg.Add(1)
	globalGroup.m[key] = c
	globalGroup.mu.Unlock()

	recorder := &responseRecorder{
		header: make(http.Header),
		body:   new(bytes.Buffer),
		code:   http.StatusOK,
	}

	proxy.ServeHTTP(recorder, r)

	c.val = &ResponseSnapshot{
		Code:   recorder.code,
		Header: recorder.header,
		Body:   recorder.body.Bytes(),
	}

	c.wg.Done()

	globalGroup.mu.Lock()
	delete(globalGroup.m, key)
	globalGroup.mu.Unlock()

	if c.dups > 0 {
		utils.LogCustomLevel("", false, "", "", utils.FgCyan+utils.Bright+"FUSION EFFECT:"+utils.Reset,
			"Collapsed", c.dups, "requests for", key)
	}

	copyResponse(w, c.val, "LEADER")
}

type responseRecorder struct {
	header http.Header
	body   *bytes.Buffer
	code   int
}

func (r *responseRecorder) Header() http.Header { return r.header }
func (r *responseRecorder) Write(b []byte) (int, error) {
	return r.body.Write(b)
}
func (r *responseRecorder) WriteHeader(statusCode int) {
	r.code = statusCode
}

func copyResponse(w http.ResponseWriter, snap *ResponseSnapshot, role string) {
	for k, v := range snap.Header {
		for _, val := range v {
			w.Header().Add(k, val)
		}
	}
	w.Header().Set("X-Vatts-Fusion", role)
	w.WriteHeader(snap.Code)
	w.Write(snap.Body)
}