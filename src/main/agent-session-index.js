const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function safeJson(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function truncateText(value = "", max = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function parseTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function fileMtimeMs(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function newestFiles(root, pattern, limit = 80) {
  const files = [];
  const walk = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(filePath);
      else if (entry.isFile() && pattern.test(entry.name)) files.push(filePath);
    }
  };
  walk(root);
  return files
    .map((filePath) => ({ filePath, mtimeMs: fileMtimeMs(filePath) }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limit)
    .map((item) => item.filePath);
}

function readJsonlTail(filePath, maxLines = 80) {
  let lines = [];
  try {
    lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
  return lines.slice(-maxLines).map(safeJson).filter(Boolean);
}

function readJsonlHead(filePath, maxLines = 20) {
  let lines = [];
  try {
    lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
  return lines.slice(0, maxLines).map(safeJson).filter(Boolean);
}

function loadClaudeHistory(homeDir) {
  const map = new Map();
  for (const item of readJsonlTail(path.join(homeDir, ".claude", "history.jsonl"), 5000)) {
    const id = String(item.sessionId || "").trim();
    if (!id) continue;
    map.set(id, {
      title: truncateText(item.display || ""),
      project: String(item.project || "").trim(),
      updatedAt: parseTimestamp(item.timestamp)
    });
  }
  return map;
}

function listClaudeSessions({ homeDir = os.homedir(), limit = 10 } = {}) {
  const history = loadClaudeHistory(homeDir);
  const projectRoot = path.join(homeDir, ".claude", "projects");
  return newestFiles(projectRoot, /\.jsonl$/i, 120)
    .map((filePath) => {
      const id = path.basename(filePath, ".jsonl");
      const meta = history.get(id) || {};
      const tail = readJsonlTail(filePath, 40).reverse();
      const prompt = tail.find((item) => item.type === "user" && item.message?.content);
      const content = Array.isArray(prompt?.message?.content)
        ? prompt.message.content.map((part) => part?.text || "").join(" ")
        : prompt?.message?.content;
      return {
        id,
        title: meta.title || truncateText(content || id, 80),
        preview: truncateText(content || ""),
        project: meta.project || "",
        updatedAt: meta.updatedAt || fileMtimeMs(filePath),
        path: filePath
      };
    })
    .filter((item) => isUuid(item.id))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

function loadCodexIndex(homeDir) {
  const map = new Map();
  for (const item of readJsonlTail(path.join(homeDir, ".codex", "session_index.jsonl"), 5000)) {
    const id = String(item.id || "").trim();
    if (!id) continue;
    map.set(id, {
      title: truncateText(item.thread_name || ""),
      updatedAt: parseTimestamp(item.updated_at)
    });
  }
  return map;
}

function codexUserText(item) {
  if (item?.type === "event_msg" && item.payload?.type === "user_message") {
    return item.payload.message || "";
  }
  if (item?.type === "user_message" || item?.payload?.type === "user_message") {
    return item.payload?.message || item.message || item.text || "";
  }
  if (item?.type === "response_item" && item.payload?.type === "message" && item.payload.role === "user") {
    const content = Array.isArray(item.payload.content) ? item.payload.content : [];
    return content.map((part) => part?.text || "").join(" ");
  }
  return "";
}

function listCodexSessions({ homeDir = os.homedir(), limit = 10 } = {}) {
  const index = loadCodexIndex(homeDir);
  const sessionRoot = path.join(homeDir, ".codex", "sessions");
  return newestFiles(sessionRoot, /\.jsonl$/i, 120)
    .map((filePath) => {
      const head = readJsonlHead(filePath, 20);
      const tail = readJsonlTail(filePath, 80);
      const entries = [...head, ...tail];
      const meta = entries.find((item) => item.type === "session_meta")?.payload || {};
      const turnContext = entries.find((item) => item.type === "turn_context")?.payload || {};
      const id = String(meta.id || path.basename(filePath).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1] || "").trim();
      if (!isUuid(id)) return null;
      const user = [...tail].reverse().find((item) => codexUserText(item));
      const text = codexUserText(user);
      const indexed = index.get(id) || {};
      return {
        id,
        title: indexed.title || truncateText(text || id, 80),
        preview: truncateText(text || ""),
        project: String(meta.cwd || turnContext.cwd || "").trim(),
        updatedAt: indexed.updatedAt || fileMtimeMs(filePath),
        path: filePath
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

function listExternalAgentSessions(engine, options = {}) {
  if (engine === "claude-code") return listClaudeSessions(options);
  if (engine === "codex") return listCodexSessions(options);
  return [];
}

module.exports = {
  listClaudeSessions,
  listCodexSessions,
  listExternalAgentSessions,
  truncateText
};
