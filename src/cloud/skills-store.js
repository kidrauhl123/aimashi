// Cloud skill marketplace store (sub-project B, F1 — community model).
//
// A skill is a LISTING (skills) with one or more versioned zip PACKAGES
// (skill_versions). Packages live on disk under <dataDir>/uploads/skills/
// <id>/<version>.zip; skill_versions stores the path relative to dataDir
// plus a sha256 checksum. install_count is a real per-user counter
// (skill_installs). Open publish + post-moderation: status defaults to
// 'published'; reports + setStatus drive takedown.

const path = require("node:path");
const crypto = require("node:crypto");
const { packageBody, packageDir, packageFromZip } = require("./skill-packages.js");

function nowIso() {
  return new Date().toISOString();
}

function rowToSkillMeta(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerUserId: row.owner_user_id || null,
    ownerLabel: row.owner_label || "",
    name: row.name,
    category: row.category,
    description: row.description || "",
    latestVersion: row.latest_version || "",
    installCount: row.install_count,
    status: row.status || "published",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToVersion(row) {
  if (!row) return null;
  return {
    version: row.version,
    packagePath: row.package_path,
    checksum: row.checksum,
    sizeBytes: row.size_bytes,
    entryPath: row.entry_path,
    manifest: (() => { try { return JSON.parse(row.manifest_json || "{}"); } catch { return {}; } })(),
    changelog: row.changelog || "",
    scanStatus: row.scan_status || "unscanned",
    createdAt: row.created_at
  };
}

function createSkillsStore(db, options = {}) {
  const dataDir = options.dataDir || "";
  const uploadDir = options.uploadDir || path.join(dataDir, "uploads");
  const pkgRoot = path.join(uploadDir, "skills");

  const upsertSkillStmt = db.prepare(
    "INSERT INTO skills (id, owner_user_id, owner_label, name, category, description, body, latest_version, install_count, status, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, '', ?, 0, 'published', ?, ?) " +
    "ON CONFLICT (id) DO UPDATE SET " +
    "  owner_user_id = excluded.owner_user_id, owner_label = excluded.owner_label, name = excluded.name, " +
    "  category = excluded.category, description = excluded.description, latest_version = excluded.latest_version, " +
    "  status = 'published', updated_at = excluded.updated_at"
  );
  const insertVersionStmt = db.prepare(
    "INSERT INTO skill_versions (skill_id, version, package_path, checksum, size_bytes, entry_path, manifest_json, changelog, created_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT (skill_id, version) DO UPDATE SET " +
    "  package_path = excluded.package_path, checksum = excluded.checksum, size_bytes = excluded.size_bytes, " +
    "  entry_path = excluded.entry_path, manifest_json = excluded.manifest_json, changelog = excluded.changelog"
  );
  const getSkillStmt = db.prepare("SELECT * FROM skills WHERE id = ?");
  const getVersionStmt = db.prepare("SELECT * FROM skill_versions WHERE skill_id = ? AND version = ?");
  const hasVersionStmt = db.prepare("SELECT 1 FROM skill_versions WHERE skill_id = ? LIMIT 1");
  const categoriesStmt = db.prepare(
    "SELECT category, COUNT(*) AS count FROM skills WHERE status = 'published' GROUP BY category ORDER BY count DESC, category ASC"
  );
  const insertInstallStmt = db.prepare(
    "INSERT OR IGNORE INTO skill_installs (skill_id, user_id, installed_version, created_at) VALUES (?, ?, ?, ?)"
  );
  const updateInstallVersionStmt = db.prepare(
    "UPDATE skill_installs SET installed_version = ? WHERE skill_id = ? AND user_id = ?"
  );
  const bumpStmt = db.prepare("UPDATE skills SET install_count = install_count + 1 WHERE id = ?");
  const setStatusStmt = db.prepare("UPDATE skills SET status = ?, updated_at = ? WHERE id = ?");
  const deleteStmt = db.prepare("DELETE FROM skills WHERE id = ?");
  const insertReportStmt = db.prepare(
    "INSERT INTO skill_reports (id, skill_id, reporter_id, reason, created_at) VALUES (?, ?, ?, ?, ?)"
  );
  const bodyOrphansStmt = db.prepare(
    "SELECT id, name, category, description, source_label, body FROM skills " +
    "WHERE body <> '' AND id NOT IN (SELECT DISTINCT skill_id FROM skill_versions)"
  );

  function getSkill(id) {
    const meta = rowToSkillMeta(getSkillStmt.get(String(id)));
    if (!meta) return null;
    const ver = meta.latestVersion ? rowToVersion(getVersionStmt.get(String(id), meta.latestVersion)) : null;
    return { ...meta, version: ver };
  }

  // Publish a version: package the content (a directory, or a single body),
  // write the zip under uploads/, upsert the listing, insert the version.
  function publishVersion(input) {
    const {
      id, ownerUserId = null, ownerLabel = "", name,
      category = "uncategorized", description = "",
      version = "1.0.0", body = "", srcDir = "", zipBuffer = null, changelog = ""
    } = input || {};
    if (!id || !name) throw new Error("publishVersion: id and name required");
    if (!srcDir && !body && !zipBuffer) throw new Error("publishVersion: srcDir, body or zipBuffer required");
    const destZip = path.join(pkgRoot, String(id), `${version}.zip`);
    const pkg = zipBuffer ? packageFromZip(zipBuffer, destZip)
      : srcDir ? packageDir(srcDir, destZip)
      : packageBody(body, destZip);
    const relPath = path.relative(dataDir, destZip);
    const now = nowIso();
    upsertSkillStmt.run(String(id), ownerUserId, String(ownerLabel), String(name), String(category), String(description), String(version), now, now);
    insertVersionStmt.run(
      String(id), String(version), relPath, pkg.checksum, pkg.sizeBytes, pkg.entryPath,
      JSON.stringify({ files: pkg.files || [pkg.entryPath], fileCount: pkg.fileCount }),
      String(changelog), now
    );
    return getSkill(id);
  }

  function listSkills({ category = "", q = "", limit = 60 } = {}) {
    const where = ["status = 'published'"];
    const params = [];
    if (category) { where.push("category = ?"); params.push(String(category)); }
    if (q) {
      where.push("(name LIKE ? OR description LIKE ?)");
      const like = `%${String(q)}%`;
      params.push(like, like);
    }
    const sql =
      "SELECT * FROM skills WHERE " + where.join(" AND ") +
      " ORDER BY install_count DESC, updated_at DESC LIMIT ?";
    params.push(Math.min(Math.max(Number(limit) || 60, 1), 200));
    return db.prepare(sql).all(...params).map(rowToSkillMeta);
  }

  function listCategories() {
    return categoriesStmt.all().map((row) => ({ category: row.category, count: row.count }));
  }

  function getVersion(id, version) {
    return rowToVersion(getVersionStmt.get(String(id), String(version)));
  }

  // Absolute on-disk path of a version's zip (for serving downloads).
  function packageAbsPath(version) {
    return version ? path.join(dataDir, version.packagePath) : "";
  }

  // Idempotent per user: first install bumps the count; re-install just
  // updates the recorded version. Returns the full skill (with latest version).
  function recordInstall(id, userId, version = "") {
    const row = getSkillStmt.get(String(id));
    if (!row) return null;
    const v = String(version || row.latest_version || "");
    const inserted = insertInstallStmt.run(String(id), String(userId), v, nowIso()).changes;
    if (inserted > 0) bumpStmt.run(String(id));
    else if (v) updateInstallVersionStmt.run(v, String(id), String(userId));
    return getSkill(id);
  }

  function report(id, reporterId, reason = "") {
    if (!getSkillStmt.get(String(id))) return null;
    const reportId = `rep_${crypto.randomBytes(8).toString("hex")}`;
    insertReportStmt.run(reportId, String(id), String(reporterId), String(reason).slice(0, 500), nowIso());
    return reportId;
  }

  function setStatus(id, status) {
    return setStatusStmt.run(String(status), nowIso(), String(id)).changes;
  }

  function deleteSkill(id) {
    return deleteStmt.run(String(id)).changes;
  }

  // Seed/refresh first-party catalog from folders (each entry carries a dir).
  // Only publishes a skill that has no version yet, so it never clobbers a
  // later-published version on restart.
  function seedFromCatalog(catalog) {
    for (const entry of Array.isArray(catalog) ? catalog : []) {
      if (!entry || !entry.id || hasVersionStmt.get(String(entry.id))) continue;
      publishVersion({
        id: entry.id,
        ownerUserId: null,
        ownerLabel: entry.sourceLabel || "Mia 官方",
        name: entry.name || entry.id,
        category: entry.category || "uncategorized",
        description: entry.description || "",
        version: "1.0.0",
        srcDir: entry.dir || "",
        body: entry.dir ? "" : (entry.body || "")
      });
    }
  }

  // Migrate any pre-v11 single-body row that has no version into a v1.0.0
  // single-file package. Idempotent.
  function backfillBodyVersions() {
    for (const row of bodyOrphansStmt.all()) {
      publishVersion({
        id: row.id,
        ownerUserId: null,
        ownerLabel: row.source_label || "Mia 官方",
        name: row.name || row.id,
        category: row.category || "uncategorized",
        description: row.description || "",
        version: "1.0.0",
        body: row.body || ""
      });
    }
  }

  return {
    publishVersion,
    listSkills,
    listCategories,
    getSkill,
    getVersion,
    packageAbsPath,
    recordInstall,
    report,
    setStatus,
    deleteSkill,
    seedFromCatalog,
    backfillBodyVersions
  };
}

module.exports = { createSkillsStore };
