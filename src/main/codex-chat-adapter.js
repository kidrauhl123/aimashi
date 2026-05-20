const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function mapCodexPermissionMode(value) {
  const id = String(value || "default").trim();
  if (id === "acceptEdits") return { sandboxMode: "workspace-write", approvalPolicy: "on-request" };
  if (id === "bypassPermissions") return { sandboxMode: "danger-full-access", approvalPolicy: "never" };
  if (id === "readOnly") return { sandboxMode: "read-only", approvalPolicy: "on-request" };
  return { sandboxMode: "workspace-write", approvalPolicy: "untrusted" };
}

function statelessPrompt(systemPrompt, userPrompt) {
  return systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
}

function stoppedError() {
  const stopped = new Error("生成已停止");
  stopped.code = "AIMASHI_STOPPED";
  return stopped;
}

function generatedImagesRoot(env = {}) {
  const codexHome = String(env.CODEX_HOME || "").trim();
  if (codexHome) return path.join(codexHome, "generated_images");
  const home = String(env.HOME || "").trim() || os.homedir();
  return path.join(home, ".codex", "generated_images");
}

function recentGeneratedImagePaths(sessionId, { env = {}, startedAtMs = 0, max = 8 } = {}) {
  const id = String(sessionId || "").trim();
  if (!id) return [];
  const dir = path.join(generatedImagesRoot(env), id);
  if (!fs.existsSync(dir)) return [];
  const since = Number(startedAtMs) - 5000;
  return fs.readdirSync(dir)
    .filter((name) => /\.(?:png|jpe?g|webp)$/i.test(name))
    .map((name) => {
      const filePath = path.join(dir, name);
      try {
        return { filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter((item) => item && item.mtimeMs >= since)
    .sort((a, b) => a.mtimeMs - b.mtimeMs)
    .slice(-max)
    .map((item) => item.filePath);
}

function contentWithGeneratedImages(content, imagePaths = []) {
  const text = String(content || "").trim();
  const paths = imagePaths.filter(Boolean);
  if (!paths.length) return text;
  return text;
}

function mimeForImagePath(filePath) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function generatedImageAttachments(imagePaths = []) {
  return imagePaths.map((filePath) => {
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size > 25 * 1024 * 1024) return null;
      const mime = mimeForImagePath(filePath);
      const dataUrl = `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
      return {
        id: `generated:${crypto.createHash("sha1").update(filePath).digest("hex").slice(0, 16)}`,
        name: path.basename(filePath),
        path: filePath,
        mime,
        size: stat.size,
        kind: "image",
        thumbnailDataUrl: dataUrl,
        dataUrl
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function requireDependency(deps, key) {
  if (typeof deps[key] !== "function") throw new Error(`${key} dependency is required.`);
  return deps[key];
}

function createCodexChatAdapter(deps = {}) {
  const shellCommandPath = requireDependency(deps, "shellCommandPath");
  const lastUserPrompt = requireDependency(deps, "lastUserPrompt");
  const expandLeadingSkillCommand = requireDependency(deps, "expandLeadingSkillCommand");
  const injectGroupContextForSdk = requireDependency(deps, "injectGroupContextForSdk");
  const readFellowPersona = requireDependency(deps, "readFellowPersona");
  const codexSdk = requireDependency(deps, "codexSdk");
  const processEnvStrings = requireDependency(deps, "processEnvStrings");
  const normalizeEffortLevel = requireDependency(deps, "normalizeEffortLevel");
  const getAgentSessionId = requireDependency(deps, "getAgentSessionId");
  const setAgentSessionId = requireDependency(deps, "setAgentSessionId");
  const chatCompletionResponse = requireDependency(deps, "chatCompletionResponse");
  const randomUUID = deps.randomUUID || (() => crypto.randomUUID());
  const cwd = deps.cwd || (() => process.cwd());

  async function sendChat({ fellow, sessionId, messages, group, signal, utility = false }) {
    const engine = "codex";
    const commandPath = shellCommandPath("codex");
    if (!commandPath) throw new Error("本机没有检测到 Codex CLI。请先安装并确认 `codex --version` 可用。");
    const externalSessionId = utility ? "" : getAgentSessionId(engine, fellow.key, sessionId);
    const lastUser = lastUserPrompt(messages);
    const userText = expandLeadingSkillCommand(lastUser, { mode: "inline" }) || lastUser;
    const persona = !externalSessionId
      ? readFellowPersona(fellow.key, fellow.name, fellow.bio).trim()
      : "";
    const prompt = persona
      ? [
          "以下是 Aimashi 给当前 Fellow 的人设，请在本次对话中遵守：",
          "",
          persona,
          "",
          "用户消息：",
          userText
        ].join("\n")
      : userText;
    const promptWithGroup = group && group.contextBlock
      ? injectGroupContextForSdk(prompt, group.contextBlock)
      : prompt;
    const { Codex } = await codexSdk();
    const env = processEnvStrings();
    const codex = new Codex({
      codexPathOverride: commandPath,
      env
    });
    const permission = mapCodexPermissionMode(fellow.engineConfig?.permissionMode || fellow.agentPermissionMode || "default");
    const threadOptions = {
      workingDirectory: cwd(),
      skipGitRepoCheck: true,
      modelReasoningEffort: normalizeEffortLevel(fellow.engineConfig?.effortLevel || "medium", "codex"),
      ...permission
    };
    if (fellow.engineConfig?.model) threadOptions.model = String(fellow.engineConfig.model);
    const thread = externalSessionId
      ? codex.resumeThread(externalSessionId, threadOptions)
      : codex.startThread(threadOptions);
    const startedAtMs = Date.now();
    const turn = await thread.run(promptWithGroup, { signal });
    const capturedSessionId = externalSessionId || thread.id || "";
    const imagePaths = recentGeneratedImagePaths(capturedSessionId, { env, startedAtMs });
    if (capturedSessionId && !externalSessionId && !utility) {
      setAgentSessionId(engine, fellow.key, sessionId, capturedSessionId);
    }
    if (signal?.aborted) throw stoppedError();
    return chatCompletionResponse({
      id: capturedSessionId || `codex_${randomUUID()}`,
      model: "codex-cli",
      content: contentWithGeneratedImages(turn?.finalResponse, imagePaths),
      attachments: generatedImageAttachments(imagePaths),
      aimashi: {
        transport: "codex-sdk",
        engine,
        session_id: capturedSessionId || "",
        fellow_key: fellow.key
      }
    });
  }

  async function sendStateless({ systemPrompt, userPrompt, signal }) {
    const commandPath = shellCommandPath("codex");
    if (!commandPath) throw new Error("本机没有检测到 Codex CLI。请先安装并确认 `codex --version` 可用。");
    const { Codex } = await codexSdk();
    const codex = new Codex({
      codexPathOverride: commandPath,
      env: processEnvStrings()
    });
    const thread = codex.startThread({
      workingDirectory: cwd(),
      skipGitRepoCheck: true,
      modelReasoningEffort: normalizeEffortLevel("medium", "codex"),
      ...mapCodexPermissionMode("default")
    });
    const turn = await thread.run(statelessPrompt(systemPrompt, userPrompt), { signal });
    if (signal?.aborted) throw stoppedError();
    return { content: String(turn?.finalResponse || "").trim() };
  }

  return { sendChat, sendStateless };
}

module.exports = {
  createCodexChatAdapter,
  mapCodexPermissionMode
};
