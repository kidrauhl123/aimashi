const fallbackSlashCommands = [
  { command: "/new", description: "Start a new session (fresh session ID + history)" },
  { command: "/topic", description: "Enable or inspect Telegram DM topic sessions" },
  { command: "/retry", description: "Retry the last message (resend to agent)" },
  { command: "/undo", description: "Remove the last user/assistant exchange" },
  { command: "/title", description: "Set a title for the current session" },
  { command: "/branch", description: "Branch the current session (explore a different path)" },
  { command: "/compress", description: "Manually compress conversation context" },
  { command: "/rollback", description: "List or restore filesystem checkpoints" },
  { command: "/commands", description: "Browse all commands and skills" },
  { command: "/help", description: "Show available commands" }
];

const state = {
  runtime: null,
  activeKey: "aimashi",
  chatStore: { schema_version: 1, readAt: {}, sessions: {} },
  activeSessionIdByPersona: {},
  generatingTitleIds: new Set(),
  startupTasks: [],
  forceScrollToBottom: false,
  sessionMenuOpen: false,
  activeView: "chat",
  activeSettingsTab: "profile",
  personaFilter: "",
  skillFilter: "",
  skillCategoryFilter: "",
  fellowMenuOpen: false,
  fellowDialogOpen: false,
  fellowAvatarDraft: {
    image: "",
    crop: { x: 50, y: 50, zoom: 1 }
  },
  avatarCropEditor: {
    open: false,
    image: "",
    crop: { x: 50, y: 50, zoom: 1 },
    dragging: false,
    lastX: 0,
    lastY: 0
  },
  settingsOpen: false,
  modelCatalog: [],
  skillLibrary: { roots: [], skills: [] },
  selectedSkillId: "",
  selectedSkillDetail: null,
  skillsLoading: false,
  slashCommands: fallbackSlashCommands,
  slashMenuOpen: false,
  slashSelectedIndex: 0,
  slashFilter: "",
  isGenerating: false
};

const els = {
  openSettings: document.getElementById("openSettings"),
  closeSettings: document.getElementById("closeSettings"),
  userAvatar: document.getElementById("userAvatar"),
  userDisplayName: document.getElementById("userDisplayName"),
  activeChatAvatar: document.getElementById("activeChatAvatar"),
  activeChatName: document.getElementById("activeChatName"),
  activeChatBadge: document.getElementById("activeChatBadge"),
  activeChatMeta: document.getElementById("activeChatMeta"),
  initialize: document.getElementById("initialize"),
  installEngine: document.getElementById("installEngine"),
  startEngine: document.getElementById("startEngine"),
  stopEngine: document.getElementById("stopEngine"),
  personaSearch: document.getElementById("personaSearch"),
  personaCount: document.getElementById("personaCount"),
  fellowCreateMenu: document.getElementById("fellowCreateMenu"),
  addFellow: document.getElementById("addFellow"),
  createGroup: document.getElementById("createGroup"),
  fellowDialog: document.getElementById("fellowDialog"),
  fellowForm: document.getElementById("fellowForm"),
  fellowName: document.getElementById("fellowName"),
  fellowAvatar: document.getElementById("fellowAvatar"),
  fellowAvatarFile: document.getElementById("fellowAvatarFile"),
  chooseFellowAvatar: document.getElementById("chooseFellowAvatar"),
  fellowAvatarDrop: document.getElementById("fellowAvatarDrop"),
  fellowAvatarPreview: document.getElementById("fellowAvatarPreview"),
  fellowAvatarDefaults: document.querySelector(".avatar-defaults"),
  fellowSeed: document.getElementById("fellowSeed"),
  closeFellowDialog: document.getElementById("closeFellowDialog"),
  cancelFellow: document.getElementById("cancelFellow"),
  avatarCropDialog: document.getElementById("avatarCropDialog"),
  avatarCropStage: document.getElementById("avatarCropStage"),
  confirmAvatarCrop: document.getElementById("confirmAvatarCrop"),
  cancelAvatarCrop: document.getElementById("cancelAvatarCrop"),
  resetAvatarCrop: document.getElementById("resetAvatarCrop"),
  conversationSidebar: document.getElementById("conversationSidebar"),
  skillsSidebar: document.getElementById("skillsSidebar"),
  chatView: document.getElementById("chatView"),
  skillsView: document.getElementById("skillsView"),
  settingsView: document.getElementById("settingsView"),
  engineStatus: document.getElementById("engineStatus"),
  hermesHome: document.getElementById("hermesHome"),
  manifestPath: document.getElementById("manifestPath"),
  engineLogs: document.getElementById("engineLogs"),
  personaList: document.getElementById("personaList"),
  engineWarning: document.getElementById("engineWarning"),
  chat: document.getElementById("chat"),
  skillSearch: document.getElementById("skillSearch"),
  skillNav: document.getElementById("skillNav"),
  skillLibraryMeta: document.getElementById("skillLibraryMeta"),
  skillSourceMeta: document.getElementById("skillSourceMeta"),
  skillEnabledMeta: document.getElementById("skillEnabledMeta"),
  skillStats: document.getElementById("skillStats"),
  skillChipRow: document.getElementById("skillChipRow"),
  skillCardGrid: document.getElementById("skillCardGrid"),
  skillDetailPanel: document.getElementById("skillDetailPanel"),
  sessionMenuButton: document.getElementById("sessionMenuButton"),
  currentSessionTitle: document.getElementById("currentSessionTitle"),
  sessionMenu: document.getElementById("sessionMenu"),
  sessionList: document.getElementById("sessionList"),
  newSession: document.getElementById("newSession"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
  slashCommandMenu: document.getElementById("slashCommandMenu"),
  sendChat: document.getElementById("sendChat"),
  quickModelSelect: document.getElementById("quickModelSelect"),
  modelSwitchStatus: document.getElementById("modelSwitchStatus"),
  modelForm: document.getElementById("modelForm"),
  modelSelect: document.getElementById("modelSelect"),
  connectedProviderList: document.getElementById("connectedProviderList"),
  modelConnectButton: document.getElementById("modelConnectButton"),
  modelAuthState: document.getElementById("modelAuthState"),
  modelApiKeyField: document.getElementById("modelApiKeyField"),
  modelApiKeyLabel: document.getElementById("modelApiKeyLabel"),
  appearanceForm: document.getElementById("appearanceForm"),
  appearanceTheme: document.getElementById("appearanceTheme"),
  appearanceFontPreset: document.getElementById("appearanceFontPreset"),
  appearanceCustomFont: document.getElementById("appearanceCustomFont"),
  profileForm: document.getElementById("profileForm"),
  profileDisplayName: document.getElementById("profileDisplayName"),
  profileAvatarText: document.getElementById("profileAvatarText"),
  profileAvatarColor: document.getElementById("profileAvatarColor"),
  profileAvatarImage: document.getElementById("profileAvatarImage"),
  authMethod: document.getElementById("authMethod"),
  modelPreset: document.getElementById("modelPreset"),
  modelProvider: document.getElementById("modelProvider"),
  modelName: document.getElementById("modelName"),
  modelKeyEnv: document.getElementById("modelKeyEnv"),
  modelApiKey: document.getElementById("modelApiKey"),
  modelBaseUrl: document.getElementById("modelBaseUrl"),
  modelApiMode: document.getElementById("modelApiMode"),
  codexInlineAuth: document.getElementById("codexInlineAuth"),
  codexCheck: document.getElementById("codexCheck"),
  newPersona: document.getElementById("newPersona"),
  codexStatus: document.getElementById("codexStatus"),
  codexCode: document.getElementById("codexCode"),
  codexLogin: document.getElementById("codexLogin"),
  codexCancel: document.getElementById("codexCancel"),
  codexLogs: document.getElementById("codexLogs")
};

function setText(el, value) {
  if (el) el.textContent = value;
}

function renderSendButton() {
  if (!els.sendChat) return;
  els.sendChat.classList.toggle("stop", state.isGenerating);
  els.sendChat.textContent = state.isGenerating ? "" : "↗";
  els.sendChat.title = state.isGenerating ? "停止生成" : "发送";
  els.sendChat.setAttribute("aria-label", state.isGenerating ? "停止生成" : "发送");
}

const providerPresets = {
  xai: {
    provider: "xai",
    model: "grok-4.1-fast",
    apiKeyEnv: "XAI_API_KEY",
    baseUrl: "",
    apiMode: ""
  },
  anthropic: {
    provider: "anthropic",
    model: "claude-sonnet-4.6",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    baseUrl: "",
    apiMode: "anthropic_messages"
  },
  openrouter: {
    provider: "openrouter",
    model: "anthropic/claude-sonnet-4.6",
    apiKeyEnv: "OPENROUTER_API_KEY",
    baseUrl: "",
    apiMode: ""
  },
  "openai-codex": {
    provider: "openai-codex",
    model: "gpt-5.3-codex",
    apiKeyEnv: "",
    baseUrl: "",
    apiMode: "codex_responses"
  },
  deepseek: {
    provider: "deepseek",
    model: "deepseek-chat",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    baseUrl: "",
    apiMode: ""
  },
  gemini: {
    provider: "gemini",
    model: "gemini-2.5-pro",
    apiKeyEnv: "GEMINI_API_KEY",
    baseUrl: "",
    apiMode: ""
  },
  lmstudio: {
    provider: "lmstudio",
    model: "",
    apiKeyEnv: "LM_API_KEY",
    baseUrl: "http://127.0.0.1:1234/v1",
    apiMode: "chat_completions"
  }
};

const providerLabels = {
  nous: "Nous Portal",
  xai: "xAI",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
  "openai-codex": "OpenAI Codex",
  deepseek: "DeepSeek",
  gemini: "Google",
  lmstudio: "LM Studio"
};

function fallbackCatalogFromPresets() {
  return Object.values(providerPresets).map((preset) => ({
    id: `${preset.provider}::${preset.model || ""}`,
    provider: preset.provider,
    providerLabel: providerLabels[preset.provider] || preset.provider,
    model: preset.model || "",
    label: preset.model || "Local Model",
    authType: preset.provider === "openai-codex" ? "oauth_external" : "api_key",
    apiKeyEnv: preset.apiKeyEnv,
    baseUrl: preset.baseUrl,
    apiMode: preset.apiMode || "chat_completions"
  }));
}

function modelKey(model = {}) {
  return `${String(model.provider || "").trim()}::${String(model.model || "").trim()}`;
}

function catalogEntries() {
  const base = state.modelCatalog.length ? state.modelCatalog : fallbackCatalogFromPresets();
  const current = state.runtime?.model || {};
  const currentId = modelKey(current);
  if (!current.provider || base.some((entry) => entry.id === currentId)) return base;
  return [
    {
      id: currentId,
      provider: current.provider,
      providerLabel: providerLabels[current.provider] || current.provider,
      model: current.model || "",
      label: current.model || "Custom Model",
      authType: current.provider === "openai-codex" ? "oauth_external" : "api_key",
      apiKeyEnv: current.apiKeyEnv || "",
      baseUrl: current.baseUrl || "",
      apiMode: current.apiMode || "chat_completions"
    },
    ...base
  ];
}

function catalogEntryForModel(model = {}) {
  const key = modelKey(model);
  return catalogEntries().find((entry) => entry.id === key)
    || catalogEntries().find((entry) => entry.provider === model.provider && entry.model === model.model)
    || null;
}

function providerEntries() {
  const providers = new Map();
  for (const entry of catalogEntries()) {
    if (!entry.provider || providers.has(entry.provider)) continue;
    providers.set(entry.provider, {
      ...entry,
      id: entry.provider,
      model: "",
      label: entry.providerLabel || providerLabels[entry.provider] || entry.provider
    });
  }
  return [...providers.values()];
}

function modelsForProvider(provider) {
  return catalogEntries().filter((entry) => entry.provider === provider);
}

function defaultModelForProvider(provider, runtime = state.runtime) {
  const current = runtime?.model || {};
  if (current.provider === provider) {
    const currentEntry = catalogEntryForModel(current);
    if (currentEntry) return currentEntry;
  }
  return modelsForProvider(provider).find((entry) => entry.model) || modelsForProvider(provider)[0] || null;
}

function providerEntryForProvider(provider) {
  return providerEntries().find((entry) => entry.provider === provider) || null;
}

function providerIconSrc(provider = "") {
  const id = String(provider || "").trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "-");
  if (!id || id === "custom") return "";
  return `./assets/provider-icons/${id}.svg`;
}

function modelIconSrc(model = {}) {
  const id = String(model.model || model.id || model.name || "").toLowerCase();
  const provider = String(model.provider || "").toLowerCase();
  const rules = [
    [/codex|openai-codex/, "chatgpt.jpeg"],
    [/gpt-5\.1-chat/, "gpt-5.1-chat.png"],
    [/gpt-5\.1/, "gpt-5.1.png"],
    [/gpt-5.*mini/, "gpt-5-mini.png"],
    [/gpt-5.*nano/, "gpt-5-nano.png"],
    [/gpt-5/, "gpt-5.png"],
    [/gpt-4/, "gpt_4.png"],
    [/gpt-3/, "gpt_3.5.png"],
    [/claude|anthropic/, "claude.png"],
    [/deepseek/, "deepseek.png"],
    [/grok|xai/, "grok.png"],
    [/qwen|qwq|qvq|wan-/, "qwen.png"],
    [/gemini/, "gemini.png"],
    [/gemma/, "gemma.png"],
    [/llama/, "llama.png"],
    [/mistral|mixtral|codestral|ministral|magistral/, "mixtral.png"],
    [/kimi|moonshot/, "moonshot.webp"],
    [/minimax|abab|m2-her/, "minimax.png"],
    [/mimo/, "mimo.svg"],
    [/nvidia|nemotron/, "nvidia.png"],
    [/copilot/, "copilot.png"],
    [/hermes|nous/, "nousresearch.png"],
    [/hugging/, "huggingface.png"],
    [/glm|zai|zhipu/, "zhipu.png"],
    [/step/, "step.png"]
  ];
  const haystack = `${id} ${provider}`;
  const match = rules.find(([regex]) => regex.test(haystack));
  if (match) return `./assets/model-icons/${match[1]}`;
  return providerIconSrc(provider);
}

function providerLabel(provider = "") {
  return providerEntryForProvider(provider)?.providerLabel
    || providerLabels[provider]
    || (state.runtime?.connectedProviders || []).find((entry) => entry.provider === provider)?.providerLabel
    || provider
    || "Provider";
}

function selectedProviderEntry() {
  const provider = els.modelSelect?.value || "";
  return provider ? providerEntryForProvider(provider) : null;
}

function selectedModelEntry() {
  const providerEntry = selectedProviderEntry();
  return providerEntry ? defaultModelForProvider(providerEntry.provider, state.runtime) : null;
}

function presetKeyForModel(model = {}) {
  return catalogEntryForModel(model)?.id || "custom";
}

function modelDisplayName(model = {}) {
  const provider = String(model.provider || "").trim();
  const entry = catalogEntryForModel(model);
  const name = entry?.label || String(model.model || "").trim() || (provider === "lmstudio" ? "Local Model" : "未选择模型");
  const label = providerLabel(provider) || "Custom";
  return `${name} | ${label}`;
}

function fillModelFieldsFromPreset(key) {
  const preset = providerPresets[key];
  if (!preset) return;
  els.modelProvider.value = preset.provider;
  els.modelName.value = preset.model;
  els.modelKeyEnv.value = preset.apiKeyEnv;
  els.modelBaseUrl.value = preset.baseUrl;
  els.modelApiMode.value = preset.apiMode;
  els.authMethod.value = key === "openai-codex" ? "openai-codex" : "api-key";
  els.modelPreset.value = key;
  if (key === "openai-codex") els.modelApiKey.value = "";
  updateModelFieldVisibility();
}

function setSelectOptions(select, entries, currentId) {
  if (!select) return;
  const previous = select.value || currentId;
  select.innerHTML = "";
  if (!entries.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "先连接模型提供商";
    select.appendChild(option);
    select.value = "";
    return;
  }
  const groups = new Map();
  for (const entry of entries) {
    const provider = entry.provider || "custom";
    if (!groups.has(provider)) {
      groups.set(provider, {
        label: entry.providerLabel || providerLabels[provider] || provider,
        entries: []
      });
    }
    groups.get(provider).entries.push(entry);
  }
  for (const group of groups.values()) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    for (const entry of group.entries) {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = `${entry.label || entry.model || "Local Model"} | ${group.label}`;
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
  const ids = new Set(entries.map((entry) => entry.id));
  if (ids.has(previous)) select.value = previous;
  else if (ids.has(currentId)) select.value = currentId;
  else if (entries[0]) select.value = entries[0].id;
}

function setProviderOptions(select, entries, currentProvider) {
  if (!select) return;
  const previous = select.value || currentProvider;
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = entries.length ? "选择要连接的提供商" : "没有更多可添加的提供商";
  select.appendChild(placeholder);
  for (const entry of entries) {
    const option = document.createElement("option");
    option.value = entry.provider;
    option.textContent = entry.providerLabel || entry.label || entry.provider;
    select.appendChild(option);
  }
  const ids = new Set(entries.map((entry) => entry.provider));
  if (ids.has(previous)) select.value = previous;
  else if (ids.has(currentProvider)) select.value = currentProvider;
  else select.value = "";
}

function providerIsConnected(provider, runtime = state.runtime) {
  if (!provider) return false;
  return Boolean((runtime?.connectedProviders || []).some((entry) => entry.provider === provider && entry.hasApiKey));
}

function connectedModelEntries(runtime = state.runtime) {
  const connectedProviders = (runtime?.connectedProviders || []).map((entry) => entry.provider);
  const entries = connectedProviders.flatMap((provider) => modelsForProvider(provider));
  const current = catalogEntryForModel(runtime.model);
  if (current && !entries.some((entry) => entry.id === current.id)) return [current, ...entries];
  return entries;
}

function renderModelSelectors(runtime = state.runtime) {
  const providers = providerEntries().filter((entry) => !providerIsConnected(entry.provider, runtime));
  const currentId = catalogEntryForModel(runtime?.model || {})?.id || modelKey(runtime?.model || {});
  setProviderOptions(els.modelSelect, providers, "");
  const connectedEntries = connectedModelEntries(runtime);
  setSelectOptions(els.quickModelSelect, connectedEntries, currentId);
  if (els.quickModelSelect) {
    els.quickModelSelect.disabled = !connectedEntries.length;
  }
}

function applyModelEntryToFields(entry) {
  if (!entry) return;
  els.modelProvider.value = entry.provider || "";
  els.modelName.value = entry.model || "";
  els.modelKeyEnv.value = entry.apiKeyEnv || "";
  els.modelBaseUrl.value = entry.baseUrl || "";
  els.modelApiMode.value = entry.apiMode || "";
  els.authMethod.value = String(entry.authType || "").startsWith("oauth") ? entry.provider : "api-key";
}

function modelAuthCopy(entry, runtime = state.runtime) {
  const authType = String(entry?.authType || "api_key");
  if (!entry) return { state: "未选择", hint: "选择提供商后，Aimashi 会显示它需要的登录方式。" };
  if (entry.provider === "openai-codex") {
    return runtime?.auth?.codexLoggedIn
      ? { state: "已授权 OpenAI Codex", hint: "OAuth token 已保存在 Aimashi 私有 runtime；具体 Codex 模型在聊天框下方切换。" }
      : { state: "需要 OpenAI 登录", hint: "选择 OpenAI Codex 后，用 OpenAI 登录完成授权；不需要 API key。" };
  }
  if (authType.startsWith("oauth")) {
    return { state: "需要登录", hint: "这个 Hermes Provider 使用 OAuth。点击登录后，Aimashi 会展示浏览器链接、激活码和登录日志。" };
  }
  if (entry.provider === "lmstudio") {
    return { state: "本地服务", hint: "LM Studio 通常不需要 API key；请确认本地服务已启动并加载模型。" };
  }
  return runtime?.model?.provider === entry.provider && runtime?.model?.hasApiKey
    ? { state: "已保存 API key", hint: "留空保存会继续使用已保存的 key；具体模型在聊天框下方切换。" }
    : { state: "需要 API key", hint: `填写 ${entry.apiKeyEnv || "API Key"} 后保存，Aimashi 会写入私有 runtime 并重启 Hermes。` };
}

function renderConnectedProviders(runtime = state.runtime) {
  if (!els.connectedProviderList) return;
  const providers = runtime?.connectedProviders || [];
  els.connectedProviderList.innerHTML = "";
  if (!providers.length) {
    const empty = document.createElement("div");
    empty.className = "connected-provider-empty";
    empty.textContent = "还没有连接模型提供商";
    els.connectedProviderList.appendChild(empty);
    return;
  }
  for (const provider of providers) {
    const row = document.createElement("div");
    row.className = "connected-provider";
    row.innerHTML = `
      <span class="provider-logo-wrap"><img class="provider-logo" src="${escapeHtml(providerIconSrc(provider.provider))}" alt="" onerror="this.style.display='none'"></span>
      <span class="provider-main">
        <strong>${escapeHtml(provider.providerLabel || provider.provider)}</strong>
      </span>
      <span class="provider-check">✓</span>
    `;
    els.connectedProviderList.appendChild(row);
  }
}

const fontPresets = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "sf-pro": '"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
  pingfang: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  inter: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  "noto-sans-sc": '"Noto Sans SC", "Source Han Sans SC", sans-serif',
  lxgw: '"LXGW WenKai", "PingFang SC", cursive',
  mono: '"SF Mono", "Cascadia Code", Menlo, Consolas, monospace'
};

function fontStackForAppearance(appearance = {}) {
  if (appearance.fontPreset === "custom" && String(appearance.customFont || "").trim()) {
    return appearance.customFont.trim();
  }
  return fontPresets[appearance.fontPreset || "system"] || fontPresets.system;
}

function applyAppearance(appearance = {}) {
  const theme = appearance.theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty("--app-font", fontStackForAppearance(appearance));
}

function initials(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

function avatarAssetForKey(key = "") {
  let hash = 0;
  for (const char of String(key || "aimashi")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const index = (hash % 16) + 1;
  return `./assets/avatar-icons/${String(index).padStart(2, "0")}.png`;
}

function defaultAvatarAssets() {
  return Array.from({ length: 16 }, (_, index) => `./assets/avatar-icons/${String(index + 1).padStart(2, "0")}.png`);
}

function avatarImageSrc(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(https?:|file:|data:)/i.test(raw)) return raw;
  if (raw.startsWith("./") || raw.startsWith("../")) return raw;
  return `file://${raw}`;
}

function normalizeCrop(crop = {}) {
  const num = (value, fallback, min, max) => {
    const next = Number(value);
    if (!Number.isFinite(next)) return fallback;
    return Math.max(min, Math.min(max, next));
  };
  return {
    x: num(crop.x, 50, 0, 100),
    y: num(crop.y, 50, 0, 100),
    offsetX: num(crop.offsetX, 0, -320, 320),
    offsetY: num(crop.offsetY, 0, -320, 320),
    zoom: num(crop.zoom, 1, 1, 2.4)
  };
}

function avatarBackgroundStyle(image, crop = {}, color = "#5e5ce6") {
  const src = avatarImageSrc(image) || image || "";
  const c = normalizeCrop(crop);
  const imagePart = src ? `background-image:url('${escapeHtml(src)}');` : "";
  const position = crop && (Object.prototype.hasOwnProperty.call(crop, "offsetX") || Object.prototype.hasOwnProperty.call(crop, "offsetY"))
    ? `calc(50% + ${c.offsetX}px) calc(50% + ${c.offsetY}px)`
    : `${c.x}% ${c.y}%`;
  return `background-color:${escapeHtml(color)};${imagePart}background-size:${Math.round(c.zoom * 100)}%;background-position:${position};background-repeat:no-repeat;`;
}

function applyFellowAvatar(el, fellow) {
  if (!el) return;
  el.textContent = "";
  const src = avatarImageSrc(fellow?.avatarImage) || avatarAssetForKey(fellow?.key);
  const crop = normalizeCrop(fellow?.avatarCrop);
  el.style.background = fellow?.color || "#5e5ce6";
  el.style.backgroundImage = `url("${src.replaceAll('"', "%22")}")`;
  el.style.backgroundSize = `${Math.round(crop.zoom * 100)}%`;
  el.style.backgroundPosition = fellow?.avatarCrop && (Object.prototype.hasOwnProperty.call(fellow.avatarCrop, "offsetX") || Object.prototype.hasOwnProperty.call(fellow.avatarCrop, "offsetY"))
    ? `calc(50% + ${crop.offsetX}px) calc(50% + ${crop.offsetY}px)`
    : `${crop.x}% ${crop.y}%`;
  el.style.backgroundRepeat = "no-repeat";
}

function applyAvatar(el, text, color, image) {
  if (!el) return;
  el.textContent = text || "?";
  el.style.background = color || "#111827";
  el.style.backgroundImage = "";
  el.style.backgroundSize = "";
  el.style.backgroundPosition = "";
  const src = avatarImageSrc(image);
  if (src) {
    el.textContent = "";
    el.style.backgroundImage = `url("${src.replaceAll('"', "%22")}")`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMarkdown(value) {
  let html = escapeHtml(value);
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, '<code tabindex="0" title="点击复制">$1</code>');
  html = html.replace(/^\s*[-*]\s+(.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)(\n<li>.*<\/li>)*/gs, (match) => `<ul>${match.replace(/\n/g, "")}</ul>`);
  return html.replace(/\n/g, "<br>");
}

async function copyTextToClipboard(text) {
  const value = String(text || "");
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the textarea copy path for Electron file:// windows.
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

function flashCopiedCode(code) {
  code.classList.add("copied");
  clearTimeout(code._copiedTimer);
  code._copiedTimer = setTimeout(() => {
    code.classList.remove("copied");
  }, 900);
}

function nowIso() {
  return new Date().toISOString();
}

function sortSessions(sessions) {
  return [...sessions].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function formatConversationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "昨天";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function ensureReadState() {
  if (!state.chatStore || typeof state.chatStore !== "object") {
    state.chatStore = { schema_version: 1, readAt: {}, sessions: {} };
  }
  if (!state.chatStore.readAt || typeof state.chatStore.readAt !== "object") {
    state.chatStore.readAt = {};
  }
  return state.chatStore.readAt;
}

function latestAssistantMessageTime(personaKey) {
  const sessions = state.chatStore.sessions?.[personaKey] || [];
  let latest = "";
  for (const session of sessions) {
    for (const message of session.messages || []) {
      if (message.role !== "assistant" || message.transient || !String(message.content || "").trim()) continue;
      const createdAt = message.createdAt || session.updatedAt || session.createdAt || "";
      if (String(createdAt).localeCompare(latest) > 0) latest = String(createdAt);
    }
  }
  return latest;
}

function initializeReadStateForPersonas(personas) {
  const readAt = ensureReadState();
  let changed = false;
  for (const persona of personas) {
    if (!persona?.key || readAt[persona.key]) continue;
    readAt[persona.key] = latestAssistantMessageTime(persona.key) || nowIso();
    changed = true;
  }
  if (changed) persistReadStateQuietly();
}

function unreadCountForPersona(personaKey) {
  const readAt = ensureReadState()[personaKey] || "";
  let count = 0;
  for (const session of state.chatStore.sessions?.[personaKey] || []) {
    for (const message of session.messages || []) {
      if (message.role !== "assistant" || message.transient || !String(message.content || "").trim()) continue;
      const createdAt = String(message.createdAt || session.updatedAt || session.createdAt || "");
      if (createdAt && createdAt.localeCompare(readAt) > 0) count += 1;
    }
  }
  return count;
}

function totalUnreadCount(personas) {
  return personas.reduce((total, persona) => total + unreadCountForPersona(persona.key), 0);
}

async function persistReadStateQuietly() {
  try {
    if (window.aimashi?.saveChatReadState) {
      const readAt = { ...ensureReadState() };
      await window.aimashi.saveChatReadState({ readAt });
      state.chatStore.readAt = { ...state.chatStore.readAt, ...readAt };
    }
  } catch (error) {
    console.error("Failed to persist read state", error);
  }
}

function markPersonaRead(personaKey, persist = true) {
  if (!personaKey) return;
  const latest = latestAssistantMessageTime(personaKey);
  if (!latest) return;
  const readAt = ensureReadState();
  const next = latest;
  if (String(next).localeCompare(readAt[personaKey] || "") <= 0) return;
  readAt[personaKey] = next;
  if (persist) persistReadStateQuietly();
}

function conversationPreview(persona) {
  const sessions = sessionsForPersona(persona.key);
  const latest = sessions[0];
  const messages = latest?.messages || [];
  const last = [...messages].reverse().find((message) => String(message.content || "").trim() && !message.transient);
  const prefix = last?.role === "user" ? "我：" : last?.role === "assistant" ? `${persona.name || "伙伴"}：` : "";
  return {
    text: last ? `${prefix}${last.content}` : (persona.bio || "本地伙伴 · 等待 Boss 发号施令"),
    time: formatConversationTime(latest?.updatedAt || latest?.createdAt)
  };
}

function sessionsForPersona(personaKey = state.activeKey) {
  if (!state.chatStore.sessions[personaKey]) state.chatStore.sessions[personaKey] = [];
  if (!state.chatStore.sessions[personaKey].length) {
    const now = nowIso();
    state.chatStore.sessions[personaKey].push({
      id: cryptoRandomId(),
      personaKey,
      title: "新对话",
      titleGenerated: false,
      createdAt: now,
      updatedAt: now,
      messages: []
    });
  }
  state.chatStore.sessions[personaKey] = sortSessions(state.chatStore.sessions[personaKey]);
  return state.chatStore.sessions[personaKey];
}

function hasSuccessfulExchange(session) {
  const messages = session?.messages || [];
  const hasUser = messages.some((message) => message.role === "user" && String(message.content || "").trim() && !message.transient);
  const hasAssistant = messages.some((message) => message.role === "assistant" && String(message.content || "").trim() && !message.transient);
  return hasUser && hasAssistant;
}

function hasPersistableMessages(session) {
  return (session?.messages || []).some((message) => String(message.content || "").trim() && !message.transient);
}

function pruneEmptyDrafts(personaKey = state.activeKey, keepId = "") {
  if (!state.chatStore.sessions[personaKey]) return;
  state.chatStore.sessions[personaKey] = state.chatStore.sessions[personaKey].filter((session) => {
    if (session.id === keepId) return true;
    return hasSuccessfulExchange(session) || (session.messages || []).length > 0;
  });
}

function cryptoRandomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function activeSession() {
  const sessions = sessionsForPersona();
  const selected = sessions.find((session) => session.id === state.activeSessionIdByPersona[state.activeKey]);
  const session = selected || sessions[0];
  state.activeSessionIdByPersona[state.activeKey] = session.id;
  return session;
}

async function persistSession(session = activeSession()) {
  if (!hasPersistableMessages(session)) return;
  state.chatStore = await window.aimashi.saveChatSession({
    personaKey: session.personaKey || state.activeKey,
    session
  });
}

async function persistSessionQuietly(session = activeSession()) {
  try {
    await persistSession(session);
    return true;
  } catch (error) {
    console.error("Failed to persist chat session", error);
    return false;
  }
}

async function loadChatSessions() {
  state.chatStore = await window.aimashi.loadChatSessions();
  const personas = state.runtime?.fellows || state.runtime?.personas || [];
  for (const persona of personas) {
    const sessions = sessionsForPersona(persona.key);
    state.activeSessionIdByPersona[persona.key] = sessions[0]?.id;
  }
}

async function loadModelCatalog() {
  try {
    const rows = await window.aimashi.loadModelCatalog();
    state.modelCatalog = Array.isArray(rows) && rows.length ? rows : fallbackCatalogFromPresets();
  } catch (error) {
    console.error("Failed to load Hermes model catalog", error);
    state.modelCatalog = fallbackCatalogFromPresets();
  }
}

async function loadSlashCommands() {
  try {
    const rows = await window.aimashi.loadSlashCommands();
    state.slashCommands = Array.isArray(rows) && rows.length ? rows : fallbackSlashCommands;
  } catch (error) {
    console.error("Failed to load Hermes slash commands", error);
    state.slashCommands = fallbackSlashCommands;
  }
}

async function loadSkills() {
  state.skillsLoading = true;
  renderSkillLibrary();
  try {
    const library = await window.aimashi.loadSkills();
    state.skillLibrary = {
      roots: Array.isArray(library?.roots) ? library.roots : [],
      skills: Array.isArray(library?.skills) ? library.skills : []
    };
    if (!state.selectedSkillId || !state.skillLibrary.skills.some((skill) => skill.id === state.selectedSkillId)) {
      state.selectedSkillId = state.skillLibrary.skills[0]?.id || "";
      state.selectedSkillDetail = null;
    }
    if (state.selectedSkillId) await selectSkill(state.selectedSkillId, false);
  } catch (error) {
    console.error("Failed to load local skills", error);
    state.skillLibrary = { roots: [], skills: [] };
    state.selectedSkillId = "";
    state.selectedSkillDetail = null;
  } finally {
    state.skillsLoading = false;
    renderSkillLibrary();
  }
}

async function trackStartupTask(label, task) {
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const start = performance.now();
  state.startupTasks.push({ id, label });
  render();
  try {
    return await task();
  } finally {
    const ms = Math.round(performance.now() - start);
    console.info(`[Aimashi startup] ${label}: ${ms}ms`);
    state.startupTasks = state.startupTasks.filter((item) => item.id !== id);
    render();
  }
}

function selectedAuthMethod(runtime) {
  if ((runtime?.model?.provider || "") === "openai-codex") return "openai-codex";
  return els.authMethod.value || "api-key";
}

function updateModelFieldVisibility(runtime = state.runtime) {
  const providerEntry = selectedProviderEntry();
  const entry = selectedModelEntry();
  const authType = String(entry?.authType || "api_key");
  const isConnected = providerIsConnected(entry?.provider, runtime);
  const isCodex = entry ? entry.provider === "openai-codex" : false;
  const needsApiKey = Boolean(entry) && !isConnected && !isCodex && !authType.startsWith("oauth") && entry?.provider !== "lmstudio";
  const needsOauth = Boolean(entry) && !isConnected && (isCodex || authType.startsWith("oauth"));
  const canConnectWithoutKey = Boolean(entry) && !isConnected && entry.provider === "lmstudio";
  els.modelApiKeyField?.classList.toggle("hidden", !needsApiKey);
  els.codexInlineAuth.classList.toggle("hidden", !needsOauth);
  els.modelConnectButton?.classList.toggle("hidden", !(needsApiKey || canConnectWithoutKey));
  if (entry) {
    applyModelEntryToFields(entry);
    const copy = modelAuthCopy(entry, runtime);
    setText(els.modelAuthState, isConnected ? "已连接" : copy.state);
    els.modelAuthState?.classList.remove("hidden");
    setText(els.modelApiKeyLabel, entry.apiKeyEnv || "API Key");
    els.modelApiKey.placeholder = "保存在 Aimashi 私有 runtime";
    if (els.modelConnectButton) {
      els.modelConnectButton.textContent = `连接 ${providerEntry?.providerLabel || entry.providerLabel || entry.provider}`;
    }
  } else {
    els.modelAuthState?.classList.add("hidden");
  }
}

function render() {
  const runtime = state.runtime;
  if (!runtime) return;
  renderSendButton();
  const editingModel = els.modelForm.contains(document.activeElement);
  const editingProfile = els.profileForm.contains(document.activeElement);
  const editingAppearance = els.appearanceForm.contains(document.activeElement);
  const appearance = runtime.appearance || { theme: "light", fontPreset: "system", customFont: "" };
  applyAppearance(appearance);
  if (!editingAppearance) {
    els.appearanceTheme.value = appearance.theme || "light";
    const savedFontPreset = appearance.fontPreset || "system";
    els.appearanceFontPreset.value = fontPresets[savedFontPreset] || savedFontPreset === "custom" ? savedFontPreset : "system";
    els.appearanceCustomFont.value = appearance.customFont || "";
  }
  const user = runtime.user || { displayName: "Boss", avatarText: "B", avatarColor: "#111827", avatarImage: "" };
  applyAvatar(els.userAvatar, user.avatarText, user.avatarColor, user.avatarImage);
  setText(els.userDisplayName, user.displayName || "Boss");
  if (!editingProfile) {
    els.profileDisplayName.value = user.displayName || "Boss";
    els.profileAvatarText.value = user.avatarText || "B";
    els.profileAvatarColor.value = user.avatarColor || "#111827";
    els.profileAvatarImage.value = user.avatarImage || "";
  }

  els.engineStatus.textContent = runtime.engineRunning
    ? `Running ${runtime.engineManagedBy ? `via ${runtime.engineManagedBy} ` : ""}at ${runtime.engineBaseUrl}`
    : runtime.engineStarting
      ? "Starting Hermes API..."
      : runtime.engineInstalled
        ? "Hermes engine installed"
        : "Runtime home initialized; engine package not installed";
  els.hermesHome.textContent = runtime.hermesHome;
  els.manifestPath.textContent = runtime.manifestPath;
  els.engineWarning.classList.toggle("hidden", runtime.engineInstalled);
  els.engineLogs.textContent = [
    runtime.engineLastError ? `ERROR: ${runtime.engineLastError}` : "",
    ...(runtime.engineLogs || [])
  ].filter(Boolean).join("\n");
  const auth = runtime.auth || {};
  const editingModelSelect = document.activeElement === els.modelSelect || document.activeElement === els.quickModelSelect;
  if (!editingModel && !editingModelSelect) renderModelSelectors(runtime);
  renderConnectedProviders(runtime);
  updateModelFieldVisibility(runtime);
  const selectedEntry = selectedModelEntry();
  const selectedProvider = selectedEntry?.provider || auth.oauthProvider || "openai-codex";
  const selectedProviderLabel = providerLabel(selectedProvider);
  const selectedConnected = providerIsConnected(selectedProvider, runtime);
  els.codexStatus.textContent = auth.codexStarting
    ? `等待 ${auth.oauthProviderLabel || selectedProviderLabel} 授权`
    : selectedConnected
      ? `已授权 ${selectedProviderLabel}`
      : `需要登录 ${selectedProviderLabel}`;
  els.codexCheck.classList.toggle("authorized", Boolean(selectedConnected));
  els.codexCode.textContent = auth.codexUserCode
    ? `在浏览器页面输入：${auth.codexUserCode}`
    : auth.codexStarting
      ? (auth.codexVerificationUrl ? `打开：${auth.codexVerificationUrl}` : "正在请求设备码...")
      : "";
  els.codexLogs.textContent = [
    auth.codexLastError ? `ERROR: ${auth.codexLastError}` : "",
    ...(auth.codexLogs || [])
  ].filter(Boolean).join("\n");
  els.codexLogs.classList.toggle("hidden", Boolean(selectedConnected) && !auth.codexLastError);
  els.codexLogin.disabled = Boolean(auth.codexStarting);
  els.codexLogin.textContent = `登录 ${selectedProviderLabel}`;
  els.codexLogin.classList.toggle("hidden", Boolean(selectedConnected));
  els.codexCancel.disabled = !auth.codexStarting;
  els.codexCancel.classList.toggle("hidden", !auth.codexStarting);
  if (!editingModel) updateModelFieldVisibility(runtime);
  if (els.quickModelSelect && document.activeElement !== els.quickModelSelect) {
    const currentModelId = presetKeyForModel(runtime.model);
    if ([...els.quickModelSelect.options].some((option) => option.value === currentModelId)) {
      els.quickModelSelect.value = currentModelId;
    }
  }
  const connectedEntries = connectedModelEntries(runtime);
  setText(els.modelSwitchStatus, connectedEntries.length ? (runtime.engineRunning ? "已连接" : runtime.engineInstalled ? "未启动" : "未安装") : "先连接提供商");
  if (els.quickModelSelect) {
    els.quickModelSelect.title = `当前模型：${modelDisplayName(runtime.model)}`;
  }
  const activeIcon = modelIconSrc(runtime.model || {});
  const modelAvatar = document.querySelector(".model-avatar");
  if (modelAvatar) {
    modelAvatar.textContent = activeIcon ? "" : "◇";
    modelAvatar.style.backgroundImage = activeIcon ? `url("${activeIcon}")` : "";
  }

  const personas = runtime.fellows || runtime.personas || [];
  if (!personas.some((persona) => persona.key === state.activeKey) && personas.length) {
    state.activeKey = personas[0].key;
  }
  initializeReadStateForPersonas(personas);
  markPersonaRead(state.activeKey, false);
  const unreadTotal = totalUnreadCount(personas);
  els.personaCount.textContent = unreadTotal > 99 ? "99+" : String(unreadTotal);
  els.personaCount.classList.toggle("hidden", unreadTotal <= 0);
  const active = personas.find((persona) => persona.key === state.activeKey) || personas[0];
  if (active) {
    applyFellowAvatar(els.activeChatAvatar, active);
    setText(els.activeChatName, active.name || "Aimashi");
    setText(els.activeChatBadge, "Fellow");
    const loading = state.startupTasks[0]?.label;
    setText(els.activeChatMeta, `${sessionsForPersona(active.key).length} 个会话 · 在线${loading ? ` · 正在${loading}` : ""}`);
  }
  const filter = state.personaFilter.trim().toLowerCase();
  const visiblePersonas = filter
    ? personas.filter((persona) => `${persona.name || ""} ${persona.key || ""}`.toLowerCase().includes(filter))
    : personas;

  els.personaList.innerHTML = "";
  for (const persona of visiblePersonas) {
    const preview = conversationPreview(persona);
    const unread = unreadCountForPersona(persona.key);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `persona${persona.key === state.activeKey ? " active" : ""}`;
    button.innerHTML = `
      <span class="avatar fellow-photo" style="${avatarBackgroundStyle(persona.avatarImage || avatarAssetForKey(persona.key), persona.avatarCrop, persona.color || "#5e5ce6")}"></span>
      <span class="persona-main">
        <span class="persona-name">${escapeHtml(persona.name)}</span>
        <span class="persona-key">${escapeHtml(preview.text)}</span>
      </span>
      <span class="persona-side">
        <span class="persona-time">${escapeHtml(preview.time)}</span>
        <span class="persona-unread${unread ? "" : " hidden"}">${escapeHtml(unread > 99 ? "99+" : String(unread))}</span>
      </span>
    `;
    button.addEventListener("click", () => {
      state.activeKey = persona.key;
      const latest = sessionsForPersona(persona.key)[0];
      state.activeSessionIdByPersona[persona.key] = latest?.id;
      markPersonaRead(persona.key);
      state.sessionMenuOpen = false;
      render();
    });
    els.personaList.appendChild(button);
  }
  if (!visiblePersonas.length) {
    const empty = document.createElement("div");
    empty.className = "persona-empty";
    empty.textContent = "没有匹配的伙伴";
    els.personaList.appendChild(empty);
  }
  renderView();
  renderSessionMenu();
  renderChat();
}

function renderView() {
  els.conversationSidebar?.classList.toggle("hidden", state.activeView !== "chat");
  els.skillsSidebar?.classList.toggle("hidden", state.activeView !== "skills");
  els.chatView.classList.toggle("hidden", state.activeView !== "chat");
  els.skillsView?.classList.toggle("hidden", state.activeView !== "skills");
  els.settingsView.classList.toggle("hidden", !state.settingsOpen);
  els.fellowCreateMenu?.classList.toggle("hidden", !state.fellowMenuOpen);
  els.fellowDialog?.classList.toggle("hidden", !state.fellowDialogOpen);
  els.avatarCropDialog?.classList.toggle("hidden", !state.avatarCropEditor.open);
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.activeView);
  });
  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsTab === state.activeSettingsTab);
  });
  document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.settingsPanel !== state.activeSettingsTab);
  });
  renderSkillLibrary();
}

function skillTone(skill = {}) {
  const text = `${skill.category || ""} ${(skill.tags || []).join(" ")} ${skill.name || ""}`.toLowerCase();
  if (/creative|image|video|art|design|media|p5|ascii|music/.test(text)) return "creative";
  if (/software|github|devops|mcp|agent|plugin|install|author|code/.test(text)) return "build";
  if (/apple|productivity|email|note|calendar|maps|home/.test(text)) return "ops";
  return "docs";
}

function skillInitials(name = "") {
  const parts = String(name || "?").split(/[-_\s/]+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : String(name || "?").slice(0, 2)).toUpperCase();
}

function skillMatchesFilters(skill) {
  const needle = state.skillFilter.trim().toLowerCase();
  const category = state.skillCategoryFilter.trim().toLowerCase();
  const haystack = [
    skill.name,
    skill.title,
    skill.description,
    skill.category,
    skill.sourceLabel,
    skill.relPath,
    ...(skill.tags || [])
  ].join(" ").toLowerCase();
  return (!needle || haystack.includes(needle)) && (!category || String(skill.category || "") === category);
}

function visibleSkills() {
  return (state.skillLibrary.skills || []).filter(skillMatchesFilters);
}

function skillCategories() {
  const counts = new Map();
  for (const skill of state.skillLibrary.skills || []) {
    const category = skill.category || "uncategorized";
    counts.set(category, (counts.get(category) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

async function selectSkill(skillId, shouldRender = true) {
  if (!skillId) return;
  state.selectedSkillId = skillId;
  const listed = state.skillLibrary.skills.find((skill) => skill.id === skillId);
  state.selectedSkillDetail = listed || null;
  if (shouldRender) renderSkillLibrary();
  try {
    state.selectedSkillDetail = await window.aimashi.readSkill(skillId);
  } catch (error) {
    console.error("Failed to read skill", error);
  }
  if (shouldRender) renderSkillLibrary();
}

function renderSkillLibrary() {
  if (!els.skillNav || !els.skillCardGrid || !els.skillDetailPanel) return;
  const skills = state.skillLibrary.skills || [];
  const shown = visibleSkills();
  const roots = state.skillLibrary.roots || [];
  const sources = roots.filter((root) => root.exists).map((root) => root.label).join(" / ") || "Local Skills";
  setText(els.skillLibraryMeta, state.skillsLoading ? "正在扫描本地 Skill..." : `${skills.length} 个本地 Skill · ${sources}`);
  setText(els.skillSourceMeta, sources);
  setText(els.skillEnabledMeta, skills.length ? "Ready" : "Empty");

  const bySource = skills.reduce((acc, skill) => {
    acc[skill.sourceLabel] = (acc[skill.sourceLabel] || 0) + 1;
    return acc;
  }, {});
  els.skillStats.innerHTML = Object.entries(bySource).length
    ? Object.entries(bySource).map(([label, count]) => `<span><strong>${count}</strong> ${escapeHtml(label)}</span>`).join("")
    : `<span><strong>0</strong> 未发现</span>`;

  const categories = skillCategories();
  els.skillChipRow.innerHTML = [
    `<button class="${state.skillCategoryFilter ? "" : "active"}" type="button" data-skill-filter="">全部</button>`,
    ...categories.slice(0, 10).map(([category, count]) => `
      <button class="${state.skillCategoryFilter === category ? "active" : ""}" type="button" data-skill-filter="${escapeHtml(category)}">
        ${escapeHtml(category)} <span>${count}</span>
      </button>
    `)
  ].join("");

  const grouped = new Map();
  for (const skill of shown) {
    const category = skill.category || "uncategorized";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(skill);
  }
  els.skillNav.innerHTML = grouped.size
    ? [...grouped.entries()].map(([category, rows]) => `
      <div class="skill-section-label">${escapeHtml(category)}</div>
      ${rows.map((skill) => `
        <button class="skill-nav-row${skill.id === state.selectedSkillId ? " active" : ""}" type="button" data-skill-select="${escapeHtml(skill.id)}">
          <span class="skill-dot ${skillTone(skill)}">${escapeHtml(skillInitials(skill.name))}</span>
          <span><strong>${escapeHtml(skill.name)}</strong><small>${escapeHtml(skill.description || skill.relPath || "")}</small></span>
          <em>${escapeHtml(skill.sourceLabel)}</em>
        </button>
      `).join("")}
    `).join("")
    : `<div class="persona-empty">${state.skillsLoading ? "正在扫描..." : "没有匹配的 Skill"}</div>`;

  els.skillCardGrid.innerHTML = shown.length
    ? shown.map((skill) => `
      <article class="skill-card${skill.id === state.selectedSkillId ? " featured" : ""}" data-skill-select="${escapeHtml(skill.id)}">
        <header>
          <span class="skill-dot ${skillTone(skill)}">${escapeHtml(skillInitials(skill.name))}</span>
          <strong>${escapeHtml(skill.name)}</strong>
          <em>${escapeHtml(skill.sourceLabel)}</em>
        </header>
        <p>${escapeHtml(skill.description || "无描述")}</p>
        <footer>
          <span>${escapeHtml(skill.category || "uncategorized")}</span>
          ${(skill.tags || []).slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
          ${skill.version ? `<span>v${escapeHtml(skill.version)}</span>` : ""}
        </footer>
      </article>
    `).join("")
    : `<div class="skill-empty-state">${state.skillsLoading ? "正在扫描本地 Skill..." : "没有匹配的 Skill"}</div>`;

  const selected = state.selectedSkillDetail || skills.find((skill) => skill.id === state.selectedSkillId) || shown[0];
  if (!selected) {
    els.skillDetailPanel.innerHTML = `<div class="skill-empty-state">没有可预览的 Skill。</div>`;
  } else {
    const body = selected.body || selected.bodyPreview || "";
    els.skillDetailPanel.innerHTML = `
      <div class="skill-detail-head">
        <span class="skill-dot ${skillTone(selected)}">${escapeHtml(skillInitials(selected.name))}</span>
        <div>
          <h2>${escapeHtml(selected.name)}</h2>
          <p>${escapeHtml(selected.sourceLabel)} · ${escapeHtml(selected.relPath || selected.category || "")}</p>
        </div>
      </div>
      <dl class="skill-detail-list">
        <div><dt>分类</dt><dd>${escapeHtml(selected.category || "uncategorized")}</dd></div>
        <div><dt>版本</dt><dd>${escapeHtml(selected.version || "未声明")}</dd></div>
        <div><dt>路径</dt><dd>${escapeHtml(selected.filePath || "")}</dd></div>
        <div><dt>状态</dt><dd><span class="status-pill">真实 SKILL.md</span></dd></div>
      </dl>
      <div class="skill-file-preview">
        <strong>SKILL.md</strong>
        <pre class="skill-source-preview">${escapeHtml(body || "无内容")}</pre>
      </div>
    `;
  }

  els.skillNav.querySelectorAll("[data-skill-select]").forEach((button) => {
    button.addEventListener("click", () => selectSkill(button.dataset.skillSelect));
  });
  els.skillCardGrid.querySelectorAll("[data-skill-select]").forEach((card) => {
    card.addEventListener("click", () => selectSkill(card.dataset.skillSelect));
  });
  els.skillChipRow.querySelectorAll("[data-skill-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.skillCategoryFilter = button.dataset.skillFilter || "";
      renderSkillLibrary();
    });
  });
}

function messagesForActive() {
  return activeSession().messages;
}

function renderSessionMenu() {
  if (!els.sessionMenu || !els.sessionList) return;
  els.sessionMenu.classList.toggle("hidden", !state.sessionMenuOpen);
  const sessions = sessionsForPersona();
  const current = activeSession();
  const activeId = current.id;
  updateCurrentSessionTitle(current.title || "新对话");
  els.sessionList.innerHTML = "";
  for (const session of sessions) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `session-row${session.id === activeId ? " active" : ""}`;
    row.innerHTML = `
      <span>
        <strong>${escapeHtml(session.title || "新对话")}</strong>
        <small>${escapeHtml(new Date(session.updatedAt || session.createdAt || Date.now()).toLocaleString())}</small>
      </span>
      <em title="重命名" data-session-edit="${escapeHtml(session.id)}">✎</em>
    `;
    row.addEventListener("click", async (event) => {
      const editTarget = event.target.closest("[data-session-edit]");
      if (editTarget) {
        event.stopPropagation();
        const title = window.prompt("重命名这个会话", session.title || "新对话");
        if (!title || !title.trim()) return;
        state.chatStore = await window.aimashi.renameChatSession({
          personaKey: state.activeKey,
          sessionId: session.id,
          title
        });
      } else {
        state.activeSessionIdByPersona[state.activeKey] = session.id;
        state.sessionMenuOpen = false;
        state.forceScrollToBottom = true;
      }
      render();
    });
    els.sessionList.appendChild(row);
  }
}

function updateCurrentSessionTitle(title) {
  if (!els.currentSessionTitle) return;
  const next = title || "新对话";
  if (els.currentSessionTitle.textContent === next) return;
  els.currentSessionTitle.textContent = next;
  els.currentSessionTitle.classList.remove("title-updated");
  requestAnimationFrame(() => els.currentSessionTitle.classList.add("title-updated"));
}

async function maybeGenerateTitleForSession(session) {
  if (!session || session.titleGenerated || !hasSuccessfulExchange(session) || state.generatingTitleIds.has(session.id)) return;
  state.generatingTitleIds.add(session.id);
  try {
    const result = await window.aimashi.generateSessionTitle({
      personaKey: session.personaKey || state.activeKey,
      sessionId: `title:${session.id}`,
      messages: (session.messages || []).filter((message) => !message.transient).slice(0, 4)
    });
    session.title = result.title || session.title || "新对话";
    session.titleGenerated = true;
    session.updatedAt = nowIso();
    await persistSessionQuietly(session);
    renderSessionMenu();
  } finally {
    state.generatingTitleIds.delete(session.id);
  }
}

function renderChat() {
  const wasNearBottom = !els.chat || (els.chat.scrollHeight - els.chat.scrollTop - els.chat.clientHeight < 80);
  const session = activeSession();
  const messages = session.messages;
  const user = state.runtime?.user || { displayName: "Boss", avatarText: "B", avatarColor: "#111827" };
  els.chat.innerHTML = "";
  for (const message of messages) {
    const article = document.createElement("article");
    article.className = `message ${message.role === "user" ? "user" : "assistant"}`;
    const persona = activePersona();
    const label = message.role === "user" ? (user.avatarText || initials(user.displayName)) : initials(persona?.name || "A");
    const color = message.role === "user" ? user.avatarColor : (persona?.color || "#23444d");
    const fellowAvatar = avatarImageSrc(persona?.avatarImage) || avatarAssetForKey(persona?.key);
    const crop = normalizeCrop(persona?.avatarCrop);
    const imageStyle = message.role === "assistant"
      ? `background-image:url('${escapeHtml(fellowAvatar)}');background-size:${Math.round(crop.zoom * 100)}%;background-position:${persona?.avatarCrop && (Object.prototype.hasOwnProperty.call(persona.avatarCrop, "offsetX") || Object.prototype.hasOwnProperty.call(persona.avatarCrop, "offsetY")) ? `calc(50% + ${crop.offsetX}px) calc(50% + ${crop.offsetY}px)` : `${crop.x}% ${crop.y}%`};background-repeat:no-repeat;`
      : "";
    article.innerHTML = `
      <div class="avatar" style="background-color:${escapeHtml(color || "#111827")};${imageStyle}">${message.role === "user" ? escapeHtml(label) : ""}</div>
      <div class="bubble">${renderMarkdown(message.content)}</div>
    `;
    els.chat.appendChild(article);
  }
  if (state.runtime && !state.runtime.engineInstalled) {
    const warning = document.createElement("article");
    warning.className = "message warning";
    warning.innerHTML = `
      <div class="avatar">!</div>
      <div class="bubble"><strong>Engine not installed</strong><p>点击 Install Engine，把官方 Hermes package 安装到 Aimashi 私有 runtime。</p></div>
    `;
    els.chat.appendChild(warning);
  }
  if (state.runtime?.engineInstalled && !state.runtime?.model?.hasApiKey) {
    const warning = document.createElement("article");
    warning.className = "message warning";
    warning.innerHTML = `
      <div class="avatar">!</div>
      <div class="bubble"><strong>Model login needed</strong><p>私有 Hermes 已就绪；可以在右侧保存 API key，或使用 OpenAI Codex 登录。</p></div>
    `;
    els.chat.appendChild(warning);
  }
  if (state.forceScrollToBottom || wasNearBottom) {
    els.chat.scrollTop = els.chat.scrollHeight;
  }
  state.forceScrollToBottom = false;
}

function activePersona() {
  const personas = state.runtime?.fellows || state.runtime?.personas || [];
  return personas.find((persona) => persona.key === state.activeKey) || personas[0];
}

function appendChat(role, content, options = {}) {
  const session = activeSession();
  const message = { role, content, createdAt: nowIso(), transient: Boolean(options.transient) };
  session.messages.push(message);
  session.updatedAt = nowIso();
  const shouldMarkRead = role === "assistant" && !message.transient;
  if (shouldMarkRead) markPersonaRead(session.personaKey || state.activeKey, false);
  state.forceScrollToBottom = true;
  renderChat();
  renderSessionMenu();
  if (options.persist) {
    persistSessionQuietly(session).then(() => {
      if (shouldMarkRead) persistReadStateQuietly();
    });
  } else if (shouldMarkRead) {
    persistReadStateQuietly();
  }
  return message;
}

function appendTransientChat(role, content) {
  const session = activeSession();
  session.messages.push({ role, content, createdAt: nowIso(), transient: true });
  session.updatedAt = nowIso();
  state.forceScrollToBottom = true;
  renderChat();
  renderSessionMenu();
}

function filteredSlashCommands() {
  const filter = state.slashFilter.replace(/^\//, "").trim().toLowerCase();
  const commands = state.slashCommands || fallbackSlashCommands;
  if (!filter) return commands;
  return commands.filter((item) => `${item.command} ${item.description}`.toLowerCase().includes(filter));
}

function updateSlashCommandState() {
  const value = els.chatInput.value;
  const cursor = els.chatInput.selectionStart || 0;
  const before = value.slice(0, cursor);
  const line = before.split(/\n/).pop() || "";
  const shouldOpen = /^\/[A-Za-z0-9_-]*$/.test(line);
  state.slashMenuOpen = shouldOpen;
  state.slashFilter = shouldOpen ? line : "";
  if (shouldOpen && state.slashFilter.length <= 1) state.slashSelectedIndex = 0;
  const commands = filteredSlashCommands();
  if (state.slashSelectedIndex >= commands.length) state.slashSelectedIndex = Math.max(0, commands.length - 1);
  renderSlashCommandMenu();
}

function renderSlashCommandMenu() {
  if (!els.slashCommandMenu) return;
  const commands = filteredSlashCommands();
  els.slashCommandMenu.classList.toggle("hidden", !state.slashMenuOpen);
  if (!state.slashMenuOpen) {
    els.slashCommandMenu.innerHTML = "";
    return;
  }
  if (!commands.length) {
    els.slashCommandMenu.innerHTML = `<div class="slash-command-empty">没有匹配的命令</div>`;
    return;
  }
  els.slashCommandMenu.innerHTML = commands.map((item, index) => `
    <button type="button" class="slash-command-item${index === state.slashSelectedIndex ? " active" : ""}" data-command="${escapeHtml(item.command)}">
      <span class="slash-command-token">${escapeHtml(item.command)}</span>
      <span class="slash-command-description">${escapeHtml(item.description)}</span>
    </button>
  `).join("");
  els.slashCommandMenu.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const command = commands.find((item) => item.command === button.dataset.command);
      if (command) sendSlashCommand(command);
    });
  });
}

function commandTextForSend(command) {
  return String(command.command || "").trim();
}

async function sendSlashCommand(command) {
  const text = commandTextForSend(command);
  if (!text) return;
  els.chatInput.value = text;
  state.slashMenuOpen = false;
  state.slashFilter = "";
  renderSlashCommandMenu();
  els.chatForm.requestSubmit();
}

function fillSlashCommand(command) {
  const value = els.chatInput.value;
  const cursor = els.chatInput.selectionStart || 0;
  const before = value.slice(0, cursor);
  const after = value.slice(cursor);
  const lineStart = before.lastIndexOf("\n") + 1;
  els.chatInput.value = `${value.slice(0, lineStart)}${command.command} ${after}`;
  const next = lineStart + command.command.length + 1;
  els.chatInput.setSelectionRange(next, next);
  state.slashMenuOpen = false;
  renderSlashCommandMenu();
  els.chatInput.focus();
}

async function createNewSessionForActive() {
  pruneEmptyDrafts(state.activeKey);
  state.chatStore = await window.aimashi.createChatSession({ personaKey: state.activeKey });
  const latest = sessionsForPersona(state.activeKey)[0];
  state.activeSessionIdByPersona[state.activeKey] = latest?.id;
  state.sessionMenuOpen = false;
  state.forceScrollToBottom = true;
  render();
}

async function refreshRuntime() {
  state.runtime = await window.aimashi.runtimeStatus();
  render();
}

async function initializeRuntime() {
  state.runtime = await trackStartupTask("初始化 runtime", () => window.aimashi.initializeRuntime());
  await trackStartupTask("加载会话", loadChatSessions);
  render();
  setTimeout(() => {
    Promise.allSettled([
      trackStartupTask("加载 Hermes 模型列表", loadModelCatalog),
      trackStartupTask("加载 Hermes 命令列表", loadSlashCommands),
      trackStartupTask("扫描本地 Skill", loadSkills)
    ]).then(() => render());
  }, 800);
}

els.openSettings.addEventListener("click", () => {
  state.settingsOpen = true;
  renderView();
});
els.closeSettings.addEventListener("click", () => {
  state.settingsOpen = false;
  renderView();
});
els.settingsView.addEventListener("click", (event) => {
  if (event.target === els.settingsView) {
    state.settingsOpen = false;
    renderView();
  }
});
els.sessionMenuButton.addEventListener("click", (event) => {
  event.stopPropagation();
  state.sessionMenuOpen = !state.sessionMenuOpen;
  renderSessionMenu();
});
document.addEventListener("click", (event) => {
  if (!state.sessionMenuOpen) return;
  if (els.sessionMenu?.contains(event.target)) return;
  state.sessionMenuOpen = false;
  renderSessionMenu();
});
document.addEventListener("click", (event) => {
  if (!state.fellowMenuOpen) return;
  if (els.fellowCreateMenu?.contains(event.target) || els.newPersona?.contains(event.target)) return;
  state.fellowMenuOpen = false;
  renderView();
});
els.newSession.addEventListener("click", async (event) => {
  event.stopPropagation();
  await createNewSessionForActive();
});
els.initialize.addEventListener("click", initializeRuntime);
els.personaSearch.addEventListener("input", () => {
  state.personaFilter = els.personaSearch.value;
  render();
});
els.skillSearch?.addEventListener("input", () => {
  state.skillFilter = els.skillSearch.value;
  renderSkillLibrary();
});
document.querySelectorAll("[data-skill-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.skillCategoryFilter = button.dataset.skillFilter || "";
    renderSkillLibrary();
  });
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.activeView = button.dataset.view;
    if (button.dataset.view === "settings") state.settingsOpen = true;
    if (button.dataset.view === "skills" && !state.skillLibrary.skills.length && !state.skillsLoading) loadSkills();
    renderView();
  });
});

document.querySelectorAll("[data-settings-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    state.activeSettingsTab = button.dataset.settingsTab;
    renderView();
  });
});

els.installEngine.addEventListener("click", async () => {
  els.installEngine.disabled = true;
  els.installEngine.textContent = "Installing...";
  try {
    state.runtime = await window.aimashi.installEngine();
    await loadModelCatalog();
    render();
  } catch (error) {
    appendChat("assistant", `Install failed: ${error.message}`);
  } finally {
    els.installEngine.disabled = false;
    els.installEngine.textContent = "Install Engine";
  }
});
els.startEngine.addEventListener("click", async () => {
  els.startEngine.disabled = true;
  els.startEngine.textContent = "Starting...";
  try {
    state.runtime = await window.aimashi.startEngine();
    render();
  } catch (error) {
    appendChat("assistant", `Start failed: ${error.message}`);
    await refreshRuntime();
  } finally {
    els.startEngine.disabled = false;
    els.startEngine.textContent = "Start";
  }
});
els.stopEngine.addEventListener("click", async () => {
  state.runtime = await window.aimashi.stopEngine();
  render();
});

els.codexLogin.addEventListener("click", async () => {
  els.codexLogin.disabled = true;
  try {
    const entry = selectedModelEntry();
    if (entry) {
      applyModelEntryToFields(entry);
      if (entry.provider === "openai-codex") state.runtime = await window.aimashi.saveModel({
        provider: entry.provider,
        model: entry.model,
        apiKeyEnv: entry.apiKeyEnv,
        baseUrl: entry.baseUrl,
        apiMode: entry.apiMode,
        providerLabel: entry.providerLabel,
        authType: entry.authType
      });
    }
    state.runtime = await window.aimashi.startProviderOAuth({
      provider: entry?.provider || "openai-codex",
      providerLabel: entry?.providerLabel || providerLabel(entry?.provider || "openai-codex"),
      authType: entry?.authType || "oauth_external",
      baseUrl: entry?.baseUrl || "",
      apiMode: entry?.apiMode || ""
    });
    render();
  } catch (error) {
    appendChat("assistant", `OAuth login failed: ${error.message}`);
    await refreshRuntime();
  }
});

els.codexCancel.addEventListener("click", async () => {
  state.runtime = await window.aimashi.cancelProviderOAuth();
  render();
});

els.modelPreset.addEventListener("change", () => {
  fillModelFieldsFromPreset(els.modelPreset.value);
});

els.authMethod.addEventListener("change", () => {
  if (els.authMethod.value === "openai-codex") {
    const preset = providerPresets["openai-codex"];
    els.modelProvider.value = preset.provider;
    els.modelName.value = preset.model;
    els.modelKeyEnv.value = "";
    els.modelApiKey.value = "";
    els.modelBaseUrl.value = "";
    els.modelApiMode.value = preset.apiMode;
    els.modelPreset.value = "";
  }
  updateModelFieldVisibility();
});

els.quickModelSelect?.addEventListener("change", async () => {
  const entry = connectedModelEntries().find((item) => item.id === els.quickModelSelect.value);
  if (!entry) return;
  els.quickModelSelect.disabled = true;
  setText(els.modelSwitchStatus, "切换中...");
  try {
    state.runtime = await window.aimashi.saveModel({
      provider: entry.provider,
      model: entry.model,
      apiKeyEnv: entry.apiKeyEnv,
      baseUrl: entry.baseUrl,
      apiMode: entry.apiMode,
      providerLabel: entry.providerLabel,
      authType: entry.authType
    });
    applyModelEntryToFields(entry);
    setText(els.modelSwitchStatus, "已切换");
    const auth = modelAuthCopy(entry, state.runtime);
    if (auth.state.includes("需要")) {
      state.settingsOpen = true;
      state.activeSettingsTab = "model";
    }
    render();
  } catch (error) {
    setText(els.modelSwitchStatus, "切换失败");
    appendTransientChat("assistant", `Model switch failed: ${error.message}`);
    await refreshRuntime();
  } finally {
    els.quickModelSelect.disabled = !connectedModelEntries(state.runtime).length;
  }
});

els.modelSelect?.addEventListener("change", () => {
  const entry = selectedModelEntry();
  applyModelEntryToFields(entry);
  updateModelFieldVisibility();
});

function setFellowAvatarDraft(image, crop = { x: 50, y: 50, zoom: 1 }) {
  state.fellowAvatarDraft = {
    image: String(image || ""),
    crop: normalizeCrop(crop)
  };
  if (els.fellowAvatar) els.fellowAvatar.value = state.fellowAvatarDraft.image;
  renderFellowAvatarDraft();
}

function renderFellowAvatarDefaults() {
  if (!els.fellowAvatarDefaults) return;
  const selected = state.fellowAvatarDraft.image;
  els.fellowAvatarDefaults.innerHTML = defaultAvatarAssets().map((src) => `
    <button type="button" class="avatar-default${selected === src ? " active" : ""}" data-avatar="${escapeHtml(src)}" style="${avatarBackgroundStyle(src, { x: 50, y: 50, zoom: 1 }, "#eef0ff")}"></button>
  `).join("");
  els.fellowAvatarDefaults.querySelectorAll("[data-avatar]").forEach((button) => {
    button.addEventListener("click", () => {
      setFellowAvatarDraft(button.dataset.avatar, { x: 50, y: 50, zoom: 1 });
    });
  });
}

function renderFellowAvatarDraft() {
  const draft = state.fellowAvatarDraft;
  const crop = normalizeCrop(draft.crop);
  if (els.fellowAvatarPreview) {
    els.fellowAvatarPreview.setAttribute("style", avatarBackgroundStyle(draft.image, crop, "#eef0ff"));
  }
  renderFellowAvatarDefaults();
}

function renderAvatarCropEditor() {
  if (!els.avatarCropStage) return;
  const editor = state.avatarCropEditor;
  const crop = normalizeCrop(editor.crop);
  els.avatarCropStage.setAttribute("style", avatarBackgroundStyle(editor.image, crop, "#eef0ff"));
}

function openAvatarCropEditor(image) {
  state.avatarCropEditor = {
    open: true,
    image: String(image || ""),
    crop: { x: 50, y: 50, offsetX: 0, offsetY: 0, zoom: 1.12 },
    dragging: false,
    lastX: 0,
    lastY: 0
  };
  renderView();
  renderAvatarCropEditor();
}

function closeAvatarCropEditor() {
  state.avatarCropEditor.open = false;
  state.avatarCropEditor.dragging = false;
  renderView();
}

function updateAvatarCropEditor(crop) {
  state.avatarCropEditor.crop = normalizeCrop({
    ...state.avatarCropEditor.crop,
    ...crop
  });
  renderAvatarCropEditor();
}

function readFellowAvatarFile(file) {
  if (!file || !file.type?.startsWith("image/")) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    openAvatarCropEditor(String(reader.result || ""));
  });
  reader.readAsDataURL(file);
}

function openFellowDialog() {
  state.fellowMenuOpen = false;
  state.fellowDialogOpen = true;
  els.fellowName.value = "";
  setFellowAvatarDraft(defaultAvatarAssets()[0], { x: 50, y: 50, zoom: 1 });
  els.fellowSeed.value = "";
  renderView();
  setTimeout(() => els.fellowName?.focus(), 0);
}

function closeFellowDialog() {
  state.fellowDialogOpen = false;
  renderView();
}

els.newPersona.addEventListener("click", (event) => {
  event.stopPropagation();
  state.fellowMenuOpen = !state.fellowMenuOpen;
  renderView();
});

els.addFellow?.addEventListener("click", openFellowDialog);
els.closeFellowDialog?.addEventListener("click", closeFellowDialog);
els.cancelFellow?.addEventListener("click", closeFellowDialog);
els.chooseFellowAvatar?.addEventListener("click", () => els.fellowAvatarFile?.click());
els.fellowAvatarFile?.addEventListener("change", () => {
  readFellowAvatarFile(els.fellowAvatarFile.files?.[0]);
  els.fellowAvatarFile.value = "";
});
els.fellowAvatarDrop?.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.fellowAvatarDrop.classList.add("dragging");
});
els.fellowAvatarDrop?.addEventListener("dragleave", () => {
  els.fellowAvatarDrop.classList.remove("dragging");
});
els.fellowAvatarDrop?.addEventListener("drop", (event) => {
  event.preventDefault();
  els.fellowAvatarDrop.classList.remove("dragging");
  readFellowAvatarFile(event.dataTransfer?.files?.[0]);
});
els.avatarCropStage?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  state.avatarCropEditor.dragging = true;
  state.avatarCropEditor.lastX = event.clientX;
  state.avatarCropEditor.lastY = event.clientY;
  els.avatarCropStage.setPointerCapture?.(event.pointerId);
});
els.avatarCropStage?.addEventListener("pointermove", (event) => {
  if (!state.avatarCropEditor.dragging) return;
  const dx = event.clientX - state.avatarCropEditor.lastX;
  const dy = event.clientY - state.avatarCropEditor.lastY;
  state.avatarCropEditor.lastX = event.clientX;
  state.avatarCropEditor.lastY = event.clientY;
  updateAvatarCropEditor({
    offsetX: state.avatarCropEditor.crop.offsetX + dx,
    offsetY: state.avatarCropEditor.crop.offsetY + dy
  });
});
els.avatarCropStage?.addEventListener("pointerup", (event) => {
  state.avatarCropEditor.dragging = false;
  els.avatarCropStage.releasePointerCapture?.(event.pointerId);
});
els.avatarCropStage?.addEventListener("pointercancel", () => {
  state.avatarCropEditor.dragging = false;
});
els.avatarCropStage?.addEventListener("wheel", (event) => {
  event.preventDefault();
  const direction = event.deltaY > 0 ? -1 : 1;
  updateAvatarCropEditor({
    zoom: state.avatarCropEditor.crop.zoom + direction * 0.08
  });
});
els.confirmAvatarCrop?.addEventListener("click", () => {
  setFellowAvatarDraft(state.avatarCropEditor.image, state.avatarCropEditor.crop);
  closeAvatarCropEditor();
});
els.cancelAvatarCrop?.addEventListener("click", closeAvatarCropEditor);
els.resetAvatarCrop?.addEventListener("click", () => {
  updateAvatarCropEditor({ x: 50, y: 50, offsetX: 0, offsetY: 0, zoom: 1.12 });
});

els.profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.runtime = await window.aimashi.saveProfile({
    displayName: els.profileDisplayName.value,
    avatarText: els.profileAvatarText.value,
    avatarColor: els.profileAvatarColor.value,
    avatarImage: els.profileAvatarImage.value
  });
  render();
});

els.appearanceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const next = {
    theme: els.appearanceTheme.value,
    fontPreset: els.appearanceFontPreset.value,
    customFont: els.appearanceCustomFont.value
  };
  applyAppearance(next);
  state.runtime = await window.aimashi.saveAppearance(next);
  render();
});

els.appearanceTheme.addEventListener("change", () => {
  applyAppearance({
    theme: els.appearanceTheme.value,
    fontPreset: els.appearanceFontPreset.value,
    customFont: els.appearanceCustomFont.value
  });
});

els.appearanceFontPreset.addEventListener("change", () => {
  applyAppearance({
    theme: els.appearanceTheme.value,
    fontPreset: els.appearanceFontPreset.value,
    customFont: els.appearanceCustomFont.value
  });
});

els.appearanceCustomFont.addEventListener("input", () => {
  if (els.appearanceFontPreset.value !== "custom") return;
  applyAppearance({
    theme: els.appearanceTheme.value,
    fontPreset: "custom",
    customFont: els.appearanceCustomFont.value
  });
});

els.fellowForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fellow = {
    name: els.fellowName.value,
    avatarImage: state.fellowAvatarDraft.image || els.fellowAvatar.value,
    avatarCrop: normalizeCrop(state.fellowAvatarDraft.crop),
    description: els.fellowSeed.value
  };
  state.runtime = await window.aimashi.saveFellow(fellow);
  const fellows = state.runtime?.fellows || state.runtime?.personas || [];
  const saved = [...fellows].reverse().find((item) => item.name === fellow.name.trim()) || fellows[0];
  if (saved?.key) state.activeKey = saved.key;
  await loadChatSessions();
  state.fellowDialogOpen = false;
  render();
});

els.modelForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const entry = selectedModelEntry();
  if (!entry || providerIsConnected(entry.provider)) return;
  const needsApiKey = entry.provider !== "openai-codex" && entry.provider !== "lmstudio" && !String(entry.authType || "").startsWith("oauth");
  if (needsApiKey && !els.modelApiKey.value.trim()) {
    setText(els.modelAuthState, `需要填写 ${entry.apiKeyEnv || "API Key"}`);
    return;
  }
  if (entry) applyModelEntryToFields(entry);
  state.runtime = await window.aimashi.saveModel({
    provider: els.modelProvider.value,
    model: els.modelName.value,
    apiKeyEnv: els.modelKeyEnv.value,
    apiKey: els.modelApiKey.value,
    baseUrl: els.modelBaseUrl.value,
    apiMode: els.modelApiMode.value,
    providerLabel: entry.providerLabel,
    authType: entry.authType
  });
  els.modelApiKey.value = "";
  if (els.modelSelect) els.modelSelect.value = "";
  render();
});

els.chatInput.addEventListener("keydown", (event) => {
  if (state.slashMenuOpen) {
    const commands = filteredSlashCommands();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      state.slashSelectedIndex = commands.length ? (state.slashSelectedIndex + 1) % commands.length : 0;
      renderSlashCommandMenu();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      state.slashSelectedIndex = commands.length ? (state.slashSelectedIndex - 1 + commands.length) % commands.length : 0;
      renderSlashCommandMenu();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const command = commands[state.slashSelectedIndex];
      if (command) {
        fillSlashCommand(command);
      }
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const command = commands[state.slashSelectedIndex];
      if (command) sendSlashCommand(command);
      return;
    }
    if (event.key === "Escape") {
      state.slashMenuOpen = false;
      renderSlashCommandMenu();
      return;
    }
  }
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    els.chatForm.requestSubmit();
  }
});

els.chatInput.addEventListener("input", updateSlashCommandState);
els.chatInput.addEventListener("click", updateSlashCommandState);
els.sendChat.addEventListener("click", async (event) => {
  if (!state.isGenerating) return;
  event.preventDefault();
  event.stopPropagation();
  await window.aimashi.stopChat?.();
});
els.chat.addEventListener("click", async (event) => {
  const code = event.target.closest(".bubble code");
  if (!code || !els.chat.contains(code)) return;
  if (await copyTextToClipboard(code.textContent)) flashCopiedCode(code);
});
els.chat.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const code = event.target.closest(".bubble code");
  if (!code || !els.chat.contains(code)) return;
  event.preventDefault();
  if (await copyTextToClipboard(code.textContent)) flashCopiedCode(code);
});

els.chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.isGenerating) {
    await window.aimashi.stopChat?.();
    return;
  }
  const text = els.chatInput.value.trim();
  if (!text) return;
  const session = activeSession();
  const shouldGenerateTitle = !session.titleGenerated && !hasSuccessfulExchange(session);
  els.chatInput.value = "";
  appendChat("user", text);
  state.isGenerating = true;
  renderSendButton();
  try {
    const history = messagesForActive()
      .filter((message) => message.content)
      .map((message) => ({ role: message.role, content: message.content }));
    const response = await window.aimashi.sendChat({
      fellowKey: state.activeKey,
      personaKey: state.activeKey,
      sessionId: session.id,
      messages: history
    });
    const answer = response.choices?.[0]?.message?.content || "(No response)";
    appendChat("assistant", answer);
    await persistSessionQuietly(session);
    persistReadStateQuietly();
    if (shouldGenerateTitle) {
      const current = activeSession();
      const result = await window.aimashi.generateSessionTitle({
        personaKey: state.activeKey,
        sessionId: `title:${current.id}`,
        messages: current.messages.slice(0, 4)
      });
      current.title = result.title || text.slice(0, 24) || "新对话";
      current.titleGenerated = true;
      current.updatedAt = nowIso();
      await persistSessionQuietly(current);
      renderSessionMenu();
    }
    await refreshRuntime();
  } catch (error) {
    if (String(error.message || "").includes("生成已停止")) {
      await persistSessionQuietly(session);
    } else {
      appendTransientChat("assistant", `Request failed: ${error.message}`);
      await persistSessionQuietly(session);
    }
    await refreshRuntime();
  } finally {
    state.isGenerating = false;
    renderSendButton();
    els.chatInput.focus();
  }
});

initializeRuntime();
renderSendButton();
setInterval(refreshRuntime, 2000);
