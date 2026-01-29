package main

/*
#include <stdlib.h>

// Definindo o tipo do callback que virá do Node.js
typedef void (*OnMessageCallback)(char* data);

// Função helper para chamar o callback (Go não chama ponteiros de função C diretamente de forma fácil)
static void dispatch_message(OnMessageCallback cb, char* msg) {
    if (cb) {
        cb(msg);
    }
}
*/
import "C"
import (
	"bufio"
	"fmt"
	"net"
	"os"
	"sync"
	"unsafe"
)

// Mapa para guardar os listeners ativos e poder fechá-los depois
var (
	listeners = make(map[string]net.Listener)
	mutex     sync.Mutex
)

//export StartSocketServer
func StartSocketServer(socketPathC *C.char, callback C.OnMessageCallback) *C.char {
	socketPath := C.GoString(socketPathC)

	mutex.Lock()
	defer mutex.Unlock()

	// 1. Limpeza prévia: Se o arquivo já existe, tenta remover.
	// No Windows, sockets AF_UNIX criam arquivos reais no sistema de arquivos.
	if _, err := os.Stat(socketPath); err == nil {
		if err := os.Remove(socketPath); err != nil {
			return C.CString(fmt.Sprintf("Failed to remove existing socket file: %v", err))
		}
	}

	// 2. Cria o Listener usando o protocolo "unix" (funciona no Windows 10+ e Linux/Mac)
	l, err := net.Listen("unix", socketPath)
	if err != nil {
		return C.CString(fmt.Sprintf("Failed to listen on socket: %v", err))
	}

	// Salva referência para fechar depois
	listeners[socketPath] = l

	// 3. Inicia o loop de aceitação em uma Goroutine para não bloquear o Node.js
	go acceptLoop(l, callback)

	return nil // Retorna null indicando sucesso
}

//export StopSocketServer
func StopSocketServer(socketPathC *C.char) *C.char {
	socketPath := C.GoString(socketPathC)

	mutex.Lock()
	defer mutex.Unlock()

	if l, ok := listeners[socketPath]; ok {
		l.Close()
		delete(listeners, socketPath)
		// Tenta garantir a remoção do arquivo
		os.Remove(socketPath)
		return nil
	}

	return C.CString("Listener not found")
}

func acceptLoop(l net.Listener, callback C.OnMessageCallback) {
	defer l.Close()

	for {
		conn, err := l.Accept()
		if err != nil {
			// Erros aqui geralmente acontecem quando o servidor é fechado
			return
		}

		// Trata cada conexão em sua própria Goroutine
		go handleConnection(conn, callback)
	}
}

func handleConnection(conn net.Conn, callback C.OnMessageCallback) {
	defer conn.Close()
	
	// Lê dados do socket. 
	// Aqui estou lendo linha a linha (Scanner), mas você pode ajustar para ler bytes puros se preferir.
	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		text := scanner.Text()
		cText := C.CString(text)
		
		// Chama o callback do Node.js
		C.dispatch_message(callback, cText)
		
		// Libera a string C criada para evitar leak na memória do Go/C
		C.free(unsafe.Pointer(cText))
	}
}
