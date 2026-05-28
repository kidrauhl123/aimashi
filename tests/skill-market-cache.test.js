const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  DEFAULT_SKILL_MARKET_CACHE_TTL_MS,
  normalizeSkillMarketParams,
  openSkillMarketCache
} = require("../src/main/skills/skill-market-cache.js");

function tempCache() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mia-skill-market-cache-"));
  return { dir, dbPath: path.join(dir, "skill-market-cache.db") };
}

function marketPage(name = "cached-skill") {
  return {
    skills: [{ id: `skill_${name}`, name, description: "Cached skill" }],
    categories: [{ category: "office", count: 1 }]
  };
}

test("normalizes skill market query params for cache and cloud requests", () => {
  assert.deepEqual(normalizeSkillMarketParams({
    category: " office ",
    q: " ppt ",
    limit: "240"
  }), {
    category: "office",
    q: "ppt",
    limit: 240
  });
  assert.equal(normalizeSkillMarketParams({ limit: -1 }).limit, 120);
  assert.equal(normalizeSkillMarketParams({ limit: 20000 }).limit, 10000);
});

test("skill market cache persists pages across reopen and marks TTL freshness", () => {
  const { dir, dbPath } = tempCache();
  let cache = openSkillMarketCache(dbPath);
  cache.upsertMarketPage("u1", { category: "office", q: "ppt", limit: 120 }, marketPage("ppt"), 1000);
  cache.close();

  cache = openSkillMarketCache(dbPath);
  try {
    const fresh = cache.getMarketPage("u1", { category: "office", q: "ppt", limit: 120 }, {
      nowMs: 1000 + DEFAULT_SKILL_MARKET_CACHE_TTL_MS - 1,
      ttlMs: DEFAULT_SKILL_MARKET_CACHE_TTL_MS
    });
    assert.equal(fresh.fresh, true);
    assert.equal(fresh.stale, false);
    assert.deepEqual(fresh.skills.map((skill) => skill.name), ["ppt"]);
    assert.deepEqual(fresh.categories.map((entry) => entry.category), ["office"]);

    const stale = cache.getMarketPage("u1", { category: "office", q: "ppt", limit: 120 }, {
      nowMs: 1000 + DEFAULT_SKILL_MARKET_CACHE_TTL_MS + 1,
      ttlMs: DEFAULT_SKILL_MARKET_CACHE_TTL_MS
    });
    assert.equal(stale.fresh, false);
    assert.equal(stale.stale, true);
  } finally {
    cache.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("skill market cache is isolated by cloud user and query params", () => {
  const { dir, dbPath } = tempCache();
  const cache = openSkillMarketCache(dbPath);
  try {
    cache.upsertMarketPage("u1", { category: "", q: "", limit: 120 }, marketPage("all-u1"), 1000);
    cache.upsertMarketPage("u2", { category: "", q: "", limit: 120 }, marketPage("all-u2"), 1000);
    cache.upsertMarketPage("u1", { category: "life", q: "", limit: 120 }, marketPage("life-u1"), 1000);

    assert.deepEqual(cache.getMarketPage("u1", { limit: 120 }).skills.map((skill) => skill.name), ["all-u1"]);
    assert.deepEqual(cache.getMarketPage("u2", { limit: 120 }).skills.map((skill) => skill.name), ["all-u2"]);
    assert.deepEqual(cache.getMarketPage("u1", { category: "life", limit: 120 }).skills.map((skill) => skill.name), ["life-u1"]);
    assert.equal(cache.getMarketPage("u1", { q: "missing", limit: 120 }), null);
  } finally {
    cache.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
