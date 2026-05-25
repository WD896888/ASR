const https = require('https');
const http = require('http');
const url = require('url');

const TARGET_BASE = 'https://dashscope.aliyuncs.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key, X-Api-Resource-Id, X-Api-Request-Id, X-Api-Sequence',
  'Access-Control-Expose-Headers': 'X-Api-Status-Code',
  'Access-Control-Max-Age': '86400'
};

function collectBody(req) {
  return new Promise((resolve) => {
    const parts = [];
    req.on('data', (c) => parts.push(c));
    req.on('end', () => resolve(Buffer.concat(parts)));
  });
}

function proxyRequest(res, targetPath, method, headers, body) {
  const fullUrl = TARGET_BASE + targetPath;
  const parsed = url.parse(fullUrl);
  const isHttps = parsed.protocol === 'https:';
  const lib = isHttps ? https : http;

  const opts = {
    hostname: parsed.hostname,
    port: parsed.port || 443,
    path: parsed.path,
    method: method,
    headers: headers
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

  const targetPath = req.url.replace(/^\/api\/bailian/, '') || '/';

  const fwdHeaders = {
    'Content-Type': req.headers['content-type'] || 'application/json',
  };

  if (req.headers['authorization']) fwdHeaders['Authorization'] = req.headers['authorization'];

  const body = await collectBody(req);
  proxyRequest(res, targetPath, 'POST', fwdHeaders, body);
};
