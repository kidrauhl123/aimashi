// Fellow / profile / avatar-crop dialog module
// Extracted from app.js. Contains all the modal-dialog logic for editing a
// Fellow (name + persona + engine + avatar) and for editing the current
// user's profile (display name + avatar), plus the shared avatar crop editor
// and the avatar preset picker tabs (human / pet).
//
// Defensive `if (!state || !els)` guards on every entry.
(function () {
  "use strict";

  let state, els;
  let renderView, render;

  function initFellowDialog(deps) {
    state = deps.state;
    els = deps.els;
    renderView = deps.renderView;
    render = deps.render;
    els.fellowRuntimeLocation?.addEventListener("change", () => {
      renderFellowAgentEngineSelect(els.fellowAgentEngine?.value || "hermes");
    });
  }

  function setFellowAvatarDraft(image, crop = null) {
    if (!state) return;
    const src = window.miaAvatar.canonicalAvatarSrc(image);
    state.fellowAvatarDraft = {
      image: src,
      crop: window.miaAvatar.normalizeCrop(crop || window.miaAvatar.avatarDefaultCropForSrc(src))
    };
    if (els.fellowAvatar) els.fellowAvatar.value = state.fellowAvatarDraft.image;
    renderFellowAvatarDraft();
  }

  function setProfileAvatarDraft(image, crop = null) {
    if (!state) return;
    const src = window.miaAvatar.canonicalAvatarSrc(image);
    state.profileAvatarDraft = {
      image: src,
      crop: window.miaAvatar.normalizeCrop(crop || window.miaAvatar.avatarDefaultCropForSrc(src))
    };
    if (els.profileAvatarImage) els.profileAvatarImage.value = state.profileAvatarDraft.image;
    renderProfileAvatarDraft();
  }

  function renderProfileAvatarDraft() {
    if (!state || !els || !els.profileAvatarPreview) return;
    const draft = state.profileAvatarDraft;
    const user = state.runtime?.user || {};
    const crop = window.miaAvatar.normalizeCrop(draft.crop);
    window.miaAvatar.applyAvatarMedia(els.profileAvatarPreview, draft.image, crop, user.avatarColor || "#111827");
    els.profileAvatarPreview.title = draft.image ? "点击调整头像裁剪" : "选择头像";
    els.profileAvatarPreview.setAttribute("role", "button");
    els.profileAvatarPreview.setAttribute("tabindex", "0");
    els.profileAvatarPreview.setAttribute("aria-label", "调整头像裁剪");
    renderProfileAvatarDefaults();
  }

  function openProfileDialog() {
    if (!state || !els) return;
    const user = state.runtime?.user || { displayName: "Boss", avatarImage: "", avatarCrop: window.miaAvatar.DEFAULT_AVATAR_CROP };
    state.profileDialogOpen = true;
    state.profileAvatarPresetGroup = window.miaAvatar.avatarPresetGroupForSrc(user.avatarImage || "") || "human";
    if (els.profileDisplayName) els.profileDisplayName.value = user.displayName || "Boss";
    setProfileAvatarDraft(user.avatarImage || "", user.avatarCrop);
    renderView();
    setTimeout(() => els.profileDisplayName?.focus(), 0);
  }

  function closeProfileDialog() {
    if (!state) return;
    state.profileDialogOpen = false;
    renderView();
  }

  function renderFellowAvatarDefaults() {
    if (!state || !els || !els.fellowAvatarDefaults) return;
    const activeGroup = window.miaAvatar.avatarPresetGroups[state.fellowAvatarPresetGroup]
      ? state.fellowAvatarPresetGroup
      : "human";
    state.fellowAvatarPresetGroup = activeGroup;
    if (els.fellowAvatarDefaultTabs) {
      els.fellowAvatarDefaultTabs.innerHTML = window.miaAvatar.avatarPresetGroupTabs.map((group) => `
        <button type="button" class="${activeGroup === group.key ? "active" : ""}" data-avatar-group="${window.miaMarkdown.escapeHtml(group.key)}" role="tab" aria-selected="${activeGroup === group.key ? "true" : "false"}">${window.miaMarkdown.escapeHtml(group.label)}</button>
      `).join("");
      els.fellowAvatarDefaultTabs.querySelectorAll("[data-avatar-group]").forEach((button) => {
        button.addEventListener("click", () => {
          const group = button.dataset.avatarGroup || "human";
          if (!window.miaAvatar.avatarPresetGroups[group] || state.fellowAvatarPresetGroup === group) return;
          state.fellowAvatarPresetGroup = group;
          renderFellowAvatarDefaults();
        });
      });
    }
    const selected = state.fellowAvatarDraft.image;
    const presets = window.miaAvatar.avatarPresetGroups[activeGroup] || window.miaAvatar.avatarPresetGroups.human;
    els.fellowAvatarDefaults.innerHTML = presets.map((preset) => `
      <button type="button" class="avatar-default${selected === preset.src ? " active" : ""}" data-avatar="${window.miaMarkdown.escapeHtml(preset.src)}" data-avatar-name="${window.miaMarkdown.escapeHtml(preset.name)}" title="${window.miaMarkdown.escapeHtml(preset.name)}" aria-label="${window.miaMarkdown.escapeHtml(preset.name)}" style="${window.miaAvatar.avatarThumbBackgroundStyle(preset.src, window.miaAvatar.avatarDefaultCropForSrc(preset.src), "#eef0ff")}"></button>
    `).join("");
    els.fellowAvatarDefaults.querySelectorAll("[data-avatar]").forEach((button) => {
      button.addEventListener("click", () => {
        setFellowAvatarDraft(button.dataset.avatar, window.miaAvatar.avatarDefaultCropForSrc(button.dataset.avatar));
        if (els.fellowName) els.fellowName.value = button.dataset.avatarName || window.miaAvatar.avatarPresetBySrc(button.dataset.avatar)?.name || "";
      });
    });
  }

  function renderProfileAvatarDefaults() {
    if (!state || !els || !els.profileAvatarDefaults) return;
    const activeGroup = window.miaAvatar.avatarPresetGroups[state.profileAvatarPresetGroup]
      ? state.profileAvatarPresetGroup
      : "human";
    state.profileAvatarPresetGroup = activeGroup;
    if (els.profileAvatarDefaultTabs) {
      els.profileAvatarDefaultTabs.innerHTML = window.miaAvatar.avatarPresetGroupTabs.map((group) => `
        <button type="button" class="${activeGroup === group.key ? "active" : ""}" data-avatar-group="${window.miaMarkdown.escapeHtml(group.key)}" role="tab" aria-selected="${activeGroup === group.key ? "true" : "false"}">${window.miaMarkdown.escapeHtml(group.label)}</button>
      `).join("");
      els.profileAvatarDefaultTabs.querySelectorAll("[data-avatar-group]").forEach((button) => {
        button.addEventListener("click", () => {
          const group = button.dataset.avatarGroup || "human";
          if (!window.miaAvatar.avatarPresetGroups[group] || state.profileAvatarPresetGroup === group) return;
          state.profileAvatarPresetGroup = group;
          renderProfileAvatarDefaults();
        });
      });
    }
    const selected = state.profileAvatarDraft.image;
    const presets = window.miaAvatar.avatarPresetGroups[activeGroup] || window.miaAvatar.avatarPresetGroups.human;
    els.profileAvatarDefaults.innerHTML = presets.map((preset) => `
      <button type="button" class="avatar-default${selected === preset.src ? " active" : ""}" data-avatar="${window.miaMarkdown.escapeHtml(preset.src)}" data-avatar-name="${window.miaMarkdown.escapeHtml(preset.name)}" title="${window.miaMarkdown.escapeHtml(preset.name)}" aria-label="${window.miaMarkdown.escapeHtml(preset.name)}" style="${window.miaAvatar.avatarThumbBackgroundStyle(preset.src, window.miaAvatar.avatarDefaultCropForSrc(preset.src), "#eef0ff")}"></button>
    `).join("");
    els.profileAvatarDefaults.querySelectorAll("[data-avatar]").forEach((button) => {
      button.addEventListener("click", async () => {
        const src = button.dataset.avatar;
        setProfileAvatarDraft(src, window.miaAvatar.avatarDefaultCropForSrc(src));
        // Auto-save: clicking a preset is a decisive choice. Pull the current
        // displayName from the input so we don't drop user's in-progress edit.
        try {
          const displayName = (els.profileDisplayName?.value || "").trim()
            || state.runtime?.user?.displayName
            || "Boss";
          state.runtime = await window.mia.saveProfile({
            displayName,
            avatarText: window.miaAvatar.initials(displayName),
            avatarImage: state.profileAvatarDraft.image || src,
            avatarCrop: window.miaAvatar.normalizeCrop(state.profileAvatarDraft.crop),
          });
          render();
        } catch (err) {
          console.error("[profile] preset avatar auto-save failed:", err);
        }
      });
    });
  }

  function renderFellowAvatarDraft() {
    if (!state || !els) return;
    const draft = state.fellowAvatarDraft;
    const crop = window.miaAvatar.normalizeCrop(draft.crop);
    if (els.fellowAvatarPreview) {
      window.miaAvatar.applyAvatarMedia(els.fellowAvatarPreview, draft.image, crop, "#eef0ff");
      els.fellowAvatarPreview.title = "点击调整头像裁剪";
      els.fellowAvatarPreview.setAttribute("role", "button");
      els.fellowAvatarPreview.setAttribute("tabindex", "0");
      els.fellowAvatarPreview.setAttribute("aria-label", "调整头像裁剪");
    }
    renderFellowAvatarDefaults();
  }

  function renderAvatarCropEditor() {
    if (!state || !els || !els.avatarCropStage) return;
    const editor = state.avatarCropEditor;
    const crop = window.miaAvatar.normalizeCrop(editor.crop);
    window.miaAvatar.applyAvatarMedia(els.avatarCropStage, editor.image, crop, "#eef0ff", "", { preserveChildren: true });
    updateAvatarTrimControls();
  }

  function updateAvatarTrimControls() {
    if (!state || !els?.avatarTrimControls) return;
    const editor = state.avatarCropEditor || {};
    const isVideo = window.miaAvatarMedia?.isVideo?.(editor.image);
    els.avatarTrimControls.classList.toggle("hidden", !isVideo);
    if (!isVideo) return;
    const trim = window.miaAvatarMedia.normalizeTrim(editor.crop || {});
    const previewSrc = window.miaAvatar.avatarImageSrc(editor.image) || editor.image || "";
    if (els.avatarTrimPreview && els.avatarTrimPreview.src !== previewSrc) {
      els.avatarTrimPreview.src = previewSrc;
      els.avatarTrimPreview.currentTime = trim.start || 0;
    }
    const total = Math.max(
      Number(els.avatarTrimPreview?.duration) || 0,
      trim.start + trim.duration,
      window.miaAvatarMedia.MAX_TRIM_DURATION || 5
    );
    const startPct = total ? Math.max(0, Math.min(100, (trim.start / total) * 100)) : 0;
    const endPct = total ? Math.max(startPct, Math.min(100, ((trim.start + trim.duration) / total) * 100)) : 100;
    els.avatarTrimTimeline?.style.setProperty("--trim-start", `${startPct}%`);
    els.avatarTrimTimeline?.style.setProperty("--trim-end", `${endPct}%`);
    if (els.avatarTrimLabel) {
      els.avatarTrimLabel.textContent = `${trim.start.toFixed(1)}s - ${(trim.start + trim.duration).toFixed(1)}s`;
    }
    if (els.avatarTrimStart && document.activeElement !== els.avatarTrimStart) {
      els.avatarTrimStart.value = String(trim.start);
    }
    if (els.avatarTrimDuration && document.activeElement !== els.avatarTrimDuration) {
      els.avatarTrimDuration.value = String(trim.duration);
    }
  }

  function openAvatarCropEditor(image, crop = null, target = "fellow") {
    if (!state) return;
    const src = window.miaAvatar.canonicalAvatarSrc(image);
    state.avatarCropEditor = {
      open: true,
      target,
      image: src,
      crop: window.miaAvatar.normalizeCrop(crop || window.miaAvatar.avatarDefaultCropForSrc(src)),
      dragging: false,
      lastX: 0,
      lastY: 0
    };
    renderView();
    renderAvatarCropEditor();
  }

  function closeAvatarCropEditor() {
    if (!state) return;
    state.avatarCropEditor.open = false;
    state.avatarCropEditor.dragging = false;
    renderView();
  }

  function updateAvatarCropEditor(crop) {
    if (!state) return;
    state.avatarCropEditor.crop = window.miaAvatar.normalizeCrop({
      ...state.avatarCropEditor.crop,
      ...crop
    });
    renderAvatarCropEditor();
  }

  function readFellowAvatarFile(file) {
    readAvatarFile(file, "fellow");
  }

  function readProfileAvatarFile(file) {
    readAvatarFile(file, "profile");
  }

  function readAvatarFile(file, target) {
    if (!file) return;
    const isImage = file.type?.startsWith("image/");
    const isVideo = file.type?.startsWith("video/");
    if (!isImage && !isVideo) return;
    if (isVideo && file.size > 8 * 1024 * 1024) {
      window.alert?.("视频头像请控制在 8MB 以内。");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      openAvatarCropEditor(String(reader.result || ""), isVideo
        ? { x: 50, y: 50, zoom: 1, start: 0, duration: 3 }
        : { x: 50, y: 50, zoom: 1.12 }, target);
    });
    reader.readAsDataURL(file);
  }

  function detectedAgentEngineOptions() {
    const engines = state?.runtime?.agentEngines || {};
    const options = [{ id: "hermes", label: "默认" }];
    if (engines.claudeCode?.available) options.push({ id: "claude-code", label: "Claude Code" });
    if (engines.codex?.available) options.push({ id: "codex", label: "Codex" });
    return options;
  }

  function fellowRuntimeLocationOptions() {
    const cloudEnabled = Boolean(state && state.runtime?.cloud?.enabled);
    return [
      { id: "desktop-local", label: "当前设备", disabled: false },
      { id: "cloud-hermes", label: cloudEnabled ? "Mia Cloud" : "Mia Cloud（需先登录）", disabled: !cloudEnabled }
    ];
  }

  function selectedRuntimeLocation() {
    const value = String(els?.fellowRuntimeLocation?.value || "desktop-local").trim();
    return value === "cloud-hermes" ? "cloud-hermes" : "desktop-local";
  }

  function renderFellowRuntimeLocationSelect(current = "desktop-local") {
    if (!els?.fellowRuntimeLocation) return;
    const options = fellowRuntimeLocationOptions();
    els.fellowRuntimeLocation.innerHTML = "";
    for (const option of options) {
      const node = document.createElement("option");
      node.value = option.id;
      node.textContent = option.label;
      node.disabled = Boolean(option.disabled);
      els.fellowRuntimeLocation.appendChild(node);
    }
    const allowed = options.some((option) => option.id === current && !option.disabled);
    els.fellowRuntimeLocation.value = allowed ? current : "desktop-local";
  }

  function renderFellowAgentEngineSelect(current = "hermes") {
    if (!els) return;
    const runtimeKind = selectedRuntimeLocation();
    const options = detectedAgentEngineOptions();
    const showField = options.length > 1;
    els.fellowAgentEngineField?.classList.toggle("hidden", runtimeKind === "cloud-hermes" || !showField);
    if (!els.fellowAgentEngine) return;
    els.fellowAgentEngine.innerHTML = "";
    for (const option of options) {
      const node = document.createElement("option");
      node.value = option.id;
      node.textContent = option.label;
      els.fellowAgentEngine.appendChild(node);
    }
    els.fellowAgentEngine.value = options.some((option) => option.id === current) ? current : "hermes";
  }

  function openFellowDialog(fellow = null, personaText = "") {
    if (!state || !els) return;
    if (fellow && fellow.currentTarget) fellow = null;
    // Allow a seed object in place of `fellow` to prefill create mode (used by
    // initial-onboarding flow). Detected by absence of a real key.
    const seed = fellow && !fellow.key && (fellow.name || fellow.agentEngine || fellow.bio) ? fellow : null;
    const actualFellow = seed ? null : fellow;
    state.fellowMenuOpen = false;
    state.fellowDialogMode = actualFellow ? "edit" : "create";
    state.fellowDialogOpen = true;
    const titleName = String(actualFellow?.name || "").trim();
    if (els.fellowDialogTitle) els.fellowDialogTitle.textContent = actualFellow
      ? `编辑「${titleName || "伙伴"}」`
      : (seed ? "创建你的第一个伙伴" : "添加伙伴");
    if (els.fellowKey) els.fellowKey.value = actualFellow?.key || "";
    els.fellowName.value = actualFellow?.name || seed?.name || "";
    const runtimeKind = window.miaFellowDirectory?.normalizeRuntimeKind?.(
      actualFellow?.runtimeKind || actualFellow?.runtime_kind || seed?.runtimeKind,
      actualFellow?.sourceKinds?.includes?.("cloud") ? "cloud-hermes" : "desktop-local"
    ) || "desktop-local";
    renderFellowRuntimeLocationSelect(runtimeKind);
    if (els.fellowRuntimeLocation) els.fellowRuntimeLocation.disabled = Boolean(actualFellow);
    renderFellowAgentEngineSelect(actualFellow?.agentEngine || actualFellow?.agent_engine || seed?.agentEngine || "hermes");
    const avatarImage = actualFellow?.avatarImage || window.miaAvatar.defaultAvatarAssets()[0];
    state.fellowAvatarPresetGroup = window.miaAvatar.avatarPresetGroupForSrc(avatarImage) || "human";
    setFellowAvatarDraft(avatarImage, window.miaAvatar.avatarCropForImage(avatarImage, actualFellow?.avatarCrop));
    els.fellowSeed.value = actualFellow ? personaText : (seed?.bio || "");
    if (els.fellowPersonaDetails) els.fellowPersonaDetails.open = Boolean(seed);
    renderView();
    setTimeout(() => els.fellowName?.focus(), 0);
  }

  function closeFellowDialog() {
    if (!state) return;
    state.fellowDialogOpen = false;
    renderView();
  }

  window.miaFellowDialog = {
    initFellowDialog,
    setFellowAvatarDraft,
    setProfileAvatarDraft,
    renderProfileAvatarDraft,
    openProfileDialog,
    closeProfileDialog,
    renderFellowAvatarDefaults,
    renderProfileAvatarDefaults,
    renderFellowAvatarDraft,
    renderAvatarCropEditor,
    openAvatarCropEditor,
    closeAvatarCropEditor,
    updateAvatarCropEditor,
    updateAvatarTrimControls,
    readFellowAvatarFile,
    readProfileAvatarFile,
    detectedAgentEngineOptions,
    renderFellowRuntimeLocationSelect,
    renderFellowAgentEngineSelect,
    openFellowDialog,
    closeFellowDialog,
  };
})();
