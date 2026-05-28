const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("web root is a landing page with download and app entry points", () => {
  const html = read("src/web/index.html");
  const css = read("src/web/landing.css");
  const js = read("src/web/landing.js");

  assert.match(html, /data-page="landing"/);
  assert.match(html, /href="\.\/landing\.css"/);
  assert.match(html, /src="\.\/landing\.js" defer/);
  assert.match(html, /<h1[^>]*>\s*把 Claude Code、Codex 变成你的 AI 伙伴。\s*<\/h1>/);
  assert.match(html, /Mia Workspace/);
  assert.match(html, /class="[^"]*\bproduct-scene\b[^"]*"/);
  assert.match(html, /class="[^"]*\bpermission-sheet\b[^"]*"/);
  assert.match(html, /class="[^"]*\bvisual-strip\b[^"]*"/);
  assert.match(html, /class="[^"]*\bengine-dock\b[^"]*"/);
  assert.match(html, /assets\/engine-icons\/codex-color\.svg/);
  assert.match(css, /assets\/engine-icons\/claudecode\.svg/);
  assert.match(css, /assets\/engine-icons\/hermesagent\.svg/);
  assert.match(html, /class="landing-progress"/);
  assert.match(html, /class="[^"]*\bworkflow-section\b[^"]*"/);
  assert.match(html, /data-scroll-stage="1"/);
  assert.match(html, /data-stage-target="approve"/);
  assert.match(html, /data-parallax/);
  assert.match(css, /overflow-y: auto/);
  assert.match(css, /--landing-scroll/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /#5e5ce6/);
  assert.match(css, /#30d158/);
  assert.doesNotMatch(css, /--amber|#ff8a1f|#f6851b|#e2761b/i);
  assert.match(js, /requestAnimationFrame/);
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(html, /href="\/downloads\/mia-macos-arm64-latest\.dmg"/);
  assert.match(html, /download="Mia-macOS-Apple-Silicon\.dmg"/);
  assert.match(html, /href="\/app\/"/);
  assert.match(html, />\s*打开 Mia Web\s*</);
  assert.match(html, /多个 AI 伙伴/);
  assert.match(html, /兼容多 Agent 内核/);
  assert.match(html, /桌面端和 Web 互通/);
  assert.match(html, /舒服的前端 GUI/);
  assert.match(html, /像聊天一样调度 Agent/);
  assert.match(html, /Claude Code\s*\/\s*Codex/);
  assert.match(html, /Hermes packaged\. Claude Code and Codex stay yours\./);
  assert.match(html, /权限先问，再执行/);
  assert.match(html, /多端互通，不等于云端接管/);
  assert.match(html, /macOS Apple Silicon/);
  assert.match(html, /macOS Intel[\s\S]*?即将支持/);
  assert.match(html, /Windows[\s\S]*?即将支持/);
});

test("web app shell lives under /app and keeps parent-relative assets", () => {
  const html = read("src/web/app/index.html");

  assert.match(html, /data-auth="loading"/);
  assert.match(html, /id="loginForm"/);
  assert.match(html, /href="\.\.\/styles\.css"/);
  assert.match(html, /src="\.\.\/shared\/unread\.js/);
  assert.match(html, /src="\.\.\/helpers\/markdown-helpers\.js/);
  assert.match(html, /src="\.\.\/appearance\.js/);
  assert.match(html, /src="\.\.\/app\.js/);
  assert.doesNotMatch(html, /href="\.\/styles\.css"/);
  assert.doesNotMatch(html, /src="\.\/app\.js/);
});

test("cloud release builder can publish the Apple Silicon DMG as a web download", () => {
  const source = read("scripts/build-cloud-release.js");

  assert.match(source, /mia-macos-arm64-latest\.dmg/);
  assert.match(source, /Mia-\*-arm64-unsigned\.dmg/);
  assert.match(source, /copyDesktopDownloadArtifacts/);
  assert.match(source, /web\/landing\.css/);
  assert.match(source, /web\/landing\.js/);
});
