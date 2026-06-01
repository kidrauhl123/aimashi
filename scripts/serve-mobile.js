#!/usr/bin/env node
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.join(__dirname, "..", "dist", "mobile-www");
const host = process.env.MIA_MOBILE_HOST || "127.0.0.1";
const port = Number(process.env.MIA_MOBILE_PORT || 4180);
const apiTarget = process.env.MIA_MOBILE_API_TARGET || "http://127.0.0.1:4175";

function contentType(p) {
  const e = path.extname(p).toLowerCase();
  return { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"application/javascript; charset=utf-8",
    ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png" }[e] || "application/octet-stream";
}

const server = http.createServer((req, res) => {
  if (String(req.url || "").startsWith("/api/")) {
    const target = new URL(req.url, apiTarget);
    const proxy = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host } },
      (up) => { res.writeHead(up.statusCode || 502, up.headers); up.pipe(res); });
    proxy.on("error", (e) => { res.writeHead(502, { "Content-Type":"application/json" }); res.end(JSON.stringify({ error: e.message })); });
    req.pipe(proxy);
    return;
  }
  const rel = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = path.normalize(path.join(root, rel === "/" ? "index.html" : rel.replace(/^\/+/, "")));
  if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, "index.html");
  const body = fs.readFileSync(file);
  res.writeHead(200, { "Content-Type": contentType(file), "Content-Length": body.length });
  res.end(body);
});
server.listen(port, host, () => console.log(`[serve-mobile] http://${host}:${port} (api→${apiTarget})`));
