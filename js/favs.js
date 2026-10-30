// SPDX-License-Identifier: GPL-3.0-or-later
/* ==========================================================================
   ⭐ お気に入りのフォルダ管理（js/favs.js）  version 1
   --------------------------------------------------------------------------
   ・3つの系統（kind）で、同じしくみを使います
       tv   … 📺 映像フィルターのお気に入り（settings.tvFav  ← これまでどおり）
       fx   … 🎛 エフェクトのお気に入り（settings.fxFav  ← これまでどおり）
       song … 📚 曲のお気に入り（settings.songFav  ← 新規。⭐のタブ）
   ・フォルダは固定の4つ
       main   ⭐1軍          … ボタンに並ぶ本番（＝今までの tvFav / fxFav と同じ場所）
       sub    ⭐2軍          … 控え。ボタンには出さない（フォルダを切り替えれば使える）
       frozen 🧊フリーズ     … 凍結して守るぶん（🔒中は追加・削除ができない）
       former 📤元お気に入り … 外したものの置き場（自動でここへ）。抽選（🎲）には出てこない
   ・📌ピン＝「絶対に外れない」… 🎲おまかせの候補に必ず入る／外すにはピンを先に外す
   ・保存：1軍はこれまでどおり settings.tvFav / fxFav（＋新しい songFav）。
           2軍〜元お気に入り・ピン・ロック・選択中のフォルダだけ settings.favs に足します。
           既存の保存キー（shadow_taiko_preferences_v2）と形式名は変えていません。
   ========================================================================== */
(function () {
  const core = window.Trk.core;
"use strict";

/* ---------- 言葉（4言語。このファイルだけで完結） ---------- */
const FAV_TEXT = {
  ja: {
    favTitle:"⭐ お気に入り（フォルダ管理）",
    favIntro:"お気に入りは、⭐1軍／⭐2軍／🧊フリーズ／📤元お気に入りの4つに分けられます。🔒は凍結（そのフォルダの追加・削除を止める。解除は3秒長押し）、📌は「絶対に外れない」です。",
    favKind:"種類", favKindTv:"📺 映像フィルターのお気に入り", favKindFx:"🎛 エフェクトのお気に入り", favKindSong:"📚 曲のお気に入り",
    favGroupMain:"1軍", favGroupSub:"2軍", favGroupFrozen:"フリーズ", favGroupFormer:"元お気に入り",
    favHintN:"⭐ {g}：{n}個",
    favHintDock:"⭐ {g}：{n}個（このボタンは {m}個。あふれたぶんは下に並びます）",
    favEmpty:"まだありません。⭐のボタンか、ドックのボタン長押しで入れられます。",
    favEmptyFormer:"外したお気に入りは、ここに残ります（🎲の候補には出ません）。",
    favTab:"お気に入り",
    favLock:"🧊 {g}を凍結する（追加・削除を止める）", favUnlock:"🔓 凍結を解除する", favUnlockHold:"🔒 {g}は凍結中です。3秒長押しで解除", favLockOn:"🧊 {g}を凍結しました", favLockOff:"🔓 {g}の凍結を解除しました",
    favLocked:"🧊 {g}は凍結中です（先に解除してください）",
    favPin:"📌 ピン（絶対に外れない）", favUnpin:"📌 ピンを外す", favPinnedOn:"📌 ピンしました（🎲の候補に必ず入ります）", favPinnedOff:"📌 ピンを外しました",
    favPinnedNo:"📌 ピン中です。先にピンを外してください",
    favToMain:"⭐ 1軍へ", favToSub:"⭐ 2軍へ", favToFrozen:"🧊 フリーズへ", favToFormer:"📤 元お気に入りへ（外す）", favRestore:"↩ お気に入りに戻す",
    favMoved:"⭐ {g}へ移動しました", favRemoved:"📤 元お気に入りへ移しました", favRestored:"⭐ 1軍に戻しました",
    favLockHint:"🔒 凍結中です。🔒（または🧊のチップ）を3秒長押しすると解除できます",
    favLockHintQuick:"🔒 凍結中です。押すと解除します",
    favPinCount:"📌 ピン {n}個（🎲の候補に必ず入ります）",
    favFrozenBadge:"🧊 フリーズ中",
    favClearFormer:"🗑 元お気に入りを空にする", favCleared:"🗑 元お気に入りを空にしました",
    favExport:"📤 書き出し", favImport:"📥 読み込み", favCopy:"📋 名前をコピー",
    favExported:"📤 お気に入りを書き出しました", favCopied:"📋 名前をコピーしました",
    favImported:"📥 読み込みました（+{n}）", favImportBad:"❌ お気に入りのファイルではありません",
    favNoFile:"❌ ファイルを選んでください", favMissing:"（見つかりません）",
    favMenu:"⭐ のメニュー", favAll:"すべて", favClose:"閉じる",
    favAdd:"☆ お気に入りに入れる", favDel:"★ お気に入りから外す（📤元へ）", favIn:"★ お気に入り（1軍）"
  },
  en: {
    favTitle:"⭐ Favorites (folders)",
    favIntro:"Favorites live in four fixed folders: ⭐1st / ⭐2nd / 🧊Frozen / 📤Former. 🔒 freezes a folder (no adds or deletes; hold 3 seconds to unfreeze), 📌 means “never dropped”.",
    favKind:"Type", favKindTv:"📺 Video filter favorites", favKindFx:"🎛 Effect favorites", favKindSong:"📚 Song favorites",
    favGroupMain:"1st", favGroupSub:"2nd", favGroupFrozen:"Frozen", favGroupFormer:"Former",
    favHintN:"⭐ {g}: {n}",
    favHintDock:"⭐ {g}: {n} (this device has {m} buttons; the rest are listed below)",
    favEmpty:"Nothing yet. Use a ⭐ button, or long-press a dock button to save one.",
    favEmptyFormer:"Favorites you removed stay here (they are never picked at random).",
    favTab:"Favorites",
    favLock:"🧊 Freeze {g} (blocks adding and removing)", favUnlock:"🔓 Unfreeze", favUnlockHold:"🔒 {g} is frozen. Hold for 3 seconds to unfreeze", favLockOn:"🧊 {g} is now frozen", favLockOff:"🔓 {g} is unfrozen",
    favLocked:"🧊 {g} is frozen (unfreeze it first)",
    favPin:"📌 Pin (never dropped)", favUnpin:"📌 Unpin", favPinnedOn:"📌 Pinned (always in the random pool)", favPinnedOff:"📌 Unpinned",
    favPinnedNo:"📌 It is pinned. Unpin it first",
    favToMain:"⭐ Move to 1st", favToSub:"⭐ Move to 2nd", favToFrozen:"🧊 Move to Frozen", favToFormer:"📤 Move to Former (remove)", favRestore:"↩ Put back in favorites",
    favMoved:"⭐ Moved to {g}", favRemoved:"📤 Moved to Former", favRestored:"⭐ Moved back to 1st",
    favLockHint:"🔒 This folder is frozen. Hold 🔒 (or the 🧊 chip) for 3 seconds to unfreeze",
    favLockHintQuick:"🔒 This folder is frozen. Click to unfreeze",
    favPinCount:"📌 {n} pinned (always in the 🎲 pool)",
    favFrozenBadge:"🧊 Frozen",
    favClearFormer:"🗑 Empty the Former folder", favCleared:"🗑 The Former folder is now empty",
    favExport:"📤 Export", favImport:"📥 Import", favCopy:"📋 Copy names",
    favExported:"📤 Exported your favorites", favCopied:"📋 Names copied",
    favImported:"📥 Imported (+{n})", favImportBad:"❌ That is not a favorites file",
    favNoFile:"❌ Choose a file first", favMissing:"(not found)",
    favMenu:"⭐ menu", favAll:"All", favClose:"Close",
    favAdd:"☆ Add to favorites", favDel:"★ Remove from favorites (to 📤Former)", favIn:"★ Favorite (1st)"
  },
  zh: {
    favTitle:"⭐ 收藏（文件夹管理）",
    favIntro:"收藏分成四个固定文件夹：⭐一军／⭐二军／🧊冻结／📤原收藏。🔒会冻结文件夹（不能增删，长按3秒解除），📌表示“绝不掉落”。",
    favKind:"种类", favKindTv:"📺 影像滤镜收藏", favKindFx:"🎛 音效收藏", favKindSong:"📚 歌曲收藏",
    favGroupMain:"一军", favGroupSub:"二军", favGroupFrozen:"冻结", favGroupFormer:"原收藏",
    favHintN:"⭐ {g}：{n}个",
    favHintDock:"⭐ {g}：{n}个（本设备有 {m} 个按钮，放不下的排在下面）",
    favEmpty:"还没有。用 ⭐ 按钮，或长按设备上的按钮保存。",
    favEmptyFormer:"取消的收藏会留在这里（不会被随机抽到）。",
    favTab:"收藏",
    favLock:"🧊 冻结 {g}（不能增删）", favUnlock:"🔓 解除冻结", favUnlockHold:"🔒 {g} 已冻结。长按3秒解除", favLockOn:"🧊 已冻结 {g}", favLockOff:"🔓 已解除 {g} 的冻结",
    favLocked:"🧊 {g} 已冻结（请先解除）",
    favPin:"📌 钉住（绝不掉落）", favUnpin:"📌 取消钉住", favPinnedOn:"📌 已钉住（一定会进入随机候选）", favPinnedOff:"📌 已取消钉住",
    favPinnedNo:"📌 已钉住。请先取消钉住",
    favToMain:"⭐ 移到一军", favToSub:"⭐ 移到二军", favToFrozen:"🧊 移到冻结", favToFormer:"📤 移到原收藏（取消）", favRestore:"↩ 放回收藏",
    favMoved:"⭐ 已移到 {g}", favRemoved:"📤 已移到原收藏", favRestored:"⭐ 已放回一军",
    favLockHint:"🔒 已冻结。长按🔒（或🧊）3秒即可解除",
    favLockHintQuick:"🔒 已冻结。点按即可解除",
    favPinCount:"📌 钉住 {n} 个（一定会进入🎲候选）",
    favFrozenBadge:"🧊 冻结中",
    favClearFormer:"🗑 清空原收藏", favCleared:"🗑 原收藏已清空",
    favExport:"📤 导出", favImport:"📥 导入", favCopy:"📋 复制名称",
    favExported:"📤 已导出收藏", favCopied:"📋 已复制名称",
    favImported:"📥 已导入（+{n}）", favImportBad:"❌ 不是收藏文件",
    favNoFile:"❌ 请先选择文件", favMissing:"（找不到）",
    favMenu:"⭐ 菜单", favAll:"全部", favClose:"关闭",
    favAdd:"☆ 加入收藏", favDel:"★ 取消收藏（移到📤原收藏）", favIn:"★ 收藏（一军）"
  },
  ko: {
    favTitle:"⭐ 즐겨찾기(폴더 관리)",
    favIntro:"즐겨찾기는 ⭐1군／⭐2군／🧊동결／📤원래 즐겨찾기 네 폴더로 나뉩니다. 🔒는 동결(그 폴더의 추가·삭제 금지, 3초 길게 눌러 해제), 📌는 “절대 빠지지 않음”입니다.",
    favKind:"종류", favKindTv:"📺 영상 필터 즐겨찾기", favKindFx:"🎛 이펙트 즐겨찾기", favKindSong:"📚 곡 즐겨찾기",
    favGroupMain:"1군", favGroupSub:"2군", favGroupFrozen:"동결", favGroupFormer:"원래 즐겨찾기",
    favHintN:"⭐ {g}: {n}개",
    favHintDock:"⭐ {g}: {n}개 (이 기기의 버튼은 {m}개, 나머지는 아래에 나옵니다)",
    favEmpty:"아직 없습니다. ⭐ 버튼이나 기기 버튼을 길게 눌러 담아 주세요.",
    favEmptyFormer:"뺀 즐겨찾기는 여기에 남습니다(무작위 후보에는 나오지 않습니다).",
    favTab:"즐겨찾기",
    favLock:"🧊 {g} 동결(추가·삭제 금지)", favUnlock:"🔓 동결 해제", favUnlockHold:"🔒 {g}는 동결 중입니다. 3초 길게 눌러 해제", favLockOn:"🧊 {g}를 동결했습니다", favLockOff:"🔓 {g}의 동결을 풀었습니다",
    favLocked:"🧊 {g}는 동결 중입니다(먼저 풀어 주세요)",
    favPin:"📌 고정(절대 빠지지 않음)", favUnpin:"📌 고정 해제", favPinnedOn:"📌 고정했습니다(무작위 후보에 반드시 들어갑니다)", favPinnedOff:"📌 고정을 풀었습니다",
    favPinnedNo:"📌 고정 중입니다. 먼저 고정을 풀어 주세요",
    favToMain:"⭐ 1군으로", favToSub:"⭐ 2군으로", favToFrozen:"🧊 동결로", favToFormer:"📤 원래 즐겨찾기로(빼기)", favRestore:"↩ 즐겨찾기로 되돌리기",
    favMoved:"⭐ {g}(으)로 옮겼습니다", favRemoved:"📤 원래 즐겨찾기로 옮겼습니다", favRestored:"⭐ 1군으로 되돌렸습니다",
    favLockHint:"🔒 동결 중입니다. 🔒(또는 🧊 칩)을 3초 길게 누르면 해제됩니다",
    favLockHintQuick:"🔒 동결 중입니다. 누르면 해제합니다",
    favPinCount:"📌 고정 {n}개 (🎲 후보에 반드시 들어갑니다)",
    favFrozenBadge:"🧊 동결 중",
    favClearFormer:"🗑 원래 즐겨찾기 비우기", favCleared:"🗑 원래 즐겨찾기를 비웠습니다",
    favExport:"📤 내보내기", favImport:"📥 불러오기", favCopy:"📋 이름 복사",
    favExported:"📤 즐겨찾기를 내보냈습니다", favCopied:"📋 이름을 복사했습니다",
    favImported:"📥 불러왔습니다 (+{n})", favImportBad:"❌ 즐겨찾기 파일이 아닙니다",
    favNoFile:"❌ 파일을 먼저 골라 주세요", favMissing:"(찾을 수 없음)",
    favMenu:"⭐ 메뉴", favAll:"전체", favClose:"닫기",
    favAdd:"☆ 즐겨찾기에 넣기", favDel:"★ 즐겨찾기에서 빼기 (📤원래 즐겨찾기로)", favIn:"★ 즐겨찾기(1군)"
  }
};
for (const l of ["ja", "en", "zh", "ko"]) if (typeof TEXT !== "undefined" && TEXT[l]) Object.assign(TEXT[l], FAV_TEXT[l]);
const ftr = (k, vars) => { try { return tr(k, vars); } catch (_) { const t = FAV_TEXT.ja[k] || k; return vars ? t.replace(/\{(\w+)\}/g, (m, n) => (vars[n] != null ? vars[n] : m)) : t; } };
const fEl = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

/* ---------- しくみ ---------- */
const KINDS = ["tv", "fx", "song"];
const GROUPS = ["main", "sub", "frozen", "former"];
const ICON = { main:"⭐", sub:"⭐", frozen:"🧊", former:"📤" };
const LABEL_KEY = { main:"favGroupMain", sub:"favGroupSub", frozen:"favGroupFrozen", former:"favGroupFormer" };
const FORMAT = "trk-favs";
const MAX_ONE = 2000;                    // 1種類あたりの上限（技術的な保険。ふつうは掛かりません）

const TIMEOUT_MS = 1600;
const HOLD_UNFREEZE_MS = 3000;           /* 🔒 trk215：凍結の解除は3秒長押し（❓謎設定でワンタップにもできる） */
let toastEl = null, toastTimer = 0;
function toast(text) {
  try {
    if (!text) return;
    if (!toastEl) { toastEl = fEl("div", "favToast"); document.body.append(toastEl); }
    toastEl.hidden = false; toastEl.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (toastEl) toastEl.hidden = true; }, TIMEOUT_MS);
  } catch (_) {}
}

const cleanStr = v => (typeof v === "string" ? v.trim().slice(0, 200) : "");
const cleanId = (kind, v) => {
  const s = cleanStr(v);
  if (!s) return "";
  if (kind === "song") return s.slice(0, 200);                       // 曲のキー（pack:… や "1234|name.mp3"）
  return /^[A-Za-z0-9_:.\-]{1,64}$/.test(s) ? s : "";                // プリセットのID
};
const list0 = (v, kind) => Array.isArray(v)
  ? [...new Set(v.map(x => cleanId(kind, x)).filter(Boolean))].slice(0, MAX_ONE)
  : [];
/* 配列を「同じもののまま」中身だけ差し替える。
   1軍の配列は settings.songFav（＝保存される配列）と同じものなので、tidy で別の配列に
   差し替えると、次の state() で syncMain が古い配列へ戻してしまう（消したはずの曲が戻る）。 */
function rewrite(arr, next) {
  if (arr.length === next.length && arr.every((v, i) => v === next[i])) return arr;
  arr.length = 0;
  for (const v of next) arr.push(v);
  return arr;
}
/* どのフォルダにも入っていない（＝元お気に入りにも無い）IDを落とし、重複も消す */
function tidy(kind, st) {
  const seen = new Set();
  for (const g of ["main", "sub", "frozen", "former", "pins", "locks"]) if (!Array.isArray(st[g])) st[g] = [];
  for (const g of ["main", "sub", "frozen"]) {
    rewrite(st[g], st[g].filter(id => { if (seen.has(id)) return false; seen.add(id); return true; }));
  }
  rewrite(st.former, st.former.filter(id => !seen.has(id)));
  /* 📌ピンは、まだ1軍を読み込む前でも消さない（使うときに「お気に入りの中か」を見る） */
  rewrite(st.locks, st.locks.filter(g => g === "main" || g === "sub" || g === "frozen"));
  if (!(st.active === "former" ? true : st.active === "main" || st.active === "sub" || st.active === "frozen")) st.active = "main";
  return st;
}
/* ⭐ trk215：フォルダの状態は settings.favs に保存する（1.1.4 までは core.prefs から読むだけで、
   どこにも書いていなかった＝2軍・フリーズ・ピン・凍結・選択中のフォルダが再読み込みで消えていた）。
   settings.favs（いまの値）→ prefs.favs（起動時の保存値）の順に見る。 */
function stored(kind) {
  const fromSettings = core.settings && core.settings.favs && typeof core.settings.favs === "object" ? core.settings.favs[kind] : null;
  if (fromSettings && typeof fromSettings === "object") return fromSettings;
  const fromPrefs = core.prefs && core.prefs.favs && typeof core.prefs.favs === "object" ? core.prefs.favs[kind] : null;
  return (fromPrefs && typeof fromPrefs === "object") ? fromPrefs : {};
}
function boot(kind) {
  const src = stored(kind);
  return tidy(kind, {
    main: [], sub: list0(src.sub, kind), frozen: list0(src.frozen, kind), former: list0(src.former, kind),
    pins: list0(src.pins, kind),
    /* 🔒凍結は、そのフォルダの追加・削除を止める（守る）ためのもの。**はじめは凍結しない**
       （trk215：1.1.4 までは 🧊フリーズが最初から凍結されていて、そこへ曲を入れられなかった）。
       凍結したフォルダは、🔒を3秒長押ししないと解除できない。 */
    locks: Array.isArray(src.locks) ? src.locks.map(cleanStr).filter(Boolean) : [],
    active: cleanStr(src.active) || "main"
  });
}
const S = { tv:null, fx:null, song:null };
const mainKey = kind => kind === "tv" ? "tvFav" : kind === "fx" ? "fxFav" : "songFav";
/* 1軍はこれまでどおり settings.tvFav / fxFav（＋新しい songFav）。
   保存されている生の値を優先して読みます（fx.js の40個の上限で切られたぶんを戻すため）。 */
function bootMain(kind) {
  const k = mainKey(kind);
  const raw = (core.prefs && Array.isArray(core.prefs[k])) ? core.prefs[k] : core.settings[k];
  return list0(raw, kind);
}
/* ほかのファイルが settings.tvFav などを「別の配列に差し替えた」ときは、そちらに乗り換える */
function syncMain(kind) {
  const st = S[kind]; if (!st) return;
  const k = mainKey(kind);
  if (Array.isArray(core.settings[k]) && core.settings[k] !== st.main) st.main = core.settings[k] = list0(core.settings[k], kind);
}
function state(kind) {
  if (!KINDS.includes(kind)) kind = "tv";
  if (!S[kind]) {
    const st = boot(kind);
    st.main = core.settings[mainKey(kind)] = bootMain(kind);
    S[kind] = st;
  }
  syncMain(kind);
  return S[kind];
}
/* フォルダの状態の写し（1軍だけは tvFav／fxFav／songFav が正なので、ここには入れない） */
function snapshot(kind) {
  const st = state(kind);
  return { sub:st.sub.slice(), frozen:st.frozen.slice(), former:st.former.slice(), pins:st.pins.slice(), locks:st.locks.slice(), active:st.active };
}
const save = () => {
  try {
    const cur = core.settings.favs;
    const base = (cur && typeof cur === "object" && !Array.isArray(cur)) ? cur
      : (core.prefs && core.prefs.favs && typeof core.prefs.favs === "object" ? Object.assign({}, core.prefs.favs) : {});
    for (const k of KINDS) if (S[k]) base[k] = snapshot(k);
    core.settings.favs = base;
  } catch (_) {}
  try { if (typeof saveUserPrefs === "function") core.saveUserPrefs(); } catch (_) {}
};
/* ❓謎設定「フリーズの解除をワンタップにする」（既定オフ＝3秒長押し） */
const quickUnfreeze = () => !!(core.settings && core.settings.favQuickUnfreeze === true);

/* ---------- 読み出し ---------- */
const label = g => ftr(LABEL_KEY[g] || "favGroupMain");
const list = (kind, g) => { const st = state(kind); return Array.isArray(st[g]) ? st[g].slice() : []; };
const count = (kind, g) => state(kind)[g].length;
const groupOf = (kind, id) => { const st = state(kind); for (const g of GROUPS) if (st[g].includes(id)) return g; return ""; };
const has = (kind, id) => ["main", "sub", "frozen"].includes(groupOf(kind, id));
const inGroup = (kind, g, id) => state(kind)[g].includes(id);
const pinned = (kind, id) => state(kind).pins.includes(id);
const locked = (kind, g) => state(kind).locks.includes(g);
const activeOf = kind => state(kind).active;

/* ---------- 書き換え（すべて「ok / why」を返す） ---------- */
function setActive(kind, g) {
  const st = state(kind);
  if (!GROUPS.includes(g)) return { ok:false, why:"bad" };
  if (st.active === g) return { ok:true };
  st.active = g; save();
  return { ok:true };
}
function toggleLock(kind, g) {
  const st = state(kind);
  if (!["main", "sub", "frozen"].includes(g)) return { ok:false, why:"bad" };
  const i = st.locks.indexOf(g);
  if (i >= 0) st.locks.splice(i, 1); else st.locks.push(g);
  save();
  return { ok:true, locked:i < 0, g };
}
/* 追加・移動。index を渡すと、その位置に差し込む（長押ししたボタンの場所など） */
function add(kind, id, opt) {
  id = cleanId(kind, id); if (!id) return { ok:false, why:"bad" };
  const o = opt || {}, st = state(kind);
  const to = GROUPS.includes(o.group) ? o.group : state(kind).active;
  const dest = to === "former" ? "former" : to;
  if (to !== "former" && locked(kind, to)) return { ok:false, why:"locked", g:to };
  for (const g of GROUPS) { const i = st[g].indexOf(id); if (i >= 0) { if (g === to) { /* 同じフォルダ：順番だけ動かす */ } else st[g].splice(i, 1); } }
  const arr = st[dest];
  const at = (typeof o.index === "number" && o.index >= 0) ? Math.min(o.index, arr.length) : (o.append === false ? 0 : arr.length);
  arr.splice(at, 0, id);
  if (arr.length > MAX_ONE) arr.length = MAX_ONE;
  tidy(kind, st);
  save();
  return { ok:true, group:dest };
}
const move = (kind, id, g) => add(kind, id, { group:g });
/* 外す（元お気に入りへ）。ピン中は外せない */
function remove(kind, id) {
  if (pinned(kind, id)) return { ok:false, why:"pinned" };
  const g = groupOf(kind, id);
  if (!g || g === "former") return { ok:false, why:"none" };
  if (locked(kind, g)) return { ok:false, why:"locked", g };
  return add(kind, id, { group:"former" });
}
function restore(kind, id) {
  if (groupOf(kind, id) !== "former") return { ok:false, why:"none" };
  return add(kind, id, { group:"main" });
}
function clearFormer(kind) {
  const st = state(kind);
  const n = st.former.length;
  st.former.length = 0;
  st.pins = st.pins.filter(id => groupOf(kind, id) && groupOf(kind, id) !== "former");
  save();
  return { ok:true, n };
}
function togglePin(kind, id) {
  const st = state(kind);
  if (!groupOf(kind, id)) return { ok:false, why:"none" };
  const i = st.pins.indexOf(id);
  if (i >= 0) st.pins.splice(i, 1); else st.pins.push(id);
  save();
  return { ok:true, pinned:i < 0 };
}
/* 🎲 の候補：いまのフォルダ（元お気に入りなら1軍）＋📌ピン（ほかのフォルダにいても必ず入る） */
function pool(kind) {
  const st = state(kind);
  const g = st.active === "former" ? "main" : st.active;
  const out = st[g].slice();
  for (const id of st.pins) if (has(kind, id) && !out.includes(id)) out.push(id);
  return out;
}
function total(kind) { const st = state(kind); return st.main.length + st.sub.length + st.frozen.length; }

/* ---------- 名前（プリセットや曲の名前を引く。無ければIDのまま） ---------- */
function nameOf(kind, id) {
  try {
    if (kind === "tv") {
      /* tv-dock.js は IIFE なので、中の関数（tvPresetById など）は外から見えない。
         公開されている TrkTV.list() から名前を引く（中の関数が使えるなら、そちらを優先） */
      if (typeof tvPresetById === "function") { const p = tvPresetById(id); if (p) return typeof tvPresetName === "function" ? tvPresetName(p) : (p.label || id); }
      const api = window.TrkTV;
      if (api && typeof api.list === "function") {
        const row = (api.list() || []).find(p => p && p.id === id);
        if (row && row.name) return row.name;
      }
    } else if (kind === "fx") {
      const api = window.TrkFX;
      if (api && typeof api.list === "function") {
        const list = api.list() || [];
        const row = typeof api.current === "function" ? list.find(p => p.id === id) : list.find(p => p.id === id);
        if (row && (row.name || row.label)) return row.name || row.label;
      }
      if (typeof presetById === "function" && typeof presetName === "function") { const p = presetById(id); if (p) return presetName(p); }
    } else {
      if (typeof allSongs === "function") { const it = allSongs().find(x => x.key === id); if (it && it.title) return typeof songDisplayTitle === "function" ? songDisplayTitle(it) : it.title; }
    }
  } catch (_) {}
  return id;
}
/* 名前が引けるか（＝いまもあるプリセット・曲か）。引けないものは「（見つかりません）」と出す */
const known = (kind, id) => nameOf(kind, id) !== id;

/* ---------- 書き出し・読み込み（形式名 trk-favs） ---------- */
function exportObj(kind) {
  const st = state(kind);
  return { format:FORMAT, version:1, kind, savedAt:new Date().toISOString(),
    groups:{ main:st.main.slice(), sub:st.sub.slice(), frozen:st.frozen.slice(), former:st.former.slice() },
    pins:st.pins.slice(), locks:st.locks.slice() };
}
function importObj(kind, data) {
  if (!data || typeof data !== "object" || String(data.format || "") !== FORMAT) return { ok:false, why:"bad" };
  const g = (data.groups && typeof data.groups === "object") ? data.groups : {};
  const st = state(kind);
  let n = 0;
  for (const gName of GROUPS) {
    const addIds = list0(g[gName], kind);
    if (!addIds.length) continue;
    if (gName !== "former" && locked(kind, gName)) continue;
    for (const id of addIds) { if (groupOf(kind, id) === gName) continue; if (add(kind, id, { group:gName }).ok) n++; }
  }
  for (const id of list0(data.pins, kind)) { if (!pinned(kind, id) && groupOf(kind, id) && togglePin(kind, id).ok) n++; }
  save();
  return { ok:true, n };
}
function exportJSON(kind) {
  const o = exportObj(kind);
  try {
    const name = `trk-favs-${kind}-` + new Date().toISOString().slice(0, 10) + ".json";
    if (typeof downloadJSON === "function") core.downloadJSON(o, name);
    else {
      const blob = new Blob([JSON.stringify(o, null, 2)], { type:"application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    toast(ftr("favExported"));
    return { ok:true, obj:o };
  } catch (e) { console.error(e); return { ok:false, why:"bad" }; }
}
async function importFile(kind, file) {
  if (!file) { toast(ftr("favNoFile")); return { ok:false, why:"nofile" }; }
  try {
    const data = JSON.parse(await file.text());
    const r = importObj(kind, data);
    if (!r.ok) { toast(ftr("favImportBad")); return r; }
    toast(ftr("favImported", { n:r.n }));
    if (typeof emit === "function") core.emit("language");            // 各画面を作り直す
    return r;
  } catch (e) { console.error(e); toast(ftr("favImportBad")); return { ok:false, why:"bad" }; }
}
function exportText(kind) {
  const ids = ["main", "sub", "frozen"].flatMap(g => state(kind)[g]);
  const text = ids.map(id => nameOf(kind, id)).join("\n");
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(ftr("favCopied")), () => {});
    else toast(ftr("favCopied"));
  } catch (_) {}
  return { ok:true, text };
}

/* ---------- ⭐ のメニュー（ドック・曲リスト・設定から、同じものを使う） ---------- */
let menuEl = null;
function closeMenu() {
  if (!menuEl) return;
  try { menuEl.remove(); } catch (_) {}
  menuEl = null;
  document.removeEventListener("pointerdown", onDocDown, true);
  document.removeEventListener("keydown", onDocKey, true);
}
function onDocDown(e) { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }
function onDocKey(e) { if (e.key === "Escape") closeMenu(); }
function menu(anchor, kind, id) {
  closeMenu();
  const g = groupOf(kind, id);
  const isPin = pinned(kind, id);
  const box = fEl("div", "favMenu");
  box.setAttribute("role", "menu");
  const head = fEl("div", "favMenuHead", nameOf(kind, id) + (isPin ? " 📌" : ""));
  box.append(head);
  const mk = (label2, fn, cls) => {
    const b = fEl("button", "favMenuItem" + (cls ? " " + cls : ""), label2);
    b.type = "button";
    b.addEventListener("click", () => { closeMenu(); const r = fn(); if (r && r.ok === false) rmsg(r); });
    box.append(b);
  };
  if (g !== "former") {
    if (g !== "main") mk(ftr("favToMain"), () => { const r = move(kind, id, "main"); if (r.ok) { toast(ftr("favMoved", { g:label("main") })); refresh(); } return r; });
    if (g !== "sub") mk(ftr("favToSub"), () => { const r = move(kind, id, "sub"); if (r.ok) { toast(ftr("favMoved", { g:label("sub") })); refresh(); } return r; });
    if (g !== "frozen") mk(ftr("favToFrozen"), () => { const r = move(kind, id, "frozen"); if (r.ok) { toast(ftr("favMoved", { g:label("frozen") })); refresh(); } return r; });
    mk(isPin ? ftr("favUnpin") : ftr("favPin"), () => { const r = togglePin(kind, id); if (r.ok) { toast(ftr(r.pinned ? "favPinnedOn" : "favPinnedOff")); refresh(); } return r; });
    mk(ftr("favToFormer"), () => { const r = remove(kind, id); if (r.ok) { toast(ftr("favRemoved")); refresh(); } return r; });
  } else {
    mk(ftr("favRestore"), () => { const r = restore(kind, id); if (r.ok) { toast(ftr("favRestored")); refresh(); } return r; }, "on");
    mk(isPin ? ftr("favUnpin") : ftr("favPin"), () => { const r = togglePin(kind, id); if (r.ok) { toast(ftr(r.pinned ? "favPinnedOn" : "favPinnedOff")); refresh(); } return r; });
  }
  document.body.append(box);
  /* 押したボタンの近くに出す（画面の外へはみ出さないように） */
  try {
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left:20, top:20, bottom:40, width:0 };
    const w = box.offsetWidth || 210, h = box.offsetHeight || 160;
    box.style.position = "fixed";
    box.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, r.left + r.width / 2 - w / 2)) + "px";
    box.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, r.bottom + 6)) + "px";
  } catch (_) {}
  menuEl = box;
  document.addEventListener("pointerdown", onDocDown, true);
  document.addEventListener("keydown", onDocKey, true);
  return box;
}
function msg(why, g) {
  if (why === "pinned") return ftr("favPinnedNo");
  if (why === "none" || why === "bad") return "";
  return ftr("favLocked", { g:label(g || "main") });
}
function rmsg(r) { const t = msg(r.why, r.g); if (t) toast(t); }
/* どこかの画面を作り直す（お気に入りを触ったあと） */
function refresh() {
  try { if (typeof emit === "function") core.emit("language"); } catch (_) {}
  try { if (typeof renderLib === "function") renderLib(); } catch (_) {}
  try { if (typeof renderFavPanel === "function") renderFavPanel(); } catch (_) {}
}
/* ドックなどで使う「⋯」ボタン（長押しの代わり） */
function menuButton(kind, id, cls) {
  const b = fEl("button", "favDots" + (cls ? " " + cls : ""), "⋯");
  b.type = "button";
  b.title = ftr("favMenu"); b.setAttribute("aria-label", ftr("favMenu") + " " + nameOf(kind, id));
  b.setAttribute("aria-haspopup", "menu");
  b.addEventListener("click", e => { e.stopPropagation(); menu(b, kind, id); });
  return b;
}

/* ---------- フォルダのチップ（ドック・曲リスト・設定で共通） ---------- */
/* 🔒 trk215：長押し（既定3秒）で1回だけ動かすボタン。キーボード（Enter／Space）でも同じ。
   押し始めると .holding が付き、CSS のバーが3秒で伸びる（解除までの残りが見える）。
   長押しが成立したあとの click は捨てる（同じボタンの click＝フォルダを開く を二重に走らせない）。 */
function holdButton(btn, ms, onDone, onShort) {
  if (!(ms > 0)) {
    btn.addEventListener("click", e => { e.preventDefault(); onDone(); });
    return;
  }
  let timer = 0, done = false;
  const stop = () => { if (timer) { clearTimeout(timer); timer = 0; } btn.classList.remove("holding"); };
  const start = () => {
    if (timer || done) return;
    btn.classList.add("holding");
    timer = setTimeout(() => {
      timer = 0; done = true; btn.classList.remove("holding");
      try { onDone(); } catch (e) { console.error(e); }
    }, ms);
  };
  btn.addEventListener("pointerdown", e => { if (typeof e.button === "number" && e.button > 0) return; start(); });
  for (const ev of ["pointerup", "pointercancel", "pointerleave", "blur"]) btn.addEventListener(ev, stop);
  btn.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); start(); }
  });
  btn.addEventListener("keyup", e => { if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") stop(); });
  btn.addEventListener("contextmenu", e => { e.preventDefault(); stop(); });   /* スマホの長押しメニューを出さない */
  btn.addEventListener("click", e => {
    if (done) { done = false; e.preventDefault(); e.stopImmediatePropagation(); return; }
    stop();
    if (onShort) { e.preventDefault(); onShort(); }
  });
}
/*   opts: { groups:[…]（既定は main/sub/frozen）, former:true で📤も出す, onChange } */
function chips(kind, opts) {
  const o = opts || {};
  const box = fEl("div", "favChips");
  const st = state(kind);
  const groups = Array.isArray(o.groups) ? o.groups : ["main", "sub", "frozen"];
  const use = o.former ? groups.concat(["former"]) : groups;
  const after = g => { if (o.onChange) o.onChange(g); else refresh(); };
  /* 🔓 凍結を解除する（3秒長押し／謎設定でワンタップ） */
  const unfreeze = g => {
    const r = toggleLock(kind, g);
    if (r.ok && !r.locked) toast(ftr("favLockOff", { g:label(g) }));
    after(g);
  };
  const quick = quickUnfreeze();
  for (const g of use) {
    const on = st.active === g, frozenOn = locked(kind, g);
    const b = fEl("button", "favChip" + (on ? " on" : "") + (frozenOn ? " locked" : ""));
    b.type = "button";
    b.dataset.group = g; b.dataset.kind = kind;
    b.append(fEl("span", "ico", ICON[g]), fEl("span", "nm", label(g)), fEl("i", "n", String(st[g].length)));
    b.title = frozenOn
      ? ftr("favHintN", { g:label(g), n:st[g].length }) + "　" + ftr(quick ? "favLockHintQuick" : "favLockHint")
      : ftr("favHintN", { g:label(g), n:st[g].length });
    /* 🧊 trk215：凍結中の🧊のチップは、3秒長押しでも解除できる（click＝フォルダを開く はそのまま） */
    if (frozenOn && !quick && g === "frozen") holdButton(b, HOLD_UNFREEZE_MS, () => unfreeze(g), null);
    b.addEventListener("click", () => {
      const r = setActive(kind, g);
      if (r.ok && o.onChange) o.onChange(g);
      else if (r.ok) refresh();
      if (oTick) oTick();
    });
    box.append(b);
  }
  if (o.lock !== false && ["main", "sub", "frozen"].includes(st.active)) {
    const g = st.active, on = locked(kind, g);
    const b = fEl("button", "favLock" + (on ? " on" : ""), on ? "🔒" : "🔓");
    b.type = "button";
    b.setAttribute("aria-pressed", String(on));
    if (!on) {
      /* 凍結するのは安全側なので、1タップでよい */
      b.title = ftr("favLock", { g:label(g) });
      b.setAttribute("aria-label", b.title);
      b.addEventListener("click", () => {
        const r = toggleLock(kind, g);
        if (r.ok) toast(ftr(r.locked ? "favLockOn" : "favLockOff", { g:label(g) }));
        after(g);
      });
    } else {
      /* 🔒 凍結中。解除は3秒長押し（❓謎設定「フリーズの解除をワンタップにする」で1タップ） */
      b.title = ftr(quick ? "favUnlock" : "favUnlockHold", { g:label(g) });
      b.setAttribute("aria-label", b.title);
      holdButton(b, quick ? 0 : HOLD_UNFREEZE_MS, () => unfreeze(g),
        quick ? null : () => toast(ftr("favLockHint", { g:label(g) })));
    }
    box.append(b);
  }
  /* 📌 ピン（ほかのフォルダにいても🎲の候補に入る）。数だけを出して、いまの状態が見えるようにする */
  const pinN = st.pins.filter(id => st.main.includes(id) || st.sub.includes(id) || st.frozen.includes(id)).length;
  if (pinN) {
    const p = fEl("span", "favPinN", "📌 " + pinN);
    p.title = ftr("favPinCount", { n:pinN });
    p.setAttribute("aria-label", p.title);
    box.append(p);
  }
  return box;
}
/* チップを作り直すための小さな合図（画面ごとの再描画フック） */
let oTick = null;
const onTick = fn => { oTick = fn; };

/* ---------- ⚙️ 設定画面の「⭐ お気に入り」パネル ---------- */
let panelKind = "tv";
function kindLabel(k) { return ftr(k === "tv" ? "favKindTv" : k === "fx" ? "favKindFx" : "favKindSong"); }
function renderFavPanel() {
  const body = document.getElementById("favPanelBody");
  if (!body) return;
  const sum = document.getElementById("favPanelSummary");
  if (sum) sum.textContent = ftr("favTitle");
  body.textContent = "";
  const kind = KINDS.includes(panelKind) ? panelKind : "tv";
  panelKind = kind;

  /* 種類（映像フィルター／エフェクト／曲） */
  const row = fEl("div", "inline tight");
  const kindLab = fEl("span", "", ftr("favKind")); kindLab.id = "favKindSelLabel";
  row.append(kindLab);
  const sel = document.createElement("select");
  sel.id = "favKindSel"; sel.setAttribute("aria-labelledby", "favKindSelLabel");
  sel.className = "favKindSel";
  for (const k of KINDS) { const o = document.createElement("option"); o.value = k; o.textContent = kindLabel(k); sel.append(o); }
  sel.value = kind;
  sel.addEventListener("change", () => { panelKind = sel.value; renderFavPanel(); });
  row.append(sel);
  body.append(row, fEl("div", "hint", ftr("favIntro")));

  /* フォルダのチップ（元お気に入りも見られる）と、凍結のボタン */
  body.append(chips(kind, { former:true, onChange: () => renderFavPanel() }));

  const g = activeOf(kind), ids = list(kind, g);
  const listBox = fEl("div", "favList");
  if (!ids.length) listBox.append(fEl("div", "hint", ftr(g === "former" ? "favEmptyFormer" : "favEmpty")));
  for (const id of ids) {
    const r = fEl("div", "favRow" + (pinned(kind, id) ? " pinned" : ""));
    r.append(fEl("span", "nm", nameOf(kind, id)));
    if (!known(kind, id)) r.append(fEl("span", "miss", ftr("favMissing")));
    if (pinned(kind, id)) r.append(fEl("span", "pin", "📌"));
    if (g === "former") {
      const back = fEl("button", "favMini on", "↩ " + ftr("favGroupMain"));
      back.type = "button";
      back.title = ftr("favRestore");
      back.addEventListener("click", () => { const res = restore(kind, id); if (res.ok) { toast(ftr("favRestored")); renderFavPanel(); } else rmsg(res); });
      r.append(back);
    }
    r.append(menuButton(kind, id));
    listBox.append(r);
  }
  body.append(listBox);
  if (g === "former" && ids.length) {
    const clr = fEl("button", "", ftr("favClearFormer"));
    clr.type = "button";
    clr.addEventListener("click", () => { clearFormer(kind); toast(ftr("favCleared")); renderFavPanel(); });
    body.append(clr);
  }

  /* 書き出し・読み込み・コピー */
  const tools = fEl("div", "inline tight");
  const expB = fEl("button", "", ftr("favExport")); expB.type = "button";
  expB.addEventListener("click", () => exportJSON(kind));
  const impB = fEl("button", "", ftr("favImport")); impB.type = "button";
  const copyB = fEl("button", "", ftr("favCopy")); copyB.type = "button";
  copyB.addEventListener("click", () => {
    const r = exportText(kind);
    try {
      if (!navigator.clipboard && r.text) {          /* クリップボードが無い環境（テストなど）でも取れるように */
        const ta = document.createElement("textarea");
        ta.value = r.text; document.body.append(ta); ta.select();
        try { document.execCommand("copy"); } catch (_) {}
        ta.remove();
      }
    } catch (_) {}
  });
  const file = document.createElement("input");
  file.type = "file"; file.accept = ".json,application/json"; file.hidden = true;
  file.addEventListener("change", async () => { const f = file.files && file.files[0]; file.value = ""; await importFile(kind, f); renderFavPanel(); });
  impB.addEventListener("click", () => file.click());
  tools.append(expB, impB, copyB, file);
  body.append(tools);
}
function initFavPanel() {
  renderFavPanel();
  const panel = document.getElementById("favPanel");
  if (panel) panel.addEventListener("toggle", () => { if (panel.open) renderFavPanel(); });
  document.addEventListener("click", e => {           /* 画面の外を押したら ⋯ のメニューを閉じる */
    if (menuEl && !menuEl.contains(e.target) && !(e.target.closest && e.target.closest(".favDots"))) closeMenu();
  });
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initFavPanel);
  else initFavPanel();
}

/* ---------- fx.js の「★」をフォルダ管理に繋ぐ（fx.js は凍結中なので、こちらから包む） ----------
   ・fx.js の ★ は今までどおり「1軍に入れる／1軍から外す（📤元お気に入りへ）」。
   ・ボタンには listener が直接付いているので、付け替えて受ける。
   ・ここが外れても、fx.js は settings.fxFav（1軍）を触るだけなので今までどおり動く。 */
function fxToggleFav() {
  try {
    const TEMP = (typeof TEMP_ID !== "undefined" && TEMP_ID) || "__chart";
    const id = core.settings.fxPreset;
    if (!core.settings.fxOn || id === TEMP) return;
    if (has("fx", id)) {
      const r = remove("fx", id);
      if (!r.ok) rmsg(r);
    } else {
      add("fx", id, { group:"main", append:false });     /* 元お気に入りにあるときは、ここで1軍に戻る */
    }
    if (typeof syncUI === "function") syncUI();          /* ☆／★ の表示を合わせる */
    refresh();
  } catch (e) { console.error(e); }
}
(function hookFxFav() {
  try {
    if (typeof settings === "undefined") return;
    /* 読み込み時に fx.js が40個で切ったぶんを、保存されている値から戻す */
    if (core.prefs && Array.isArray(core.prefs.fxFav)) {
      const full = list0(core.prefs.fxFav, "fx");
      if (full.length > (Array.isArray(core.settings.fxFav) ? core.settings.fxFav.length : 0)) { core.settings.fxFav = full; S.fx = null; }
    }
    if (typeof favBtn === "undefined" || typeof toggleFav !== "function") return;
    favBtn.removeEventListener("click", toggleFav);
    favBtn.addEventListener("click", fxToggleFav);
  } catch (_) {}
})();

/* ---------- 窓口 ---------- */
window.TrkFavs = {
  version: 1, FORMAT, KINDS, GROUPS, ICON,
  kinds: () => KINDS.slice(), groups: () => GROUPS.slice(),
  label, state, list, count, total, groupOf, has, inGroup, pinned, locked, activeOf,
  setActive, toggleLock, add, move, remove, restore, clearFormer, togglePin, pool, nameOf, known,
  exportObj, importObj, exportJSON, importFile, exportText, menu, menuButton, chips, toast, refresh, onTick, msg,
  fxToggle: fxToggleFav,   /* fx.js の ★ を受ける側（テスト用にも出しておく）*/
  renderPanel: renderFavPanel, kindLabel,
  text: (l, k) => (l === "ja" || l === "en" || l === "zh" || l === "ko") ? (FAV_TEXT[l][k] || "") : "",
  _closeMenu: closeMenu
};
/* 言語が変わったら、言葉を合わせて作り直す */
if (typeof on === "function") {
  on("language", () => {
    try {
      closeMenu();
      if (typeof renderFavPanel === "function") renderFavPanel();
    } catch (_) {}
  });
}
})();
