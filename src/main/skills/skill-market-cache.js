"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const DEFAULT_SKILL_MARKET_PAGE_LIMIT = 120;
const MAX_SKILL_MARKET_PAGE_LIMIT = 10000;
const DEFAULT_SKILL_MARKET_CACHE_TTL_MS = 5 * 60 * 1000;

function finiteNow(nowMs = Date.now()) {
  const value = Number(nowMs);
  return Number.isFinite(value) ? value : Date.now();
}

function normalizeSkillMarketParams(params = {}) {
  const requestedLimit = Number(params.limit);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(Math.floor(requestedLimit), MAX_SKILL_MARKET_PAGE_LIMIT)
    : DEFAULT_SKILL_MARKET_PAGE_LIMIT;
  return {
    category: String(params.category || "").trim(),
    q: String(params.q || "").trim(),
    limit
  };
}

function skillMarketQueryKey(params = {}) {
  const normalized = normalizeSkillMarketParams(params);
  return JSON.stringify(normalized);
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_market_pages (
      user_id         TEXT NOT NULL,
      query_key       TEXT NOT NULL,
      category        TEXT NOT NULL,
      q               TEXT NOT NULL,
      limit_count     INTEGER NOT NULL,
      skills_json     TEXT NOT NULL,
      categories_json TEXT NOT NULL,
      updated_at_ms   INTEGER NOT NULL,
      updated_at      TEXT NOT NULL,
      PRIMARY KEY (user_id, query_key)
    );
  `);
}

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || "");
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function openSkillMarketCache(dbPath) {
  if (!dbPath || typeof dbPath !== "string") {
    throw new Error("[skill-market-cache] dbPath is required");
  }
  fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  migrate(db);

  const selectStmt = db.prepare(`
    SELECT skills_json, categories_json, updated_at_ms, updated_at
    FROM skill_market_pages
    WHERE user_id = ? AND query_key = ?
  `);
  const upsertStmt = db.prepare(`
    INSERT INTO skill_market_pages (
      user_id, query_key, category, q, limit_count,
      skills_json, categories_json, updated_at_ms, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, query_key) DO UPDATE SET
      category = excluded.category,
      q = excluded.q,
      limit_count = excluded.limit_count,
      skills_json = excluded.skills_json,
      categories_json = excluded.categories_json,
      updated_at_ms = excluded.updated_at_ms,
      updated_at = excluded.updated_at
  `);

  function getMarketPage(userId, params = {}, options = {}) {
    const uid = String(userId || "").trim();
    if (!uid) return null;
    const normalized = normalizeSkillMarketParams(params);
    const row = selectStmt.get(uid, skillMarketQueryKey(normalized));
    if (!row) return null;
    const skills = parseJson(row.skills_json, []);
    const categories = parseJson(row.categories_json, []);
    if (!Array.isArray(skills) || !Array.isArray(categories)) return null;
    const nowMs = finiteNow(options.nowMs);
    const ttlMs = Number.isFinite(Number(options.ttlMs)) && Number(options.ttlMs) >= 0
      ? Number(options.ttlMs)
      : DEFAULT_SKILL_MARKET_CACHE_TTL_MS;
    const updatedAtMs = Number(row.updated_at_ms) || 0;
    const ageMs = Math.max(0, nowMs - updatedAtMs);
    const fresh = ageMs <= ttlMs;
    return {
      skills,
      categories,
      updatedAt: String(row.updated_at || ""),
      updatedAtMs,
      ageMs,
      fresh,
      stale: !fresh
    };
  }

  function upsertMarketPage(userId, params = {}, page = {}, nowMs = Date.now()) {
    const uid = String(userId || "").trim();
    if (!uid) return false;
    const normalized = normalizeSkillMarketParams(params);
    const writtenAtMs = finiteNow(nowMs);
    const skills = Array.isArray(page.skills) ? page.skills : [];
    const categories = Array.isArray(page.categories) ? page.categories : [];
    upsertStmt.run(
      uid,
      skillMarketQueryKey(normalized),
      normalized.category,
      normalized.q,
      normalized.limit,
      JSON.stringify(skills),
      JSON.stringify(categories),
      writtenAtMs,
      new Date(writtenAtMs).toISOString()
    );
    return true;
  }

  function close() {
    db.close();
  }

  return {
    getMarketPage,
    upsertMarketPage,
    close
  };
}

module.exports = {
  DEFAULT_SKILL_MARKET_CACHE_TTL_MS,
  DEFAULT_SKILL_MARKET_PAGE_LIMIT,
  MAX_SKILL_MARKET_PAGE_LIMIT,
  normalizeSkillMarketParams,
  openSkillMarketCache,
  skillMarketQueryKey
};
