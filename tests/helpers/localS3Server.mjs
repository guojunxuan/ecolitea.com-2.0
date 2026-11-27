import http from 'node:http'

const port = Number.parseInt(process.env.E2E_STORAGE_PORT ?? '9001', 10)

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('E2E_STORAGE_PORT must be an unprivileged TCP port.')
}

const server = http.createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('ok')
    return
  }

  request.resume()
  request.on('end', () => {
    response.writeHead(200, { 'content-type': 'application/xml' })
    response.end('<Response/>')
  })
})

server.listen(port, '127.0.0.1')
