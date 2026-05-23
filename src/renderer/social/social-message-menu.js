// Lightweight context menu for cloud-room (DM + group) message bubbles.
//
// Cloud-room messages don't live in a fellow session, so the full
// fellow-chat menu in src/renderer/chat/message-menu.js (which depends on
// activeSession() / messageAtIndex) doesn't apply. This module reuses the
// same DOM element (#messageContextMenu) and CSS (.message-context-menu)
// but renders a smaller action set: copy plain text, copy markdown.
//
// Wired from social._buildMessageArticle and social-groups.buildGroupMessageArticle
// via the onContextMenu callback of createMessageBubble.

(function (global) {
  "use strict";

  function getMenuEl() {
    return document.getElementById("messageContextMenu");
  }

  function escapeHtml(value) {
    const h = global.aimashiMarkdown?.escapeHtml;
    if (typeof h === "function") return h(value);
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  }

  function plainTextFromMarkdown(md) {
    return String(md || "")
      .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-zA-Z]*\n?/g, "").replace(/```$/g, ""))
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  }

  async function copyToClipboard(text) {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* fall through */ }
    return false;
  }

  let outsideClickHandler = null;
  let escapeHandler = null;

  function closeMenu() {
    const menu = getMenuEl();
    if (!menu) return;
    menu.classList.add("hidden");
    menu.innerHTML = "";
    if (outsideClickHandler) {
      document.removeEventListener("click", outsideClickHandler, true);
      outsideClickHandler = null;
    }
    if (escapeHandler) {
      document.removeEventListener("keydown", escapeHandler);
      escapeHandler = null;
    }
  }

  function openSocialMessageMenu(message, x, y) {
    const menu = getMenuEl();
    if (!menu) return;
    // If fellow chat had its menu open, close it first.
    const fellowMenu = global.aimashiMessageMenu?.closeMessageContextMenu;
    if (typeof fellowMenu === "function") fellowMenu();

    const md = message?.body_md || message?.bodyMd || "";
    const plain = plainTextFromMarkdown(md);
    const hasText = Boolean(plain);

    menu.innerHTML = `
      <button type="button" data-social-message-action="copy" ${hasText ? "" : "disabled"}>复制</button>
      <button type="button" data-social-message-action="copy-md" ${hasText ? "" : "disabled"}>复制 Markdown</button>
    `;
    menu.classList.remove("hidden");

    const rect = menu.getBoundingClientRect();
    const width = rect.width || 140;
    const height = rect.height || 80;
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`;

    menu.querySelectorAll("[data-social-message-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const action = btn.dataset.socialMessageAction;
        closeMenu();
        if (action === "copy") await copyToClipboard(plain);
        if (action === "copy-md") await copyToClipboard(md);
      });
    });

    // Defer outside-click registration so the right-click that opened the
    // menu doesn't immediately close it via bubbling.
    setTimeout(() => {
      outsideClickHandler = (event) => {
        if (menu.contains(event.target)) return;
        closeMenu();
      };
      document.addEventListener("click", outsideClickHandler, true);
      escapeHandler = (event) => {
        if (event.key === "Escape") closeMenu();
      };
      document.addEventListener("keydown", escapeHandler);
    }, 0);
  }

  global.aimashiSocialMessageMenu = { openSocialMessageMenu, closeSocialMessageMenu: closeMenu };
})(typeof window !== "undefined" ? window : globalThis);
