const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const AdmZip = require("adm-zip");
const { packageBody, packageDir, sha256 } = require("../src/cloud/skill-packages.js");

test("packageBody writes a one-file zip with a sha256 checksum", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mia-pkg-"));
  try {
    const dest = path.join(dir, "x", "1.0.0.zip");
    const r = packageBody("# Hi", dest);
    assert.equal(r.fileCount, 1);
    assert.equal(r.entryPath, "SKILL.md");
    assert.equal(r.checksum.length, 64);
    assert.ok(fs.existsSync(dest));
    assert.equal(sha256(fs.readFileSync(dest)), r.checksum);
    assert.deepEqual(new AdmZip(dest).getEntries().map((e) => e.entryName), ["SKILL.md"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("packageDir zips a multi-file skill (the whole point of the new model)", () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), "mia-pkg-src-"));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "mia-pkg-out-"));
  try {
    fs.writeFileSync(path.join(src, "SKILL.md"), "# Skill");
    fs.mkdirSync(path.join(src, "scripts"));
    fs.writeFileSync(path.join(src, "scripts", "run.py"), "print(1)");
    const dest = path.join(out, "pkg.zip");
    const r = packageDir(src, dest);
    assert.ok(r.fileCount >= 2, "multiple files packaged");
    const entries = new AdmZip(dest).getEntries().map((e) => e.entryName);
    assert.ok(entries.includes("SKILL.md"));
    assert.ok(entries.some((e) => e.endsWith("run.py")), "nested script included");
  } finally {
    fs.rmSync(src, { recursive: true, force: true });
    fs.rmSync(out, { recursive: true, force: true });
  }
});
