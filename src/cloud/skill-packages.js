// Skill package (zip) creation for the marketplace (sub-project B, F1).
//
// A skill version is distributed as a zip whose root holds the skill's files
// (SKILL.md + any scripts/references/assets). Packages are written under the
// cloud data dir's uploads/skills/<id>/<version>.zip and served with a
// sha256 checksum so the desktop can verify before extracting.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const AdmZip = require("adm-zip");
const { isSafeEntryName, MAX_FILES, MAX_UNCOMPRESSED_BYTES } = require("../shared/skill-safety.js");

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function writeZip(zip, destZipPath) {
  const buf = zip.toBuffer();
  fs.mkdirSync(path.dirname(destZipPath), { recursive: true });
  fs.writeFileSync(destZipPath, buf);
  return { checksum: sha256(buf), sizeBytes: buf.length };
}

// Package a single SKILL.md body as a one-file zip (used to migrate the old
// single-body skills and to publish simple text-only skills).
function packageBody(body, destZipPath, entryName = "SKILL.md") {
  const zip = new AdmZip();
  zip.addFile(entryName, Buffer.from(String(body || ""), "utf8"));
  return { ...writeZip(zip, destZipPath), entryPath: entryName, fileCount: 1 };
}

// Package a directory tree (its contents land at the zip root). Returns the
// checksum/size plus the file list for the version manifest.
function packageDir(srcDir, destZipPath, entryName = "SKILL.md") {
  const zip = new AdmZip();
  zip.addLocalFolder(srcDir);
  const files = zip.getEntries().filter((entry) => !entry.isDirectory).map((entry) => entry.entryName);
  return { ...writeZip(zip, destZipPath), entryPath: entryName, fileCount: files.length, files };
}

// Store an already-built zip (user upload). Validates it contains a SKILL.md,
// returns its checksum/manifest. Throws if the zip has no SKILL.md entry.
function packageFromZip(zipBuffer, destZipPath, entryName = "SKILL.md") {
  const buf = Buffer.from(zipBuffer);
  const zip = new AdmZip(buf);
  const fileEntries = zip.getEntries().filter((entry) => !entry.isDirectory);
  if (fileEntries.length > MAX_FILES) throw new Error("package has too many files");
  let uncompressed = 0;
  for (const entry of fileEntries) {
    if (!isSafeEntryName(entry.entryName)) throw new Error(`unsafe path in package: ${entry.entryName}`);
    uncompressed += Number(entry.header?.size || 0);
    if (uncompressed > MAX_UNCOMPRESSED_BYTES) throw new Error("package uncompressed size too large");
  }
  const files = fileEntries.map((entry) => entry.entryName);
  const entryPath = files.includes(entryName) ? entryName : files.find((name) => name.endsWith("SKILL.md"));
  if (!entryPath) throw new Error("package must contain a SKILL.md");
  fs.mkdirSync(path.dirname(destZipPath), { recursive: true });
  fs.writeFileSync(destZipPath, buf);
  return { checksum: sha256(buf), sizeBytes: buf.length, entryPath, fileCount: files.length, files };
}

module.exports = { packageBody, packageDir, packageFromZip, sha256 };
