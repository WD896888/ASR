const https = require('https');
const urlModule = require('url');

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

function proxyRequest(targetUrl, method, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = urlModule.parse(targetUrl);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.path,
      method,
      headers
    };

    const preq = https.request(opts, (pres) => {
      const chunks = [];
      pres.on('data', (chunk) => chunks.push(chunk));
      pres.on('end', () => {
        resolve({
          statusCode: pres.statusCode,
          headers: pres.headers,
          body: Buffer.concat(chunks)
        });
      });
    });

    preq.on('error', reject);
    if (body) preq.write(body);
    preq.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const target = req.url.replace('/api/doubao', 'https://openspeech.bytedance.com/api/v3/auc/bigmodel');
  const headers = {
    'Content-Type': req.headers['content-type'] || 'application/json',
  };
  if (req.headers['x-api-key']) headers['X-Api-Key'] = req.headers['x-api-key'];
  if (req.headers['x-api-resource-id']) headers['X-Api-Resource-Id'] = req.headers['x-api-resource-id'];
  if (req.headers['x-api-request-id']) headers['X-Api-Request-Id'] = req.headers['x-api-request-id'];
  if (req.headers['x-api-sequence']) headers['X-Api-Sequence'] = req.headers['x-api-sequence'];

  const body = await collectBody(req);

  try {
    const result = await proxyRequest(target, 'POST', headers, body);
    const responseHeaders = { ...CORS_HEADERS };
    Object.keys(result.headers).forEach((k) => {
      const lk = k.toLowerCase();
      if (lk !== 'transfer-encoding' && lk !== 'content-length') {
        responseHeaders[k] = result.headers[k];
      }
    });
    res.writeHead(result.statusCode, responseHeaders);
    res.end(result.body);
  } catch (error) {
    res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Proxy error', message: error.message }));
  }
};
