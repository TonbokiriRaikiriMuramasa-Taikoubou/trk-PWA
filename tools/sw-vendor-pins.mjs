#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * sw.js の VENDOR_PINS（ハッシュ固定の vendor の SHA-384）を tools/vendor-lock.json から作る。
 *
 *   node tools/sw-vendor-pins.mjs          確認だけ（sw.js と lock がずれていたら終了コード1）  ※ npm run check から呼ばれる
 *   node tools/sw-vendor-pins.mjs --write  sw.js の BEGIN/END の間を書き直す
 *
 * sw.js は cache-first で vendor を返すので、キャッシュの中身は、ここの値と一致したものだけ使う。
 * lock を更新したら、--write してから sw.js の CACHE 名も上げる。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const lock = JSON.parse(fs.readFileSync(path.join(root, "tools", "vendor-lock.json"), "utf8"));
const BEGIN = "// BEGIN VENDOR PINS";
const END = "// END VENDOR PINS";

const pins = {};
for (const [url, entry] of Object.entries(lock.entries || {})) {
  if (!entry.local || !entry.sha384) throw new Error(`lock entry without local/sha384: ${url}`);
  if (!entry.local.startsWith("assets/vendor/")) throw new Error(`not under assets/vendor/: ${entry.local}`);
  if (pins[entry.local]) throw new Error(`duplicate local path: ${entry.local}`);
  pins[entry.local] = entry.sha384;
}
const lines = [
  BEGIN + "（tools/sw-vendor-pins.mjs が tools/vendor-lock.json から生成。手で編集しない）",
  "const VENDOR_PINS = {",
  ...Object.keys(pins).sort().map(local => `  ${JSON.stringify(local)}: ${JSON.stringify(pins[local])},`),
  "};",
  END,
].join("\n");

const swPath = path.join(root, "sw.js");
const sw = fs.readFileSync(swPath, "utf8");
const start = sw.indexOf(BEGIN), stop = sw.indexOf(END);
if (start < 0 || stop < 0 || stop < start) throw new Error("sw.js has no VENDOR PINS markers");
const endOfLine = stop + END.length;
const next = sw.slice(0, start) + lines + sw.slice(endOfLine);

if (process.argv.includes("--write")) {
  fs.writeFileSync(swPath, next, "utf8");
  console.log(`wrote ${Object.keys(pins).length} pins to sw.js`);
} else if (next === sw) {
  console.log(`OK    sw.js VENDOR_PINS match tools/vendor-lock.json (${Object.keys(pins).length} files)`);
} else {
  console.log("FAIL  sw.js VENDOR_PINS are out of date with tools/vendor-lock.json (run: node tools/sw-vendor-pins.mjs --write)");
  process.exitCode = 1;
}
