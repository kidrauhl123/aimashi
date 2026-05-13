const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pkg = require(path.join(root, "package.json"));
const productName = pkg.productName || "Aimashi";
const version = pkg.version || "0.0.0";
const source = path.join(root, "release", "mac");
const target = path.join(root, "release", `${productName}-${version}-unsigned.dmg`);

if (process.platform !== "darwin") {
  throw new Error("create-mac-dmg.js only runs on macOS.");
}

if (!fs.existsSync(path.join(source, `${productName}.app`))) {
  throw new Error(`Missing packaged app: ${path.join(source, `${productName}.app`)}`);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
execFileSync("hdiutil", [
  "create",
  "-volname",
  productName,
  "-srcfolder",
  source,
  "-ov",
  "-format",
  "UDZO",
  target
], { stdio: "inherit" });

console.log(target);
