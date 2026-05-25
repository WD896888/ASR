const https = require('https');
const http = require('http');
const urlModule = require('url');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key, X-Api-Resource-Id, X-Api-Request-Id, X-Api-Sequence',
  'Access-Control-Expose-Headers': 'X-Api-Status-Code',
  'Access-Control-Max-Age': '86400'
};

function pipe(res, fromRes) {
  var h = {};
  Object.keys(fromRes.headers).forEach(function(k) {
    var lk = k.toLowerCase();
    if (lk !== 'transfer-encoding' && lk !== 'content-length') h[k] = fromRes.headers[k];
  });
  Object.assign(h, CORS_HEADERS);
  res.writeHead(fromRes.statusCode, h);
  fromRes.pipe(res);
}

function proxy(res, targetUrl, method, headers, body) {
  var parsed = urlModule.parse(targetUrl);
  var isHttps = parsed.protocol === 'https:';
  var lib = isHttps ? https : http;
  var opts = {
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: parsed.path,
    method: method,
    headers: headers
  };
  var preq = lib.request(opts, function(pres) {
    pipe(res, pres);
  });
  preq.on('error', function(e) {
    res.writeHead(502, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, CORS_HEADERS));
    res.end('Proxy error: ' + e.message);
  });
  if (body) preq.write(body);
  preq.end();
}

function collectBodyStream(req) {
  return new Promise(function(resolve) {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'string') resolve(Buffer.from(req.body));
      else if (Buffer.isBuffer(req.body)) resolve(req.body);
      else resolve(Buffer.from(JSON.stringify(req.body)));
      return;
    }
    var parts = [];
    req.on('data', function(chunk) { parts.push(chunk) });
    req.on('end', function() {
      var buf = Buffer.concat(parts);
      resolve(buf.length > 0 ? buf : null);
    });
    req.on('error', function() { resolve(null) });
  });
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const reqUrl = req.url;
  const body = await collectBodyStream(req);

  if (reqUrl.indexOf('/api/doubao/') === 0) {
    var target = reqUrl.replace('/api/doubao', 'https://openspeech.bytedance.com/api/v3/auc/bigmodel');
    var hdrs = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    if (req.headers['x-api-key']) hdrs['X-Api-Key'] = req.headers['x-api-key'];
    if (req.headers['x-api-resource-id']) hdrs['X-Api-Resource-Id'] = req.headers['x-api-resource-id'];
    if (req.headers['x-api-request-id']) hdrs['X-Api-Request-Id'] = req.headers['x-api-request-id'];
    if (req.headers['x-api-sequence']) hdrs['X-Api-Sequence'] = req.headers['x-api-sequence'];
    proxy(res, target, 'POST', hdrs, body);
    return;
  }

  if (reqUrl.indexOf('/api/bailian/') === 0) {
    var target2 = reqUrl.replace('/api/bailian', 'https://dashscope.aliyuncs.com');
    var hdrs2 = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    if (req.headers['authorization']) hdrs2['Authorization'] = req.headers['authorization'];
    proxy(res, target2, 'POST', hdrs2, body);
    return;
  }

  if (reqUrl.indexOf('/api/fangzhou/') === 0) {
    var target3 = reqUrl.replace('/api/fangzhou', 'https://ark.cn-beijing.volces.com');
    var hdrs3 = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    if (req.headers['authorization']) hdrs3['Authorization'] = req.headers['authorization'];
    proxy(res, target3, 'POST', hdrs3, body);
    return;
  }

  if (reqUrl.indexOf('/api/proxy-url') === 0) {
    var p = urlModule.parse(reqUrl, true);
    var extUrl = p.query.url;
    if (!extUrl) {
      res.writeHead(400, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, CORS_HEADERS));
      res.end('Missing url parameter');
      return;
    }
    var extParsed = urlModule.parse(extUrl);
    proxy(res, extUrl, 'GET', { 'Host': extParsed.hostname }, null);
    return;
  }

  res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, CORS_HEADERS));
  res.end('Not found');
};
