const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

test("market IPC channels + preload bridge are wired", () => {
  const channels = read("src/shared/ipc-channels.js");
  assert.match(channels, /SkillsMarketList:\s*"skills:market-list"/);
  assert.match(channels, /SkillsMarketInstall:\s*"skills:market-install"/);

  const preload = read("src/preload.js");
  assert.match(preload, /marketSkills:.*SkillsMarketList/);
  assert.match(preload, /installMarketSkill:.*SkillsMarketInstall/);
});

test("main orchestrates cloud install → local write", () => {
  const main = read("src/main.js");
  assert.match(main, /SkillsMarketList.*listMarketSkills/);
  // install: cloud call → download package → verify checksum → extract locally
  assert.match(main, /installMarketSkill\(skillId\)/);
  assert.match(main, /downloadSkillPackage\(download\.url\)/);
  assert.match(main, /installMarketplaceSkill\(\{[\s\S]*id: skill\.id[\s\S]*zipBuffer/);
  assert.match(main, /marketMeta:\s*\{[\s\S]*sourceLabel: skill\.sourceLabel/);
});

test("skill-library renders a market mode with an install action", () => {
  const src = read("src/renderer/skills/skill-library.js");
  assert.match(src, /state\.skillMarketMode/);
  assert.match(src, /function renderMarketView/);
  assert.match(src, /function installMarketSkill/);
  assert.match(src, /data-skill-install=/);
  // a signed-out prompt rather than a broken empty grid
  assert.match(src, /登录 Mia Cloud/);
});

test("market cards render compact source logos beside source labels", () => {
  const src = read("src/renderer/skills/skill-library.js");
  assert.match(src, /MARKET_SOURCE_LOGOS/);
  assert.match(src, /function marketSourceKey/);
  assert.match(src, /function marketSourceLogoHtml/);
  assert.match(src, /className = `skill-source-logo skill-source-logo-\$\{sourceKey\}`/);
  assert.match(src, /claude:\s*\{\s*label:\s*"Claude"/);
  assert.match(src, /values\.has\("anthropic"\)/);
  assert.match(src, /values\.has\("anthropics\/skills"\)/);
  assert.doesNotMatch(src, /function marketCardIconHtml/);
  assert.doesNotMatch(src, /marketCardIconHtml\(skill/);
  assert.match(src, /assets\/provider-icons\/skills-sh\.png/);
  assert.match(src, /assets\/provider-icons\/clawhub\.png/);
  assert.match(src, /assets\/provider-icons\/browse-sh\.svg/);
  assert.match(src, /assets\/provider-icons\/claude\.svg/);
  assert.match(src, /assets\/provider-icons\/lobehub\.svg/);

  const css = read("src/renderer/styles/skills.css");
  assert.match(css, /\.market-card\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.market-card \.skill-card-source\s*\{[\s\S]*display:\s*flex/);
  assert.match(css, /\.skill-source-logo\s*\{/);
  assert.match(css, /\.skill-source-logo-mask/);
  assert.match(css, /assets\/engine-icons\/hermesagent\.svg/);
  assert.match(css, /assets\/provider-icons\/github\.svg/);
  assert.match(css, /\.skill-source-logo-hermes\s*\{[\s\S]*color:\s*#0f172a/);
  assert.doesNotMatch(css, /\.skill-card-icon\.source-logo/);

  [
    "src/renderer/assets/engine-icons/hermesagent.svg",
    "src/renderer/assets/provider-icons/github.svg",
    "src/renderer/assets/provider-icons/skills-sh.png",
    "src/renderer/assets/provider-icons/clawhub.png",
    "src/renderer/assets/provider-icons/browse-sh.svg",
    "src/renderer/assets/provider-icons/claude.svg",
    "src/renderer/assets/provider-icons/lobehub.svg"
  ].forEach((rel) => assert.ok(fs.existsSync(path.join(root, rel)), `${rel} should exist`));
});

test("topbar has the mine/market toggle and market styles exist", () => {
  const html = read("src/renderer/index.html");
  assert.match(html, /id="skillModeToggle"/);
  const css = read("src/renderer/styles/skills.css");
  assert.match(css, /\.skill-mode-toggle/);
  assert.match(css, /\.skill-card-action/);
});
