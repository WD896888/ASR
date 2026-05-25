const https = require('https');
const http = require('http');
const url = require('url');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key, X-Api-Resource-Id, X-Api-Request-Id, X-Api-Sequence',
  'Access-Control-Expose-Headers': 'X-Api-Status-Code',
  'Access-Control-Max-Age': '86400'
};

function proxyRequest(res, targetUrl, body) {
  const parsed = url.parse(targetUrl);
  const isHttps = parsed.protocol === 'https:';
  const lib = isHttps ? https : http;

  const opts = {
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: parsed.path,
    method: 'GET',
    headers: { 'Host': parsed.hostname }
  };

  const preq = lib.request(opts, (pres) => {
    const h = {};
    Object.keys(pres.headers).forEach((k) => {
      const lk = k.toLowerCase();
      if (lk !== 'transfer-encoding' && lk !== 'content-length') {
        h[k] = pres.headers[k];
      }
    });
    Object.assign(h, CORS_HEADERS);
    res.writeHead(pres.statusCode, h);
    pres.pipe(res);
  });

  preq.on('error', (e) => {
    res.writeHead(502, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, CORS_HEADERS));
    res.end('Proxy error: ' + e.message);
  });

  if (body) preq.write(body);
  preq.end();
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);
  const extUrl = parsed.query.url;

  if (!extUrl) {
    res.writeHead(400, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, CORS_HEADERS));
    res.end('Missing url parameter');
    return;
  }

  proxyRequest(res, extUrl, null);
};
