// Remote Hermes Skills Hub source for Mia's skill marketplace.
//
// The Hermes docs site publishes a machine-readable index with upstream
// source ids (GitHub, skills.sh, browse.sh, ClawHub, LobeHub, etc.). Mia uses
// that index for discovery, then resolves the real upstream package on install
// and serves a checked zip to the desktop.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const AdmZip = require("adm-zip");
const { parseFrontmatter } = require("./skills-catalog.js");
const {
  MAX_FILES,
  MAX_UNCOMPRESSED_BYTES,
  assertInside,
  isSafeEntryName,
  isSafeId,
  slugify
} = require("../shared/skill-safety.js");

const DEFAULT_INDEX_URL = "https://hermes-agent.nousresearch.com/docs/api/skills-index.json";
const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NOUS_HERMES_REPO = "NousResearch/hermes-agent";
const DEFAULT_GITHUB_ARCHIVE_BASE_URL = "https://codeload.github.com";
const DEFAULT_BROWSE_SH_API_BASE_URL = "https://browse.sh/api/skills";
const DEFAULT_CLAWHUB_API_BASE_URL = "https://clawhub.ai/api/v1";
const DEFAULT_LOBEHUB_BASE_URL = "https://chat-agents.lobehub.com";
const DEFAULT_MARKET_LIMIT = 5000;
const MAX_MARKET_LIMIT = 10000;
const ANTHROPIC_SKILLS_REPO = "anthropics/skills";
const CLAUDE_MARKETPLACE_SOURCE = "claude-marketplace";

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function shortHash(value, len = 10) {
  return sha256(Buffer.from(String(value || ""), "utf8")).slice(0, len);
}

function sourceLabel(source) {
  const labels = {
    official: "Hermes",
    "skills.sh": "skills.sh",
    "skills-sh": "skills.sh",
    github: "GitHub",
    clawhub: "ClawHub",
    "browse-sh": "browse.sh",
    "claude-marketplace": "Claude",
    claude: "Claude",
    anthropic: "Claude",
    lobehub: "LobeHub",
    "well-known": "Well-known",
    url: "URL"
  };
  return labels[String(source || "")] || String(source || "Hermes Hub");
}

function safeMarketId(entry) {
  const sourcePart = slugify(String(entry?.source || "hermes"));
  const namePart = slugify(String(entry?.name || entry?.identifier || "skill")).slice(0, 40) || "skill";
  const hash = shortHash(`${entry?.source || ""}\n${entry?.identifier || ""}`);
  const id = `hermes.${sourcePart}.${namePart}.${hash}`;
  return isSafeId(id) ? id : `hermes.skill.${hash}`;
}

function clampLimit(limit, fallback = DEFAULT_MARKET_LIMIT) {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(Math.floor(n), 1), MAX_MARKET_LIMIT);
}

function installCountFor(entry) {
  const extra = entry?.extra || {};
  return Number(extra.install_count ?? extra.installCount ?? extra.installs ?? 0) || 0;
}

function marketSkillFromEntry(entry, generatedAt = "") {
  const label = sourceLabel(entry?.source);
  const id = safeMarketId(entry);
  const versionHash = shortHash(`${entry?.identifier || id}\n${generatedAt}`, 12);
  return {
    id,
    ownerUserId: null,
    ownerLabel: label,
    name: String(entry?.name || id),
    category: label,
    description: String(entry?.description || ""),
    latestVersion: versionHash,
    installCount: installCountFor(entry),
    status: "published",
    createdAt: generatedAt || "",
    updatedAt: generatedAt || "",
    source: "hermes-hub",
    sourceLabel: label,
    upstreamSource: String(entry?.source || ""),
    upstreamId: String(entry?.identifier || ""),
    upstreamRepo: String(entry?.repo || ""),
    upstreamPath: String(entry?.path || ""),
    trustLevel: String(entry?.trust_level || "community"),
    tags: Array.isArray(entry?.tags) ? entry.tags.map(String).slice(0, 12) : [],
    remote: true
  };
}

function categoryCounts(skills) {
  const counts = new Map();
  for (const skill of skills) {
    const category = skill.category || "Hermes Hub";
    counts.set(category, (counts.get(category) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

function parseGithubId(value) {
  const parts = String(value || "").replace(/^github\//, "").split("/").filter(Boolean);
  if (parts.length < 3) return null;
  const owner = parts[0];
  const repo = parts[1];
  const subPath = parts.slice(2).join("/");
  if (!owner || !repo || !subPath) return null;
  return { owner, repo, repoSlug: `${owner}/${repo}`, subPath };
}

function githubIdForEntry(entry) {
  if (!entry) return "";
  if (entry.source === "official" && entry.path) {
    return `${NOUS_HERMES_REPO}/optional-skills/${entry.path}`;
  }
  if (entry.resolved_github_id) return String(entry.resolved_github_id);
  if (entry.repo && entry.path) return `${entry.repo}/${entry.path}`;
  if (entry.repo && entry.identifier && String(entry.identifier).startsWith(String(entry.repo))) {
    return String(entry.identifier);
  }
  return "";
}

function validateFiles(files) {
  const entries = Object.entries(files || {});
  if (!entries.some(([name]) => name === "SKILL.md")) throw new Error("remote skill package has no SKILL.md");
  if (entries.length > MAX_FILES) throw new Error("remote skill package has too many files");
  let total = 0;
  for (const [name, content] of entries) {
    if (!isSafeEntryName(name)) throw new Error(`unsafe remote package path: ${name}`);
    total += Buffer.isBuffer(content) ? content.length : Buffer.byteLength(String(content || ""), "utf8");
    if (total > MAX_UNCOMPRESSED_BYTES) throw new Error("remote skill package is too large");
  }
}

function zipFiles(files) {
  validateFiles(files);
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.isBuffer(content) ? content : Buffer.from(String(content || ""), "utf8"));
  }
  return zip.toBuffer();
}

function archiveSubsetFiles(archiveBuffer, subPath) {
  const prefix = String(subPath || "").replace(/^\/+|\/+$/g, "");
  const zip = new AdmZip(Buffer.from(archiveBuffer));
  const files = {};
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const parts = String(entry.entryName || "").split("/");
    if (parts.length < 2) continue;
    const tail = parts.slice(1).join("/");
    if (tail !== prefix && !tail.startsWith(`${prefix}/`)) continue;
    const rel = tail.slice(prefix.length).replace(/^\/+/, "");
    if (!rel || !isSafeEntryName(rel)) continue;
    files[rel] = entry.getData();
  }
  return files;
}

function isAnthropicSkillsCollection(entry) {
  const source = String(entry?.source || "");
  const repo = String(entry?.repo || "").toLowerCase();
  const identifier = String(entry?.identifier || "").replace(/\/+$/, "").toLowerCase();
  const skillPath = String(entry?.path || "").replace(/^\/+|\/+$/g, "");
  return source === CLAUDE_MARKETPLACE_SOURCE
    && !skillPath
    && (repo === ANTHROPIC_SKILLS_REPO || identifier === ANTHROPIC_SKILLS_REPO);
}

function anthropicSkillsFromArchive(collectionEntry, archiveBuffer) {
  const zip = new AdmZip(Buffer.from(archiveBuffer));
  const skills = [];
  const seen = new Set();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const parts = String(entry.entryName || "").split("/");
    if (parts.length < 4) continue;
    const tail = parts.slice(1).join("/");
    const match = tail.match(/^skills\/([^/]+)\/SKILL\.md$/);
    if (!match) continue;
    const folder = match[1];
    if (!folder || seen.has(folder)) continue;
    seen.add(folder);
    const skillPath = `skills/${folder}`;
    const body = entry.getData().toString("utf8");
    const meta = parseFrontmatter(body);
    skills.push({
      ...collectionEntry,
      name: String(meta.name || folder),
      description: String(meta.description || collectionEntry?.description || ""),
      source: CLAUDE_MARKETPLACE_SOURCE,
      identifier: `${ANTHROPIC_SKILLS_REPO}/${skillPath}`,
      repo: ANTHROPIC_SKILLS_REPO,
      path: skillPath,
      trust_level: String(collectionEntry?.trust_level || "trusted"),
      tags: Array.isArray(collectionEntry?.tags) ? collectionEntry.tags : [],
      extra: {
        ...(collectionEntry?.extra || {}),
        collection: String(collectionEntry?.name || "anthropics/skills")
      }
    });
  }
  return skills.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function lobeHubSkillMd(agentData) {
  const meta = agentData?.meta || agentData || {};
  const identifier = String(agentData?.identifier || "lobehub-agent");
  const title = String(meta.title || identifier);
  const description = String(meta.description || "");
  const tags = Array.isArray(meta.tags) ? meta.tags.map(String) : [];
  const systemRole = String(agentData?.config?.systemRole || "");
  return [
    "---",
    `name: ${slugify(identifier)}`,
    `description: ${description.replace(/\r?\n/g, " ").slice(0, 500)}`,
    "metadata:",
    "  hermes:",
    `    tags: [${tags.join(", ")}]`,
    "  lobehub:",
    "    source: lobehub",
    "---",
    "",
    `# ${title}`,
    "",
    description,
    "",
    "## Instructions",
    "",
    systemRole || "(No system role defined)",
    ""
  ].join("\n");
}

function createHermesSkillsSource(options = {}) {
  const indexUrl = String(options.indexUrl || process.env.MIA_HERMES_SKILLS_INDEX_URL || DEFAULT_INDEX_URL);
  const fetchImpl = options.fetchImpl || global.fetch;
  const now = options.now || Date.now;
  const cacheTtlMs = Number(options.cacheTtlMs || DEFAULT_CACHE_TTL_MS);
  const dataDir = options.dataDir || "";
  const packageRoot = path.join(dataDir || process.cwd(), "uploads", "hermes-skills");
  const githubArchiveBaseUrl = String(
    options.githubArchiveBaseUrl
    || process.env.MIA_HERMES_GITHUB_ARCHIVE_BASE_URL
    || DEFAULT_GITHUB_ARCHIVE_BASE_URL
  ).replace(/\/+$/, "");
  const browseShApiBaseUrl = String(
    options.browseShApiBaseUrl
    || process.env.MIA_HERMES_BROWSE_SH_API_BASE_URL
    || DEFAULT_BROWSE_SH_API_BASE_URL
  ).replace(/\/+$/, "");
  const clawHubApiBaseUrl = String(
    options.clawHubApiBaseUrl
    || process.env.MIA_HERMES_CLAWHUB_API_BASE_URL
    || DEFAULT_CLAWHUB_API_BASE_URL
  ).replace(/\/+$/, "");
  const lobeHubBaseUrl = String(
    options.lobeHubBaseUrl
    || process.env.MIA_HERMES_LOBEHUB_BASE_URL
    || DEFAULT_LOBEHUB_BASE_URL
  ).replace(/\/+$/, "");
  let cachedIndex = null;
  let cachedAt = 0;

  if (typeof fetchImpl !== "function") {
    throw new Error("Hermes skills source requires fetch.");
  }

  async function fetchOk(url, init = {}) {
    const response = await fetchImpl(url, init);
    if (!response || !response.ok) {
      throw new Error(`Hermes skill fetch failed: ${url} (${response?.status || "network"})`);
    }
    return response;
  }

  async function fetchJson(url) {
    return fetchOk(url).then((response) => response.json());
  }

  async function fetchText(url) {
    return fetchOk(url).then((response) => response.text());
  }

  async function fetchBuffer(url) {
    const response = await fetchOk(url);
    return Buffer.from(await response.arrayBuffer());
  }

  async function expandAnthropicSkillsCollection(entry) {
    const archiveUrl = `${githubArchiveBaseUrl}/${ANTHROPIC_SKILLS_REPO}/zip/HEAD`;
    return anthropicSkillsFromArchive(entry, await fetchBuffer(archiveUrl));
  }

  async function expandIndexSkills(skills) {
    const expanded = [];
    for (const entry of skills) {
      if (isAnthropicSkillsCollection(entry)) {
        const entries = await expandAnthropicSkillsCollection(entry).catch(() => []);
        if (entries.length) {
          expanded.push(...entries);
          continue;
        }
      }
      expanded.push(entry);
    }
    return expanded;
  }

  async function loadIndex({ force = false } = {}) {
    const age = now() - cachedAt;
    if (!force && cachedIndex && age < cacheTtlMs) return cachedIndex;
    const data = await fetchJson(indexUrl);
    const skills = Array.isArray(data?.skills) ? data.skills : [];
    const indexSkills = await expandIndexSkills(skills);
    cachedIndex = {
      generatedAt: String(data?.generated_at || data?.generatedAt || ""),
      skills: indexSkills.filter((entry) => entry && entry.identifier && entry.name)
    };
    cachedAt = now();
    return cachedIndex;
  }

  async function listSkills({ category = "", q = "", limit = DEFAULT_MARKET_LIMIT } = {}) {
    let index;
    try {
      index = await loadIndex();
    } catch {
      return { skills: [], categories: [] };
    }
    const needle = String(q || "").trim().toLowerCase();
    const categoryFilter = String(category || "").trim();
    const all = index.skills.map((entry) => marketSkillFromEntry(entry, index.generatedAt));
    const filtered = all.filter((skill) => {
      if (categoryFilter && skill.category !== categoryFilter) return false;
      if (!needle) return true;
      return [
        skill.name,
        skill.description,
        skill.sourceLabel,
        skill.category,
        skill.upstreamId,
        ...(skill.tags || [])
      ].join(" ").toLowerCase().includes(needle);
    });
    return {
      skills: filtered.slice(0, clampLimit(limit)),
      categories: categoryCounts(all)
    };
  }

  async function resolveEntry(id) {
    const index = await loadIndex();
    const target = String(id || "");
    return index.skills.find((entry) => safeMarketId(entry) === target) || null;
  }

  async function filesFromGithub(entry) {
    const parsed = parseGithubId(githubIdForEntry(entry));
    if (!parsed) throw new Error("remote skill has no GitHub package path");
    const archiveUrl = `${githubArchiveBaseUrl}/${parsed.repoSlug}/zip/HEAD`;
    const archive = await fetchBuffer(archiveUrl);
    const files = archiveSubsetFiles(archive, parsed.subPath);
    if (!files["SKILL.md"]) {
      throw new Error(`GitHub package did not contain ${parsed.subPath}/SKILL.md`);
    }
    return files;
  }

  async function filesFromBrowseSh(entry) {
    const slug = String(entry?.extra?.slug || entry?.identifier || "")
      .replace(/^browse-sh\//, "")
      .replace(/^\/+/, "");
    if (!slug) throw new Error("browse.sh skill has no slug");
    const detail = await fetchJson(`${browseShApiBaseUrl}/${slug}`);
    let skillMd = String(detail?.skillMd || "");
    if (!skillMd && detail?.skillMdUrl) {
      skillMd = await fetchText(String(detail.skillMdUrl));
    }
    if (!skillMd) throw new Error("browse.sh detail did not include SKILL.md");
    return { "SKILL.md": skillMd };
  }

  async function filesFromClawHub(entry) {
    const slug = String(entry?.identifier || "").split("/").filter(Boolean).pop();
    if (!slug) throw new Error("ClawHub skill has no slug");
    const detail = await fetchJson(`${clawHubApiBaseUrl}/skills/${encodeURIComponent(slug)}`);
    const latest = detail?.latestVersion?.version
      || detail?.skill?.latestVersion?.version
      || detail?.skill?.tags?.latest
      || "latest";
    const zipUrl = `${clawHubApiBaseUrl}/download?slug=${encodeURIComponent(slug)}&version=${encodeURIComponent(latest)}`;
    const remoteZip = new AdmZip(await fetchBuffer(zipUrl));
    const files = {};
    for (const entry of remoteZip.getEntries()) {
      if (entry.isDirectory) continue;
      if (!isSafeEntryName(entry.entryName)) continue;
      files[entry.entryName] = entry.getData();
    }
    return files;
  }

  async function filesFromLobeHub(entry) {
    const agentId = String(entry?.identifier || "").replace(/^lobehub\//, "");
    if (!agentId) throw new Error("LobeHub skill has no id");
    const agent = await fetchJson(`${lobeHubBaseUrl}/${encodeURIComponent(agentId)}.json`);
    return { "SKILL.md": lobeHubSkillMd(agent) };
  }

  async function filesForEntry(entry) {
    const source = String(entry?.source || "");
    if (source === "browse-sh") return filesFromBrowseSh(entry);
    if (source === "clawhub") return filesFromClawHub(entry);
    if (source === "lobehub") return filesFromLobeHub(entry);
    return filesFromGithub(entry);
  }

  function packagePath(id, checksum) {
    if (!isSafeId(id) || !/^[a-f0-9]{64}$/.test(String(checksum || ""))) return "";
    return assertInside(packageRoot, path.join(packageRoot, id, `${checksum}.zip`));
  }

  async function prepareInstall(id) {
    const entry = await resolveEntry(id);
    if (!entry) return null;
    const skill = marketSkillFromEntry(entry, (cachedIndex && cachedIndex.generatedAt) || "");
    const zipBuffer = zipFiles(await filesForEntry(entry));
    const checksum = sha256(zipBuffer);
    const target = packagePath(skill.id, checksum);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, zipBuffer);
    return {
      skill,
      packagePath: target,
      download: {
        version: skill.latestVersion || checksum.slice(0, 12),
        url: `/api/hermes-skills/${encodeURIComponent(skill.id)}/package/${checksum}.zip`,
        checksum,
        entryPath: "SKILL.md"
      }
    };
  }

  function packageAbsPath(id, checksum) {
    const target = packagePath(String(id || ""), String(checksum || ""));
    return target && fs.existsSync(target) ? target : "";
  }

  return {
    loadIndex,
    listSkills,
    resolveEntry,
    prepareInstall,
    packageAbsPath
  };
}

module.exports = {
  DEFAULT_INDEX_URL,
  createHermesSkillsSource,
  marketSkillFromEntry,
  safeMarketId,
  sourceLabel
};
