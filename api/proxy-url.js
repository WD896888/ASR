const http = require('http');
const https = require('https');
const urlModule = require('url');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function proxyRequest(targetUrl, method, headers) {
  return new Promise((resolve, reject) => {
    const parsed = urlModule.parse(targetUrl);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.path,
      method,
      headers
    };

    const preq = lib.request(opts, (pres) => {
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
    preq.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const p = urlModule.parse(req.url, true);
  const extUrl = p.query.url;
  
  if (!extUrl) {
    res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Missing url parameter');
    return;
  }

  const extParsed = urlModule.parse(extUrl);

  try {
    const result = await proxyRequest(extUrl, 'GET', { 'Host': extParsed.hostname });
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
