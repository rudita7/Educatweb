const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.end('ok');
});

server.listen(PORT, () => {
  console.log(`minimal test server listening on port ${PORT}`);
});
