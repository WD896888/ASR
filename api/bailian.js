const https = require('https');
const urlModule = require('url');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

  const target = req.url.replace('/api/bailian', 'https://dashscope.aliyuncs.com');
  const headers = {
    'Content-Type': req.headers['content-type'] || 'application/json',
  };
  if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'];

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
