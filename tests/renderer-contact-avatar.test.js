const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadHelper() {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "contact-avatar.js"), "utf8");
  const mockEl = () => {
    const el = {
      tagName: "SPAN",
      className: "",
      attrs: {},
      style: { cssText: "" },
      _text: "",
      setAttribute(k, v) { this.attrs[k] = v; },
      get textContent() { return this._text; },
      set textContent(v) { this._text = v; }
    };
    return el;
  };
  const avatarThumbBackgroundStyle = (img, crop, color) => `background-image:url(${img});background-color:${color};`;
  const window = {
    miaAvatar: {
      avatarThumbBackgroundStyle,
      // renderAvatar now delegates image/video painting to the shared entry
      // point; the real one mounts an <img>/<video>, here we just reflect it
      // into cssText so the test can assert the delegation happened.
      paintAvatar: (el, avatar) => { el.style.cssText = avatarThumbBackgroundStyle(avatar.image, avatar.crop, avatar.color); }
    }
  };
  const ctx = vm.createContext({ window, globalThis: window, document: { createElement: () => mockEl() }, console });
  vm.runInContext(src, ctx);
  return window.miaContactAvatar;
}

test("renderAvatar with image returns styled element", () => {
  const helper = loadHelper();
  const el = helper.renderAvatar({ kind: "fellow", id: "x", displayName: "Codex", avatar: { image: "data:x", crop: null, color: "#5e5ce6" } });
  assert.match(el.style.cssText, /background-image:url\(data:x\)/);
});

test("renderAvatar without image falls back to letter + color", () => {
  const helper = loadHelper();
  const el = helper.renderAvatar({ kind: "user", id: "u", displayName: "Alice", avatar: { image: "", crop: null, color: "#34c759" } });
  assert.equal(el.textContent, "A");
  assert.match(el.style.cssText, /background-color:#34c759/);
});

test("renderAvatar empty contact uses ? letter", () => {
  const helper = loadHelper();
  const el = helper.renderAvatar({ kind: "", id: "", displayName: "", avatar: { image: "", color: "" } });
  assert.equal(el.textContent, "?");
});
