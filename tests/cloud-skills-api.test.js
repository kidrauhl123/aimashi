const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { freePort } = require("./helpers/free-port");

async function startServer() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mia-skills-test-"));
  const port = await freePort();
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ["scripts/serve-cloud.js"], {
      env: {
        ...process.env,
        MIA_CLOUD_HOST: "127.0.0.1",
        MIA_CLOUD_PORT: String(port),
        MIA_CLOUD_DATA: tmpDir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let resolved = false;
    const done = () => { if (!resolved) { resolved = true; resolve({ proc, port, tmpDir }); } };
    proc.stdout.on("data", (chunk) => { if (/listening|Listening/.test(chunk.toString())) done(); });
    proc.stderr.on("data", (chunk) => { if (/listening|Listening|mia-cloud/i.test(chunk.toString())) done(); });
    proc.on("error", reject);
    setTimeout(done, 1500);
  });
}

async function stopServer(ctx) {
  if (ctx.proc.exitCode === null && ctx.proc.signalCode === null) {
    ctx.proc.kill("SIGTERM");
    await new Promise((r) => ctx.proc.once("exit", r));
  }
  fs.rmSync(ctx.tmpDir, { recursive: true, force: true });
}

function api(port, method, pathStr, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: "127.0.0.1", port, path: pathStr, method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: "Bearer " + token } : {}),
      },
    }, (res) => {
      let chunks = "";
      res.on("data", (c) => { chunks += c; });
      res.on("end", () => {
        let parsed = null;
        try { parsed = JSON.parse(chunks); } catch { parsed = chunks; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function register(port, username) {
  const r = await api(port, "POST", "/api/auth/register", { body: { username, password: "Pa55word!" } });
  if (r.status !== 201) throw new Error("register failed: " + JSON.stringify(r));
  const login = await api(port, "POST", "/api/auth/login", { body: { username, password: "Pa55word!" } });
  return { user: login.body.user, token: login.body.token };
}

test("GET /api/skills lists seeded catalog with categories, no body", async () => {
  const ctx = await startServer();
  try {
    const alice = await register(ctx.port, "alice");
    const r = await api(ctx.port, "GET", "/api/skills", { token: alice.token });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.skills) && r.body.skills.length >= 3);
    assert.ok(Array.isArray(r.body.categories) && r.body.categories.length >= 1);
    const one = r.body.skills.find((s) => s.id === "commit-craft");
    assert.ok(one, "seeded commit-craft present");
    assert.equal(one.installCount, 0, "install count starts honest at 0");
    assert.equal(one.body, undefined, "list payload omits body");
  } finally { await stopServer(ctx); }
});

test("GET /api/skills requires auth", async () => {
  const ctx = await startServer();
  try {
    const r = await api(ctx.port, "GET", "/api/skills");
    assert.equal(r.status, 401);
  } finally { await stopServer(ctx); }
});

test("GET /api/skills?category= filters", async () => {
  const ctx = await startServer();
  try {
    const alice = await register(ctx.port, "alice");
    const r = await api(ctx.port, "GET", "/api/skills?category=" + encodeURIComponent("生活日常"), { token: alice.token });
    assert.equal(r.status, 200);
    assert.ok(r.body.skills.length >= 1);
    assert.ok(r.body.skills.every((s) => s.category === "生活日常"));
  } finally { await stopServer(ctx); }
});

test("GET /api/skills/:id returns listing + latest version meta (no raw body)", async () => {
  const ctx = await startServer();
  try {
    const alice = await register(ctx.port, "alice");
    const r = await api(ctx.port, "GET", "/api/skills/commit-craft", { token: alice.token });
    assert.equal(r.status, 200);
    assert.equal(r.body.skill.id, "commit-craft");
    assert.equal(r.body.skill.latestVersion, "1.0.0");
    assert.ok(r.body.skill.version && r.body.skill.version.checksum, "carries a packaged version");
    assert.equal(r.body.skill.body, undefined, "detail no longer ships a raw body");
  } finally { await stopServer(ctx); }
});

test("POST install bumps count once per user, returns download info; package downloads", async () => {
  const ctx = await startServer();
  try {
    const alice = await register(ctx.port, "alice");
    const bob = await register(ctx.port, "bob");

    const i1 = await api(ctx.port, "POST", "/api/skills/commit-craft/install", { token: alice.token });
    assert.equal(i1.status, 200);
    assert.equal(i1.body.skill.installCount, 1);
    assert.ok(i1.body.download && i1.body.download.url && i1.body.download.checksum, "install returns package download info");

    // the package itself downloads (zip bytes, 200)
    const pkg = await api(ctx.port, "GET", i1.body.download.url, { token: alice.token });
    assert.equal(pkg.status, 200);

    // same user re-installs → idempotent, no inflation
    const i2 = await api(ctx.port, "POST", "/api/skills/commit-craft/install", { token: alice.token });
    assert.equal(i2.body.skill.installCount, 1);

    // a different user → count grows
    const i3 = await api(ctx.port, "POST", "/api/skills/commit-craft/install", { token: bob.token });
    assert.equal(i3.body.skill.installCount, 2);
  } finally { await stopServer(ctx); }
});

test("POST /api/skills/:id/install → 404 for unknown skill", async () => {
  const ctx = await startServer();
  try {
    const alice = await register(ctx.port, "alice");
    const r = await api(ctx.port, "POST", "/api/skills/nope_not_real/install", { token: alice.token });
    assert.equal(r.status, 404);
  } finally { await stopServer(ctx); }
});
