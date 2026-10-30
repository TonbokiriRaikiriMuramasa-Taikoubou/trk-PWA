// SPDX-License-Identifier: GPL-3.0-or-later
/* trk194: 🔓 起動したら前回のミュージックフォルダーを自動で読み取る（VLCのように開けば曲がある）。
   ブラウザーの File System Access では、許可の確認（requestPermission）をクリックの中でしか出せない。
   そのため「granted なら起動しただけで読む」「prompt なら最初のタップで1回だけ確認する」の2段構えにする。
   ・設定は core.settings.folderAutoRead（初期オン・初期化でオン・セーフモードでオフ）
   ・決め方は純関数 folderReadPlan（scan / ask / none）＝VMで直接検証する
   ・確認の要求は folderAutoKick（最初の pointerdown / keydown の中）だけで行う */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const coreSrc = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");
const libSrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const html = fs.readFileSync(`${ROOT}/index.html`, "utf8");
const i18nSrc = fs.readFileSync(`${ROOT}/js/i18n.js`, "utf8");

const planSrc = libSrc.match(/function folderReadPlan\(st\) \{[\s\S]*?\n\}/)[0];
const permSrc = libSrc.match(/async function folderPermissionOf\(h\) \{[\s\S]*?\n\}/)[0];
const plan = st => vm.runInNewContext(`${planSrc}; folderReadPlan(${JSON.stringify(st)})`);

/* ---------- 設定 ---------- */
test("trk194: automatic folder reading is on by default and off in safe mode", () => {
  assert.ok(coreSrc.includes("folderAutoRead: prefs.folderAutoRead !== false"), "初期オン（今までどおりの手動も残る）");
  assert.ok(/settings\.folderAutoRead = true;/.test(coreSrc), "設定の初期化でオンへ戻す");
  assert.ok(/settings\.folderAutoRead = false;/.test(coreSrc), "セーフモードでは自動で読まない");
});

/* ---------- 決め方（純関数） ---------- */
test("trk194: a live permission is read with no click at all", () => {
  assert.equal(plan({ hasHandle:true, permission:"granted", autoRead:true, safe:false }), "scan");
});

test("trk194: a prompt waits for the first tap, a denial never auto-prompts", () => {
  assert.equal(plan({ hasHandle:true, permission:"prompt", autoRead:true, safe:false }), "ask");
  assert.equal(plan({ hasHandle:true, permission:"denied", autoRead:true, safe:false }), "none");
});

test("trk194: the setting and safe mode fall back to the manual reconnect", () => {
  for (const st of [
    { hasHandle:true, permission:"granted", autoRead:false, safe:false },
    { hasHandle:true, permission:"prompt", autoRead:false, safe:false },
    { hasHandle:true, permission:"granted", autoRead:true, safe:true },
    { hasHandle:false, permission:"granted", autoRead:true, safe:false },
    {},
  ]) assert.equal(plan(st), "none", JSON.stringify(st));
});

/* ---------- 最初のタップの中でだけ確認する ---------- */
function kickWith({ permission = "prompt", request = "granted", queryThrows = false } = {}) {
  const calls = { use: 0, request: 0, synced: 0, disarmed: 0 };
  const handle = {
    name: "Music",
    async queryPermission() { if (queryThrows) throw new Error("nope"); return permission; },
    async requestPermission() { calls.request++; return request; },
  };
  const fn = libSrc.match(/async function folderAutoKick\(e\) \{[\s\S]*?\n\}/)[0];
  const manual = libSrc.match(/const FOLDER_MANUAL_SELECTOR = [^;]+;/)[0];
  const context = vm.createContext({
    libHandle: handle, libShared: false, calls,
    disarmFolderAutoRead: () => { calls.disarmed++; },
    useHandle: async () => { calls.use++; },
    markFolderAccess: () => {},
    showReconnect: () => {}, syncShareUI: () => { calls.synced++; },
    core: { setStatus: () => {}, $: () => ({ hidden: false }) },
  });
  vm.runInContext(`let folderAutoBusy = false;\n${manual}\n${permSrc}\n${fn}; globalThis.kick = e => folderAutoKick(e);`, context);
  return { context, calls };
}

test("trk194: tapping asks the browser once and then reads the folder", async () => {
  const ok = kickWith({ permission:"prompt", request:"granted" });
  await ok.context.kick();
  assert.equal(ok.calls.request, 1, "確認はクリックの中の1回だけ");
  assert.equal(ok.calls.use, 1, "許可できたら読み取る");
  assert.equal(ok.calls.disarmed, 1, "待ち合わせは1回で解除");

  const live = kickWith({ permission:"granted" });
  await live.context.kick();
  assert.equal(live.calls.request, 0, "許可が生きていれば確認しない");
  assert.equal(live.calls.use, 1);
});

test("trk194: a refused or failed confirmation keeps the manual button", async () => {
  const no = kickWith({ permission:"prompt", request:"denied" });
  await no.context.kick();
  assert.equal(no.calls.use, 0, "許可されなければ読まない");
  assert.equal(no.calls.synced, 1, "状態の表示だけ更新する");

  const broken = kickWith({ queryThrows:true, request:"denied" });
  await broken.context.kick();
  assert.equal(broken.calls.use, 0, "確認に失敗しても落ちない");
});

test("trk194: tapping a folder button keeps the manual flow in charge", async () => {
  const manual = kickWith({ permission:"prompt", request:"granted" });
  await manual.context.kick({ target: { closest: sel => sel.includes("#libShareBtn") ? {} : null } });
  assert.equal(manual.calls.request, 0, "「📤 共有」などを押したときは自動の確認を出さない");
  assert.equal(manual.calls.use, 0);
});

/* ---------- 配線 ---------- */
test("trk194: startup uses the plan instead of just showing a reconnect button", () => {
  assert.ok(libSrc.includes("await restoreFolderAccess();"), "起動時に自動で読み取る");
  const restore = libSrc.match(/async function restoreFolderAccess\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(restore.includes('plan === "scan"'), "生きていれば読む");
  assert.ok(restore.includes('plan === "ask"') && restore.includes("armFolderAutoRead()"), "確認が必要ならタップ待ち");
  assert.ok(libSrc.includes('document.addEventListener("pointerdown", folderAutoKick, true)'), "最初のタップで解除する");
  assert.ok(libSrc.includes('document.addEventListener("keydown", folderAutoKick, true)'), "キーボードでも同じ");
  const disarm = libSrc.match(/function disarmFolderAutoRead\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(disarm.includes('removeEventListener("pointerdown", folderAutoKick, true)'), "要らなくなったら確実に外す");
  const stop = libSrc.match(/async function stopSharing\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(stop.includes("disarmFolderAutoRead()"), "共有をやめたら待ち合わせも止める");
});

test("trk194: a grant made in this session is not described as permanent", () => {
  const mark = libSrc.match(/function markFolderAccess\(persisted\) \{[\s\S]*?\n\}/)[0];
  assert.ok(mark.includes("folderAccessSession = persisted !== true"), "今回の許可は「次回も自動」と言い切らない");
  const restore = libSrc.match(/async function restoreFolderAccess\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(restore.includes("folderAccessPersisted = true"), "起動時点で granted なら覚えている");
  const sync = libSrc.match(/function syncShareUI\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(sync.includes("folderPermSession"), "今回だけの許可には専用の説明を出す");
});

test("trk194: the setting panel shows the switch and the current permission state", () => {
  assert.ok(html.includes('id="folderAutoReadChk"'), "設定のチェック");
  assert.ok(html.includes('id="folderAutoReadHint"'), "説明");
  assert.ok(html.includes('id="folderAutoNowBtn"'), "いま読み取るボタン");
  assert.ok(html.includes('id="folderPermState"'), "いまの許可の状態");
  const sync = libSrc.match(/function syncShareUI\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(sync.includes("folderPermPersisted"), "次回も自動で読めることを伝える");
  assert.ok(sync.includes("folderPermNeedsTap"), "タップ待ちを伝える");
  assert.ok(sync.includes("folderAutoReadChk"), "チェックの状態を合わせる");
});

test("trk194: the tap-to-read button says what will happen", () => {
  const show = libSrc.match(/function showReconnect\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(show.includes('"libReconnectAuto"'), "タップ待ちのときは「読み取る」と書く");
});

/* ---------- 4言語 ---------- */
test("trk194: every new label exists in all four languages", () => {
  for (const key of ["folderAutoRead", "folderAutoReadHint", "folderAutoNow", "folderAutoChecking",
    "folderAutoNeedsTap", "folderPermPersisted", "folderPermNeedsTap", "folderPermManual", "folderPermNone",
    "libAutoRestored", "libShareAutoRestored", "libReconnectAuto", "libShareStateOpened", "folderPermSession"]) {
    const n = (i18nSrc.match(new RegExp(`(^|[\\s,{])${key}:`, "g")) || []).length;
    assert.equal(n, 4, `${key} は4言語`);
  }
});
