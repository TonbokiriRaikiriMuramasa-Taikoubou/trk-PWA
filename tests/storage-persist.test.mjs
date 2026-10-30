// SPDX-License-Identifier: GPL-3.0-or-later
/* 💾 trk136: 端末の保存を固定する（navigator.storage.persist）。
   ・状態は persisted() の結果をそのまま出す（on／off／unsupported）
   ・要求は、まだ固定されていないときだけ persist() を呼ぶ
   ・?safe=1 では要求せず、状態の表示だけ
   ・API が無い・例外のときは unsupported（落とさない） */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const core = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");
const start = core.indexOf("/* ---------- 端末の保存を固定する（trk136）");
const end = core.indexOf("/* ---------- 緊急復旧パネルのボタン");
assert.ok(start >= 0 && end > start, "the storage-persist block can be isolated");
const src = core.slice(start, end);

function setup({ storage, safe = false } = {}) {
  const els = { storagePersistState:{ textContent:"" }, storagePersistBtn:{ hidden:false, disabled:false, listeners:[], addEventListener(t, fn) { this.listeners.push(fn); } } };
  const ctx = vm.createContext({
    console, Promise,
    navigator: storage === undefined ? {} : { storage },
    document: { getElementById: id => els[id] || null },
    tr: key => key,
    window: { TrkSafeMode: () => safe },
  });
  vm.runInContext(src, ctx);
  return { ctx, els };
}
const flush = () => new Promise(r => setTimeout(r, 0));

test("no StorageManager → unsupported, button disabled", async () => {
  const { ctx, els } = setup({ storage: undefined });
  const state = await ctx.requestStoragePersist();
  assert.equal(state, "unsupported");
  assert.equal(ctx.renderStoragePersist(state), "unsupported");
  assert.equal(els.storagePersistState.textContent, "storagePersistUnsupported");
  assert.equal(els.storagePersistBtn.disabled, true);
});

test("already persisted → on, no persist() call, button hidden", async () => {
  let calls = 0;
  const { ctx, els } = setup({ storage:{ persisted: async () => true, persist: async () => { calls++; return true; } } });
  assert.equal(ctx.renderStoragePersist(await ctx.requestStoragePersist()), "on");
  assert.equal(calls, 0);
  assert.equal(els.storagePersistState.textContent, "storagePersistOn");
  assert.equal(els.storagePersistBtn.hidden, true);
});

test("not persisted → persist() is asked once; a refusal shows off", async () => {
  let calls = 0;
  const { ctx, els } = setup({ storage:{ persisted: async () => false, persist: async () => { calls++; return false; } } });
  const state = await ctx.requestStoragePersist();
  assert.equal(state, "off");
  assert.equal(calls, 1);
  ctx.renderStoragePersist(state);
  assert.equal(els.storagePersistState.textContent, "storagePersistOff");
  assert.equal(els.storagePersistBtn.hidden, false);
});

test("a granted request shows on", async () => {
  const { ctx } = setup({ storage:{ persisted: async () => false, persist: async () => true } });
  assert.equal(await ctx.requestStoragePersist(), "on");
});

test("?safe=1 never asks; it only reports the state", async () => {
  let calls = 0;
  const { ctx } = setup({ safe:true, storage:{ persisted: async () => false, persist: async () => { calls++; return true; } } });
  assert.equal(await ctx.requestStoragePersist(), "off");
  assert.equal(calls, 0);
});

test("an exception from the API is unsupported, not a crash", async () => {
  const { ctx } = setup({ storage:{ persisted: async () => { throw new Error("boom"); }, persist: async () => true } });
  assert.equal(await ctx.requestStoragePersist(), "unsupported");
  assert.equal(await ctx.storagePersistState(), "unsupported");
});

test("the settings button is wired to a request on click", async () => {
  let calls = 0;
  const { ctx, els } = setup({ storage:{ persisted: async () => false, persist: async () => { calls++; return true; } } });
  await flush();
  els.storagePersistBtn.listeners.forEach(fn => fn());
  await flush(); await flush();
  assert.equal(calls, 1);
});
