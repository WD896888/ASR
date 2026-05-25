const https = require('https');
const http = require('http');
const url = require('url');

const TARGET = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit';

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

function proxyRequest(res, method, headers, body) {
  const parsed = url.parse(TARGET);
  const opts = {
    hostname: parsed.hostname,
    port: parsed.port || 443,
    path: parsed.path,
    method: method,
    headers: headers
  };

  const preq = https.request(opts, (pres) => {
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

  const fwdHeaders = {
    'Content-Type': req.headers['content-type'] || 'application/json',
  };

  if (req.headers['x-api-key']) fwdHeaders['X-Api-Key'] = req.headers['x-api-key'];
  if (req.headers['x-api-resource-id']) fwdHeaders['X-Api-Resource-Id'] = req.headers['x-api-resource-id'];
  if (req.headers['x-api-request-id']) fwdHeaders['X-Api-Request-Id'] = req.headers['x-api-request-id'];
  if (req.headers['x-api-sequence']) fwdHeaders['X-Api-Sequence'] = req.headers['x-api-sequence'];

  const body = await collectBody(req);
  proxyRequest(res, 'POST', fwdHeaders, body);
};
