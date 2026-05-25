const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
  '.flac': 'audio/flac',
  '.opus': 'audio/opus',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

module.exports = async function handler(req, res) {
  const cleanUrl = req.url.split('?')[0];
  
  if (cleanUrl === '/' || cleanUrl === '') {
    const idx = path.join(ROOT, 'index.html');
    try {
      const data = fs.promises.readFile(idx);
      res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
      res.end(await data);
    } catch {
      res.writeHead(500, { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Index not found');
    }
    return;
  }

  const fp = path.join(ROOT, cleanUrl);
  const ext = path.extname(fp).toLowerCase();
  const ct = MIME[ext] || 'application/octet-stream';

  try {
    const data = fs.promises.readFile(fp);
    const stat = fs.promises.stat(fp);
    await stat;
    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': ct, 'Cache-Control': 'no-cache' });
    res.end(await data);
  } catch {
    res.writeHead(404, { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
};
