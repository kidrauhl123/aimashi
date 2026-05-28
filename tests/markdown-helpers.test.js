const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.join(__dirname, "..");

function loadMarkdownHelpers() {
  const mockWindow = {};
  const context = vm.createContext({
    window: mockWindow,
    globalThis: mockWindow,
    console
  });
  vm.runInContext(fs.readFileSync(path.join(root, "src/renderer/helpers/markdown-helpers.js"), "utf8"), context, {
    filename: "src/renderer/helpers/markdown-helpers.js"
  });
  return mockWindow.miaMarkdown;
}

test("markdown code block renders the language label as the copy button", () => {
  const markdown = loadMarkdownHelpers();
  const html = markdown.renderMarkdown("```shell\npwd\n```");

  assert.match(html, /<figure class="message-code-block" data-language="bash">/);
  assert.match(html, /<button type="button" class="message-code-copy" data-copy-code aria-label="复制 Shell 代码" title="复制 Shell 代码">Shell<\/button>/);
  assert.doesNotMatch(html, />⧉<\/button>/);
  assert.doesNotMatch(html, /<figcaption>[\s\S]*<span>Shell<\/span>/);
});
