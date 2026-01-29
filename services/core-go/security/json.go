/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 mfraz
 */
package security

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"strings"
)

const (
	MaxScanningBodySize = 1024 * 1024 // 1MB
)

var (
	ErrMaliciousPayload = errors.New("vatts-shield: malicious payload detected")
)

// AnalyzeRequest realiza a inspeção profunda do pacote
func AnalyzeRequest(r *http.Request) error {
	if r.Body == nil || r.ContentLength == 0 {
		return nil
	}

	// Verifica apenas métodos que carregam payload perigoso
	if r.Method == "POST" || r.Method == "PUT" || r.Method == "PATCH" {
		return scanBody(r)
	}

	return nil
}

func scanBody(r *http.Request) error {
	// Ignora corpos gigantes para performance
	if r.ContentLength > int64(MaxScanningBodySize) {
		return nil
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}

	// Restaura o corpo para o Proxy ler depois
	r.Body.Close()
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	payload := string(bodyBytes)

	// 1. Prototype Pollution
	if strings.Contains(payload, "\"__proto__\"") || 
	   strings.Contains(payload, "\"constructor\"") || 
	   strings.Contains(payload, "\"prototype\"") {
		return ErrMaliciousPayload
	}

	// 2. NoSQL Injection Básico
	if strings.Contains(payload, "\"$ne\"") || 
	   strings.Contains(payload, "\"$gt\"") || 
	   strings.Contains(payload, "\"$where\"") {
		return ErrMaliciousPayload
	}

	return nil
}