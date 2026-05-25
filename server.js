const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const urlModule = require('url');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

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

function collectBody(req, cb) {
  var parts = [];
  req.on('data', function(c) { parts.push(c) });
  req.on('end', function() { cb(Buffer.concat(parts)) });
}

function serveStatic(res, reqUrl) {
  var cleanUrl = reqUrl.split('?')[0];
  var fp = path.join(ROOT, cleanUrl);
  var ext = path.extname(fp).toLowerCase();
  fs.stat(fp, function(err, st) {
    if (err || !st.isFile()) {
      if (cleanUrl === '/' || cleanUrl === '') {
        var idx = path.join(ROOT, 'index.html');
        fs.readFile(idx, function(err2, data) {
          if (err2) {
            res.writeHead(500, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, CORS_HEADERS));
            res.end('Index not found');
            return;
          }
          res.writeHead(200, Object.assign({ 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' }, CORS_HEADERS));
          res.end(data);
        });
      } else {
        res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, CORS_HEADERS));
        res.end('Not found');
      }
      return;
    }
    var ct = MIME[ext] || 'application/octet-stream';
    fs.readFile(fp, function(err2, data) {
      if (err2) {
        res.writeHead(500, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, CORS_HEADERS));
        res.end('Read error');
        return;
      }
      res.writeHead(200, Object.assign({ 'Content-Type': ct, 'Cache-Control': 'no-cache' }, CORS_HEADERS));
      res.end(data);
    });
  });
}

var server = http.createServer(function(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.url.indexOf('/api/doubao/') === 0) {
    var target = req.url.replace('/api/doubao', 'https://openspeech.bytedance.com/api/v3/auc/bigmodel');
    var hdrs = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    if (req.headers['x-api-key']) hdrs['X-Api-Key'] = req.headers['x-api-key'];
    if (req.headers['x-api-resource-id']) hdrs['X-Api-Resource-Id'] = req.headers['x-api-resource-id'];
    if (req.headers['x-api-request-id']) hdrs['X-Api-Request-Id'] = req.headers['x-api-request-id'];
    if (req.headers['x-api-sequence']) hdrs['X-Api-Sequence'] = req.headers['x-api-sequence'];
    collectBody(req, function(body) { proxy(res, target, 'POST', hdrs, body) });
    return;
  }

  if (req.url.indexOf('/api/bailian/') === 0) {
    var target2 = req.url.replace('/api/bailian', 'https://dashscope.aliyuncs.com');
    var hdrs2 = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    if (req.headers['authorization']) hdrs2['Authorization'] = req.headers['authorization'];
    collectBody(req, function(body) { proxy(res, target2, 'POST', hdrs2, body) });
    return;
  }

  if (req.url.indexOf('/api/fangzhou/') === 0) {
    var target3 = req.url.replace('/api/fangzhou', 'https://ark.cn-beijing.volces.com');
    var hdrs3 = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    if (req.headers['authorization']) hdrs3['Authorization'] = req.headers['authorization'];
    collectBody(req, function(body) { proxy(res, target3, 'POST', hdrs3, body) });
    return;
  }

  if (req.url.indexOf('/api/proxy-url') === 0) {
    var p = urlModule.parse(req.url, true);
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

  serveStatic(res, req.url);
});

server.listen(PORT, function() {
  console.log('ASR 评估平台已启动: http://localhost:' + PORT + '/');
});
