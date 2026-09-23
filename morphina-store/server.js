/**
 * Morphina Store — minimal static dev server (zero dependencies)
 * ---------------------------------------------------------------------------
 * Usage:  npm start   (or:  node server.js)
 * Serves the repository root at http://localhost:PORT
 *
 * A static host (Netlify / Vercel / GitHub Pages / any S3 or nginx) can serve
 * the same `index.html` + `styles.css` + `app.js` + `assets/` directly — this
 * file is ONLY for local development convenience.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// Basic, safe MIME map for the file types the project uses.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  // Strip query string, decode, and prevent directory traversal.
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  const filePath = path.normalize(path.join(ROOT, url));
  if (!filePath.startsWith(ROOT)) {          // path traversal guard
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  ▶ Morphina Store running at  http://localhost:${PORT}\n`);
});
