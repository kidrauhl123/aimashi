(function attachFellowCommands(global) {
  "use strict";

  function slugFromFellowName(name) {
    return String(name || "fellow")
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "fellow";
  }

  function cloudFellowKeyFromName(name, existingKeys = []) {
    const used = new Set(existingKeys.map((key) => String(key || "").trim()).filter(Boolean));
    const base = slugFromFellowName(name);
    let key = base;
    let index = 2;
    while (used.has(key)) {
      key = `${base}_${index}`;
      index += 1;
    }
    return key;
  }

  function existingFellowKeys(state = {}, social = {}) {
    const local = [
      ...(Array.isArray(state.runtime?.fellows) ? state.runtime.fellows : []),
      ...(Array.isArray(state.runtime?.personas) ? state.runtime.personas : [])
    ];
    const cloud = social?.moduleState?.fellows || [];
    return [...local, ...cloud].map((item) => String(item?.key || item?.id || "").trim()).filter(Boolean);
  }

  function serializableCapabilities(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return value;
    return ["chat", "files", "terminal", "code"];
  }

  function roomFromResult(result) {
    return result?.data?.room || result?.room || null;
  }

  function savedFellowFromResult(result, fallback) {
    return result?.data?.fellow || result?.fellow || fallback;
  }

  async function saveCloudHermesFellow({
    state = {},
    api = global.mia,
    social = global.miaSocial,
    fellow = {},
    isCreate = false,
    cloudModelEntries = () => []
  } = {}) {
    if (!state.runtime?.cloud?.enabled || typeof api?.social?.saveFellowIdentity !== "function") {
      throw new Error("请先登录 Mia Cloud。");
    }
    const key = fellow.key || cloudFellowKeyFromName(fellow.name, existingFellowKeys(state, social));
    const identity = {
      name: String(fellow.name || "").trim(),
      color: fellow.color || "#2563eb",
      avatarImage: fellow.avatarImage || "",
      avatarCrop: fellow.avatarCrop || null,
      bio: fellow.description || fellow.bio || "",
      personaText: fellow.personaText || fellow.description || fellow.bio || "",
      capabilities: serializableCapabilities(fellow.capabilities)
    };
    const saved = await api.social.saveFellowIdentity(key, identity);
    if (!saved?.ok) throw new Error(saved?.error || "创建云端 Fellow 失败");
    if (isCreate) {
      const runtime = await api.social.saveFellowRuntime(key, {
        runtimeKind: "cloud-hermes",
        enabled: true,
        config: {
          model: cloudModelEntries()[0]?.id || "mia-default",
          effortLevel: "medium",
          permissionMode: "ask"
        }
      });
      if (!runtime?.ok) throw new Error(runtime?.error || "保存云端运行配置失败");
    }
    const ensured = await api.social.ensureFellowRoom(key, {
      title: identity.name || key,
      runtimeKind: "cloud-hermes"
    });
    if (!ensured?.ok) throw new Error(ensured?.error || "创建云端会话失败");
    const cloudFellow = { ...savedFellowFromResult(saved, identity), key, id: key };
    if (social?.moduleState) {
      social.moduleState.fellows = [
        cloudFellow,
        ...social.moduleState.fellows.filter((item) => String(item?.key || item?.id || "") !== key)
      ];
    }
    const room = social?.upsertFellowRoom?.(roomFromResult(ensured)) || roomFromResult(ensured);
    return { key, fellow: cloudFellow, room, runtime: state.runtime };
  }

  async function saveDesktopLocalFellow({
    api = global.mia,
    fellow = {},
    loadChatSessions = async () => {}
  } = {}) {
    if (typeof api?.saveFellow !== "function") throw new Error("本机 Fellow 保存接口不可用。");
    const runtime = await api.saveFellow(fellow);
    const fellows = runtime?.fellows || runtime?.personas || [];
    const saved = fellow.key
      ? fellows.find((item) => item.key === fellow.key)
      : [...fellows].reverse().find((item) => item.name === String(fellow.name || "").trim()) || fellows[0];
    await loadChatSessions();
    return { key: saved?.key || "", fellow: saved || null, room: null, runtime };
  }

  async function saveFellow(options = {}) {
    const runtimeKind = String(options.runtimeKind || "desktop-local").trim();
    if (runtimeKind === "cloud-hermes") return saveCloudHermesFellow(options);
    return saveDesktopLocalFellow(options);
  }

  async function deleteCloudHermesFellow({
    state = {},
    api = global.mia,
    social = global.miaSocial,
    fellow = {}
  } = {}) {
    const key = String(fellow.key || fellow.id || "").trim();
    if (!key) return { deleted: false, runtime: state.runtime };
    if (typeof api?.social?.deleteFellow !== "function") throw new Error("云端 Fellow 删除接口不可用。");
    const result = await api.social.deleteFellow(key);
    if (result && result.ok === false) throw new Error(result.error || "删除云端 Fellow 失败");
    if (social?.moduleState) {
      social.moduleState.fellows = social.moduleState.fellows
        .filter((item) => String(item?.key || item?.id || "") !== key);
    }
    await social?.bootstrapAfterLogin?.();
    return { deleted: true, runtime: state.runtime };
  }

  async function deleteDesktopLocalFellow({
    state = {},
    api = global.mia,
    fellow = {},
    loadChatSessions = async () => {}
  } = {}) {
    const key = String(fellow.key || fellow.id || "").trim();
    if (!key) return { deleted: false, runtime: state.runtime };
    if (typeof api?.deleteFellow !== "function") throw new Error("本机 Fellow 删除接口不可用。");
    const runtime = await api.deleteFellow({ key });
    await loadChatSessions();
    return { deleted: true, runtime };
  }

  async function deleteFellow(options = {}) {
    const fellow = options.fellow || {};
    if (fellow.canDelete === false) return { deleted: false, runtime: options.state?.runtime };
    const runtimeKind = String(fellow.runtimeKind || options.runtimeKind || "desktop-local").trim();
    if (runtimeKind === "cloud-hermes") return deleteCloudHermesFellow(options);
    return deleteDesktopLocalFellow(options);
  }

  const api = {
    slugFromFellowName,
    cloudFellowKeyFromName,
    existingFellowKeys,
    saveCloudHermesFellow,
    saveDesktopLocalFellow,
    saveFellow,
    deleteCloudHermesFellow,
    deleteDesktopLocalFellow,
    deleteFellow
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  if (global) global.miaFellowCommands = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
