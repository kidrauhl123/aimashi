const fs = require("node:fs");
const childProcess = require("node:child_process");
const path = require("node:path");

const required = [
  "src/main.js",
  "src/preload.js",
  "src/renderer/index.html",
  "src/renderer/app.js",
  "src/renderer/styles.css",
  "src/mobile/index.html",
  "src/mobile/app.js",
  "src/mobile/styles.css",
  "src/relay/server.js",
  "scripts/create-mac-dmg.js",
  "resources/pet-generator/hatch_generate.py",
  "resources/pet-generator/petctl.py",
  "resources/pet-generator/skills/alkaka-friend-pet/SKILL.md",
  "resources/pet-generator/skills/alkaka-friend-pet/assets/alkaka-style-reference.jpg",
  "resources/pet-generator/skills/alkaka-friend-pet/scripts/prepare_pet_run.py",
  "resources/pet-generator/skills/alkaka-friend-pet/scripts/finalize_pet_run.py",
  "resources/pet-generator/skills/alkaka-friend-pet/scripts/package_custom_pet.py",
  "resources/pet-generator/skills/alkaka-friend-pet/scripts/record_imagegen_result.py"
];

for (const file of required) {
  const full = path.join(__dirname, "..", file);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing ${file}`);
  }
}

for (const file of ["src/main.js", "src/preload.js", "src/renderer/app.js", "src/mobile/app.js", "src/relay/server.js"]) {
  childProcess.execFileSync(process.execPath, ["--check", path.join(__dirname, "..", file)], {
    stdio: "inherit"
  });
}

console.log("Aimashi project structure OK");
