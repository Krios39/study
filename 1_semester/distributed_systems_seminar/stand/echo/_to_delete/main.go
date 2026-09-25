// Эхо-сервис для замеров: околонулевое время обработки, размер ответа задаётся клиентом.
//
//   GET  /echo?size=N[&delay=MS]  -> N байт (по умолчанию 1024, максимум 4 MiB), опц. задержка MS мс
//   POST /echo[?delay=MS]         -> тело запроса как есть
//   GET  /health                  -> ok
package main

import (
	"io"
	"log"
	"net/http"
	"strconv"
	"time"
)

const maxSize = 4 << 20

var payload = make([]byte, maxSize)

func delay(r *http.Request) {
	if ms, err := strconv.Atoi(r.URL.Query().Get("delay")); err == nil && ms > 0 {
		time.Sleep(time.Duration(ms) * time.Millisecond)
	}
}

func echo(w http.ResponseWriter, r *http.Request) {
	delay(r)
	switch r.Method {
	case http.MethodPost, http.MethodPut:
		if ct := r.Header.Get("Content-Type"); ct != "" {
			w.Header().Set("Content-Type", ct)
		}
		if r.ContentLength >= 0 {
			w.Header().Set("Content-Length", strconv.FormatInt(r.ContentLength, 10))
		}
		io.Copy(w, r.Body)
	default:
		n, err := strconv.Atoi(r.URL.Query().Get("size"))
		if err != nil || n <= 0 {
			n = 1024
		}
		if n > maxSize {
			n = maxSize
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Length", strconv.Itoa(n))
		w.Write(payload[:n])
	}
}

func main() {
	for i := range payload {
		payload[i] = 'a' + byte(i%26)
	}
	http.HandleFunc("/echo", echo)
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
	log.Println("echo listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
