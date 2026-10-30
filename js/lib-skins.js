// SPDX-License-Identifier: GPL-3.0-or-later
/* ==========================================================================
   trk! lib-skins.js — 📚 曲リストの「棚」スキン（曲タブの見た目）
   ・タブの中身（どの曲がどのタブか）は library.js が作ります。
     ここは #libPanel[data-lib-skin="…"] を付け替えて、見た目を変えるだけ。
   ・30種類：player / note / sticker / card / cassette / blackboard / retro / clearfile
              ＋ 🎰 juke（ジュークボックス）／📻 guide（ラジオ番組表）／🚉 board（電光掲示板）
              ＋ 💿 vinyl（レコード棚）／📼 vhs（レンタルビデオ）／🎤 karaoke（カラオケ目次）／🗂️ archive（図書館の書架）／🍱 menu（お品書き）
   ・曲リストの見出しの 🎨 ボタンで、その場で切り替え（settings.libSkinQuick で隠せます）
   ・設定画面「見た目」にも、スキンの選択と 🎨 ボタンの表示切り替えがあります
   読み込み順：i18n.js → core.js → … → library.js → verified.js → lib-skins.js
   ========================================================================== */
"use strict";
(() => {
  const core = window.Trk.core;

/* ============ 文章（接頭辞 libSkin…） ============ */
const L4 = (ja, en, zh, ko) => ({ ja, en, zh, ko });
Object.assign(TEXT.ja, {
  libSkinHead:"📚 曲リストの棚（タブ）のスキン",
  libSkinQuick:"曲リストに 🎨 ボタンを出す（その場でスキンを切り替え）",
  libSkinHint:"曲タブの見た目を、ノート・シール帳・ジュークボックス・電光掲示板などから選べます。タブそのものは、曲の入り口（パック・フォルダー・追加した曲）ごとに自動でできます。",
  libSkinBtnTitle:"🎨 棚のスキン（曲タブの見た目）",
  libSkinRand:"🎲 おまかせ",
  libSkinApplied:"棚のスキン：{name}"
});
Object.assign(TEXT.en, {
  libSkinHead:"📚 Song list shelf (tab) skin",
  libSkinQuick:"Show the 🎨 button on the song list (switch skins on the spot)",
  libSkinHint:"Pick the look of the song tabs: notebook, sticker book, jukebox, departure board and more. The tabs themselves are made automatically, one per source (pack / folder / added songs).",
  libSkinBtnTitle:"🎨 Shelf skin (song tab look)",
  libSkinRand:"🎲 Surprise me",
  libSkinApplied:"Shelf skin: {name}"
});
Object.assign(TEXT.zh, {
  libSkinHead:"📚 歌曲列表的架子（标签）皮肤",
  libSkinQuick:"在歌曲列表显示 🎨 按钮（就地切换皮肤）",
  libSkinHint:"歌曲标签的外观可选：笔记本、贴纸册、点唱机、电子显示屏等。标签本身会按来源（歌曲包／文件夹／已添加）自动生成。",
  libSkinBtnTitle:"🎨 架子皮肤（歌曲标签外观）",
  libSkinRand:"🎲 随机",
  libSkinApplied:"架子皮肤：{name}"
});
Object.assign(TEXT.ko, {
  libSkinHead:"📚 곡 목록 선반(탭) 스킨",
  libSkinQuick:"곡 목록에 🎨 버튼 표시 (그 자리에서 스킨 전환)",
  libSkinHint:"곡 탭의 모양을 노트·스티커 앨범·주크박스·전광판 등에서 고를 수 있습니다. 탭 자체는 곡의 입구(팩·폴더·추가한 곡)마다 자동으로 생깁니다.",
  libSkinBtnTitle:"🎨 선반 스킨 (곡 탭 모양)",
  libSkinRand:"🎲 랜덤",
  libSkinApplied:"선반 스킨: {name}"
});

/* ============ スキン30種 ============ */
const LIB_SKIN_ORDER = ["player", "note", "sticker", "card", "cassette", "blackboard", "retro", "clearfile", "juke", "guide", "board", "vinyl", "vhs", "karaoke", "archive", "menu", "toolbox", "herbarium", "kusuri", "geta", "dagashi", "message", "postal", "score", "okabe", "pattern", "signage", "popart", "rainbow", "tropical"];
const LIB_SKINS = {
  player:     { icon:"🎛", label:L4("タブプレーヤー", "Tab player", "标签播放器", "탭 플레이어") },
  note:       { icon:"📝", label:L4("ノート", "Notebook", "笔记本", "노트") },
  sticker:    { icon:"🌈", label:L4("シール帳", "Sticker book", "贴纸册", "스티커 앨범") },
  card:       { icon:"🗄", label:L4("カード目録", "Card catalog", "卡片目录", "카드 목록") },
  cassette:   { icon:"📼", label:L4("カセットラベル", "Cassette label", "磁带标签", "카세트 라벨") },
  blackboard: { icon:"🖍", label:L4("黒板", "Blackboard", "黑板", "칠판") },
  retro:      { icon:"🕹", label:L4("レトロPC", "Retro PC", "复古电脑", "레트로 PC") },
  clearfile:  { icon:"📁", label:L4("クリアファイル", "Clear file", "透明文件夹", "클리어 파일") },
  /* 🆕 3種（2026-10-05） */
  juke:       { icon:"🎰", label:L4("ジュークボックス", "Jukebox", "点唱机", "주크박스") },
  guide:      { icon:"📻", label:L4("ラジオ番組表", "Radio guide", "广播节目表", "라디오 편성표") },
  board:      { icon:"🚉", label:L4("電光掲示板", "Departure board", "电子显示屏", "전광판") },
  /* 🆕 5種（2026-10-05 拡張） */
  vinyl:      { icon:"💿", label:L4("レコード棚", "Vinyl record", "黑胶唱片架", "바이닐 레코드") },
  vhs:        { icon:"📼", label:L4("レンタルビデオ", "VHS rental", "VHS录像带", "비디오 대여점") },
  karaoke:    { icon:"🎤", label:L4("カラオケ目次", "Karaoke book", "KTV歌单", "노래방 책자") },
  archive:    { icon:"🗂️", label:L4("図書館の書架", "Library catalog", "图书馆书架", "도서관 서가") },
  menu:       { icon:"🍱", label:L4("お品書き", "Menu scroll", "日式菜单", "식사 메뉴판") },
  /* ③棚スキンの追加（SKIN-PLAN §3-3）。見た目は CSS だけで作る。自作の配色・図形のみ */
  toolbox:    { icon:"🧰", label:L4("工具箱", "Toolbox", "工具箱", "공구함") },
  herbarium:  { icon:"🌿", label:L4("植物標本箱", "Herbarium", "植物标本箱", "식물 표본함") },
  kusuri:     { icon:"💊", label:L4("薬箪笥", "Medicine chest", "药柜", "약장") },
  geta:       { icon:"🏨", label:L4("旅館の下駄箱", "Ryokan shoe lockers", "旅馆鞋柜", "여관 신발장") },
  dagashi:    { icon:"🍬", label:L4("駄菓子屋の棚", "Candy shop shelf", "零食店货架", "주전부리 가게 선반") },
  /* 棚スキン（追加：駅の伝言板・郵便の仕分け棚・楽譜棚）。CSS だけで作る */
  message:    { icon:"📌", label:L4("駅の伝言板", "Station message board", "车站留言板", "역 메시지 게시판") },
  postal:     { icon:"📮", label:L4("郵便の仕分け棚", "Postal sorting shelf", "邮件分拣架", "우편 분류함") },
  score:      { icon:"🎼", label:L4("楽譜棚", "Sheet music shelf", "乐谱架", "악보 선반") },
  /* 棚スキン（30種へ）：色覚配慮の3種（色だけに頼らない）＋ビビットの3種 */
  okabe:      { icon:"🔷", label:L4("色覚にやさしい（青×橙）", "Colorblind-friendly (blue × orange)", "色觉友好（蓝×橙）", "색각 배려 (파랑×주황)") },
  pattern:    { icon:"🧵", label:L4("模様で見分ける", "Pattern-coded (stripes, dots, grid)", "图案区分（条纹·圆点·格子）", "무늬로 구분 (줄무늬·점·격자)") },
  signage:    { icon:"🚧", label:L4("案内サイン（黄×黒）", "Wayfinding sign (yellow × black)", "导向标识（黄×黑）", "안내 표지판 (노랑×검정)") },
  popart:     { icon:"💥", label:L4("ポップアート", "Pop art", "波普艺术", "팝아트") },
  rainbow:    { icon:"🦄", label:L4("虹色ネオン", "Rainbow neon", "彩虹霓虹", "무지개 네온") },
  tropical:   { icon:"🍍", label:L4("トロピカル", "Tropical", "热带风", "트로피컬") }
};
const hasLibSkin = id => Object.prototype.hasOwnProperty.call(LIB_SKINS, id);
const skinDef = id => hasLibSkin(id) ? LIB_SKINS[id] : LIB_SKINS.player;
const skinText = id => { const d = hasLibSkin(id) ? LIB_SKINS[id] : null; return d ? d.icon + " " + (d.label[lang] || d.label.en) : String(id); };
const skinIds = () => LIB_SKIN_ORDER.slice();

/* ============ 適用 ============ */
function applyLibSkin(id, opts) {
  const save = !opts || opts.save !== false;
  if (!hasLibSkin(id)) id = "player";
  core.settings.libSkin = id;
  const panel = core.$("libPanel");
  if (panel) panel.dataset.libSkin = id;
  document.querySelectorAll("#libSkinBar .libSkinChip").forEach(c => {
    const on = c.dataset.skin === id;
    c.classList.toggle("on", on); c.setAttribute("aria-pressed", String(on));
  });
  const sel = core.$("libSkinSelect");
  if (sel) sel.value = id;
  if (save) core.saveUserPrefs();
  return id;
}
function randomLibSkin() { return applyLibSkin(LIB_SKIN_ORDER[Math.floor(Math.random() * LIB_SKIN_ORDER.length)]); }

/* ============ 🎨 ボタンと、スキン選びの帯 ============ */
function barOpen() { const bar = core.$("libSkinBar"); return !!bar && !bar.hidden; }
function openBar(on) {
  const bar = core.$("libSkinBar"), b = core.$("libSkinBtn");
  if (!bar) return;
  const want = (on === undefined) ? bar.hidden : !!on;
  if (want && core.settings.libSkinQuick === false) return;     // ボタンを隠す設定のときは開かない
  bar.hidden = !want;
  if (b) b.setAttribute("aria-expanded", String(want));
}
/* 表示の並び：かんたん＝棚スキンの上位6つ（おすすめ）を先頭に、残りは従来の順。全部＝LIB_SKIN_ORDER そのまま。ランダムは並びに関係なく同じ30から選ぶ */
const LIB_SKIN_SIMPLE_TOP = ["player", "cassette", "vinyl", "note", "karaoke", "retro"];
function libSkinOrder() {
  if (core.settings.displayMode === "full") return LIB_SKIN_ORDER;
  return [...LIB_SKIN_SIMPLE_TOP, ...LIB_SKIN_ORDER.filter(id => !LIB_SKIN_SIMPLE_TOP.includes(id))];
}
function buildBar() {
  const bar = core.$("libSkinBar"); if (!bar) return;
  bar.textContent = "";
  for (const id of libSkinOrder()) {
    const b = core.el("button", "libSkinChip"); b.type = "button"; b.dataset.skin = id;
    b.textContent = skinText(id);
    b.classList.toggle("on", id === core.settings.libSkin);
    b.setAttribute("aria-pressed", String(id === core.settings.libSkin));
    b.addEventListener("click", () => { applyLibSkin(id); flashSkin(skinText(id)); });
    bar.append(b);
  }
  const rnd = core.el("button", "libSkinChip libSkinRand", tr("libSkinRand")); rnd.type = "button";
  rnd.addEventListener("click", () => { randomLibSkin(); flashSkin(skinText(core.settings.libSkin)); });
  bar.append(rnd);
}
function buildSelect() {
  const sel = core.$("libSkinSelect"); if (!sel) return;
  sel.textContent = "";
  for (const id of libSkinOrder()) {
    const o = document.createElement("option"); o.value = id; o.textContent = skinText(id);
    sel.append(o);
  }
  sel.value = hasLibSkin(core.settings.libSkin) ? core.settings.libSkin : "player";
}
function applyQuick() {
  const b = core.$("libSkinBtn");
  const on = core.settings.libSkinQuick !== false;
  if (b) b.hidden = !on;
  if (!on) openBar(false);
  const chk = core.$("libSkinQuickChk"); if (chk) chk.checked = on;
}
let flashTimer = 0;
function flashSkin(name) {
  const box = core.$("libSkinNote");
  if (!box) return;
  box.textContent = tr("libSkinApplied", { name });
  box.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { box.hidden = true; }, 2200);
}

/* ============ 画面の組み立て（全部のファイルを読み終えてから） ============ */
addEventListener("DOMContentLoaded", () => {
  /* 知らないスキン名（古い設定・壊れた設定ファイル）は player として扱う */
  applyLibSkin(hasLibSkin(core.settings.libSkin) ? core.settings.libSkin : "player", { save:false });
  buildBar(); buildSelect(); applyQuick();

  const b = core.$("libSkinBtn");
  if (b) {
    b.textContent = "🎨";
    b.title = tr("libSkinBtnTitle"); b.setAttribute("aria-label", b.title);
    b.setAttribute("aria-haspopup", "true");
    b.addEventListener("click", () => openBar());
  }
  const sel = core.$("libSkinSelect");
  if (sel) sel.addEventListener("change", e => applyLibSkin(e.target.value));
  const chk = core.$("libSkinQuickChk");
  if (chk) chk.addEventListener("change", e => {
    core.settings.libSkinQuick = !!e.target.checked; core.saveUserPrefs(); applyQuick();
    if (e.target.checked) openBar(true);
  });

  /* 帯の外を押したら閉じる（開きっぱなしにしない） */
  document.addEventListener("click", e => {
    if (!barOpen()) return;
    if (e.target.closest("#libSkinBar") || e.target.closest("#libSkinBtn")) return;
    openBar(false);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") openBar(false); });

  on("language", () => {
    buildBar(); buildSelect(); applyQuick();
    if (b) { b.title = tr("libSkinBtnTitle"); b.setAttribute("aria-label", b.title); }
  });
});

/* ============ 窓口（テスト・コンソールから叩けるように） ============ */
window.TrkLibSkins = {
  version: 1,
  skins: skinIds,
  skin: () => core.settings.libSkin,
  selectSkin: id => applyLibSkin(id),
  random: randomLibSkin,
  open: openBar,
  barOpen
};
core.on("displayMode", () => { buildBar(); buildSelect(); });
})();
/* ✅ lib-skins.js 完了 */
