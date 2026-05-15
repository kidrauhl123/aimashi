// Renderer-side group chat module.
// Loaded by <script src="./group.js"></script> from index.html, before app.js.

(function (global) {
  const promptsModule =
    typeof require !== "undefined"
      ? require("./group-prompts.js")
      : global.aimashiGroupPrompts;
  const conductorModule =
    typeof require !== "undefined"
      ? require("./conductor.js")
      : global.aimashiConductor;
  const { createConductor } = conductorModule || {};
  // parseMentions/filterRecentTurnsForFellow/etc. accessed via promptsModule when needed.

  const moduleState = {
    groups: [],
    activeGroupId: null,
    messagesByGroup: new Map(),
    fellows: [],
    fellowNamesById: {},
    promptTemplates: null,
    conductor: null,
    deps: null,
  };

  async function initGroupModule(deps) {
    moduleState.deps = deps;
    moduleState.fellows = (deps.getFellows && deps.getFellows()) || [];
    moduleState.fellowNamesById = Object.fromEntries(
      moduleState.fellows.map((f) => [f.id || f.key, f.name])
    );
    try {
      moduleState.promptTemplates = await window.aimashi.groups.loadPrompts();
      moduleState.groups = await window.aimashi.groups.list();
    } catch (err) {
      console.error("[group] init failed:", err);
      moduleState.promptTemplates = null;
      moduleState.groups = [];
    }
    if (createConductor && moduleState.promptTemplates && deps.engineCall) {
      moduleState.conductor = createConductor({
        engineCall: deps.engineCall,
        dispatchTemplate: moduleState.promptTemplates.dispatch,
        summarizeTemplate: moduleState.promptTemplates.summarize,
      });
    }
    renderGroupSidebarEntries();
    bindCreateButton();
  }

  function renderGroupSidebarEntries() {
    const container = document.getElementById("groupList");
    if (!container) return;
    container.innerHTML = "";
    for (const group of moduleState.groups) {
      const item = document.createElement("div");
      item.className = "sidebar-item group-item";
      item.dataset.groupId = group.id;
      item.addEventListener("click", () => openGroup(group.id));

      const avatar = document.createElement("div");
      avatar.className = "group-avatar composite";
      const memberAvatars = (group.members || []).slice(0, 4);
      for (const memberId of memberAvatars) {
        const sub = document.createElement("div");
        sub.className = "group-avatar-sub";
        sub.textContent = (moduleState.fellowNamesById[memberId] || "?")[0] || "?";
        avatar.appendChild(sub);
      }
      item.appendChild(avatar);

      const meta = document.createElement("div");
      meta.className = "sidebar-item-meta";
      const title = document.createElement("div");
      title.className = "sidebar-item-title";
      title.textContent = group.name;
      meta.appendChild(title);
      const memberLine = document.createElement("div");
      memberLine.className = "sidebar-item-subtitle";
      memberLine.textContent = (group.members || [])
        .map((id) => moduleState.fellowNamesById[id] || id)
        .join(", ");
      meta.appendChild(memberLine);
      item.appendChild(meta);

      container.appendChild(item);
    }
  }

  function bindCreateButton() {
    const btn = document.getElementById("createGroup");
    if (!btn) return;
    btn.disabled = false;
    btn.addEventListener("click", () => {
      // T13 will replace this with openCreateDialog().
      console.log("[group] create button clicked — T13 will hook openCreateDialog");
    });
  }

  function openGroup(groupId) {
    // T14 will implement the group chat view; for now log only.
    console.log("[group] open group", groupId, "— T14 will implement view");
  }

  global.aimashiGroup = {
    initGroupModule,
    renderGroupSidebarEntries,
    openGroup,
    bindCreateButton,
    moduleState,
  };
})(window);
