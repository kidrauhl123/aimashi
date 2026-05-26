const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const AdmZip = require("adm-zip");
const { createSkillsLoader } = require("../src/main/skills-loader.js");

function makeLoader(home) {
  return createSkillsLoader({
    runtimePaths: () => ({ home }),
    readJson: () => null, // no official library → only the private source is active
    officialLibraryManifestPath: () => path.join(home, "does-not-exist.json"),
    resolveOfficialLibraryRoot: () => "",
    getEngineState: () => ({ running: false }),
    apiKey: () => "",
    appendEngineLog: () => {},
    isChildPath: (parent, child) =>
      path.resolve(String(child)).startsWith(path.resolve(String(parent)) + path.sep)
  });
}

// A multi-file skill package: SKILL.md + a nested script.
function makeZip() {
  const zip = new AdmZip();
  zip.addFile("SKILL.md", Buffer.from("---\nname: demo-skill\ndescription: A demo.\n---\n# Demo Skill\n"));
  zip.addFile("scripts/run.py", Buffer.from("print('hi')\n"));
  return zip.toBuffer();
}

test("installMarketplaceSkill extracts a multi-file zip into <home>/skills and it scans as 'mia'", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "mia-skills-loader-"));
  try {
    const loader = makeLoader(home);
    const library = await loader.installMarketplaceSkill({ id: "demo-skill", zipBuffer: makeZip() });

    const dir = path.join(home, "skills", "demo-skill");
    assert.ok(fs.existsSync(path.join(dir, "SKILL.md")), "SKILL.md extracted");
    assert.ok(fs.existsSync(path.join(dir, "scripts", "run.py")), "nested file extracted");

    const found = library.skills.find((s) => s.name === "demo-skill");
    assert.ok(found, "installed skill appears in local scan");
    assert.equal(found.source, "mia");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("re-installing replaces the dir cleanly (no stale files)", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "mia-skills-loader-"));
  try {
    const loader = makeLoader(home);
    await loader.installMarketplaceSkill({ id: "demo-skill", zipBuffer: makeZip() });
    // a v2 zip without the script
    const v2 = new AdmZip();
    v2.addFile("SKILL.md", Buffer.from("---\nname: demo-skill\n---\n# v2\n"));
    await loader.installMarketplaceSkill({ id: "demo-skill", zipBuffer: v2.toBuffer() });
    const dir = path.join(home, "skills", "demo-skill");
    assert.ok(!fs.existsSync(path.join(dir, "scripts", "run.py")), "stale file removed on re-install");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("an installed marketplace skill is deletable (private source)", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "mia-skills-loader-"));
  try {
    const loader = makeLoader(home);
    const library = await loader.installMarketplaceSkill({ id: "demo-skill", zipBuffer: makeZip() });
    const installed = library.skills.find((s) => s.name === "demo-skill");
    const after = await loader.deleteLocalSkill(installed.id);
    assert.ok(!after.skills.some((s) => s.name === "demo-skill"), "skill removed after delete");
    assert.ok(!fs.existsSync(path.join(home, "skills", "demo-skill")), "skill dir removed");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("installMarketplaceSkill rejects a missing package", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "mia-skills-loader-"));
  try {
    const loader = makeLoader(home);
    await assert.rejects(loader.installMarketplaceSkill({ id: "x" }), /zipBuffer required/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
