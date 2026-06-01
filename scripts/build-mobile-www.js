#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const out = path.join(root, "dist", "mobile-www");

const SHARED = [
  "conversation-kinds", "message-spec", "contact", "avatar-resolve",
  "unread", "send-pipeline", "agent-permissions", "trace-blocks", "cloud-client"
];

function copy(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// 视图层
["index.html", "styles.css", "app.js", "manifest.json"].forEach((f) => {
  const src = path.join(root, "src", "mobile", f);
  if (fs.existsSync(src)) copy(src, path.join(out, f));
});
// lib
for (const f of fs.readdirSync(path.join(root, "src", "mobile", "lib"))) {
  copy(path.join(root, "src", "mobile", "lib", f), path.join(out, "lib", f));
}
// shared
for (const name of SHARED) copy(path.join(root, "src", "shared", `${name}.js`), path.join(out, "shared", `${name}.js`));
// 渲染适配器
copy(
  path.join(root, "src", "renderer", "message-sources", "cloud-conversation-source.js"),
  path.join(out, "message-sources", "cloud-conversation-source.js")
);

console.log(`[build-mobile-www] wrote ${out}`);
