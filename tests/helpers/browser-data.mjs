// SPDX-License-Identifier: GPL-3.0-or-later
/* テスト用に、リポジトリの実物の定数と乱数関数を読み込む。
   DIFFS は js/data.js をそのまま vm で評価して取り出し、hashString／mulberry32 は js/core.js の本文を切り出す。
   （コピーを持つと本物との差が生まれるため、コードを写さない。core.js は DOM に触るので丸ごとは読まない） */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadBrowserData() {
  const dataSrc = fs.readFileSync(path.join(ROOT, "js/data.js"), "utf8");
  const core = fs.readFileSync(path.join(ROOT, "js/core.js"), "utf8");
  const helpers = core.slice(core.indexOf("function hashString"), core.indexOf("const esc ="));
  const sb = { console, Math, Array, Object, Number, String, JSON, Set, Map, Date, window: {} };
  vm.createContext(sb);
  vm.runInContext(dataSrc, sb, { filename: "js/data.js" });
  vm.runInContext(helpers, sb, { filename: "js/core.js#helpers" });
  /* js/data.js は即時関数で包まれ、公開名は window に出る（名前空間の移行。sb.window で受け取る） */
  const DIFFS = sb.window.DIFFS;
  const DIFF_IDS = sb.window.DIFF_IDS;
  return { DIFFS, DIFF_IDS, hashString: sb.hashString, mulberry32: sb.mulberry32 };
}
