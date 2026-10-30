// SPDX-License-Identifier: GPL-3.0-or-later
/* trk197: 🔓 フォルダーの自動読み取りで「曲が出ない理由」を言う（trk194 の続き）。
   許可が拒否されていると、起動しても何も起きず「自動オフ」とだけ出ていた。
   なぜ出ないのか（ブラウザーのサイト設定で許可し直す）と、そのあと押すボタンまで案内する。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const libSrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const i18nSrc = fs.readFileSync(`${ROOT}/js/i18n.js`, "utf8");

test("trk197: the last permission answer is remembered (so the UI can explain a denial)", () => {
  assert.ok(/let folderLastPermission = "";/.test(libSrc), "状態を持つ");
  assert.ok(/folderLastPermission = p;/.test(libSrc), "queryPermission の答えを残す");
});

test("trk197: a denied folder is explained, not just marked 'automatic off'", () => {
  const sync = libSrc.slice(libSrc.indexOf("function syncShareUI()"), libSrc.indexOf("function syncTrkUI()"));
  assert.ok(sync.includes('folderLastPermission === "denied"'), "拒否を先に見る");
  assert.ok(sync.includes('tr("folderPermDenied", { name:libHandle.name })'), "フォルダー名つきで案内");
  const restore = libSrc.slice(libSrc.indexOf("async function restoreFolderAccess()"), libSrc.indexOf("\nasync function useHandle("));
  assert.ok(restore.includes('core.setStatus("libStatus", "folderPermDenied"'), "起動時にも理由を出す");
  assert.ok(/permission === "denied" && core\.settings\.folderAutoRead !== false/.test(restore), "自動読み取りがオンのときだけ（設定オフは黙っている）");
});

test("trk197: the message says how to allow it again, in all four languages", () => {
  for (const key of ["folderPermDenied"]) assert.equal(i18nSrc.split(`\n    ${key}:`).length - 1, 4, `${key} は4言語`);
  const ja = i18nSrc.match(/folderPermDenied:"([^"]*)"/)[1];
  assert.match(ja, /\{name\}/, "どのフォルダーか分かる");
  assert.match(ja, /ブラウザーの設定/, "直し方（サイト設定）まで言う");
  assert.match(ja, /再接続/, "そのあと押すボタンまで言う");
  const en = i18nSrc.match(/folderPermDenied:"🔒 Reading[^"]*"/)[0];
  assert.match(en, /site settings/);
});

test("trk197: queryPermission failures are reported as denied (not thrown)", async () => {
  const fn = libSrc.match(/async function folderPermissionOf\(h\) \{[\s\S]*?\n\}/)[0];
  const ctx = vm.createContext({});
  vm.runInContext(`let folderLastPermission = "";\n${fn}\nthis.__of = folderPermissionOf; this.__get = () => folderLastPermission;`, ctx);
  assert.equal(await ctx.__of({ async queryPermission() { return "prompt"; } }), "prompt");
  assert.equal(ctx.__get(), "prompt", "答えを残す");
  assert.equal(await ctx.__of({ async queryPermission() { throw new Error("nope"); } }), "denied");
  assert.equal(ctx.__get(), "denied", "例外も「拒否」として扱う");
});
