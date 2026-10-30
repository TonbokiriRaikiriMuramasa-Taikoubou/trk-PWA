// SPDX-License-Identifier: GPL-3.0-or-later
/* 📦 trk130: パックを外したときに、パックが変えた設定（スキン・ノーツ・fxPower・SEのオン）を戻す。
   ・退避は settings.packPrev（保存される）＝パックを使ったまま再起動してから外しても戻せる
   ・パックAからBへ切り替えても上書きしない（最初に退避した値を保つ）
   ・利用者がパックを使っている間に自分で変えた項目は戻さない（その変更が正）
   新しいパックに音が無いときだけ自分のSEを読み直す（切り替え中の競合よけ） */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const custom = fs.readFileSync(`${ROOT}/js/custom.js`, "utf8");
const start = custom.indexOf("/* 📦 パックが変えた設定の退避（trk130）");
const end = custom.indexOf("async function activatePack(");
assert.ok(start >= 0 && end > start, "the pack snapshot/restore helpers can be isolated");
const src = custom.slice(start, end);

const SKINS = { shadow:{}, sakura:{}, forest:{} };
function setup({ prev = null, savedSkinAtBoot = "shadow", seFiles = [null, null] } = {}) {
  const calls = { skins: [], loadedSE: [] };
  const settings = { skin:"sakura", notes:[{ color:"#ffcc00", shape:"circle" }, { color:"#00ccff", shape:"diamond" }],
    fxPower:1.25, seEnabled:false, activePack:"p1", packPrev:prev ? JSON.parse(JSON.stringify(prev)) : null };
  const els = { fxPower:{ value:0 }, seEnabled:{ checked:false } };
  const ctx = vm.createContext({
    console, JSON, Array, Object, String, Number, Math,
    core: { settings, savedSkinAtBoot,
      applySkin(id, persist) { calls.skins.push(id); settings.skin = Object.prototype.hasOwnProperty.call(SKINS, id) ? id : "shadow"; },
      $(id) { return els[id] || null; }, setStatus() {}, saveUserPrefs() {} },
    setNotes(list) { settings.notes = list.map(n => ({ color:n.color, shape:n.shape })); },
    showFxPower() {},
    window: { Trk: { media: { seBuffers:[{}, {}], seFiles, loadSE(file, lane) { calls.loadedSE.push([file, lane]); } } } }
  });
  vm.runInContext(src + "\nglobalThis.__api = { packSnapshot, packApplied, packRebase, packRestoreSettings, restoreOwnSounds };", ctx);
  return { settings, els, calls, api: ctx.__api };
}

test("a pack that changed the look gives the old look back when it is removed", () => {
  const { settings, els, calls, api } = setup();
  api.packSnapshot();
  api.packApplied({ skin:"pack_p1", notes:[{ color:"#111111", shape:"square" }, { color:"#222222", shape:"triangle" }], fxPower:2, seEnabled:true });
  settings.skin = "pack_p1"; settings.notes = [{ color:"#111111", shape:"square" }, { color:"#222222", shape:"triangle" }];
  settings.fxPower = 2; settings.seEnabled = true; els.fxPower.value = 2; els.seEnabled.checked = true;
  assert.equal(api.packRestoreSettings(), true);
  assert.equal(settings.skin, "sakura", "the user's own skin comes back");
  assert.deepEqual(settings.notes.map(n => n.color), ["#ffcc00", "#00ccff"]);
  assert.equal(settings.fxPower, 1.25);
  assert.equal(settings.seEnabled, false);
  assert.equal(els.fxPower.value, 1.25, "the slider follows");
  assert.equal(els.seEnabled.checked, false, "the checkbox follows");
  assert.equal(settings.packPrev, undefined, "the snapshot is used up");
  assert.ok(calls.skins.includes("sakura"));
});

test("what the user changed while the pack was on is kept", () => {
  const { settings, api } = setup();
  api.packSnapshot();
  api.packApplied({ skin:"pack_p1", notes:[{ color:"#111111", shape:"square" }, { color:"#222222", shape:"triangle" }], fxPower:2, seEnabled:true });
  settings.seEnabled = true;                     /* パックが入れた（利用者は触っていない） */
  settings.skin = "forest";                      /* 利用者が別のスキンを選んだ */
  settings.notes = [{ color:"#ffffff", shape:"circle" }, { color:"#000000", shape:"circle" }];
  settings.fxPower = 0.5;                        /* 動かした */
  assert.equal(api.packRestoreSettings(), true, "the SE switch (which the user did not touch) still comes back");
  assert.equal(settings.skin, "forest");
  assert.deepEqual(settings.notes.map(n => n.color), ["#ffffff", "#000000"]);
  assert.equal(settings.fxPower, 0.5);
  assert.equal(settings.seEnabled, false, "SE goes back to off — the pack turned it on and the user left it alone");
  assert.equal(settings.packPrev, undefined);
});

test("switching from pack A to pack B keeps A's snapshot", () => {
  const { settings, api } = setup();
  api.packSnapshot();
  api.packApplied({ skin:"pack_p1", fxPower:2 });
  /* B を当てるとき（activatePack は snapshot → deactivatePack(false) の順で呼ぶ） */
  settings.packPrev.applied = {};                /* deactivatePack(false) は packRestoreSettings を呼ばない */
  settings.skin = "pack_p1";
  api.packSnapshot();
  assert.equal(settings.packPrev.skin, "sakura", "the first snapshot is not overwritten");
  api.packApplied({ skin:"pack_p2" });
  settings.skin = "pack_p2";
  api.packRestoreSettings();
  assert.equal(settings.skin, "sakura", "removing B brings back the skin from before A");
});

test("a snapshot saved in the settings still works after a restart", () => {
  /* 再起動の再現：起動時の復元（restore:true）は packSnapshot を呼ばず、settings.packPrev をそのまま使う */
  const prev = { skin:"sakura", notes:[{ color:"#ffcc00", shape:"circle" }, { color:"#00ccff", shape:"diamond" }],
    fxPower:1.25, seEnabled:false, applied:{ skin:"pack_p1", fxPower:2, seEnabled:true } };
  const { settings, api } = setup({ prev });
  settings.skin = "pack_p1"; settings.fxPower = 2; settings.seEnabled = true;
  assert.equal(api.packRestoreSettings(), true);
  assert.equal(settings.skin, "sakura");
  assert.equal(settings.fxPower, 1.25);
  assert.equal(settings.seEnabled, false);
});

test("a missing snapshot falls back to the default skin (old data)", () => {
  const { settings, api } = setup();
  settings.skin = "pack_p1";
  assert.equal(api.packRestoreSettings(), false, "no snapshot = nothing to restore");
  assert.equal(settings.skin, "pack_p1");
});

test("the wiring: snapshot before applying, restore only when the pack is really removed", () => {
  const act = custom.slice(custom.indexOf("async function activatePack("), custom.indexOf("function deactivatePack("));
  const deact = custom.slice(custom.indexOf("function deactivatePack("), custom.indexOf("async function installAndUse("));
  const iSnap = act.indexOf("if (!restore) { packSnapshot(); packRebase(); }"), iUnload = act.indexOf("deactivatePack(false);");
  assert.ok(iSnap >= 0 && iUnload > iSnap, "the snapshot is taken before the old pack is unloaded (the unload can reset the skin)");
  assert.ok(act.indexOf("packSnapshot();") < act.indexOf("packApplied("), "prev is captured before applied");
  for (const mark of ["packApplied({ skin: sid })", "packApplied({ notes:", "packApplied({ seEnabled: true })", "packApplied({ fxPower: core.settings.fxPower })"])
    assert.ok(act.includes(mark), `${mark} records what the pack applied`);
  assert.ok(deact.includes("if (persist) packRestoreSettings();"), "removing restores; switching does not");
  assert.ok(deact.indexOf("packRestoreSettings();") < deact.indexOf("delete window.Trk.data.SKINS[sid];"), "restore runs before the pack skin is deleted");
  assert.ok(deact.includes("if (persist) restoreOwnSounds();"), "the SE reload waits until the pack is really removed");
  assert.ok(act.includes("if (!packRuntime.hadSounds && prevHadSounds) restoreOwnSounds();"), "a sound-less pack hands the user's SE back");
  assert.ok(act.includes("if (restore) { core.settings.activePack = null; packRestoreSettings();"), "a missing pack record gives the settings back");
});

test("own sound effects come back, and only the sound-less pack reads them", () => {
  const don = { name:"don.wav" };
  const { settings, calls, api } = setup({ seFiles:[don, null] });
  assert.equal(api.restoreOwnSounds(), true);
  assert.deepEqual(calls.loadedSE, [[don, 0]]);
  assert.equal(api.restoreOwnSounds(), true, "no own sound file for the ka lane leaves it null");
  assert.deepEqual(calls.loadedSE, [[don, 0], [don, 0]]);
});

test("trk132: what the user changed while pack A was on survives a switch to pack B", () => {
  const { settings, api } = setup();
  api.packSnapshot();
  api.packApplied({ skin:"pack_p1", fxPower:2, seEnabled:true });
  settings.skin = "pack_p1"; settings.fxPower = 2; settings.seEnabled = true;
  settings.skin = "forest";       /* A を使いながら、自分でスキンを選び直した */
  settings.seEnabled = false;     /* SE も自分で切った */
  api.packSnapshot(); api.packRebase();   /* B を当てる直前（activatePack の順） */
  assert.equal(settings.packPrev.skin, "forest", "the user's newer choice becomes the value to come back to");
  assert.equal(settings.packPrev.seEnabled, false);
  assert.equal(settings.packPrev.applied.skin, undefined, "A's skin is no longer something the pack set");
  assert.equal(settings.packPrev.applied.fxPower, 2, "untouched fields stay as applied");
  assert.equal(settings.packPrev.fxPower, 1.25);
});

/* ①スキンを持つパックAから、スキンを持たないパックBへ切り替えるとき、Aのスキンを消すだけだと
     「Aのスキン（applied）と今のスキン（shadow）が食い違って」Bを外しても戻らなかった。
   ②退避の無い古いデータは、これまでどおり shadow へ。 */
const deactSrc = custom.slice(custom.indexOf("function deactivatePack("), custom.indexOf("async function installAndUse("));
assert.ok(deactSrc.includes("const pv = core.settings.packPrev"), "deactivatePack can be isolated for the switch case");

function loadSwitch({ skin, prev = null, skinId = "pack_p1" }) {
  const calls = { skins: [] };
  const settings = { skin, activePack:"p1", notes:[{ color:"#ffcc00", shape:"circle" }, { color:"#00ccff", shape:"diamond" }],
    fxPower:1.25, seEnabled:false, packPrev:prev ? JSON.parse(JSON.stringify(prev)) : null };
  const ctx = vm.createContext({
    JSON, Array, Object, String,
    core: { settings, applySkin(id, persist) { calls.skins.push([id, persist]); settings.skin = id; },
      buildSkinGrid() {}, saveUserPrefs() {}, setStatus() {}, $: () => null },
    setNotes(list) { settings.notes = list; }, showFxPower() {},
    URL: { revokeObjectURL() {} },
    window: { Trk: { data: { SKINS: { shadow:{}, sakura:{}, forest:{}, pack_p1:{}, pack_p2:{} } },
      media: { seBuffers:[{}, {}], seFiles:[null, null], loadSE() {} } } },
    restoreOwnSounds: () => false, updateMascotUI() {}, renderPackList() {},
    packRuntime: { id:"p1", captions:null, noteImages:[null, null], urls:[], skinId, hadSounds:false }
  });
  vm.runInContext(src + "\n" + deactSrc + "\nglobalThis.__deactivatePack = deactivatePack;", ctx);
  return { settings, calls, deactivatePack: ctx.__deactivatePack };
}

test("trk132: a skin-less pack B leaves the skin the user had before pack A", () => {
  const { settings, calls, deactivatePack } = loadSwitch({ skin:"pack_p1",
    prev:{ skin:"sakura", notes:[{ color:"#ffcc00", shape:"circle" }, { color:"#00ccff", shape:"diamond" }], fxPower:1.25, seEnabled:false, applied:{ skin:"pack_p1" } } });
  deactivatePack(false);   /* A→B の切り替え（persist=false＝本当には外していない） */
  assert.equal(settings.skin, "sakura", "going to shadow here was the bug: B could not give this back");
  assert.deepEqual(calls.skins, [["sakura", false]], "the saved skin is applied without saving over the user's choice");
  assert.equal(settings.packPrev.applied.skin, undefined, "A's applied skin is forgotten, so removing B keeps the value");
});

test("trk132: with no snapshot at all (old data) the fallback stays shadow", () => {
  const { settings, deactivatePack } = loadSwitch({ skin:"pack_p1", prev:null });
  deactivatePack(false);
  assert.equal(settings.skin, "shadow");
});
