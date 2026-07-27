const http = require('http');

function timedRequire(name) {
  const start = Date.now();
  console.log(`requiring ${name}...`);
  const mod = require(name);
  console.log(`  -> ${name} loaded in ${Date.now() - start}ms`);
  return mod;
}

timedRequire('express');
timedRequire('cors');
timedRequire('dotenv');
timedRequire('drizzle-orm/postgres-js');
timedRequire('postgres');
timedRequire('@supabase/supabase-js');
timedRequire('bcryptjs');
timedRequire('multer');

console.log('all dependencies loaded successfully');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.end('ok');
});

server.listen(PORT, () => {
  console.log(`deps test server listening on port ${PORT}`);
});
