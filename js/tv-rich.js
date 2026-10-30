(() => {
  const core = window.Trk.core;
// SPDX-License-Identifier: GPL-3.0-or-later
/* ==========================================================================
   trk! tv-rich.js — ✨ TRKエフェクトを使う（リッチ映像の独立カテゴリー）
   ・選曲画面の左下、「🎛 くわしく」の下、「🔥 TRKアンプ」のさらに下に並ぶ details パネル
   ・中身は js/tv-presets.js の「人物・肌色／アニメ・セル／質感／スタジオ・高画質」の20種
     （＝定番45種のあとに足した“リッチ”な映像グレード）
   ・適用は映像の窓口 window.TrkTV（js/tv-dock.js）だけを通す。settings.videoStyle は
     テレビの「映像フィルター」と同じ1つの値なので、二重管理しない（どちらで選んでも同期する）
   ・映像はもともと記録に入らないので、演奏・判定・記録には影響しない
   読み込み順：tv-dock.js のあと（TrkTV ができてから組み立てる）
   ========================================================================== */
"use strict";

/* ============ ⑧ 文章（接頭辞 rich…） ============ */
Object.assign(TEXT.ja, {
  richTitle:"✨ TRKエフェクトを使う",
  richHint:"人肌・アニメ・質感・高画質の「リッチ」な映像エフェクト（20種）を、ここから直接さわれます。テレビの「映像フィルター」と同じ設定を動かします（記録には影響しません）。",
  richUse:"TRKエフェクトを使う（映像に重ねる）",
  richOn:"✨ 使っています：{name}", richOff:"いまは使っていません（{name}）",
  richSafe:"🛟 セーフモード中は映像を出しません（?safe を外すと戻ります）",
  richPrevLabel:"◀ 前へ", richNextLabel:"次へ ▶", richRandom:"🎲 おまかせ", richReset:"↩ 元の色に戻す",
  richRandomed:"✨ {name} にしました", richRestored:"↩ 映像フィルターを元に戻しました",
  richMore:"🎛 映像フィルターをくわしく（設定を開く）",
  richNote:"🎞 リッチ以外のプリセット（モノクロ・レトロなど）・⭐お気に入り・🕘最近使ったは、これまでどおりテレビの「映像フィルター」から選べます。",
  richNoPreset:"（映像プリセットが見つかりません）"
});
Object.assign(TEXT.en, {
  richTitle:"✨ Use the TRK effects",
  richHint:"The 20 “rich” video grades — portrait/skin, anime/cel, texture and studio/quality — right here. They move the same setting as the TV's “video filter” (they never affect your records).",
  richUse:"Use the TRK effects (over the video)",
  richOn:"✨ In use: {name}", richOff:"Not in use ({name})",
  richSafe:"🛟 Safe mode hides the video (remove ?safe to bring it back)",
  richPrevLabel:"◀ Previous", richNextLabel:"Next ▶", richRandom:"🎲 Surprise me", richReset:"↩ Back to the original color",
  richRandomed:"✨ Switched to {name}", richRestored:"↩ Video filter restored",
  richMore:"🎛 Fine-tune the video filters (open settings)",
  richNote:"🎞 The other presets (mono, retro, …), ⭐ favorites and 🕘 recents stay in the TV's “video filter” as before.",
  richNoPreset:"(No video presets found)"
});
Object.assign(TEXT.zh, {
  richTitle:"✨ 使用 TRK 影像特效",
  richHint:"把人像／肤色·动画／赛璐珞·质感·影棚／画质这20种“进阶”影像调色放在这里直接使用。它与电视的“影像滤镜”是同一个设置（不会影响成绩）。",
  richUse:"使用 TRK 影像特效（叠加到影像）",
  richOn:"✨ 使用中：{name}", richOff:"未使用（{name}）",
  richSafe:"🛟 安全模式下不显示影像（去掉 ?safe 即可恢复）",
  richPrevLabel:"◀ 上一个", richNextLabel:"下一个 ▶", richRandom:"🎲 随机", richReset:"↩ 恢复原来的颜色",
  richRandomed:"✨ 已切换为 {name}", richRestored:"↩ 已恢复影像滤镜",
  richMore:"🎛 细致调整影像滤镜（打开设置）",
  richNote:"🎞 其他预设（黑白、复古等）、⭐收藏、🕘最近使用仍在电视的“影像滤镜”里。",
  richNoPreset:"（未找到影像预设）"
});
Object.assign(TEXT.ko, {
  richTitle:"✨ TRK 영상 이펙트 사용",
  richHint:"인물/피부톤·애니/셀·질감·스튜디오/화질의 ‘리치’ 영상 그레이드 20종을 여기서 바로. TV의 ‘영상 필터’와 같은 설정을 움직입니다 (기록에는 영향 없음).",
  richUse:"TRK 영상 이펙트 사용 (영상 위에 겹치기)",
  richOn:"✨ 사용 중: {name}", richOff:"사용 안 함 ({name})",
  richSafe:"🛟 세이프 모드에서는 영상을 표시하지 않아요 (?safe를 빼면 돌아옵니다)",
  richPrevLabel:"◀ 이전", richNextLabel:"다음 ▶", richRandom:"🎲 랜덤", richReset:"↩ 원래 색으로",
  richRandomed:"✨ {name} (으)로 바꿨어요", richRestored:"↩ 영상 필터를 되돌렸어요",
  richMore:"🎛 영상 필터를 자세히 조정 (설정 열기)",
  richNote:"🎞 그 외 프리셋(모노·레트로 등)·⭐즐겨찾기·🕘최근 사용은 지금처럼 TV의 ‘영상 필터’에서 고를 수 있어요.",
  richNoPreset:"(영상 프리셋을 찾지 못했습니다)"
});

/* ============ 設定（このパネルで使う分だけ。videoStyle はいつもの settings.videoStyle） ============
   tvRichId   … 最後に使ったリッチプリセット（スイッチを入れたときの行き先）
   tvRichPrev … スイッチを切ったときに戻す、リッチではない元の映像フィルター
   tvRichCat  … いま開いている分類タブ */
const RICH_CATS = ["portrait", "anime", "texture", "quality"];
const RICH_CAT_ICON = { portrait:"👤", anime:"🎨", texture:"🧵", quality:"📡" };
const RICH_DEFAULT_ID = "portrait_natural";
const RICH_FALLBACK_ID = "skin";                 /* 元に戻すときの行き先（スキン標準） */
/* 読み込み：ふつうは prefs（保存された生の値）から。
   ただし ?reset=tv / ?reset=all のときは、core.js の resetVideoPrefs() が
   先に settings 側へ既定値を書いている（core.js のほうが先に走る）ので、そちらを優先する。 */
const idOk = v => typeof v === "string" && /^[a-z0-9_]{1,40}$/.test(v);
/* ⚠ idOk は**書式だけ**なので "constructor" も "__proto__" も通る（全部小文字＋_で40字以内）。
   いまは実害ゼロ＝3キーとも行き先が配列の .find()／.includes() だけで、継承キーは配列検索に効かない
   （M-03 検収済み）。ただ F-30 の教訓は「辞書を足すときに継承キーを踏む」なので、
   将来ここに辞書参照を足した瞬間の種を残さないよう、実在IDでも検証する。
   ⚠ 二つのキーは**行き先が違う**ので同じ許可リストにしてはいけない：
     ・tvRichId   ＝選べるリッチプリセット（portrait/anime/texture/quality の20種）
     ・tvRichPrev ＝リッチではない元の映像フィルター（skin／vivid／off など**全70種**）
     tvRichPrev をリッチ20種で検証すると、保存済みの「戻る先」が毎回リセットされる。
   一覧が読めないときは従来どおり書式だけ（保存値を勝手に捨てない＝fail-open）。 */
const richIds = () => {
  try {
    if (typeof TRK_TV_PRESETS === "undefined") return null;
    const ids = TRK_TV_PRESETS.filter(p => p && RICH_CATS.includes(p.cat) && !p.off).map(p => p.id);
    return ids.length ? ids : null;
  } catch (_) { return null; }
};
const videoIds = () => {
  try {
    const L = (typeof window !== "undefined" && window.TrkTV && typeof window.TrkTV.list === "function") ? window.TrkTV.list()
      : (typeof TrkTV !== "undefined" && typeof TrkTV.list === "function" ? TrkTV.list() : null);
    if (!Array.isArray(L)) return null;
    const ids = L.map(p => p && p.id).filter(id => typeof id === "string");
    return ids.length ? ids : null;
  } catch (_) { return null; }
};
const richIdOk = v => { if (!idOk(v)) return false; const ids = richIds(); return !ids || ids.includes(v); };
const videoIdOk = v => { if (!idOk(v)) return false; const ids = videoIds(); return !ids || ids.includes(v); };
const pickRich = (key, ok, def) => {
  const v = typeof core.settings[key] === "string" ? core.settings[key] : core.prefs[key];
  return ok(v) ? v : def;
};
core.settings.tvRichId = pickRich("tvRichId", richIdOk, RICH_DEFAULT_ID);
core.settings.tvRichPrev = pickRich("tvRichPrev", videoIdOk, "");
core.settings.tvRichCat = pickRich("tvRichCat", v => RICH_CATS.includes(v), RICH_CATS[0]);
core.settings.tvRichOpen = typeof core.settings.tvRichOpen === "boolean" ? core.settings.tvRichOpen : core.prefs.tvRichOpen !== false;   /* 欄は最初から開いておく（🔥 TRKアンプとおそろい。触って閉じた人の記憶は残す） */

/* ============ 画面の組み立て（ほかのファイルを読み終えてから） ============ */
addEventListener("DOMContentLoaded", () => {
  const col = document.querySelector(".songCol");
  if (!col || !window.TrkTV) return;
  core.saveUserPrefs();                               /* 追加した設定を一度書いておく */

  const tx = (tag, key, cls) => { const n = core.el(tag, cls || "", tr(key)); n.dataset.i18n = key; return n; };
  const btn = (cls, text) => { const b = core.el("button", cls, text); b.type = "button"; return b; };
  const safeOn = () => typeof window.TrkSafeMode === "function" && window.TrkSafeMode();
  const richList = () => TrkTV.list().filter(p => RICH_CATS.includes(p.cat) && !p.off);
  /* 説明文は TrkTV.list() に無いので、プリセット表（tv-presets.js）から今の言語で読む */
  const presetDesc = id => {
    const p = (typeof TRK_TV_PRESETS !== "undefined" ? TRK_TV_PRESETS.find(x => x.id === id) : null);
    const d = p && p.desc;
    return typeof d === "string" ? d : (d && (d[lang] || d.en || d.ja)) || "";
  };
  const anyPreset = id => TrkTV.list().find(p => p.id === id) || null;
  const richById = id => richList().find(p => p.id === id) || null;
  const isRich = id => !!richById(id);
  const currentRich = () => richById(TrkTV.current());
  const say = msg => { try { if (typeof plToast === "function") plToast(msg); } catch (_) {} };

  /* ---- 🔥 TRKアンプの下（無ければ「くわし」の下）に置く独立カテゴリー ---- */
  const panel = core.el("details", "panel dockRich"); panel.id = "richPanel";
  panel.open = core.settings.tvRichOpen === true;
  panel.addEventListener("toggle", () => { core.settings.tvRichOpen = panel.open; core.saveUserPrefs(); if (panel.open) render(); });

  const useLab = core.el("label", "check"), useInp = document.createElement("input");
  useInp.type = "checkbox"; useLab.append(useInp, tx("span", "richUse"));
  const state = core.el("div", "hint status"); state.id = "richState";
  const cats = core.el("div", "seg richCats"); cats.id = "richCats";
  const chips = core.el("div", "richChips"); chips.id = "richChips";
  const desc = core.el("div", "hint"); desc.id = "richDesc";
  const row = core.el("div", "miniActions");
  const prevBtn = tx("button", "richPrevLabel", "fxMini"), nextBtn = tx("button", "richNextLabel", "fxMini");
  const randBtn = tx("button", "richRandom", "fxMini"), resetBtn = tx("button", "richReset", "fxMini");
  const moreBtn = tx("button", "richMore", "fxMini");
  row.append(prevBtn, nextBtn, randBtn, resetBtn);
  panel.append(tx("summary", "richTitle"), tx("div", "richHint", "hint"), useLab, state, cats, chips, desc, row, moreBtn, tx("div", "richNote", "hint"));

  const catBtns = {};
  for (const cat of RICH_CATS) {
    const b = btn("richCat", "");
    b.dataset.richcat = cat;
    const catKey = { portrait:"tvCatPortrait", anime:"tvCatAnime", texture:"tvCatTexture", quality:"tvCatQuality" }[cat];
    b.append(core.el("span", "richCatIcon", RICH_CAT_ICON[cat] + " "), tx("span", catKey));
    b.addEventListener("click", () => { core.settings.tvRichCat = cat; core.saveUserPrefs(); render(); });
    catBtns[cat] = b; cats.append(b);
  }

  /* ---- 適用はすべて TrkTV（＝テレビの映像フィルターと同じ設定）経由 ---- */
  function rememberPrev() {
    const cur = TrkTV.current();
    if (!cur || isRich(cur)) return;
    core.settings.tvRichPrev = cur === "off" ? (core.settings.tvPowerPrev && !isRich(core.settings.tvPowerPrev) ? core.settings.tvPowerPrev : RICH_FALLBACK_ID) : cur;
  }
  function applyRich(id, quiet) {
    const p = richById(id);
    if (!p) return false;
    if (safeOn()) { say(tr("richSafe")); return false; }
    rememberPrev();
    core.settings.tvRichId = id;
    if (!TrkTV.select(id)) return false;
    core.saveUserPrefs(); render();
    if (!quiet) say(tr("richRandomed", { name: p.name }));
    return true;
  }
  function restoreRich(quiet) {
    if (safeOn()) { say(tr("richSafe")); return; }
    const prev = core.settings.tvRichPrev;
    if (!(prev && !isRich(prev) && TrkTV.select(prev))) TrkTV.select(RICH_FALLBACK_ID);
    core.saveUserPrefs(); render();
    if (!quiet) say(tr("richRestored"));
  }
  const richStep = dir => {
    const list = richList(); if (!list.length) return;
    const cur = list.findIndex(p => p.id === TrkTV.current());
    const nxt = cur < 0 ? (dir > 0 ? 0 : list.length - 1) : (cur + dir + list.length) % list.length;
    applyRich(list[nxt].id);
  };

  useInp.addEventListener("change", () => {
    if (safeOn()) { useInp.checked = false; say(tr("richSafe")); return; }
    if (useInp.checked) { if (!applyRich(core.settings.tvRichId || RICH_DEFAULT_ID)) useInp.checked = false; }
    else restoreRich();
  });
  prevBtn.addEventListener("click", () => richStep(-1));
  nextBtn.addEventListener("click", () => richStep(1));
  randBtn.addEventListener("click", () => {
    const list = richList().filter(p => p.id !== TrkTV.current());
    if (!list.length) return;
    applyRich(list[Math.floor(Math.random() * list.length)].id);
  });
  resetBtn.addEventListener("click", () => restoreRich(true));
  moreBtn.addEventListener("click", () => {
    core.openSettings(); // 設定画面へ（選曲画面にいるときだけ）
    const vs = document.getElementById("videoStyle");
    if (vs) { const lab = vs.closest("label") || vs; if (vs.options && vs.value !== core.settings.videoStyle) { try { vs.value = core.settings.videoStyle; } catch (_) {} } setTimeout(() => { try { lab.scrollIntoView({ behavior:"smooth", block:"center" }); } catch (_) {} }, 60); }
  });

  function render() {
    const list = richList();
    const cur = currentRich();
    const safe = safeOn();
    const cat = RICH_CATS.includes(core.settings.tvRichCat) ? core.settings.tvRichCat : RICH_CATS[0];
    useInp.checked = !!cur;
    useInp.disabled = safe;
    const other = anyPreset(TrkTV.current());
    state.textContent = safe ? tr("richSafe")
      : (cur ? tr("richOn", { name: cur.name }) : tr("richOff", { name: other ? other.name : tr("richNoPreset") }));
    for (const [c, b] of Object.entries(catBtns)) b.classList.toggle("selected", c === cat);
    chips.textContent = "";
    const items = list.filter(p => p.cat === cat);
    if (!items.length) chips.append(core.el("div", "hint", tr("richNoPreset")));
    for (const p of items) {
      const chip = btn("richChip" + (cur && cur.id === p.id ? " selected" : ""), p.name);
      chip.dataset.richid = p.id; chip.title = presetDesc(p.id) || p.name; chip.disabled = safe;
      chip.addEventListener("click", () => applyRich(p.id));
      chips.append(chip);
    }
    desc.textContent = presetDesc(cur ? cur.id : TrkTV.current());
  }

  /* ---- 置き場所：🔥 TRKアンプの直下（無ければ「くわし」の直下） ---- */
  const richOwner = () => col.querySelector(":scope > details.dockAmp") || col.querySelector(":scope > details.dockMore");
  const placeRich = () => {
    const owner = richOwner();
    if (owner && owner.nextElementSibling !== panel) owner.after(panel);
    else if (!owner && panel.parentElement !== col) col.append(panel);
  };
  col.append(panel);
  placeRich(); setTimeout(placeRich, 0);
  if (typeof MutationObserver === "function") { try { new MutationObserver(placeRich).observe(col, { childList:true }); } catch (_) {} }

  /* ---- 外からの変更（テレビの映像フィルター・🎲・言語）に追従 ----
     テレビ側の 🎲 などでリッチに変わったときも、戻り先（直前に見ていた色）を覚えておく */
  let lastStyle = TrkTV.current();
  if (isRich(lastStyle)) core.settings.tvRichId = lastStyle;   /* 起動時からリッチなら、スイッチの行き先もそれに合わせる */
  if (typeof on === "function") {
    core.on("tvChange", id => {
      if (isRich(id)) {
        core.settings.tvRichId = id;
        if (lastStyle && !isRich(lastStyle)) core.settings.tvRichPrev = lastStyle === "off" ? RICH_FALLBACK_ID : lastStyle;
        core.saveUserPrefs();
      }
      lastStyle = id;
      render();
    });
    core.on("language", render);
  }
  render();
});
/* ✅ tv-rich.js 完了 */
})();
