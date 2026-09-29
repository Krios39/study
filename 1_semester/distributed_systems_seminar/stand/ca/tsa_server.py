#!/usr/bin/python3
# Замена /home/ca/TSA/tsa_server.py из образа testca (монтируется через docker-compose.yml).
# Оригинал — однопоточный http.server.HTTPServer + один openssl на запрос: ~50 меток/с, под synctsa при
# 16–32 VU очередь превышает 60-секундный таймаут nginx, а после перегрузки сервер оставался висеть.
# Здесь: многопоточный сервер, до TSA_WORKERS параллельных openssl, у каждого worker'а свой файл serial
# (нет гонки за serial), таймаут на openssl, лишние запросы ждут свободного worker'а.
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import subprocess, tempfile, sys, os, re, time, queue

WORKERS = int(os.environ.get('TSA_WORKERS', '4'))
BASE_CNF = '/home/ca/TSA/TSA.cnf'
slots = queue.Queue()

with open(BASE_CNF) as f:
    base = f.read()
for k in range(WORKERS):
    cnf, ser = f'/tmp/tsa-{k}.cnf', f'/tmp/tsa-serial-{k}'
    with open(cnf, 'w') as f:
        f.write(re.sub(r'^(\s*serial\s*=).*$', rf'\1 {ser}', base, flags=re.M))
    if not os.path.exists(ser):
        with open(ser, 'w') as f:                      # уникально между worker'ами и рестартами
            f.write('%X\n' % ((int(time.time() * 1000) << 4) | k))
    slots.put(cnf)


class TSHandler(BaseHTTPRequestHandler):
    def log_message(self, *a):                          # доступ пишет nginx
        pass

    def do_POST(self):
        length = int(self.headers.get('content-length', 0))
        if length > 100000 or self.headers.get('content-type', '').lower() != 'application/timestamp-query':
            self.send_error(400)
            return
        if self.headers.get('expect', '').lower() == '100-continue':
            self.send_response(100)
            self.end_headers()
        data = self.rfile.read(length)
        cnf = slots.get()
        try:
            with tempfile.NamedTemporaryFile() as t:
                t.write(data)
                t.flush()
                p = subprocess.run(['openssl', 'ts', '-reply', '-config', cnf, '-queryfile', t.name],
                                   capture_output=True, timeout=20)
        except subprocess.TimeoutExpired:
            sys.stderr.write('tsa: openssl timeout\n')
            self.send_error(504)
            return
        finally:
            slots.put(cnf)
        if p.returncode == 0:
            self.send_response(200, 'OK')
            self.send_header('Content-Type', 'application/timestamp-response')
            self.send_header('Content-Length', str(len(p.stdout)))
            self.end_headers()
            self.wfile.write(p.stdout)
        else:
            sys.stderr.buffer.write(p.stderr)
            self.send_error(400)

    def send_error(self, code, *a):
        self.send_response(code)
        self.end_headers()


if __name__ == '__main__':
    print(f'tsa_server: {WORKERS} workers', flush=True)
    ThreadingHTTPServer.daemon_threads = True
    ThreadingHTTPServer(('localhost', 9999), TSHandler).serve_forever()
