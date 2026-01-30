package main

import (
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/quic-go/quic-go/http3"
)

func maina() {
	// URL do seu servidor (mude a porta se necessário)
	url := "https://localhost/_vatts/assets/d63956b8-globals.Or2dZy8p.css"

	// Configura o RoundTripper para usar HTTP/3
	// InsecureSkipVerify: true é para aceitar certificados autoassinados em testes locais
	roundTripper := &http3.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
		},
	}
	defer roundTripper.Close()

	// Cria o cliente HTTP padrão injetando o transporte HTTP/3
	client := &http.Client{
		Transport: roundTripper,
	}

	fmt.Printf("Tentando conectar em %s via HTTP/3...\n", url)

	// Faz a requisição
	resp, err := client.Get(url)
	if err != nil {
		log.Fatalf("Erro na requisição: %v", err)
	}
	defer resp.Body.Close()

	// Lê o corpo da resposta
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalf("Erro ao ler o corpo: %v", err)
	}

	// Mostra o resultado
	fmt.Println("--- Sucesso! ---")
	fmt.Printf("Status: %s\n", resp.Status)
	fmt.Printf("Protocolo: %s\n", resp.Proto) // Deve mostrar HTTP/3.0
	fmt.Printf("Corpo: %s\n", string(body))
}
