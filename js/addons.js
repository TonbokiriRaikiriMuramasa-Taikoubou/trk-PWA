// SPDX-License-Identifier: GPL-3.0-or-later
/* ==========================================================================
   trk! addons.js — 🧩 アドオン（あとから機能を足せるしくみ）

   【考え方】
   ・本体には入れられない機能（例：YouTube の音をエフェクターに通す…など）を、
     あとから誰かが「アドオン」として足せるようにするための、置き場所と決まりごと。
   ・本体はアドオンを同梱しません。入れるかどうかは、使う人が決めます。
   ・アドオンの中身は、このページの中で動くプログラムです。信頼できるものだけ入れてください。

   【入れ方】
   ・設定画面「🧩 アドオン」→「📄 アドオンを入れる」で、.js か .trk-addon(JSON) を選ぶ
   ・index.html に <script src="js/addons/○○.js"></script> を足す（配布物に入れる場合）

   【アドオンの書き方】
     TrkAddons.register({
       id:"my-addon", name:"わたしのアドオン", version:"1.0.0",
       author:"名前", description:"何をするか", apiVersion:1,
       setup(api){ ... },        // 読み込まれたときに1回呼ばれます
       teardown(){}              // 任意（いまは、外したあとの後片付け用）
     });

   【api でできること（apiVersion 1）】
     api.tr(key, vars)        … 本体の文章（4言語）を引く
     api.el(tag, cls, text)   … 要素を作る
     api.$(id)                … id で要素を取る
     api.addStyle(css)        … <style> を足す（見た目を足す用）
     api.on(event, fn) / api.emit(event, data) … 本体のイベント（language / tvChange / packsChanged / addonSelect / nowPlaying など）
                                  ※ apiVersion 2: api.on は**解除関数**を返します（teardown で購読を外せます）
     api.nowPlaying()         … 💬 いまの曲のスナップショット（trk-now-playing/1・曲が無ければ null・API v2）
     api.slot(name)           … 置き場所。name は "settings" / "libPanel" / "tvMore" / "rackMore" / "drawer"（API v2・画面右端の引き出し）
     api.say(text)            … 設定画面のアドオン欄に、そのままの文字を出す
     api.settings / api.savePrefs() … 設定（shadow_taiko_preferences_v2）
     api.video() / api.phase()      … 本体の <video> と、いまの画面（"title" など）
     api.addSongs(list)       … 曲リストに曲を足す（source:"addon"・タブが自動でできる）
     api.fx.available()       … エフェクター（TrkFX）が使えるか
     api.fx.tapElement(el)    … 自分の <audio>/<video> を、本体のエフェクターに通す
     api.log(...)             … コンソールに出す（[addon:id] が付きます）

   【曲を足すときの形（api.addSongs）】
     { key, title, artist?, bpm?, offset?,
       file?(Blob/File)   … 入れると本体の再生・エフェクターにそのまま乗ります
       addonName?         … タブの名前（既定はアドオン名）
     }
     file を入れない曲は、選んだときに "addonSelect" イベントが流れるので、
     アドオン側が自前のプレイヤーで鳴らします（その音は api.fx.tapElement でエフェクターへ）。

   【保存】
   ・trk_addons_v1（localStorage）＝入れたアドオン（名前・作者・有効/無効・コード）
   ・配布ファイルの形式名は "trk-addon"（JSON）。code を文字列で持ちます
   読み込み順：… → verified.js → lib-skins.js → addons.js（最後）
   ========================================================================== */
"use strict";
(() => {
  const core = window.Trk.core;

const ADDONS_KEY = "trk_addons_v1";       // 新しい保存キー（既存のキーは触りません）
const ADDON_FORMAT = "trk-addon";         // 配布ファイルの形式名
const API_VERSION = 2;                    // このファイルが提供するAPIの版（trk191: nowPlaying / drawer / on の解除関数）
const MAX_CODE = 512 * 1024;              // 1つのアドオンコードの上限（512KiB）
const MAX_ADDON_FILE = 4 * 1024 * 1024;   // JSONラッパーを含む入力ファイルの上限（4MiB）
const SAMPLE_URL = "js/addons/example.js";
function exceedsUtf8Limit(value, limit) {
  const text = String(value);
  if (text.length > limit) return true;    // UTF-8はASCIIでも最低1 byte／UTF-16 code unit
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c <= 0x7f) bytes++;
    else if (c <= 0x7ff) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length &&
        text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i++; }
    else bytes += 3;                       // BMP / unpaired surrogate (TextEncoder replacement)
    if (bytes > limit) return true;
  }
  return false;
}

/* ============ 文章（接頭辞 addon…） ============ */
Object.assign(TEXT.ja, {
  addonTitle:"🧩 アドオン（あとから機能を足す）",
  addonHint:"本体に入れられない機能を、あとから足せます。アドオンは、このページの中で動くプログラムです。**信頼できるものだけ**入れてください。",
  addonInstall:"📄 アドオンを入れる", addonSample:"⬇ サンプルを保存", addonDocs:"📖 つくり方（docs/ADDONS.md）",
  addonReload:"↻ 反映して再読み込み", addonNone:"まだアドオンはありません。",
  addonOn:"オン", addonOff:"オフ", addonDelete:"削除", addonFromFile:"index.html から読み込み",
  addonInstalled:"アドオン「{name}」を入れました。", addonRemoved:"アドオン「{name}」を外しました（↻ 反映して再読み込み）。",
  addonToggledOn:"アドオン「{name}」をオンにしました（↻ 反映して再読み込み）。",
  addonToggledOff:"アドオン「{name}」をオフにしました（↻ 反映して再読み込み）。",
  addonBadFile:"アドオンとして読み込めませんでした：{why}", addonNoRegister:"TrkAddons.register({...}) が見つかりませんでした。",
  addonNeedReload:"（いま入れたアドオンは、読み込み直すと もっと確実に動きます）",
  addonSongs:"このアドオンが足した曲：{n}曲", addonBroken:"エラー：{why}",
  addonSafe:"🛟 セーフモード中は、アドオンを読み込みません（?safe=1 を外して開き直してください）。",
  addonConsentTitle:"🧩 このアドオンを追加しますか？", addonConsentFile:"ファイル：{name}",
  addonConsentBody:"アドオンは trk! と同じ権限（同じページの中）で動きます。設定・スコア・📚 書斎の本や画像・覚えているフォルダのハンドルを読める立場になり、外部へ送ることも技術的には可能です。\n**信頼できるものだけ**追加してください（あとからオフ・削除できます）。",
  addonConsentYes:"✅ 同意して追加する", addonConsentNo:"やめる",
  addonConsentRecorded:"✅ 「{name}」の同意を記録しました（{date}）。", addonConsentCanceled:"追加をやめました。",
  addonConsentBadge:"✅ 同意 {date}", addonConsentNone:"⚠ 同意の記録がありません（この記録を始める前に追加したアドオンです）",
  addonConsentStale:"⚠ コードが同意したときと変わっています（自分で入れ直したのでなければ外してください）",
  addonConsentBtn:"✅ 同意を記録する", addonConsentHint:"同意の記録は端末内にだけ保存されます（外部へは送りません）。",
  addonSampleSaved:"サンプルを保存しました。中身を見て、自分のアドオンを作ってみてください。",
  addonSampleFail:"サンプルを取ってこられませんでした。docs/ADDONS.md を見てください。",
  addonFileTooBig:"ファイルが大きすぎます（{n}KB まで）。",
  addonTooBig:"大きすぎます（{n}KB まで）。"
});
Object.assign(TEXT.en, {
  addonTitle:"🧩 Add-ons (add features later)",
  addonHint:"You can add features the app itself can't include. An add-on is a program that runs inside this page. **Only install ones you trust.**",
  addonInstall:"📄 Install an add-on", addonSample:"⬇ Save the sample", addonDocs:"📖 How to make one (docs/ADDONS.md)",
  addonReload:"↻ Apply and reload", addonNone:"No add-ons yet.",
  addonOn:"On", addonOff:"Off", addonDelete:"Remove", addonFromFile:"loaded from index.html",
  addonInstalled:"Installed “{name}”.", addonRemoved:"Removed “{name}” (↻ Apply and reload).",
  addonToggledOn:"“{name}” is on (↻ Apply and reload).",
  addonToggledOff:"“{name}” is off (↻ Apply and reload).",
  addonBadFile:"Could not read it as an add-on: {why}", addonNoRegister:"No TrkAddons.register({...}) found.",
  addonNeedReload:"(A reload makes a freshly installed add-on work more reliably.)",
  addonSongs:"Songs added by this add-on: {n}", addonBroken:"Error: {why}",
  addonSafe:"🛟 Add-ons are not loaded in safe mode (open again without ?safe=1).",
  addonConsentTitle:"🧩 Add this add-on?", addonConsentFile:"File: {name}",
  addonConsentBody:"Add-ons run with the same privileges as trk! itself (inside the same page). They can read your settings, scores, 📚 Study books and images, remembered folder handles, and could technically send data out.\nPlease add only add-ons you trust (you can turn them off or delete them later).",
  addonConsentYes:"✅ I agree - add it", addonConsentNo:"Cancel",
  addonConsentRecorded:"✅ Recorded your consent for \"{name}\" ({date}).", addonConsentCanceled:"Cancelled - nothing was added.",
  addonConsentBadge:"✅ Agreed {date}", addonConsentNone:"⚠ No consent on record (this add-on was installed before the record existed)",
  addonConsentStale:"⚠ The code differs from what you agreed to (remove it unless you replaced it yourself)",
  addonConsentBtn:"✅ Record my consent", addonConsentHint:"The consent record is stored on this device only (never uploaded).",
  addonSampleSaved:"Sample saved. Open it and try making your own add-on.",
  addonSampleFail:"Could not fetch the sample. See docs/ADDONS.md.",
  addonFileTooBig:"File is too large (up to {n}KB).",
  addonTooBig:"Too big (up to {n}KB)."
});
Object.assign(TEXT.zh, {
  addonTitle:"🧩 插件（之后添加功能）",
  addonHint:"可以之后添加本体无法包含的功能。插件是在本页面内运行的程序，**请只安装你信任的**。",
  addonInstall:"📄 安装插件", addonSample:"⬇ 保存示例", addonDocs:"📖 制作方法（docs/ADDONS.md）",
  addonReload:"↻ 应用并重新加载", addonNone:"还没有插件。",
  addonOn:"开", addonOff:"关", addonDelete:"删除", addonFromFile:"从 index.html 读取",
  addonInstalled:"已安装插件「{name}」。", addonRemoved:"已移除插件「{name}」（↻ 应用并重新加载）。",
  addonToggledOn:"插件「{name}」已开启（↻ 应用并重新加载）。",
  addonToggledOff:"插件「{name}」已关闭（↻ 应用并重新加载）。",
  addonBadFile:"无法作为插件读取：{why}", addonNoRegister:"没有找到 TrkAddons.register({...})。",
  addonNeedReload:"（重新加载后，刚安装的插件会更可靠地运行。）",
  addonSongs:"此插件添加的歌曲：{n}首", addonBroken:"错误：{why}",
  addonSafe:"🛟 安全模式下不会读取插件（请去掉 ?safe=1 后重新打开）。",
  addonConsentTitle:"🧩 要添加这个插件吗？", addonConsentFile:"文件：{name}",
  addonConsentBody:"插件以与 trk! 相同的权限运行（同一个页面内）。它可以读取设置、成绩、📚 书房的书籍与图片、记住的文件夹句柄，技术上也可能把数据发到外部。\n请只添加**信得过的**插件（之后可以关闭或删除）。",
  addonConsentYes:"✅ 同意并添加", addonConsentNo:"取消",
  addonConsentRecorded:"✅ 已记录对「{name}」的同意（{date}）。", addonConsentCanceled:"已取消，没有添加。",
  addonConsentBadge:"✅ 已同意 {date}", addonConsentNone:"⚠ 没有同意记录（这是在开始记录之前添加的插件）",
  addonConsentStale:"⚠ 代码与同意时不同（如果不是自己重新安装的，请移除）",
  addonConsentBtn:"✅ 记录同意", addonConsentHint:"同意记录只保存在本机（不会上传）。",
  addonSampleSaved:"已保存示例。请打开看看，试着自己做一个插件。",
  addonSampleFail:"取不到示例。请看 docs/ADDONS.md。",
  addonFileTooBig:"文件太大（最大 {n}KB）。",
  addonTooBig:"太大了（最大 {n}KB）。"
});
Object.assign(TEXT.ko, {
  addonTitle:"🧩 애드온 (나중에 기능 추가)",
  addonHint:"본체에 넣을 수 없는 기능을 나중에 추가할 수 있습니다. 애드온은 이 페이지 안에서 동작하는 프로그램입니다. **믿을 수 있는 것만** 넣어 주세요.",
  addonInstall:"📄 애드온 넣기", addonSample:"⬇ 샘플 저장", addonDocs:"📖 만드는 법 (docs/ADDONS.md)",
  addonReload:"↻ 반영하고 새로고침", addonNone:"아직 애드온이 없습니다.",
  addonOn:"켜기", addonOff:"끄기", addonDelete:"삭제", addonFromFile:"index.html에서 읽음",
  addonInstalled:"애드온 '{name}'을(를) 넣었습니다.", addonRemoved:"애드온 '{name}'을(를) 뺐습니다 (↻ 반영하고 새로고침).",
  addonToggledOn:"애드온 '{name}'을(를) 켰습니다 (↻ 반영하고 새로고침).",
  addonToggledOff:"애드온 '{name}'을(를) 껐습니다 (↻ 반영하고 새로고침).",
  addonBadFile:"애드온으로 읽을 수 없습니다: {why}", addonNoRegister:"TrkAddons.register({...})를 찾지 못했습니다.",
  addonNeedReload:"(새로고침하면 방금 넣은 애드온이 더 확실히 동작합니다.)",
  addonSongs:"이 애드온이 더한 곡: {n}곡", addonBroken:"오류: {why}",
  addonSafe:"🛟 안전 모드에서는 애드온을 읽지 않습니다 (?safe=1을 빼고 다시 열어 주세요).",
  addonConsentTitle:"🧩 이 애드온을 추가할까요?", addonConsentFile:"파일: {name}",
  addonConsentBody:"애드온은 trk! 와 같은 권한(같은 페이지 안)으로 동작합니다. 설정·점수·📚 서재의 책과 이미지·기억해 둔 폴더 핸들을 읽을 수 있고, 기술적으로는 외부로 보낼 수도 있습니다.\n**믿을 수 있는 것만** 추가해 주세요 (나중에 끄거나 삭제할 수 있습니다).",
  addonConsentYes:"✅ 동의하고 추가", addonConsentNo:"취소",
  addonConsentRecorded:"✅ 「{name}」에 대한 동의를 기록했습니다 ({date}).", addonConsentCanceled:"취소했습니다. 추가하지 않았습니다.",
  addonConsentBadge:"✅ 동의 {date}", addonConsentNone:"⚠ 동의 기록이 없습니다 (기록을 시작하기 전에 추가한 애드온입니다)",
  addonConsentStale:"⚠ 코드가 동의했을 때와 다릅니다 (직접 다시 설치한 것이 아니라면 삭제해 주세요)",
  addonConsentBtn:"✅ 동의 기록하기", addonConsentHint:"동의 기록은 이 기기에만 저장됩니다 (업로드하지 않습니다).",
  addonSampleSaved:"샘플을 저장했습니다. 열어 보고 자기만의 애드온을 만들어 보세요.",
  addonSampleFail:"샘플을 가져오지 못했습니다. docs/ADDONS.md를 봐 주세요.",
  addonFileTooBig:"파일이 너무 큽니다 ({n}KB까지).",
  addonTooBig:"너무 큽니다 ({n}KB까지)."
});

/* ============ 保存（入れたアドオン） ============ */
function loadStore() {
  try {
    const raw = localStorage.getItem(ADDONS_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return (o && typeof o === "object") ? o : {};
  } catch (_) { return {}; }
}
let store = loadStore();
function saveStore() {
  try { localStorage.setItem(ADDONS_KEY, JSON.stringify(store)); return true; }
  catch (e) { say("⚠ " + (e && e.message || e)); return false; }
}
const runtime = new Map();      // id → { def, api }
const fileAddons = [];          // index.html の <script> から来たアドオン
const songsByAddon = new Map(); // id → 曲の配列
const slots = new Map();        // 置き場所
const consentStateCache = new WeakMap();
let collecting = null;          // いま走っているコードが register() したぶん
let pendingReload = false;
let bootPromise = Promise.resolve();

/* ============ 画面まわり ============ */
function say(text, isError) {
  const box = core.$("addonStatus");
  if (box) { box.textContent = String(text || ""); box.classList.toggle("ng", !!isError); }
}
function downloadText(text, filename) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type:"text/javascript" }));
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (e) { say("⚠ " + (e && e.message || e), true); }
}
/* セーフモード中は、アドオンを読み込まない。
   印は core.js（window.TrkSafeMode）から。URLのほうは、処理前に見るための保険です */
const safeNow = () => {
  try { if (typeof window.TrkSafeMode === "function" && window.TrkSafeMode()) return true; } catch (_) {}
  try {
    const u = new URL(location.href), sp = u.searchParams;
    return sp.has("safe") || sp.get("safe") === "1" || (u.hash || "").toLowerCase().includes("safe") || sp.has("factory");
  } catch (_) { return false; }
};
const appPhase = () => (typeof core.phase === "string" ? core.phase : "");

/* ============ 置き場所（アドオンがUIを足せる場所） ============ */
function mountSlots() {
  const mk = (name, host, put) => {
    if (!host) return;
    const box = core.el("div", "addonSlot"); box.dataset.addonSlot = name;
    put(host, box);
    slots.set(name, box);
  };
  mk("settings", core.$("addonSlots"), (h, d) => h.append(d));
  mk("libPanel", core.$("libPanel"), (h, d) => { const st = core.$("libStatus"); if (st) st.before(d); else h.append(d); });
  /* 📺🎛 の「くわしい」は、並べ替えで列の下のほうへ移ることがある（Task E）。どちらでも見つける */
  mk("tvMore", document.querySelector("#tvDock .tvMore") || document.querySelector(".songCol > details.tvMore"), (h, d) => h.append(d));
  mk("rackMore", document.querySelector("#fxDock .dockMore") || document.querySelector(".songCol > details.dockMore"), (h, d) => h.append(d));
  /* 💬 trk191: 画面右端の引き出し（チャット等の常設UI用・API v2）。中身が無いときは場所ごと隠れる */
  mk("drawer", core.$("addonDrawerHost"), (h, d) => h.append(d));
  /* 置き場所に何も無いときは、場所ごと隠す（画面を静かに保つ） */
  const hide = () => slots.forEach(box => { box.hidden = !box.children.length; });
  hide();
  const mo = new MutationObserver(hide);
  slots.forEach(box => mo.observe(box, { childList:true }));
}

/* ============ アドオンを動かす ============ */
function register(def) {
  if (!def || typeof def !== "object") throw new Error("register(def) にはオブジェクトを渡してください");
  const id = String(def.id || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{1,39}$/i.test(id)) throw new Error("id は英数字と . _ - で2〜40文字にしてください");
  const norm = {
    id,
    name: String(def.name || id),
    version: String(def.version || "0"),
    apiVersion: Number(def.apiVersion || API_VERSION),
    author: String(def.author || ""),
    description: String(def.description || ""),
    setup: typeof def.setup === "function" ? def.setup : null,
    teardown: typeof def.teardown === "function" ? def.teardown : null
  };
  if (collecting) { collecting.push(norm); return norm; }
  /* index.html に <script src> で書いたアドオン：その場で動かす */
  if (fileAddons.some(d => d.id === norm.id)) return norm;
  fileAddons.push(norm);
  startAddon(norm, null);
  renderList();
  return norm;
}
function runCode(code) {
  collecting = [];
  let err = null;
  try { (0, eval)(code); } catch (e) { err = e; }
  const got = collecting;
  collecting = null;
  if (err) throw err;          // 構文エラー・実行時エラーは、そのまま呼び出し元へ
  return got;
}
function makeApi(id) {
  return Object.freeze({
    apiVersion: API_VERSION,
    id,
    tr: (key, vars) => tr(key, vars),
    log: (...a) => console.log("[addon:" + id + "]", ...a),
    el: core.el, $: elemId => document.getElementById(elemId),
    addStyle(css) {
      const s = document.createElement("style");
      s.dataset.addon = id; s.textContent = String(css || "");
      document.head.append(s); return s;
    },
    on: (ev, fn) => on(ev, fn),   /* trk191（API v2）: 解除関数を返す（core.on の戻り値をそのまま渡す） */
    emit: (ev, data) => core.emit(ev, data),
    slot: name => slots.get(name) || null,
    say: text => say("🧩 " + id + "：" + text),
    settings: core.settings, savePrefs: () => core.saveUserPrefs(),
    video: () => document.getElementById("video"),
    phase: appPhase,
    /* trk191（API v2）: 💬 いまの曲のスナップショット（trk-now-playing/1）。曲が無ければ null */
    nowPlaying: () => { const L = window.Trk.library; return L && typeof L.nowPlaying === "function" ? L.nowPlaying() : null; },
    addSongs: list => setSongs(id, list),
    fx: {
      available: () => !!(window.TrkFX && typeof window.TrkFX.tapElement === "function"),
      tapElement: mediaEl => (window.TrkFX && typeof window.TrkFX.tapElement === "function") ? window.TrkFX.tapElement(mediaEl) : false
    }
  });
}
function startAddon(def, entry) {
  if (def.apiVersion > API_VERSION) {
    if (entry) entry.error = tr("addonBroken", { why:"apiVersion " + def.apiVersion });
    return false;
  }
  try {
    const api = makeApi(def.id);
    if (def.setup) def.setup(api);
    runtime.set(def.id, { def, api });
    if (entry) entry.error = "";
    return true;
  } catch (err) {
    console.error("[addon:" + def.id + "]", err);
    runtime.delete(def.id);
    if (entry) entry.error = tr("addonBroken", { why:(err && err.message) || String(err) });
    return false;
  }
}
function stopAddon(id) {
  const rt = runtime.get(id);
  if (rt && rt.def.teardown) { try { rt.def.teardown(); } catch (e) { console.error(e); } }
  runtime.delete(id);
}
function setSongs(id, list) {
  const entry = store[id];
  const rt = runtime.get(id);
  const name = (entry && entry.name) || (rt && rt.def.name) || id;
  const out = (Array.isArray(list) ? list : []).slice(0, 2000).map(it => ({
    ...it,
    source: "addon",
    addonId: id,
    addonName: it.addonName || name,
    key: String(it.key || (id + ":" + (it.title || "?"))),
    title: String(it.title || it.key || "?")
  }));
  songsByAddon.set(id, out);
  syncSongs();
  renderList();
}
function syncSongs() {
  const all = [];
  for (const list of songsByAddon.values()) all.push(...list);
  if (typeof setAddonSongs === "function") window.Trk.library.setAddonSongs(all);
}

/* ============ 入れる／外す ============ */
function parseAddonFile(text, filename = "", allowRawCode = false) {
  const t = text == null ? "" : String(text);
  const name = String(filename || "");
  const isJsFile = /\.js$/i.test(name);
  const isJsonFile = /\.(?:json|trkaddon|trk-addon)$/i.test(name);
  const looksJson = /^\s*[{[]/.test(t);
  /* .js は明示的なコード。JSON形式の拡張子／JSON風の文字列は、壊れていてもJSへ流さない。 */
  if (isJsFile) return { code:t, meta:{} };
  if (isJsonFile || looksJson) {
    let j;
    try { j = JSON.parse(t); }
    catch (e) {
      if (allowRawCode && !isJsonFile) return { code:t, meta:{} };   /* プログラムAPIのみ明示コードとして扱う */
      return { code:"", meta:{}, why:"JSON として読めませんでした：" + e.message };
    }
    if (j && typeof j === "object" && !Array.isArray(j) && typeof j.code === "string") {
      if (j.format != null && j.format !== ADDON_FORMAT) return { code:"", meta:j, why:"format が対応していません" };
      return { code:j.code, meta:{ name:j.name, author:j.author, description:j.description, version:j.version, apiVersion:j.apiVersion, format:j.format } };
    }
    if (isJsonFile || !allowRawCode) return { code:"", meta:j && typeof j === "object" ? j : {}, why:"code がありません" };
    return { code:t, meta:{} };
  }
  /* TrkAddons.install() は既存のプログラム向け文字列API。ファイル選択では raw code を許さない。 */
  if (allowRawCode) return { code:t, meta:{} };
  return { code:"", meta:{}, why:"対応拡張子は .js / .json / .trkaddon です" };
}
/* ---------- ✅ 同意の記録 ----------
   アドオンはページのフル権限で動くので、「入れる前に一度だけ同意してもらう」ようにしました。
   ・同意は端末内（この保存領域）にだけ記録します（外部へは送りません）
   ・コードの指紋（短いハッシュ）も一緒に記録し、あとで中身が変わっていたら ⚠ を出します
   ・コードの実行（runCode）は同意の後。同意しなければ、そのファイルは動かしません
   ・この記録より前に導入したアドオンは ⚠ を出すだけで、勝手に止めたりはしません */
function codeShaLegacy(code) {
  const text = String(code || "");
  let h1 = 0x811c9dc5, h2 = 0x01000193;   /* 旧版のFNV系指紋。既存レコードの互換確認だけに使う */
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ ((c << 5) | (c >>> 3)), 2654435761) >>> 0;
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).slice(0, 16);
}
function hasSha256() {
  return typeof crypto !== "undefined" && !!crypto.subtle && typeof TextEncoder === "function";
}
async function codeFingerprint(code) {
  const text = String(code || "");
  if (!hasSha256()) return "fnv64:" + codeShaLegacy(text);   /* file:// 等の互換用。署名ではない */
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return "sha256:" + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function verifyConsent(entry) {
  if (!entry || typeof entry !== "object" || !entry.consentAt) return "none";
  if (typeof entry.code !== "string" || exceedsUtf8Limit(entry.code, MAX_CODE) || typeof entry.consentSha !== "string") return "stale";
  const saved = entry.consentSha.toLowerCase();
  try {
    if (/^sha256:[0-9a-f]{64}$/.test(saved)) {
      if (!hasSha256()) return "stale";
      return (await codeFingerprint(entry.code)) === saved ? "ok" : "stale";
    }
    if (/^fnv64:[0-9a-f]{16}$/.test(saved)) return saved === "fnv64:" + codeShaLegacy(entry.code) ? "ok" : "stale";
    /* 2026-10-06 以前の16桁指紋。新しいインストールではSHA-256へ移行する */
    if (/^[0-9a-f]{16}$/.test(saved)) return saved === codeShaLegacy(entry.code) ? "ok" : "stale";
  } catch (_) {}
  return "stale";
}
function consentState(entry) {
  if (!entry || typeof entry !== "object" || !entry.consentAt) return "none";
  return consentStateCache.get(entry) || "stale";   /* 検証前は安全側に倒す */
}
function askConsent(name, onYes, onNo) {
  const wrap = document.createElement("div");
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.dataset.trkAsk = "consent";   /* 見つけやすさのために印を付ける（テスト・支援技術） */
  wrap.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px";
  const card = document.createElement("div");
  card.style.cssText = "max-width:min(92vw,500px);background:#16181d;color:#f2f3f5;border:2px solid #ffb020;border-radius:14px;padding:16px 18px;box-shadow:0 10px 40px rgba(0,0,0,.6);font:15px/1.65 system-ui,sans-serif";
  const title = document.createElement("b");
  title.textContent = tr("addonConsentTitle"); title.style.cssText = "font-size:17px";
  const file = document.createElement("div");
  file.textContent = tr("addonConsentFile", { name: name || "(text)" });
  file.style.cssText = "opacity:.8;font-size:13px;margin-top:4px;word-break:break-all";
  const body = document.createElement("div");
  body.textContent = String(tr("addonConsentBody")).replace(/\*\*/g, "");
  body.style.cssText = "margin:10px 0 4px;white-space:pre-line";
  const hint = document.createElement("div");
  hint.textContent = tr("addonConsentHint");
  hint.style.cssText = "opacity:.65;font-size:12px;margin-bottom:12px";
  const rowBox = document.createElement("div");
  rowBox.style.cssText = "display:flex;gap:10px;flex-wrap:wrap";
  const yes = document.createElement("button");
  yes.type = "button"; yes.textContent = tr("addonConsentYes");
  yes.style.cssText = "flex:1 1 auto;min-height:44px;padding:10px 14px;border-radius:10px;border:0;background:#ffb020;color:#1a1a1a;font-weight:700;font-size:15px;cursor:pointer";
  const no = document.createElement("button");
  no.type = "button"; no.textContent = tr("addonConsentNo");
  no.style.cssText = "flex:1 1 auto;min-height:44px;padding:10px 14px;border-radius:10px;border:1px solid #555;background:#22252b;color:#f2f3f5;font-size:15px;cursor:pointer";
  const close = () => { document.removeEventListener("keydown", onKey); wrap.remove(); };
  const onKey = e => { if (e.key === "Escape") { close(); if (typeof onNo === "function") onNo(); } };
  yes.addEventListener("click", () => { close(); if (typeof onYes === "function") onYes(); });
  no.addEventListener("click", () => { close(); if (typeof onNo === "function") onNo(); });
  wrap.addEventListener("click", e => { if (e.target === wrap) { close(); if (typeof onNo === "function") onNo(); } });
  document.addEventListener("keydown", onKey);
  rowBox.append(yes, no);
  card.append(title, file, body, hint, rowBox);
  wrap.append(card);
  (document.body || document.documentElement).append(wrap);
  try { no.focus(); } catch (_) {}
}
/* 同意 → 実行 → 保存（installText は同意の後にだけ呼ぶ） */
function installWithConsent(text, filename, allowRawCode = false) {
  const rawText = text == null ? "" : String(text);
  const filenameText = String(filename || "(text)");
  if (exceedsUtf8Limit(rawText, MAX_ADDON_FILE)) return { ok:false, why:tr("addonFileTooBig", { n:MAX_ADDON_FILE / 1024 }) };
  const parsed = parseAddonFile(rawText, filenameText, allowRawCode);
  const code = String(parsed.code || "");
  if (!code.trim()) return { ok:false, why:parsed.why || tr("addonNoRegister") };
  if (exceedsUtf8Limit(code, MAX_CODE)) return { ok:false, why:tr("addonTooBig", { n:Math.floor(MAX_CODE / 1024) }) };
  const shown = parsed.meta && parsed.meta.name ? `${parsed.meta.name} (${filenameText})` : filenameText;
  askConsent(shown,
    async () => {
      try {
        await bootPromise;
        const fingerprint = await codeFingerprint(code);
        const res = installText(rawText, filenameText, fingerprint, allowRawCode);
        if (res.ok) {
          const e = store[res.id] || {};
          say(tr("addonConsentRecorded", { name:e.name || res.id, date:stamp(e.consentAt) }));
          pendingReload = true; renderList(); updateReload();
        } else say(tr("addonBadFile", { why:res.why }), true);
      } catch (e) { say(tr("addonBadFile", { why:(e && e.message) || e }), true); }
    },
    () => say(tr("addonConsentCanceled")));
  return { ok:true, pending:true };
}
function stamp(ms) {
  if (!ms) return "-";
  try { return new Date(ms).toLocaleDateString(); } catch (_) { return "-"; }
}
function installText(text, filename, fingerprint, allowRawCode = false) {
  const filename2 = String(filename || "(text)");
  const parsed = parseAddonFile(text, filename, allowRawCode);
  const code = parsed.code;
  if (!code || !code.trim()) return { ok:false, why:parsed.why || "中身が空です" };
  if (exceedsUtf8Limit(code, MAX_CODE)) return { ok:false, why:tr("addonTooBig", { n:Math.floor(MAX_CODE / 1024) }) };
  let defs;
  try { defs = runCode(code); }
  catch (e) { return { ok:false, why:"コードが動きませんでした：" + ((e && e.message) || e) }; }
  if (!defs || !defs.length) return { ok:false, why:tr("addonNoRegister") };
  const def = defs[0];
  const old = store[def.id];
  const entry = {
    id: def.id,
    name: def.name || parsed.meta.name || def.id,
    version: def.version || parsed.meta.version || "0",
    author: def.author || parsed.meta.author || "",
    description: def.description || parsed.meta.description || "",
    apiVersion: def.apiVersion || parsed.meta.apiVersion || API_VERSION,
    enabled: old ? !!old.enabled : true,
    code,
    source: "installed",
    file: filename2,
    addedAt: (old && old.addedAt) || Date.now(),
    error: ""
  };
  entry.consentAt = Date.now();          /* ✅ 同意の記録（この時刻に、この中身へ同意した） */
  entry.consentSha = fingerprint;         /* SHA-256（Web Crypto対応時）。旧版指紋は読み込み互換だけ */
  consentStateCache.set(entry, "ok");
  store[def.id] = entry;
  saveStore();
  if (entry.enabled) startAddon(def, entry);
  pendingReload = true;
  saveStore();
  renderList(); updateReload();
  say(tr("addonInstalled", { name:entry.name }) + " " + tr("addonNeedReload"));
  return { ok:true, id:def.id, name:entry.name };
}
function setEnabled(id, on) {
  const e = store[id];
  if (!e) return false;
  e.enabled = !!on;
  if (!e.enabled) stopAddon(id);
  saveStore();
  pendingReload = true;
  renderList(); updateReload();
  say(tr(e.enabled ? "addonToggledOn" : "addonToggledOff", { name:e.name }));
  return true;
}
function removeAddon(id) {
  const e = store[id];
  if (!e) return false;
  stopAddon(id);
  songsByAddon.delete(id); syncSongs();
  delete store[id];
  saveStore();
  pendingReload = true;
  renderList(); updateReload();
  say(tr("addonRemoved", { name:e.name }));
  return true;
}

/* ============ パネルの絵 ============ */
function row(entry) {
  const box = core.el("div", "addonRow" + (entry.enabled ? "" : " off"));
  const head = core.el("div", "addonHead");
  const on = entry.enabled !== false;
  const bits = [
    core.el("span", "addonDot" + (on ? " on" : "") + (entry.error ? " ng" : "")),
    core.el("b", "addonName", entry.name || entry.id),
    core.el("span", "addonVer", "v" + (entry.version || "0"))
  ];
  if (entry.author) bits.push(core.el("span", "addonAuthor", "by " + entry.author));
  if (entry.source === "file") bits.push(core.el("span", "addonBadge", tr("addonFromFile")));
  head.append(...bits);
  box.append(head);
  if (entry.description) box.append(core.el("div", "hint", entry.description));
  if (entry.id && songsByAddon.has(entry.id) && songsByAddon.get(entry.id).length) {
    box.append(core.el("div", "hint", tr("addonSongs", { n:songsByAddon.get(entry.id).length })));
  }
  if (entry.error) box.append(core.el("div", "hint addonErr", tr("addonBroken", { why:entry.error })));
  /* ✅ 同意の記録（この記録を始める前に導入したアドオンは「記録なし」、中身が変わっていれば「⚠」） */
  if (entry.source !== "file" && entry.id) {
    const state = consentState(entry);
    const line = core.el("div", "hint" + (state === "ok" ? " addonConsentOk" : " addonConsentWarn"));
    line.textContent = state === "ok" ? tr("addonConsentBadge", { date:stamp(entry.consentAt) })
      : state === "stale" ? tr("addonConsentStale") : tr("addonConsentNone");
    box.append(line);
    if (state === "none" && typeof entry.code === "string" && !exceedsUtf8Limit(entry.code, MAX_CODE)) {
      const acts0 = core.el("div", "miniActions");
      const agree = core.el("button", "", tr("addonConsentBtn")); agree.type = "button";
      agree.addEventListener("click", async () => {
        const e2 = store[entry.id];
        if (!e2 || typeof e2.code !== "string" || exceedsUtf8Limit(e2.code, MAX_CODE)) return;
        try {
          e2.consentSha = await codeFingerprint(e2.code);
          e2.consentAt = Date.now();
          consentStateCache.set(e2, "ok");
          saveStore(); renderList();
          say(tr("addonConsentRecorded", { name:e2.name || e2.id, date:stamp(e2.consentAt) }));
        } catch (err) { say(tr("addonBadFile", { why:(err && err.message) || err }), true); }
      });
      acts0.append(agree);
      box.append(acts0);
    }
  }
  if (entry.source !== "file") {
    const acts = core.el("div", "miniActions");
    const tg = core.el("button", "", tr(on ? "addonOff" : "addonOn")); tg.type = "button";
    tg.addEventListener("click", () => setEnabled(entry.id, !on));
    const del = core.el("button", "", tr("addonDelete")); del.type = "button";
    del.addEventListener("click", () => { if (confirm("🧩 " + entry.name + " / " + tr("addonDelete") + "?")) removeAddon(entry.id); });
    acts.append(tg, del);
    box.append(acts);
  }
  return box;
}
function renderList() {
  const box = core.$("addonList"); if (!box) return;
  box.textContent = "";
  const entries = Object.values(store).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
  if (!entries.length && !fileAddons.length) { box.append(core.el("div", "hint", tr("addonNone"))); return; }
  for (const e of entries) box.append(row(e));
  for (const d of fileAddons) box.append(row({ ...d, source:"file", enabled:true }));
}
function updateReload() {
  const b = core.$("addonReloadBtn");
  if (b) b.hidden = !pendingReload;
}

/* ============ 起動 ============ */
async function boot() {
  if (safeNow()) { say(tr("addonSafe")); return; }
  const entries = Object.values(store).filter(entry => entry && typeof entry === "object" && !Array.isArray(entry));
  /* 指紋確認をすべて終えてから、どのアドオンのコードも評価する。 */
  const states = await Promise.all(entries.map(async entry => {
    try {
      const state = await verifyConsent(entry);
      consentStateCache.set(entry, state);
      return state;
    } catch (_) {
      consentStateCache.set(entry, "stale");
      return "stale";
    }
  }));
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i], state = states[i];
    if (entry.enabled !== true) continue;
    if (typeof entry.code !== "string" || !entry.code.trim()) { entry.error = tr("addonNoRegister"); continue; }
    if (exceedsUtf8Limit(entry.code, MAX_CODE)) { entry.error = tr("addonTooBig", { n:Math.floor(MAX_CODE / 1024) }); continue; }
    if (state === "stale") { entry.error = tr("addonConsentStale"); continue; }
    let defs;
    try { defs = runCode(entry.code); }
    catch (e) { entry.error = tr("addonBroken", { why:(e && e.message) || String(e) }); continue; }
    const def = (defs || []).find(d => d.id === entry.id) || (defs || [])[0];
    if (!def) { entry.error = tr("addonNoRegister"); continue; }
    entry.name = def.name || entry.name;
    entry.version = def.version || entry.version;
    entry.author = def.author || entry.author;
    entry.description = def.description || entry.description;
    if (!startAddon(def, entry)) console.warn("[addon:" + entry.id + "]", entry.error);
  }
  saveStore();
}
addEventListener("DOMContentLoaded", () => {
  mountSlots();
  const fileInput = core.$("addonInstallFile");
  if (fileInput) fileInput.addEventListener("change", async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (typeof f.size !== "number" || !Number.isFinite(f.size) || f.size < 0 || f.size > MAX_ADDON_FILE) {
      say(tr("addonBadFile", { why:tr("addonFileTooBig", { n:MAX_ADDON_FILE / 1024 }) }), true);
      return;
    }
    let text = "";
    try { text = await f.text(); } catch (err) { say(tr("addonBadFile", { why:(err && err.message) || err }), true); return; }
    /* ✅ 同意を取ってから実行する（同意しなければ、そのコードは動かさない） */
    const res = installWithConsent(text, f.name);
    if (!res.ok) say(tr("addonBadFile", { why:res.why }), true);
  });
  const sample = core.$("addonSampleBtn");
  if (sample) sample.addEventListener("click", async () => {
    let code = "";
    try { const r = await fetch(SAMPLE_URL, { cache:"no-store" }); if (r.ok) code = await r.text(); } catch (_) {}
    if (!code) { say(tr("addonSampleFail"), true); return; }
    downloadText(code, "trk-addon-example.js");
    say(tr("addonSampleSaved"));
  });
  const reload = core.$("addonReloadBtn");
  if (reload) reload.addEventListener("click", () => location.reload());
  on("language", () => { renderList(); updateReload(); });
  bootPromise = boot()
    .catch(e => { console.error("[addons] boot failed", e); say(tr("addonBroken", { why:(e && e.message) || e }), true); })
    .then(() => { renderList(); updateReload(); });
});

/* ============ 窓口 ============ */
window.TrkAddons = Object.freeze({
  version: 1,
  apiVersion: API_VERSION,
  format: ADDON_FORMAT,
  key: ADDONS_KEY,
  register,
  list: () => Object.entries(store).map(([id, e]) => ({
    id, name:e.name, version:e.version, author:e.author, description:e.description,
    enabled:!!e.enabled, error:e.error || "", source:e.source || "installed",
    /* ✅ 同意の記録（"ok" / "stale" / "none"）と、その時刻・指紋 */
    consent: { state:consentState(e), at:e.consentAt || 0, sha:e.consentSha || "" }
  })),
  active: () => [...runtime.keys()],
  install: (text, name) => installWithConsent(text, name || "(text)", true),   /* ✅ 同意を取ってから（同意なしでは動かさない） */
  setEnabled, remove: removeAddon,
  slots: () => [...slots.keys()],
  songs: id => (songsByAddon.get(id) || []).slice(),
  panel() { const p = core.$("addonPanel"); if (p) { p.open = true; try { p.scrollIntoView({ behavior:"smooth", block:"start" }); } catch (_) {} } },
  docs: "docs/ADDONS.md"
});
})();
/* ✅ addons.js 完了 */
