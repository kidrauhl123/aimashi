const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const AdmZip = require("adm-zip");
const { createHermesSkillsSource } = require("../src/cloud/hermes-skills-source.js");

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function bufferResponse(value, status = 200) {
  return new Response(value, {
    status,
    headers: { "content-type": "application/zip" }
  });
}

function makeIndex(skills) {
  return {
    version: 1,
    generated_at: "2026-05-28T03:27:06.731039+00:00",
    skill_count: skills.length,
    skills
  };
}

function makeArchive(entries) {
  const zip = new AdmZip();
  for (const [entry, body] of Object.entries(entries)) {
    zip.addFile(entry, Buffer.from(body));
  }
  return zip.toBuffer();
}

function makeFetch(routes) {
  return async (url) => {
    const key = String(url);
    if (!(key in routes)) {
      return new Response(`unexpected url: ${key}`, { status: 404 });
    }
    const value = routes[key];
    return typeof value === "function" ? value(key) : value;
  };
}

test("Hermes remote catalog preserves upstream source labels and safe Mia ids", async () => {
  const indexUrl = "https://example.test/skills-index.json";
  const source = createHermesSkillsSource({
    indexUrl,
    fetchImpl: makeFetch({
      [indexUrl]: jsonResponse(makeIndex([
        {
          name: "1password",
          description: "Hermes bundled skill",
          source: "official",
          identifier: "official/security/1password",
          trust_level: "builtin",
          repo: "",
          path: "security/1password",
          tags: ["security"],
          extra: {}
        },
        {
          name: "demo-github",
          description: "GitHub backed skill",
          source: "github",
          identifier: "owner/repo/skills/demo-github",
          trust_level: "community",
          repo: "owner/repo",
          path: "skills/demo-github",
          tags: ["software"],
          extra: {}
        },
        {
          name: "shop-flow",
          description: "Browser automation skill",
          source: "browse-sh",
          identifier: "browse-sh/example.com/shop-flow-abcd12",
          trust_level: "community",
          repo: "",
          path: "",
          tags: ["shopping"],
          extra: { category: "shopping", install_count: 18, slug: "example.com/shop-flow-abcd12" }
        }
      ]))
    })
  });

  const { skills, categories } = await source.listSkills({ limit: 10 });

  assert.equal(skills.length, 3);
  assert.ok(skills.every((skill) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(skill.id)), "market ids are filesystem-safe");
  assert.deepEqual(skills.map((skill) => skill.sourceLabel), ["Hermes", "GitHub", "browse.sh"]);
  assert.equal(skills[0].ownerLabel, "Hermes");
  assert.equal(skills[1].ownerLabel, "GitHub");
  assert.equal(skills[1].upstreamId, "owner/repo/skills/demo-github");
  assert.ok(categories.some((entry) => entry.category === "Hermes"));
  assert.ok(categories.some((entry) => entry.category === "GitHub"));
  assert.ok(categories.some((entry) => entry.category === "browse.sh"));
});

test("Hermes remote catalog default limit covers the full hub scale", async () => {
  const indexUrl = "https://example.test/skills-index.json";
  const source = createHermesSkillsSource({
    indexUrl,
    fetchImpl: makeFetch({
      [indexUrl]: jsonResponse(makeIndex(Array.from({ length: 2105 }, (_item, index) => ({
        name: `skill-${index}`,
        description: "Large public hub entry",
        source: "skills-sh",
        identifier: `skills-sh/example/skill-${index}`,
        trust_level: "community",
        repo: "example/skills",
        path: `skills/skill-${index}`,
        tags: [],
        extra: {}
      }))))
    })
  });

  const { skills } = await source.listSkills();

  assert.equal(skills.length, 2105);
});

test("Hermes Claude Marketplace collection expands Anthropic repo skills", async () => {
  const indexUrl = "https://example.test/skills-index.json";
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mia-hermes-source-"));
  try {
    const archiveUrl = "https://codeload.github.com/anthropics/skills/zip/HEAD";
    const archive = makeArchive({
      "skills-main/README.md": "outside",
      "skills-main/skills/frontend-design/SKILL.md": "---\nname: frontend-design\ndescription: Design frontend UI.\n---\n# Frontend\n",
      "skills-main/skills/frontend-design/references/style.md": "# Style\n",
      "skills-main/skills/docx/SKILL.md": "---\nname: docx\ndescription: Work with Word documents.\n---\n# DOCX\n",
      "skills-main/template/SKILL.md": "---\nname: template\n---\n# Template\n"
    });
    const source = createHermesSkillsSource({
      indexUrl,
      dataDir: tmpDir,
      fetchImpl: makeFetch({
        [indexUrl]: jsonResponse(makeIndex([
          {
            name: "document-skills",
            description: "Collection of Claude document and example skills",
            source: "claude-marketplace",
            identifier: "anthropics/skills/",
            trust_level: "trusted",
            repo: "anthropics/skills",
            path: "",
            tags: [],
            extra: {}
          }
        ])),
        [archiveUrl]: () => bufferResponse(archive)
      })
    });

    const { skills, categories } = await source.listSkills({ limit: 10 });
    assert.deepEqual(skills.map((skill) => skill.name).sort(), ["docx", "frontend-design"]);
    assert.ok(skills.every((skill) => skill.sourceLabel === "Claude"));
    assert.ok(skills.every((skill) => skill.ownerLabel === "Claude"));
    assert.ok(skills.every((skill) => skill.category === "Claude"));
    assert.ok(skills.every((skill) => skill.upstreamRepo === "anthropics/skills"));
    assert.deepEqual(
      skills.map((skill) => skill.upstreamId).sort(),
      ["anthropics/skills/skills/docx", "anthropics/skills/skills/frontend-design"]
    );
    assert.ok(categories.some((entry) => entry.category === "Claude" && entry.count === 2));

    const frontend = skills.find((skill) => skill.name === "frontend-design");
    const prepared = await source.prepareInstall(frontend.id);
    const pkg = new AdmZip(fs.readFileSync(prepared.packagePath));
    assert.deepEqual(
      pkg.getEntries().filter((entry) => !entry.isDirectory).map((entry) => entry.entryName).sort(),
      ["SKILL.md", "references/style.md"]
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Hermes GitHub-backed skill installs from a real repository archive subset", async () => {
  const indexUrl = "https://example.test/skills-index.json";
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mia-hermes-source-"));
  try {
    const archiveUrl = "https://codeload.github.com/owner/repo/zip/HEAD";
    const source = createHermesSkillsSource({
      indexUrl,
      dataDir: tmpDir,
      fetchImpl: makeFetch({
        [indexUrl]: jsonResponse(makeIndex([
          {
            name: "demo-github",
            description: "GitHub backed skill",
            source: "github",
            identifier: "owner/repo/skills/demo-github",
            trust_level: "community",
            repo: "owner/repo",
            path: "skills/demo-github",
            tags: [],
            extra: {}
          }
        ])),
        [archiveUrl]: bufferResponse(makeArchive({
          "repo-main/README.md": "outside",
          "repo-main/skills/demo-github/SKILL.md": "---\nname: demo-github\n---\n# Demo\n",
          "repo-main/skills/demo-github/references/api.md": "# API\n"
        }))
      })
    });
    const { skills } = await source.listSkills({ limit: 10 });

    const prepared = await source.prepareInstall(skills[0].id);
    assert.equal(prepared.skill.sourceLabel, "GitHub");
    assert.equal(prepared.download.entryPath, "SKILL.md");
    assert.match(prepared.download.checksum, /^[a-f0-9]{64}$/);
    assert.ok(fs.existsSync(prepared.packagePath));

    const pkg = new AdmZip(fs.readFileSync(prepared.packagePath));
    assert.deepEqual(
      pkg.getEntries().filter((entry) => !entry.isDirectory).map((entry) => entry.entryName).sort(),
      ["SKILL.md", "references/api.md"]
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Hermes browse.sh skill installs from the browse.sh detail endpoint", async () => {
  const indexUrl = "https://example.test/skills-index.json";
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mia-hermes-source-"));
  try {
    const source = createHermesSkillsSource({
      indexUrl,
      dataDir: tmpDir,
      fetchImpl: makeFetch({
        [indexUrl]: jsonResponse(makeIndex([
          {
            name: "shop-flow",
            description: "Browser automation skill",
            source: "browse-sh",
            identifier: "browse-sh/example.com/shop-flow-abcd12",
            trust_level: "community",
            repo: "",
            path: "",
            tags: ["shopping"],
            extra: { category: "shopping", slug: "example.com/shop-flow-abcd12" }
          }
        ])),
        "https://browse.sh/api/skills/example.com/shop-flow-abcd12": jsonResponse({
          skillMd: "---\nname: shop-flow\n---\n# Shop Flow\n"
        })
      })
    });
    const { skills } = await source.listSkills({ limit: 10 });

    const prepared = await source.prepareInstall(skills[0].id);
    const pkg = new AdmZip(fs.readFileSync(prepared.packagePath));
    assert.equal(pkg.readAsText("SKILL.md"), "---\nname: shop-flow\n---\n# Shop Flow\n");
    assert.equal(prepared.skill.sourceLabel, "browse.sh");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Hermes LobeHub entries install as generated SKILL.md files", async () => {
  const indexUrl = "https://example.test/skills-index.json";
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mia-hermes-source-"));
  try {
    const source = createHermesSkillsSource({
      indexUrl,
      dataDir: tmpDir,
      fetchImpl: makeFetch({
        [indexUrl]: jsonResponse(makeIndex([
          {
            name: "prompt-helper",
            description: "Prompt assistant",
            source: "lobehub",
            identifier: "lobehub/prompt-helper",
            trust_level: "community",
            repo: "",
            path: "",
            tags: ["prompts"],
            extra: {}
          }
        ])),
        "https://chat-agents.lobehub.com/prompt-helper.json": jsonResponse({
          identifier: "prompt-helper",
          meta: { title: "Prompt Helper", description: "Prompt assistant", tags: ["prompts"] },
          config: { systemRole: "Write concise image prompts." }
        })
      })
    });
    const { skills } = await source.listSkills({ limit: 10 });

    const prepared = await source.prepareInstall(skills[0].id);
    const skillMd = new AdmZip(fs.readFileSync(prepared.packagePath)).readAsText("SKILL.md");
    assert.match(skillMd, /name: prompt-helper/);
    assert.match(skillMd, /Write concise image prompts/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
