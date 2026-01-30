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
package traffic

import (
	"bytes"
	"core-go/utils"

	"net/http"
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
// Adaptação: Aceita http.Handler em vez de *httputil.ReverseProxy para compatibilidade
func ServeFusion(w http.ResponseWriter, r *http.Request, next http.Handler) {
	if r.Method != "GET" {
		next.ServeHTTP(w, r)
		return
	}

	key := r.URL.String()

	globalGroup.mu.Lock()
	if c, ok := globalGroup.m[key]; ok {
		c.dups++
		globalGroup.mu.Unlock()
		c.wg.Wait()

		if c.err != nil || c.val == nil {
			next.ServeHTTP(w, r)
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

	// Executa o handler real (Proxy p/ Node)
	next.ServeHTTP(recorder, r)

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
		utils.Info("Collapsed %d requests for %s", c.dups, key)
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
