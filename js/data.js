(() => {
// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ trk! 統合版：データ（スキン・レイアウト・難易度・マスコット登録） ============
   内蔵スキンを増やすときは SKINS に1項目足すだけで、設定画面の一覧に出ます。
     ui     : メニュー画面の色（CSS変数）。--ui-bg は linear-gradient(…) も可（グラデーション）
     cat    : （任意）スキンの棚での絞り込み用タグ（basic / miku / dark / light / grad / fun / access / life の配列）
     game   : プレイ画面の色
     shapes : [ドン, カッ] の「おすすめ」ノーツ形状（circle / diamond / square）
     video  : 背景映像に掛けるCSSフィルター
     font   : （任意）フォント
     mascot : （任意）スキン標準のマスコット
   キャラクターのマスコットは registerMascot() で外から追加します（見本：js/characters/miku.js）。 */
"use strict";

const W = 1920, H = 1080, TAU = Math.PI * 2;
const FONT_DEFAULT = 'system-ui,-apple-system,"Segoe UI","Noto Sans JP","Noto Sans SC","Noto Sans KR",sans-serif';
const HEX = /^#[0-9a-f]{6}$/i;
const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

/* ---------- 色の計算 ---------- */
function toHex(v, fb = "#888888") {
  v = String(v || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return "#" + v.slice(1).split("").map(c => c + c).join("").toLowerCase();
  const m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return "#" + m.slice(1, 4).map(x => Math.min(255, +x).toString(16).padStart(2, "0")).join("");
  return fb;
}
function hexToRgba(hex, a) {
  const h = toHex(hex), n = parseInt(h.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
function luminance(hex) {
  const n = parseInt(toHex(hex).slice(1), 16);
  const c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}
/* 🔤 アクセント色を「小さな文字」に使うときの色（CSS変数 --ui-accent-ink。core.js の applySkin が毎回入れる）。
   設定画面でいちばん濃く重なる面（カード --ui-panel の上に --ui-soft が2枚＝パネルの中の小欄）でも
   4.5:1（WCAG AA）を満たすまで、アクセントを本文の色（--ui-text）へ5%ずつ寄せる。足りていれば元の色のまま。
   --ui-bg がグラデーションのときは、ほぼ不透明なカードの色で代える（透ける分は数%）。 */
function parseUiColor(v) {
  const t = String(v || "").trim();
  if (/^#[0-9a-f]{3}$/i.test(t) || /^#[0-9a-f]{6}$/i.test(t)) { const n = parseInt(toHex(t).slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, 1]; }
  const m = t.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (!m) return null;
  const c = m.slice(1, 4).map(x => Math.min(255, Number(x)));
  return [c[0], c[1], c[2], m[4] === undefined ? 1 : Math.max(0, Math.min(1, Number(m[4])))];
}
function overUiColor(top, base) {
  const a = top[3];
  return [top[0] * a + base[0] * (1 - a), top[1] * a + base[1] * (1 - a), top[2] * a + base[2] * (1 - a), 1];
}
function uiContrast(a, b) {
  const lum = c => { const v = c.slice(0, 3).map(x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
function accentInkBackground(ui) {
  const panel = parseUiColor(ui["--ui-panel"]), soft = parseUiColor(ui["--ui-soft"]) || [0, 0, 0, 0];
  if (!panel) return null;
  const bg = parseUiColor(ui["--ui-bg"]);
  const card = overUiColor(panel, bg && bg[3] === 1 ? bg : [panel[0], panel[1], panel[2], 1]);
  return overUiColor(soft, overUiColor(soft, card));
}
function accentInk(ui) {
  const accent = parseUiColor(ui && ui["--ui-accent"]), text = parseUiColor(ui && ui["--ui-text"]);
  const back = ui && accentInkBackground(ui);
  if (!accent || !text || !back) return (ui && (ui["--ui-accent"] || ui["--ui-text"])) || "#888888";
  for (let step = 0; step <= 20; step++) {
    const t = step / 20;
    const ink = [0, 1, 2].map(i => Math.round(accent[i] + (text[i] - accent[i]) * t));
    if (uiContrast(ink.concat(1), back) >= 4.6) return step ? "#" + ink.map(v => v.toString(16).padStart(2, "0")).join("") : ui["--ui-accent"];
  }
  return ui["--ui-text"];
}
function mixHex(a, b, t) {
  const ch = h => { const n = parseInt(toHex(h).slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const ca = ch(a), cb = ch(b);
  return "#" + ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/* ---------- 内蔵スキン（キャラクターに依存しないもの） ---------- */
const SKINS = {
  shadow: {
    cat:["basic"],
    label:{ja:"シャドウ",en:"Shadow",zh:"暗影",ko:"섀도우"},
    desc:{ja:"白黒シルエットの原点",en:"The original monochrome silhouette",zh:"原版黑白剪影",ko:"오리지널 흑백 실루엣"},
    ui:{"--ui-bg":"#07080d","--ui-panel":"rgba(14,16,24,.96)","--ui-soft":"rgba(255,255,255,.05)","--ui-text":"#f4f4f8",
      "--ui-muted":"#a9abb8","--ui-border":"rgba(255,255,255,.16)","--ui-button":"#1a1d29","--ui-button-hover":"#262b3b",
      "--ui-field":"#0f111a","--ui-accent":"#ff3b55","--ui-on-accent":"#000000","--ui-gold":"#ffd166",
      "--ui-shadow":"0 24px 80px rgba(0,0,0,.55)","--ui-glow":"rgba(255,59,85,.14)"},
    game:{don:"#ff3b55",ka:"#55aaff",stage:"#050505",lane:"rgba(0,0,0,.52)",track:"rgba(255,255,255,.22)",ink:"#ffffff",
      inkShadow:"rgba(0,0,0,.85)",noteBorder:"#ffffff",panel:"rgba(10,11,16,.94)",perfect:"#ffd166",good:"#ffffff",miss:"#9aa0aa",glow:false},
    shapes:["circle","circle"], video:"grayscale(1) contrast(1.7)"
  },
  daylight: {
    cat:["basic"],
    label:{ja:"デイライト",en:"Daylight",zh:"日光",ko:"데이라이트"},
    desc:{ja:"明るく見やすいライトテーマ",en:"Clean, bright light theme",zh:"明亮清爽的浅色主题",ko:"밝고 깔끔한 라이트 테마"},
    ui:{"--ui-bg":"#eef1f6","--ui-panel":"rgba(255,255,255,.97)","--ui-soft":"rgba(20,30,50,.045)","--ui-text":"#1f2433",
      "--ui-muted":"#5b6475","--ui-border":"rgba(20,30,50,.16)","--ui-button":"#f3f5f9","--ui-button-hover":"#e5e9f1",
      "--ui-field":"#ffffff","--ui-accent":"#e0294a","--ui-on-accent":"#ffffff","--ui-gold":"#c47f00",
      "--ui-shadow":"0 24px 70px rgba(30,40,60,.16)","--ui-glow":"rgba(224,41,74,.10)"},
    game:{don:"#f0384f",ka:"#2f8cff",stage:"#e6eaf0",lane:"rgba(255,255,255,.80)",track:"rgba(20,30,50,.20)",ink:"#1f2433",
      inkShadow:"rgba(255,255,255,.9)",noteBorder:"#ffffff",panel:"rgba(246,248,251,.96)",perfect:"#d38f00",good:"#1f2433",miss:"#7a8394",glow:false},
    shapes:["circle","circle"], video:"grayscale(1) contrast(1.25) brightness(1.12)"
  },
  neon: {
    cat:["basic"],
    label:{ja:"ネオンアーケード",en:"Neon Arcade",zh:"霓虹街机",ko:"네온 아케이드"},
    desc:{ja:"シンセウェーブ風の発光",en:"Synthwave glow",zh:"合成波霓虹光效",ko:"신스웨이브 네온"},
    ui:{"--ui-bg":"#0b0418","--ui-panel":"rgba(20,8,40,.95)","--ui-soft":"rgba(255,43,214,.06)","--ui-text":"#fbefff",
      "--ui-muted":"#b9a3d6","--ui-border":"rgba(255,43,214,.30)","--ui-button":"#1d0b38","--ui-button-hover":"#2c1152",
      "--ui-field":"#12062a","--ui-accent":"#ff2bd6","--ui-on-accent":"#000000","--ui-gold":"#ffe94d",
      "--ui-shadow":"0 0 60px rgba(255,43,214,.25)","--ui-glow":"rgba(0,229,255,.18)"},
    game:{don:"#ff2bd6",ka:"#00e5ff",stage:"#0b0418",lane:"rgba(10,0,30,.58)",track:"rgba(0,229,255,.32)",ink:"#fbefff",
      inkShadow:"rgba(255,43,214,.8)",noteBorder:"#ffffff",panel:"rgba(16,5,34,.94)",perfect:"#ffe94d",good:"#e6f7ff",miss:"#8f7aa8",glow:true},
    shapes:["circle","circle"], video:"grayscale(1) contrast(1.5) sepia(1) hue-rotate(230deg) saturate(2.2) brightness(.8)",
    font:'"Trebuchet MS","Avenir Next",system-ui,sans-serif'
  },
  sakura: {
    cat:["basic"],
    label:{ja:"サクラ",en:"Sakura",zh:"樱花",ko:"사쿠라"},
    desc:{ja:"やわらかい桜色",en:"Soft cherry-blossom pastel",zh:"柔和樱花色",ko:"부드러운 벚꽃 파스텔"},
    ui:{"--ui-bg":"#fff0f4","--ui-panel":"rgba(255,250,252,.97)","--ui-soft":"rgba(214,77,128,.06)","--ui-text":"#3a2330",
      "--ui-muted":"#7c5968","--ui-border":"rgba(214,77,128,.24)","--ui-button":"#ffe6ee","--ui-button-hover":"#ffd5e2",
      "--ui-field":"#ffffff","--ui-accent":"#e0568a","--ui-on-accent":"#000000","--ui-gold":"#d9782a",
      "--ui-shadow":"0 24px 70px rgba(160,60,100,.15)","--ui-glow":"rgba(224,86,138,.14)"},
    game:{don:"#ff5d8f",ka:"#5aa9e6",stage:"#ffeef3",lane:"rgba(255,244,248,.84)",track:"rgba(224,86,138,.28)",ink:"#3a2330",
      inkShadow:"rgba(255,255,255,.9)",noteBorder:"#ffffff",panel:"rgba(255,246,249,.96)",perfect:"#e0802f",good:"#3a2330",miss:"#a58b97",glow:false},
    shapes:["circle","circle"], video:"sepia(.25) saturate(1.15) brightness(1.06)"
  },
  terminal: {
    cat:["basic"],
    label:{ja:"ターミナル",en:"Terminal",zh:"终端",ko:"터미널"},
    desc:{ja:"レトロCRT・走査線",en:"Retro CRT with scanlines",zh:"复古CRT扫描线",ko:"레트로 CRT 주사선"},
    ui:{"--ui-bg":"#020a04","--ui-panel":"rgba(3,14,6,.96)","--ui-soft":"rgba(57,255,20,.05)","--ui-text":"#b8ffb0",
      "--ui-muted":"#5fae63","--ui-border":"rgba(57,255,20,.30)","--ui-button":"#04180a","--ui-button-hover":"#072a10",
      "--ui-field":"#010802","--ui-accent":"#39ff14","--ui-on-accent":"#021a06","--ui-gold":"#ffb000",
      "--ui-shadow":"0 0 50px rgba(57,255,20,.15)","--ui-glow":"rgba(57,255,20,.12)"},
    game:{don:"#ffb000",ka:"#39ff14",stage:"#010501",lane:"rgba(0,10,2,.72)",track:"rgba(57,255,20,.30)",ink:"#b8ffb0",
      inkShadow:"rgba(0,0,0,.9)",noteBorder:"#e9ffe4",panel:"rgba(2,12,4,.95)",perfect:"#ffb000",good:"#b8ffb0",miss:"#3d7a40",glow:true,scanlines:true},
    shapes:["square","square"], video:"grayscale(1) contrast(1.5) sepia(1) hue-rotate(70deg) saturate(3) brightness(.7)",
    font:'"Cascadia Mono","Consolas","Menlo","Noto Sans Mono",monospace'
  },
  clarity: {
    cat:["basic"],
    label:{ja:"クラリティ",en:"Clarity",zh:"清晰",ko:"클래리티"},
    desc:{ja:"色覚多様性に配慮・形でも区別",en:"Colorblind-safe, shape-coded",zh:"色觉友好·形状区分",ko:"색각 친화 · 모양으로 구분"},
    ui:{"--ui-bg":"#000000","--ui-panel":"#0d0d0d","--ui-soft":"rgba(255,255,255,.06)","--ui-text":"#ffffff",
      "--ui-muted":"#cfcfcf","--ui-border":"rgba(255,255,255,.45)","--ui-button":"#1a1a1a","--ui-button-hover":"#2a2a2a",
      "--ui-field":"#000000","--ui-accent":"#E69F00","--ui-on-accent":"#000000","--ui-gold":"#F0E442",
      "--ui-shadow":"none","--ui-glow":"rgba(230,159,0,.18)"},
    game:{don:"#E69F00",ka:"#56B4E9",stage:"#000000",lane:"rgba(0,0,0,.78)",track:"rgba(255,255,255,.42)",ink:"#ffffff",
      inkShadow:"#000000",noteBorder:"#ffffff",panel:"rgba(0,0,0,.95)",perfect:"#F0E442",good:"#ffffff",miss:"#999999",glow:false},
    shapes:["circle","diamond"], video:"grayscale(1) brightness(.55)"
  },
  buddy: {
    cat:["basic"],
    label:{ja:"オレンジ相棒",en:"Orange Buddy",zh:"橙色搭档",ko:"오렌지 버디"},
    desc:{ja:"AIあるあるミームで応援",en:"Cheers you on with AI-assistant memes",zh:"用AI助手梗为你加油",ko:"AI 어시스턴트 밈으로 응원"},
    ui:{"--ui-bg":"#17110d","--ui-panel":"rgba(34,24,18,.96)","--ui-soft":"rgba(255,140,60,.06)","--ui-text":"#fff3e6",
      "--ui-muted":"#c9ad96","--ui-border":"rgba(255,140,60,.28)","--ui-button":"#2a1d15","--ui-button-hover":"#3a271b",
      "--ui-field":"#120c09","--ui-accent":"#ff7a2f","--ui-on-accent":"#1a0d05","--ui-gold":"#ffc861",
      "--ui-shadow":"0 24px 80px rgba(0,0,0,.55)","--ui-glow":"rgba(255,122,47,.16)"},
    game:{don:"#ff6a1f",ka:"#46c2cb",stage:"#120c09",lane:"rgba(30,18,10,.62)",track:"rgba(255,150,80,.30)",ink:"#fff3e6",
      inkShadow:"rgba(0,0,0,.85)",noteBorder:"#ffffff",panel:"rgba(28,18,12,.95)",perfect:"#ffc861",good:"#fff3e6",miss:"#9c8676",glow:false},
    shapes:["circle","circle"], video:"sepia(.5) saturate(1.4) hue-rotate(-10deg) brightness(.75)",
    font:'"Trebuchet MS","Avenir Next",system-ui,sans-serif', mascot:"buddy"
  },
  snowfield: {   // 標準マスコット（冬服ミク）は characters/miku.js があるときだけ設定されます
    cat:["basic"],
    label:{ja:"スノーフィールド",en:"Snowfield",zh:"雪原",ko:"스노필드"},
    desc:{ja:"雪景色のライトテーマ",en:"Snowy light theme",zh:"雪景浅色主题",ko:"눈 풍경 라이트 테마"},
    ui:{"--ui-bg":"#eef5fb","--ui-panel":"rgba(255,255,255,.96)","--ui-soft":"rgba(40,90,140,.05)","--ui-text":"#1d3550",
      "--ui-muted":"#566b83","--ui-border":"rgba(40,90,140,.18)","--ui-button":"#f1f6fb","--ui-button-hover":"#e1ecf6",
      "--ui-field":"#ffffff","--ui-accent":"#2f8fd8","--ui-on-accent":"#000000","--ui-gold":"#c2477e",
      "--ui-shadow":"0 24px 70px rgba(40,80,120,.16)","--ui-glow":"rgba(47,143,216,.12)"},
    game:{don:"#ff5d7a",ka:"#3a9be0",stage:"#e8f1f8",lane:"rgba(255,255,255,.82)",track:"rgba(40,90,140,.22)",ink:"#1d3550",
      inkShadow:"rgba(255,255,255,.9)",noteBorder:"#ffffff",panel:"rgba(244,249,253,.96)",perfect:"#c2477e",good:"#1d3550",miss:"#8aa0b6",glow:false},
    shapes:["circle","circle"], video:"grayscale(.6) brightness(1.1) contrast(1.1) hue-rotate(180deg) saturate(.6)"
  },
  /* ---------- 追加プリセット（2026-10 スキンの棚と同時に追加。グラデは --ui-bg / game.stage へ直書き） ---------- */
  garden: {
    cat:["light"],
    label:{ja:"ミントガーデン",en:"Mint Garden",zh:"薄荷花园",ko:"민트 가든"},
    desc:{ja:"緑と白のすっきりテーマ",en:"Crisp green and white",zh:"绿与白的清爽主题",ko:"그린과 화이트의 산뜻한 테마"},
    ui:{"--ui-bg":"#eef6ef","--ui-panel":"rgba(255,255,255,.97)","--ui-soft":"rgba(30,110,70,.05)","--ui-text":"#1e3527",
      "--ui-muted":"#516a5a","--ui-border":"rgba(30,110,70,.22)","--ui-button":"#e2f0e5","--ui-button-hover":"#d0e8d6",
      "--ui-field":"#ffffff","--ui-accent":"#2e9e5b","--ui-on-accent":"#000000","--ui-gold":"#e0853a",
      "--ui-shadow":"0 24px 70px rgba(30,80,50,.14)","--ui-glow":"rgba(46,158,91,.12)"},
    game:{don:"#ff5d7a",ka:"#2e9e5b",stage:"#edf6ee",lane:"rgba(255,255,255,.84)",track:"rgba(46,158,91,.24)",ink:"#1e3527",
      inkShadow:"rgba(255,255,255,.9)",noteBorder:"#ffffff",panel:"rgba(246,250,246,.96)",perfect:"#e0853a",good:"#1e3527",miss:"#93ac9c",glow:false},
    shapes:["circle","circle"], video:"saturate(1.05) brightness(1.05)"
  },
  strawberry: {
    cat:["light","grad"],
    label:{ja:"ストロベリーホイップ",en:"Strawberry Whip",zh:"草莓奶昔",ko:"스트로베리 휩"},
    desc:{ja:"いちごミルクのやさしいグラデ",en:"A gentle strawberry-milk gradient",zh:"草莓牛奶般的柔和渐变",ko:"딸기우유 같은 부드러운 그라데이션"},
    ui:{"--ui-bg":"linear-gradient(180deg,#fff8f4,#ffe9f0)","--ui-panel":"rgba(255,251,248,.97)","--ui-soft":"rgba(224,86,120,.06)","--ui-text":"#40222e",
      "--ui-muted":"#845c6b","--ui-border":"rgba(224,86,120,.26)","--ui-button":"#ffeef2","--ui-button-hover":"#ffdfe8",
      "--ui-field":"#fffdfa","--ui-accent":"#e0568a","--ui-on-accent":"#000000","--ui-gold":"#d9782a",
      "--ui-shadow":"0 24px 70px rgba(160,60,100,.14)","--ui-glow":"rgba(224,86,120,.13)"},
    game:{don:"#e0568a",ka:"#5a9ec9",stage:"linear-gradient(180deg,#fff3ec,#ffdee9)",lane:"rgba(255,246,242,.84)",track:"rgba(224,86,120,.26)",ink:"#40222e",
      inkShadow:"rgba(255,255,255,.9)",noteBorder:"#ffffff",panel:"rgba(255,247,244,.96)",perfect:"#d9782a",good:"#40222e",miss:"#ab8b96",glow:false},
    shapes:["circle","circle"], video:"sepia(.15) saturate(1.1) brightness(1.05)"
  },
  melonberry: {
    cat:["light","grad","fun"],
    label:{ja:"メロンベリー",en:"Melon Berry",zh:"蜜瓜莓果",ko:"멜론베리"},
    desc:{ja:"緑×ピンクのポップな横グラデ",en:"A pop green-and-pink side gradient",zh:"绿×粉的流行横向渐变",ko:"그린×핑크 팝한 가로 그라데이션"},
    ui:{"--ui-bg":"linear-gradient(90deg,#eaf8ee,#ffeef5)","--ui-panel":"rgba(255,255,255,.96)","--ui-soft":"rgba(255,107,157,.06)","--ui-text":"#263428",
      "--ui-muted":"#5c6d61","--ui-border":"rgba(46,158,91,.24)","--ui-button":"#eaf5ee","--ui-button-hover":"#ddeee4",
      "--ui-field":"#fefffe","--ui-accent":"#ff6b9d","--ui-on-accent":"#000000","--ui-gold":"#2e9e5b",
      "--ui-shadow":"0 24px 70px rgba(60,110,80,.13)","--ui-glow":"rgba(255,107,157,.12)"},
    game:{don:"#ff6b9d",ka:"#2e9e5b",stage:"linear-gradient(90deg,#e6f7ea,#ffe8f2)",lane:"rgba(255,255,255,.82)",track:"rgba(255,107,157,.26)",ink:"#263428",
      inkShadow:"rgba(255,255,255,.9)",noteBorder:"#ffffff",panel:"rgba(250,253,251,.96)",perfect:"#2e9e5b",good:"#263428",miss:"#9aab9f",glow:false},
    shapes:["circle","circle"], video:"saturate(1.1) brightness(1.06)"
  },
  dusk: {
    cat:["dark","grad"],
    label:{ja:"宵闇",en:"Duskfall",zh:"暮色",ko:"황혼"},
    desc:{ja:"紫の夜に沈むグラデ",en:"Sinking into a purple night",zh:"沉入紫色夜幕的渐变",ko:"보라빛 밤으로 가라앉는 그라데이션"},
    ui:{"--ui-bg":"linear-gradient(180deg,#241b4d,#0e1430)","--ui-panel":"rgba(20,17,44,.95)","--ui-soft":"rgba(157,140,255,.06)","--ui-text":"#eef0ff",
      "--ui-muted":"#a5a8cc","--ui-border":"rgba(150,140,255,.30)","--ui-button":"#1c1940","--ui-button-hover":"#282356",
      "--ui-field":"#131030","--ui-accent":"#9d8cff","--ui-on-accent":"#141033","--ui-gold":"#ffb84d",
      "--ui-shadow":"0 0 60px rgba(120,100,255,.20)","--ui-glow":"rgba(157,140,255,.16)"},
    game:{don:"#ff6b8f",ka:"#9d8cff",stage:"linear-gradient(180deg,#1a1438,#0a0f26)",lane:"rgba(12,10,30,.66)",track:"rgba(157,140,255,.30)",ink:"#eef0ff",
      inkShadow:"rgba(0,0,0,.85)",noteBorder:"#ffffff",panel:"rgba(18,15,40,.95)",perfect:"#ffb84d",good:"#eef0ff",miss:"#6f7396",glow:true},
    shapes:["circle","circle"], video:"grayscale(1) contrast(1.4) sepia(1) hue-rotate(220deg) saturate(1.8) brightness(.7)"
  },
  abyss: {
    cat:["dark","grad"],
    label:{ja:"深海",en:"Deep Sea",zh:"深海",ko:"심해"},
    desc:{ja:"青緑の深い海の底",en:"The teal depths of the ocean",zh:"青绿色的深海之底",ko:"청록빛 깊은 바다 밑바닥"},
    ui:{"--ui-bg":"linear-gradient(180deg,#062a33,#010a10)","--ui-panel":"rgba(6,32,40,.95)","--ui-soft":"rgba(62,230,200,.06)","--ui-text":"#e6fbff",
      "--ui-muted":"#8fb8c1","--ui-border":"rgba(64,220,220,.28)","--ui-button":"#0a3540","--ui-button-hover":"#0f4753",
      "--ui-field":"#052028","--ui-accent":"#3ee6c8","--ui-on-accent":"#032a24","--ui-gold":"#ffd166",
      "--ui-shadow":"0 0 60px rgba(62,230,200,.16)","--ui-glow":"rgba(62,230,200,.14)"},
    game:{don:"#ff7a6b",ka:"#3ee6c8",stage:"linear-gradient(180deg,#052028,#000609)",lane:"rgba(2,16,22,.68)",track:"rgba(62,230,200,.30)",ink:"#e6fbff",
      inkShadow:"rgba(0,0,0,.85)",noteBorder:"#ffffff",panel:"rgba(5,26,33,.95)",perfect:"#ffd166",good:"#e6fbff",miss:"#5c8188",glow:true},
    shapes:["circle","circle"], video:"grayscale(.7) hue-rotate(160deg) saturate(1.3) brightness(.55) contrast(1.2)"
  },
  ember: {
    cat:["dark","grad"],
    label:{ja:"残炎",en:"Embers",zh:"余烬",ko:"잔불"},
    desc:{ja:"燃えさかる赤と灰の煙",en:"Smoldering red with a wisp of ash",zh:"燃烧的赤红与灰烟",ko:"타오르는 붉은빛과 재의 연기"},
    ui:{"--ui-bg":"linear-gradient(180deg,#3a0f0a,#120303)","--ui-panel":"rgba(40,14,10,.95)","--ui-soft":"rgba(255,106,61,.07)","--ui-text":"#fff1ea",
      "--ui-muted":"#c39a8c","--ui-border":"rgba(255,110,60,.30)","--ui-button":"#2e0f0a","--ui-button-hover":"#3f150d",
      "--ui-field":"#200806","--ui-accent":"#ff6a3d","--ui-on-accent":"#2a0b04","--ui-gold":"#ffc861",
      "--ui-shadow":"0 0 60px rgba(255,106,61,.18)","--ui-glow":"rgba(255,106,61,.15)"},
    game:{don:"#ff5a2e",ka:"#9fc3e0",stage:"linear-gradient(180deg,#2a0b07,#0c0202)",lane:"rgba(24,8,6,.68)",track:"rgba(255,106,61,.30)",ink:"#fff1ea",
      inkShadow:"rgba(0,0,0,.85)",noteBorder:"#ffffff",panel:"rgba(32,11,8,.95)",perfect:"#ffd166",good:"#fff1ea",miss:"#8a6a5e",glow:true},
    shapes:["circle","circle"], video:"sepia(.6) saturate(1.5) hue-rotate(-15deg) brightness(.6) contrast(1.25)"
  },
  dawn: {
    cat:["light","grad"],
    label:{ja:"朝焼け",en:"Daybreak",zh:"朝霞",ko:"새벽빛"},
    desc:{ja:"白から桃色にひろがる朝",en:"White melting into peach morning light",zh:"从纯白铺开到桃色的清晨",ko:"흰색에서 복숭아빛으로 퍼지는 아침"},
    ui:{"--ui-bg":"linear-gradient(180deg,#fdfbf7,#ffe3d3)","--ui-panel":"rgba(255,253,250,.96)","--ui-soft":"rgba(224,106,74,.06)","--ui-text":"#3a2c28",
      "--ui-muted":"#78625b","--ui-border":"rgba(224,120,80,.24)","--ui-button":"#fbf0e8","--ui-button-hover":"#f6e3d6",
      "--ui-field":"#fffdfa","--ui-accent":"#e06a4a","--ui-on-accent":"#000000","--ui-gold":"#c47f2a",
      "--ui-shadow":"0 24px 70px rgba(160,90,60,.14)","--ui-glow":"rgba(224,106,74,.12)"},
    game:{don:"#e06a4a",ka:"#5a9ec9",stage:"linear-gradient(180deg,#fdf6ee,#ffdcc7)",lane:"rgba(255,250,244,.82)",track:"rgba(224,106,74,.22)",ink:"#3a2c28",
      inkShadow:"rgba(255,255,255,.9)",noteBorder:"#ffffff",panel:"rgba(254,249,244,.96)",perfect:"#c47f2a",good:"#3a2c28",miss:"#a8907f",glow:false},
    shapes:["circle","circle"], video:"sepia(.2) saturate(1.15) brightness(1.08)"
  },
  midnightsun: {
    cat:["light","grad"],
    label:{ja:"白夜",en:"Midnight Sun",zh:"白夜",ko:"백야"},
    desc:{ja:"地平線の金色の光",en:"Gold light on the horizon",zh:"地平线上的金色光芒",ko:"지평선의 금빛"},
    ui:{"--ui-bg":"linear-gradient(0deg,#fff7df,#fdfdfa)","--ui-panel":"rgba(255,255,250,.96)","--ui-soft":"rgba(184,145,46,.06)","--ui-text":"#33301f",
      "--ui-muted":"#716a57","--ui-border":"rgba(160,130,50,.26)","--ui-button":"#faf5e4","--ui-button-hover":"#f3ecd4",
      "--ui-field":"#fffdf6","--ui-accent":"#b8912e","--ui-on-accent":"#000000","--ui-gold":"#e07a4a",
      "--ui-shadow":"0 24px 70px rgba(140,110,40,.14)","--ui-glow":"rgba(184,145,46,.13)"},
    game:{don:"#e07a4a",ka:"#4a7fa8",stage:"linear-gradient(0deg,#fdf3d8,#ffffff)",lane:"rgba(255,255,248,.82)",track:"rgba(184,145,46,.24)",ink:"#33301f",
      inkShadow:"rgba(255,255,255,.9)",noteBorder:"#ffffff",panel:"rgba(254,252,244,.96)",perfect:"#b8912e",good:"#33301f",miss:"#9a9179",glow:false},
    shapes:["circle","circle"], video:"brightness(1.1) saturate(.9) contrast(1.02)"
  },
  pastelloop: {
    cat:["light","grad","fun"],
    label:{ja:"パステルループ",en:"Pastel Loop",zh:"粉彩循环",ko:"파스텔 루프"},
    desc:{ja:"ぴかぴかの3色パステル",en:"Three pastels in a soft loop",zh:"三色粉彩的柔和循环",ko:"삼색 파스텔의 부드러운 순환"},
    ui:{"--ui-bg":"linear-gradient(180deg,#ffeef5,#eefaf1,#eef0fb)","--ui-panel":"rgba(255,255,255,.95)","--ui-soft":"rgba(183,139,224,.06)","--ui-text":"#3a3346",
      "--ui-muted":"#6b657b","--ui-border":"rgba(150,130,200,.24)","--ui-button":"#f6f2fb","--ui-button-hover":"#ede6f7",
      "--ui-field":"#ffffff","--ui-accent":"#b78be0","--ui-on-accent":"#000000","--ui-gold":"#f2a3c0",
      "--ui-shadow":"0 24px 70px rgba(120,100,160,.12)","--ui-glow":"rgba(183,139,224,.13)"},
    game:{don:"#f27ba5",ka:"#7ecbb0",stage:"linear-gradient(180deg,#fff0f6,#eefaf3,#eef1fc)",lane:"rgba(255,255,255,.84)",track:"rgba(183,139,224,.26)",ink:"#3a3346",
      inkShadow:"rgba(255,255,255,.9)",noteBorder:"#ffffff",panel:"rgba(253,252,255,.96)",perfect:"#f2a3c0",good:"#3a3346",miss:"#a49db5",glow:false},
    shapes:["circle","circle"], video:"brightness(1.06) saturate(1.05)"
  },
  prism: {
    cat:["grad","fun"],
    label:{ja:"プリズム",en:"Prism",zh:"棱镜",ko:"프리즘"},
    desc:{ja:"横に走る宝石色の虹",en:"A jewel-tone rainbow across the screen",zh:"横贯屏幕的宝石色彩虹",ko:"가로지르는 보석빛 무지개"},
    ui:{"--ui-bg":"linear-gradient(90deg,#241539,#123041,#153829,#38300f,#3b1526)","--ui-panel":"rgba(18,16,32,.94)","--ui-soft":"rgba(255,255,255,.05)","--ui-text":"#f4f2ff",
      "--ui-muted":"#b0aecb","--ui-border":"rgba(255,255,255,.22)","--ui-button":"#201a35","--ui-button-hover":"#2c2450",
      "--ui-field":"#151126","--ui-accent":"#f0eeff","--ui-on-accent":"#241a3a","--ui-gold":"#ffd166",
      "--ui-shadow":"0 24px 80px rgba(0,0,0,.55)","--ui-glow":"rgba(240,238,255,.12)"},
    game:{don:"#ff5d8f",ka:"#5ad0e8",stage:"linear-gradient(90deg,#1a0f2e,#0e2233,#0e2e22,#2e2a0c,#33101f)",lane:"rgba(10,8,22,.72)",track:"rgba(255,255,255,.26)",ink:"#f4f2ff",
      inkShadow:"rgba(0,0,0,.85)",noteBorder:"#ffffff",panel:"rgba(16,14,30,.95)",perfect:"#ffd166",good:"#f4f2ff",miss:"#6f6d8c",glow:true},
    shapes:["circle","diamond"], video:"saturate(1.4) contrast(1.2) brightness(.75)"
  },
  laser: {
    cat:["dark","grad","fun"],
    label:{ja:"レーザーナイト",en:"Laser Night",zh:"激光之夜",ko:"레이저 나이트"},
    desc:{ja:"闇に走る光の帯",en:"Beams of light through the dark",zh:"划破黑暗的光带",ko:"어둠을 가르는 빛의 띠"},
    ui:{"--ui-bg":"linear-gradient(270deg,#06131f,#0a0616)","--ui-panel":"rgba(8,14,24,.95)","--ui-soft":"rgba(61,240,255,.06)","--ui-text":"#eafaff",
      "--ui-muted":"#8fa8bb","--ui-border":"rgba(61,240,255,.28)","--ui-button":"#0b1826","--ui-button-hover":"#102436",
      "--ui-field":"#060e18","--ui-accent":"#3df0ff","--ui-on-accent":"#032027","--ui-gold":"#ff3df0",
      "--ui-shadow":"0 0 60px rgba(61,240,255,.18)","--ui-glow":"rgba(61,240,255,.14)"},
    game:{don:"#ff3df0",ka:"#3df0ff",stage:"linear-gradient(270deg,#050e18,#080512)",lane:"rgba(4,10,18,.70)",track:"rgba(61,240,255,.30)",ink:"#eafaff",
      inkShadow:"rgba(0,0,0,.85)",noteBorder:"#ffffff",panel:"rgba(7,13,22,.95)",perfect:"#ffe94d",good:"#eafaff",miss:"#5f7484",glow:true},
    shapes:["circle","circle"], video:"grayscale(.5) hue-rotate(180deg) saturate(1.6) brightness(.6) contrast(1.3)"
  },
  aurora: {
    cat:["dark","grad","fun"],
    label:{ja:"オーロラ",en:"Aurora",zh:"极光",ko:"오로라"},
    desc:{ja:"緑から紫への夜空の幕",en:"A curtain from green to violet",zh:"从绿到紫的夜空帷幕",ko:"초록에서 보라로 이어지는 밤하늘 장막"},
    ui:{"--ui-bg":"linear-gradient(0deg,#0e3a2c,#101d44)","--ui-panel":"rgba(10,26,30,.95)","--ui-soft":"rgba(80,255,190,.06)","--ui-text":"#eafff8",
      "--ui-muted":"#93c0b4","--ui-border":"rgba(80,255,190,.30)","--ui-button":"#0c2e2c","--ui-button-hover":"#124238",
      "--ui-field":"#082020","--ui-accent":"#50ffbe","--ui-on-accent":"#032119","--ui-gold":"#c89bff",
      "--ui-shadow":"0 0 60px rgba(80,255,190,.16)","--ui-glow":"rgba(80,255,190,.13)"},
    game:{don:"#ff8abf",ka:"#50ffbe",stage:"linear-gradient(0deg,#0b2f24,#0c1a38)",lane:"rgba(4,18,20,.66)",track:"rgba(80,255,190,.30)",ink:"#eafff8",
      inkShadow:"rgba(0,0,0,.85)",noteBorder:"#ffffff",panel:"rgba(9,24,28,.95)",perfect:"#c89bff",good:"#eafff8",miss:"#5f8a80",glow:true},
    shapes:["circle","circle"], video:"grayscale(.6) hue-rotate(120deg) saturate(1.4) brightness(.65) contrast(1.2)"
  },
  wagara: {
    cat:["light"],
    label:{ja:"和モダン",en:"Wa Modern",zh:"和风现代",ko:"화모던"},
    desc:{ja:"和紙と墨と朱色",en:"Washi paper, ink, and vermillion",zh:"和纸・墨与朱红",ko:"와시 종이, 먹, 주홍"},
    ui:{"--ui-bg":"#f7f2e8","--ui-panel":"rgba(252,248,240,.97)","--ui-soft":"rgba(199,62,58,.05)","--ui-text":"#2e2a24",
      "--ui-muted":"#696254","--ui-border":"rgba(60,50,40,.22)","--ui-button":"#f0e9db","--ui-button-hover":"#e8dfcb",
      "--ui-field":"#fdfaf3","--ui-accent":"#c73e3a","--ui-on-accent":"#ffffff","--ui-gold":"#a8842c",
      "--ui-shadow":"0 24px 70px rgba(80,60,30,.14)","--ui-glow":"rgba(199,62,58,.11)"},
    game:{don:"#c73e3a",ka:"#2c5f7c",stage:"#f5efe2",lane:"rgba(250,246,236,.84)",track:"rgba(199,62,58,.22)",ink:"#2e2a24",
      inkShadow:"rgba(255,255,255,.9)",noteBorder:"#ffffff",panel:"rgba(250,246,238,.96)",perfect:"#a8842c",good:"#2e2a24",miss:"#a09880",glow:false},
    shapes:["circle","circle"], video:"sepia(.3) contrast(1.05) brightness(1.02)",
    font:'Georgia,"Noto Serif JP","Noto Serif SC",serif'
  },
  showacafe: {
    cat:["light","fun"],
    label:{ja:"昭和喫茶",en:"Showa Cafe",zh:"昭和咖啡厅",ko:"쇼와 카페"},
    desc:{ja:"なつかしい喫茶店の皿",en:"A nostalgic coffee-shop plate",zh:"令人怀念的咖啡厅瓷盘",ko:"그리운 찻집의 접시"},
    ui:{"--ui-bg":"#f2e8d8","--ui-panel":"rgba(250,243,230,.97)","--ui-soft":"rgba(212,85,46,.06)","--ui-text":"#3a2e22",
      "--ui-muted":"#655646","--ui-border":"rgba(120,80,40,.24)","--ui-button":"#eadcc4","--ui-button-hover":"#e0cdb0",
      "--ui-field":"#faf4e8","--ui-accent":"#d4552e","--ui-on-accent":"#000000","--ui-gold":"#2e8b8b",
      "--ui-shadow":"0 24px 70px rgba(100,70,30,.15)","--ui-glow":"rgba(212,85,46,.12)"},
    game:{don:"#d4552e",ka:"#2e8b8b",stage:"#efe2cc",lane:"rgba(250,242,228,.84)",track:"rgba(212,85,46,.22)",ink:"#3a2e22",
      inkShadow:"rgba(255,255,255,.9)",noteBorder:"#ffffff",panel:"rgba(249,241,228,.96)",perfect:"#2e8b8b",good:"#3a2e22",miss:"#a6947c",glow:false},
    shapes:["circle","circle"], video:"sepia(.4) saturate(1.1) brightness(.98)"
  },
  blueprint: {
    cat:["dark"],
    label:{ja:"青写真",en:"Blueprint",zh:"蓝图",ko:"청사진"},
    desc:{ja:"製図用紙の青と白い線",en:"Drafting-paper blue with white lines",zh:"绘图纸的蓝与白线",ko:"제도지의 파랑과 흰 선"},
    ui:{"--ui-bg":"#103055","--ui-panel":"rgba(16,42,74,.95)","--ui-soft":"rgba(126,194,255,.06)","--ui-text":"#eaf3ff",
      "--ui-muted":"#a0bbd9","--ui-border":"rgba(160,200,255,.34)","--ui-button":"#143a66","--ui-button-hover":"#1b4a7e",
      "--ui-field":"#0c2544","--ui-accent":"#7ec2ff","--ui-on-accent":"#0a1e38","--ui-gold":"#ffd166",
      "--ui-shadow":"0 24px 80px rgba(0,10,30,.55)","--ui-glow":"rgba(126,194,255,.14)"},
    game:{don:"#ffffff",ka:"#7ec2ff",stage:"#0e2c50",lane:"rgba(8,20,40,.60)",track:"rgba(255,255,255,.30)",ink:"#eaf3ff",
      inkShadow:"rgba(0,0,0,.85)",noteBorder:"#7ec2ff",panel:"rgba(14,36,64,.95)",perfect:"#ffd166",good:"#eaf3ff",miss:"#5f7796",glow:false},
    shapes:["circle","square"], video:"grayscale(1) contrast(1.5) sepia(1) hue-rotate(190deg) saturate(2) brightness(.6)",
    font:'"Cascadia Mono","Consolas","Menlo","Noto Sans Mono",monospace'
  },
  planetarium: {
    cat:["dark"],
    label:{ja:"天体観測",en:"Planetarium",zh:"天象仪",ko:"천체 관측"},
    desc:{ja:"星図と黄金の線",en:"Star charts and golden lines",zh:"星图与金线",ko:"별자리 지도와 황금선"},
    ui:{"--ui-bg":"#0a0e1e","--ui-panel":"rgba(12,16,34,.95)","--ui-soft":"rgba(212,175,55,.05)","--ui-text":"#f0ecdc",
      "--ui-muted":"#b3ac93","--ui-border":"rgba(212,175,55,.30)","--ui-button":"#10152c","--ui-button-hover":"#181f3e",
      "--ui-field":"#080c1a","--ui-accent":"#d4af37","--ui-on-accent":"#1a1405","--ui-gold":"#9fd0ff",
      "--ui-shadow":"0 0 60px rgba(212,175,55,.14)","--ui-glow":"rgba(212,175,55,.12)"},
    game:{don:"#ff8a5c",ka:"#a8ccf0",stage:"#080b18",lane:"rgba(6,8,20,.68)",track:"rgba(212,175,55,.26)",ink:"#f0ecdc",
      inkShadow:"rgba(0,0,0,.85)",noteBorder:"#ffffff",panel:"rgba(10,14,30,.95)",perfect:"#d4af37",good:"#f0ecdc",miss:"#6b6858",glow:true},
    shapes:["circle","diamond"], video:"grayscale(1) contrast(1.6) brightness(.5)"
  },
  silverprint: {
    cat:["light"],
    label:{ja:"モノクロ印画",en:"Silver Print",zh:"黑白照片",ko:"모노크롬 인화"},
    desc:{ja:"印画紙の白と黒",en:"Photographic paper in black and white",zh:"相纸的黑与白",ko:"인화지의 흑과 백"},
    ui:{"--ui-bg":"#ececec","--ui-panel":"rgba(250,250,250,.97)","--ui-soft":"rgba(40,40,40,.05)","--ui-text":"#1c1c1c",
      "--ui-muted":"#5c5c5c","--ui-border":"rgba(40,40,40,.24)","--ui-button":"#e2e2e2","--ui-button-hover":"#d6d6d6",
      "--ui-field":"#f8f8f8","--ui-accent":"#1c1c1c","--ui-on-accent":"#ffffff","--ui-gold":"#6e6e6e",
      "--ui-shadow":"0 24px 70px rgba(40,40,40,.16)","--ui-glow":"rgba(60,60,60,.10)"},
    game:{don:"#262626",ka:"#8c8c8c",stage:"#e8e8e8",lane:"rgba(255,255,255,.86)",track:"rgba(40,40,40,.24)",ink:"#1c1c1c",
      inkShadow:"rgba(255,255,255,.9)",noteBorder:"#ffffff",panel:"rgba(246,246,246,.96)",perfect:"#6e6e6e",good:"#1c1c1c",miss:"#b0b0b0",glow:false},
    shapes:["circle","circle"], video:"grayscale(1) contrast(1.15) brightness(1.1)"
  },
  nessun: {
    cat:["dark","grad","fun"],
    label:{ja:"ネッスン・ドルマ",en:"Nessun Dorma",zh:"今夜无人入睡",ko:"네순 도르마"},
    desc:{ja:"夜空と黄金のグランドオペラ",en:"A grand opera of night and gold",zh:"夜空与黄金的宏大歌剧",ko:"밤하늘과 황금의 그랜드 오페라"},
    ui:{"--ui-bg":"linear-gradient(0deg,#2a1a3e,#0c1026)","--ui-panel":"rgba(20,16,44,.95)","--ui-soft":"rgba(242,193,78,.06)","--ui-text":"#fdf6e3",
      "--ui-muted":"#c5b8d8","--ui-border":"rgba(242,193,78,.32)","--ui-button":"#1c1638","--ui-button-hover":"#29204e",
      "--ui-field":"#130f2c","--ui-accent":"#f2c14e","--ui-on-accent":"#241a04","--ui-gold":"#fff1c4",
      "--ui-shadow":"0 0 70px rgba(242,193,78,.18)","--ui-glow":"rgba(242,193,78,.14)"},
    game:{don:"#f2c14e",ka:"#6fa8ff",stage:"linear-gradient(0deg,#231540,#0a0d22)",lane:"rgba(10,8,28,.66)",track:"rgba(242,193,78,.30)",ink:"#fdf6e3",
      inkShadow:"rgba(0,0,0,.85)",noteBorder:"#ffffff",panel:"rgba(18,14,40,.95)",perfect:"#fff1c4",good:"#fdf6e3",miss:"#7d7296",glow:true},
    shapes:["circle","circle"], video:"grayscale(1) contrast(1.45) sepia(1) hue-rotate(200deg) saturate(1.6) brightness(.6)",
    font:'Georgia,"Noto Serif JP","Noto Serif SC",serif'
  },

  /* 🎓 ごほうびスキン：チュートリアルのスタンプを5つ集めると解禁（core.js で鍵を管理）。
     それまではスキンの棚に「❓ ？？？」の正体不明カードとして並びます */
  graduation: {
    cat:["grad","fun"], locked:true,
    label:{ja:"グラデュエーション",en:"Graduation",zh:"毕业典礼",ko:"졸업"},
    desc:{ja:"🎓 卒業おめでとう！夜明けの金色へ",en:"🎓 Congrats, graduate! Into the golden dawn",zh:"🎓 毕业快乐！迈向金色黎明",ko:"🎓 졸업 축하! 금빛 새벽으로"},
    ui:{"--ui-bg":"linear-gradient(180deg,#0b1030 0%,#2c2160 52%,#c99a2e 100%)","--ui-panel":"rgba(17,14,40,.96)","--ui-soft":"rgba(255,209,102,.06)","--ui-text":"#fdf6e3",
      "--ui-muted":"#cabfe0","--ui-border":"rgba(255,209,102,.34)","--ui-button":"#191437","--ui-button-hover":"#241c4e",
      "--ui-field":"#120e2c","--ui-accent":"#ffd166","--ui-on-accent":"#241a04","--ui-gold":"#ffe9a8",
      "--ui-shadow":"0 24px 80px rgba(0,0,0,.55)","--ui-glow":"rgba(255,209,102,.16)"},
    game:{don:"#ffd166",ka:"#6fa8ff",stage:"linear-gradient(180deg,#0a0e28 0%,#241b52 55%,#b8892a 100%)",lane:"rgba(8,6,24,.62)",track:"rgba(255,209,102,.32)",ink:"#fdf6e3",
      inkShadow:"rgba(0,0,0,.85)",noteBorder:"#ffffff",panel:"rgba(15,12,36,.95)",perfect:"#ffe9a8",good:"#fdf6e3",miss:"#8d84a8",glow:true},
    shapes:["circle","circle"], video:"grayscale(1) contrast(1.5) sepia(1) hue-rotate(18deg) saturate(1.4) brightness(.55)"
  },

  /* ===== 見やすさ（access）：色覚配慮と高コントラスト =====
     色覚配慮の配色は Okabe & Ito（2008）の基本の8色の値を使う（色の組み合わせの提案で、値は公開の指定）。
     赤と緑の区別に頼らず、青とだいだい（朱色）の組みにする。さらに、ノーツの形（丸と菱形）でも区別する。
     明るい背景では、朱色を濃い茶色寄りにし、青は明るい水色にして、輝度でも差をつける（白黒でも区別できるように）。
     コントラストは WCAG の基準（本文 4.5:1 以上）を tests/skins-access.test.mjs で検査する。 */
  "hc": {
    cat:["access"],
    label:{ja:"ハイコントラスト",en:"High contrast",zh:"高对比度",ko:"고대비"},
    desc:{ja:"白と黒の強い対比。数字と判定を最優先",en:"Strong black-and-white contrast; numbers and judgments first",zh:"黑白强对比，优先显示数字与判定",ko:"흑백 강한 대비, 숫자와 판정 우선"},
    ui:{"--ui-bg":"#000000","--ui-panel":"rgba(0,0,0,.98)","--ui-soft":"rgba(255,255,255,.10)","--ui-text":"#ffffff",
      "--ui-muted":"#e6e6e6","--ui-border":"#ffffff","--ui-button":"#111111","--ui-button-hover":"#262626",
      "--ui-field":"#000000","--ui-accent":"#ffff00","--ui-on-accent":"#000000","--ui-gold":"#ffff00",
      "--ui-shadow":"0 0 0 2px #ffffff","--ui-glow":"rgba(255,255,0,.25)"},
    game:{don:"#ffff00",ka:"#00e5ff",stage:"#000000",lane:"rgba(255,255,255,.12)",track:"#ffffff",ink:"#ffffff",
      inkShadow:"#000000",noteBorder:"#ffffff",panel:"rgba(0,0,0,.98)",perfect:"#ffff00",good:"#ffffff",miss:"#bfbfbf",glow:false},
    shapes:["circle","diamond"], video:"grayscale(1) brightness(.6) contrast(1.4)"
  },
  "cbDark": {
    cat:["access"],
    label:{ja:"色覚にやさしい（暗め）",en:"Colorblind-friendly (dark)",zh:"色觉友好（深色）",ko:"색각 친화（어두움）"},
    desc:{ja:"青とだいだい色。ノーツの形も変えて区別",en:"Blue and vermilion, with different note shapes",zh:"蓝色与朱红色，并用不同形状区分",ko:"파랑과 주황. 노트 모양도 달리해 구분"},
    ui:{"--ui-bg":"#0b0f17","--ui-panel":"rgba(16,22,34,.97)","--ui-soft":"rgba(255,255,255,.06)","--ui-text":"#f0f4f8",
      "--ui-muted":"#b8c2d0","--ui-border":"rgba(255,255,255,.28)","--ui-button":"#1b2536","--ui-button-hover":"#26334a",
      "--ui-field":"#0e1420","--ui-accent":"#56b4e9","--ui-on-accent":"#001018","--ui-gold":"#f0e442",
      "--ui-shadow":"0 24px 80px rgba(0,0,0,.55)","--ui-glow":"rgba(86,180,233,.18)"},
    game:{don:"#d55e00",ka:"#56b4e9",stage:"#0b0f17",lane:"rgba(255,255,255,.06)",track:"rgba(255,255,255,.35)",ink:"#f0f4f8",
      inkShadow:"rgba(0,0,0,.8)",noteBorder:"#ffffff",panel:"rgba(16,22,34,.94)",perfect:"#f0e442",good:"#ffffff",miss:"#9aa6b8",glow:false},
    shapes:["circle","diamond"], video:"grayscale(.6) contrast(1.2) brightness(.8)"
  },
  "cbLight": {
    cat:["access"],
    label:{ja:"色覚にやさしい（明るめ）",en:"Colorblind-friendly (light)",zh:"色觉友好（浅色）",ko:"색각 친화（밝음）"},
    desc:{ja:"明るい背景で、青とだいだい色を使う",en:"Light background using blue and vermilion",zh:"浅色背景，使用蓝与朱红色",ko:"밝은 배경에 파랑과 주황 사용"},
    ui:{"--ui-bg":"#f7f7f4","--ui-panel":"#ffffff","--ui-soft":"rgba(0,0,0,.04)","--ui-text":"#1a1a1a",
      "--ui-muted":"#4a4a4a","--ui-border":"rgba(0,0,0,.30)","--ui-button":"#e9e9e4","--ui-button-hover":"#dcdcd4",
      "--ui-field":"#ffffff","--ui-accent":"#0072b2","--ui-on-accent":"#ffffff","--ui-gold":"#b07000",
      "--ui-shadow":"0 12px 40px rgba(0,0,0,.12)","--ui-glow":"rgba(0,114,178,.15)"},
    game:{don:"#8f3500",ka:"#56b4e9",stage:"#f4f4ef",lane:"rgba(0,0,0,.05)",track:"rgba(0,0,0,.35)",ink:"#1a1a1a",
      inkShadow:"rgba(255,255,255,.8)",noteBorder:"#1a1a1a",panel:"rgba(255,255,255,.95)",perfect:"#8f3500",good:"#0072b2",miss:"#6b6b6b",glow:false},
    shapes:["circle","diamond"], video:"grayscale(.5) brightness(1.1) contrast(1.05)"
  },

  /* ===== 生活（life）：日常の場面をテーマにする（すべて自作の配色。素材・画像は使わない） ===== */
  "rainWindow": {
    cat:["life"],
    label:{ja:"雨の窓",en:"Rainy window",zh:"雨窗",ko:"빗속 창가"},
    desc:{ja:"窓ガラスを流れる雨、夜の灯りがにじむ",en:"Rain on the glass, night lights blurred",zh:"玻璃窗上流淌的雨，夜灯朦胧",ko:"유리창을 타고 흐르는 빗물, 번지는 밤의 불빛"},
    ui:{"--ui-bg":"#111a22","--ui-panel":"rgba(20,30,40,.96)","--ui-soft":"rgba(255,255,255,.05)","--ui-text":"#e8eef4",
      "--ui-muted":"#9fb0c0","--ui-border":"rgba(255,255,255,.18)","--ui-button":"#1a2834","--ui-button-hover":"#24364a",
      "--ui-field":"#0e1720","--ui-accent":"#6fb7d6","--ui-on-accent":"#06131a","--ui-gold":"#e8d28a",
      "--ui-shadow":"0 24px 80px rgba(0,0,0,.5)","--ui-glow":"rgba(111,183,214,.16)"},
    game:{don:"#f2a36b",ka:"#6fb7d6",stage:"#0e1820",lane:"rgba(0,0,0,.35)",track:"rgba(255,255,255,.18)",ink:"#e8eef4",
      inkShadow:"rgba(0,0,0,.7)",noteBorder:"rgba(255,255,255,.7)",panel:"rgba(14,24,32,.94)",perfect:"#f2d27a",good:"#e8eef4",miss:"#7d8c99",glow:false},
    shapes:["circle","circle"], video:"grayscale(.4) brightness(.7) contrast(1.1)"
  },
  "nightBath": {
    cat:["life"],
    label:{ja:"夜の銭湯",en:"Night bathhouse",zh:"夜间澡堂",ko:"밤의 목욕탕"},
    desc:{ja:"タイルの壁と、ぬくもりのある電球色",en:"Tiled walls and warm bulb light",zh:"瓷砖墙与温暖的灯光",ko:"타일 벽과 따뜻한 전구 빛"},
    ui:{"--ui-bg":"#0d2a2e","--ui-panel":"rgba(12,40,44,.96)","--ui-soft":"rgba(255,255,255,.05)","--ui-text":"#eef7f4",
      "--ui-muted":"#a8cfc8","--ui-border":"rgba(255,255,255,.2)","--ui-button":"#15393e","--ui-button-hover":"#1d4b52",
      "--ui-field":"#0a2024","--ui-accent":"#f0b35a","--ui-on-accent":"#2a1800","--ui-gold":"#ffd98a",
      "--ui-shadow":"0 24px 80px rgba(0,0,0,.5)","--ui-glow":"rgba(240,179,90,.16)"},
    game:{don:"#f0b35a",ka:"#7fd3c4",stage:"#0b2428",lane:"rgba(0,0,0,.25)",track:"rgba(255,255,255,.2)",ink:"#eef7f4",
      inkShadow:"rgba(0,0,0,.7)",noteBorder:"rgba(255,255,255,.6)",panel:"rgba(10,36,40,.94)",perfect:"#ffd98a",good:"#eef7f4",miss:"#88a9a4",glow:true},
    shapes:["circle","circle"], video:"sepia(.3) saturate(1.2) brightness(.7)"
  },
  "shojiLight": {
    cat:["life"],
    label:{ja:"障子の光",en:"Shoji light",zh:"障子之光",ko:"쇼지의 빛"},
    desc:{ja:"和紙越しのやわらかい光と、木の桟",en:"Soft light through washi paper and wooden lattice",zh:"透过和纸的柔光与木格栅",ko:"와시 종이를 통한 부드러운 빛과 나무 격자"},
    ui:{"--ui-bg":"#efe9dc","--ui-panel":"#fbf8f1","--ui-soft":"rgba(60,45,30,.05)","--ui-text":"#2b2620",
      "--ui-muted":"#60584e","--ui-border":"rgba(60,45,30,.25)","--ui-button":"#e6dfd0","--ui-button-hover":"#d9d0bd",
      "--ui-field":"#fffdf8","--ui-accent":"#b5533c","--ui-on-accent":"#fff8f0","--ui-gold":"#a67c2e",
      "--ui-shadow":"0 12px 36px rgba(60,45,30,.12)","--ui-glow":"rgba(181,83,60,.14)"},
    game:{don:"#b5533c",ka:"#5f7f8f",stage:"#f4eee0",lane:"rgba(60,45,30,.06)",track:"rgba(60,45,30,.3)",ink:"#2b2620",
      inkShadow:"rgba(255,255,255,.7)",noteBorder:"rgba(43,38,32,.6)",panel:"rgba(251,248,241,.95)",perfect:"#b5533c",good:"#2b2620",miss:"#8a8075",glow:false},
    shapes:["circle","circle"], video:"sepia(.2) brightness(1.1) contrast(.95)"
  },

  /* 生活（life）2回目：駅・台所・商店街（すべて自作の配色。素材・画像は使わない） */
  "stationDusk": {
    cat:["life"],
    label:{ja:"駅のホーム（夕暮れ）",en:"Station platform at dusk",zh:"黄昏的站台",ko:"해질녘 역 승강장"},
    desc:{ja:"電車を待つ、オレンジの灯りと群青の空",en:"Waiting for the train under amber lamps and a deep blue sky",zh:"在橙色灯光与深蓝天空下等车",ko:"주황빛 조명과 남색 하늘 아래 전철을 기다리며"},
    ui:{"--ui-bg":"#15203a","--ui-panel":"rgba(22,32,58,.96)","--ui-soft":"rgba(255,255,255,.05)","--ui-text":"#f2f4fa",
      "--ui-muted":"#aeb8d4","--ui-border":"rgba(255,255,255,.18)","--ui-button":"#1d2a4a","--ui-button-hover":"#27396a",
      "--ui-field":"#0f1930","--ui-accent":"#ffb454","--ui-on-accent":"#2a1600","--ui-gold":"#ffd98a",
      "--ui-shadow":"0 24px 80px rgba(0,0,0,.5)","--ui-glow":"rgba(255,180,84,.16)"},
    game:{don:"#ffb454",ka:"#7aa6c2",stage:"#101a31",lane:"rgba(0,0,0,.3)",track:"rgba(255,255,255,.2)",ink:"#f2f4fa",
      inkShadow:"rgba(0,0,0,.7)",noteBorder:"rgba(255,255,255,.6)",panel:"rgba(16,26,50,.94)",perfect:"#ffd98a",good:"#f2f4fa",miss:"#8b96b5",glow:false},
    shapes:["circle","circle"], video:"saturate(1.1) brightness(.75) contrast(1.05)"
  },
  "morningKitchen": {
    cat:["life"],
    label:{ja:"台所の朝",en:"Kitchen morning",zh:"厨房的清晨",ko:"아침 부엌"},
    desc:{ja:"白いタイルと、窓から入る朝の光",en:"White tiles and morning light from the window",zh:"白色瓷砖与窗边的晨光",ko:"하얀 타일과 창으로 드는 아침 햇살"},
    ui:{"--ui-bg":"#f5efe6","--ui-panel":"#fffaf2","--ui-soft":"rgba(60,50,40,.05)","--ui-text":"#2e2a24",
      "--ui-muted":"#615b4b","--ui-border":"rgba(60,50,40,.22)","--ui-button":"#ebe3d4","--ui-button-hover":"#ddd3bf",
      "--ui-field":"#ffffff","--ui-accent":"#3f7d5f","--ui-on-accent":"#ffffff","--ui-gold":"#9a6b1f",
      "--ui-shadow":"0 12px 36px rgba(60,50,40,.12)","--ui-glow":"rgba(63,125,95,.14)"},
    game:{don:"#e0894d",ka:"#4f7fb0",stage:"#f7f1e7",lane:"rgba(60,50,40,.05)",track:"rgba(60,50,40,.28)",ink:"#2e2a24",
      inkShadow:"rgba(255,255,255,.7)",noteBorder:"rgba(46,42,36,.6)",panel:"rgba(255,250,242,.95)",perfect:"#b35f1f",good:"#2e2a24",miss:"#8a8374",glow:false},
    shapes:["circle","circle"], video:"brightness(1.08) saturate(.95)"
  },
  "shoutengai": {
    cat:["life"],
    label:{ja:"商店街の夕暮れ",en:"Shopping street at dusk",zh:"傍晚的商店街",ko:"저녁 상점가"},
    desc:{ja:"赤い提灯と、店先の明かりが並ぶ通り",en:"A street lined with red lanterns and shop lights",zh:"红灯笼与店铺灯火排列的街道",ko:"빨간 등불과 가게 불빛이 늘어선 거리"},
    ui:{"--ui-bg":"#2a1d24","--ui-panel":"rgba(42,29,36,.96)","--ui-soft":"rgba(255,255,255,.05)","--ui-text":"#f7eef0",
      "--ui-muted":"#c9b3bb","--ui-border":"rgba(255,255,255,.2)","--ui-button":"#36262e","--ui-button-hover":"#44303a",
      "--ui-field":"#22161c","--ui-accent":"#ff7a59","--ui-on-accent":"#1d0d08","--ui-gold":"#ffd166",
      "--ui-shadow":"0 24px 80px rgba(0,0,0,.5)","--ui-glow":"rgba(255,122,89,.16)"},
    game:{don:"#ffd166",ka:"#8ec5e8",stage:"#24181f",lane:"rgba(0,0,0,.3)",track:"rgba(255,255,255,.2)",ink:"#f7eef0",
      inkShadow:"rgba(0,0,0,.7)",noteBorder:"rgba(255,255,255,.6)",panel:"rgba(36,24,31,.94)",perfect:"#ffd166",good:"#f7eef0",miss:"#9c8790",glow:true},
    shapes:["circle","circle"], video:"sepia(.25) saturate(1.2) brightness(.75)"
  },

  /* ①ゲーム画面の残り（水墨・楽譜・ドット絵の夜・霧の森）。すべて自作の配色。素材・画像・フォントは使わない */
  "sumi": {
    cat:["light"],
    label:{ja:"水墨（墨と朱の判子）",en:"Sumi ink (ink and red seal)",zh:"水墨（墨与朱印）",ko:"수묵(먹과 주인)"},
    desc:{ja:"和紙に墨の濃淡、朱の判子だけの差し色",en:"Ink wash on washi paper, with only a red seal as accent",zh:"宣纸上的墨色浓淡，仅以朱印点缀",ko:"한지 위의 먹 농담, 주인 한 점만 더한 색"},
    ui:{"--ui-bg":"#f3efe6","--ui-panel":"#fbf8f1","--ui-soft":"rgba(27,27,27,.05)","--ui-text":"#1b1b1b",
      "--ui-muted":"#56534c","--ui-border":"rgba(27,27,27,.25)","--ui-button":"#e7e1d3","--ui-button-hover":"#dad2bf",
      "--ui-field":"#ffffff","--ui-accent":"#b3261e","--ui-on-accent":"#ffffff","--ui-gold":"#8f3500",
      "--ui-shadow":"0 12px 36px rgba(27,27,27,.12)","--ui-glow":"rgba(179,38,30,.12)"},
    game:{don:"#1d1d1d",ka:"#7d7a72",stage:"#f3efe6",lane:"rgba(27,27,27,.05)",track:"rgba(27,27,27,.3)",ink:"#1b1b1b",
      inkShadow:"rgba(255,255,255,.7)",noteBorder:"rgba(27,27,27,.7)",panel:"rgba(251,248,241,.95)",perfect:"#b3261e",good:"#1b1b1b",miss:"#8b877c",glow:false},
    shapes:["circle","circle"], video:"grayscale(.6) contrast(1.05)"
  },
  "score": {
    cat:["light"],
    label:{ja:"楽譜（五線と音符）",en:"Sheet music (staves and notes)",zh:"乐谱（五线与音符）",ko:"악보(오선과 음표)"},
    desc:{ja:"淡い紙の上に五線、ブラウンの音符",en:"Staff lines and brown notes on pale paper",zh:"淡色纸上的五线与棕色音符",ko:"연한 종이 위의 오선과 갈색 음표"},
    ui:{"--ui-bg":"#faf7ef","--ui-panel":"#fffdf7","--ui-soft":"rgba(60,40,20,.05)","--ui-text":"#2a2118",
      "--ui-muted":"#6b5a48","--ui-border":"rgba(60,40,20,.22)","--ui-button":"#eee6d4","--ui-button-hover":"#e2d6bb",
      "--ui-field":"#ffffff","--ui-accent":"#7a4a1e","--ui-on-accent":"#ffffff","--ui-gold":"#8f5e10",
      "--ui-shadow":"0 12px 36px rgba(60,40,20,.12)","--ui-glow":"rgba(122,74,30,.12)"},
    game:{don:"#2a2118",ka:"#4f7a96",stage:"#fbf9f2",lane:"rgba(60,40,20,.04)",track:"rgba(60,40,20,.35)",ink:"#2a2118",
      inkShadow:"rgba(255,255,255,.7)",noteBorder:"rgba(42,33,24,.6)",panel:"rgba(255,253,247,.95)",perfect:"#7a4a1e",good:"#2a2118",miss:"#8b7e6e",glow:false},
    shapes:["circle","circle"], video:"sepia(.2) brightness(1.04)"
  },
  "dotNight": {
    cat:["dark","fun"],
    label:{ja:"ドット絵の夜",en:"Pixel night",zh:"像素夜空",ko:"도트 밤하늘"},
    desc:{ja:"8ビット風の星空と、自作のドット",en:"An 8-bit starry sky with original pixel art",zh:"8位风格的星空与自制像素画",ko:"8비트풍 별밤과 직접 만든 도트"},
    ui:{"--ui-bg":"#0b0f2a","--ui-panel":"rgba(14,20,50,.96)","--ui-soft":"rgba(255,255,255,.05)","--ui-text":"#e8ecff",
      "--ui-muted":"#a9b3e0","--ui-border":"rgba(232,236,255,.22)","--ui-button":"#18214a","--ui-button-hover":"#24306a",
      "--ui-field":"#070a1e","--ui-accent":"#ffd23f","--ui-on-accent":"#1a1400","--ui-gold":"#ffd23f",
      "--ui-shadow":"0 0 0 2px #000,0 16px 0 #000","--ui-glow":"rgba(255,210,63,.16)"},
    game:{don:"#ffd23f",ka:"#5ee0ff",stage:"#0b0f2a",lane:"rgba(255,255,255,.04)",track:"rgba(232,236,255,.25)",ink:"#e8ecff",
      inkShadow:"rgba(0,0,0,.8)",noteBorder:"#000000",panel:"rgba(11,15,42,.94)",perfect:"#ffd23f",good:"#e8ecff",miss:"#7f8bbd",glow:true},
    shapes:["square","square"], video:"contrast(1.1) saturate(1.2)"
  },
  "mistForest": {
    cat:["dark"],
    label:{ja:"霧の森",en:"Misty forest",zh:"雾林",ko:"안개 숲"},
    desc:{ja:"薄い霧が流れる、緑の階調",en:"Drifting thin mist over layers of green",zh:"薄雾流动的绿色层次",ko:"얇은 안개가 흐르는 초록의 농담"},
    ui:{"--ui-bg":"#1d3a33","--ui-panel":"rgba(24,50,43,.96)","--ui-soft":"rgba(255,255,255,.05)","--ui-text":"#e9f3ee",
      "--ui-muted":"#b1ccc1","--ui-border":"rgba(233,243,238,.2)","--ui-button":"#264a41","--ui-button-hover":"#2f5a4f",
      "--ui-field":"#162e28","--ui-accent":"#8fd3b0","--ui-on-accent":"#0c231b","--ui-gold":"#d8e8a0",
      "--ui-shadow":"0 24px 80px rgba(0,0,0,.45)","--ui-glow":"rgba(143,211,176,.16)"},
    game:{don:"#8fd3b0",ka:"#d7ecd9",stage:"#1d3a33",lane:"rgba(255,255,255,.05)",track:"rgba(233,243,238,.22)",ink:"#e9f3ee",
      inkShadow:"rgba(0,0,0,.6)",noteBorder:"rgba(233,243,238,.5)",panel:"rgba(29,58,51,.94)",perfect:"#d8e8a0",good:"#e9f3ee",miss:"#8fa89e",glow:false},
    shapes:["circle","circle"], video:"saturate(.85) brightness(.9)"
  }
};

/* ---------- マスコット（内蔵：オレンジ相棒・VRM。キャラクターは registerMascot で追加） ---------- */
const MASCOT_IDS = ["buddy", "vrm", "mmd"];
const MASCOT_FAMILY = { buddy:"buddy", vrm:"vrm", mmd:"mmd" };
const MASCOT_DEFS = {};
const MASCOT_CAPTIONS = {
  buddy: {
    capStart:{ja:"ご依頼ありがとうございます！一歩ずつ叩いていきましょう。",en:"Great question! Let's drum through this step by step.",
      zh:"好问题！我们一步一步敲下去吧。",ko:"좋은 질문이에요! 한 단계씩 두드려 봅시다."},
    capCombo:{ja:"{n}コンボ！まさにおっしゃる通りです！",en:"{n} combo! You're absolutely right!",
      zh:"{n}连击！您说得完全正确！",ko:"{n} 콤보! 완전히 맞는 말씀입니다!"},
    capBreak:{ja:"ご指摘ありがとうございます。私のミスでした！",en:"You're right, I apologize for the confusion!",
      zh:"感谢指正，是我的失误！",ko:"지적 감사합니다. 제 실수였어요!"}
  },
  vrm: {
    capStart:{ja:"いくよ！リズムに乗っていこう！",en:"Let's go! Ride the rhythm!",zh:"出发！跟上节奏吧！",ko:"가자! 리듬을 타 보자!"},
    capCombo:{ja:"{n}コンボ！いい調子！",en:"{n} combo! Nice groove!",zh:"{n}连击！状态很好！",ko:"{n} 콤보! 좋은 흐름이야!"},
    capBreak:{ja:"ドンマイ！まだまだこれから！",en:"No worries! Plenty of song left!",zh:"没关系！还早着呢！",ko:"괜찮아! 아직 남았어!"}
  }
};
/* キャラクターのマスコットを追加する（MOD用）
   def = { family, draw(x, y, st), top, shadowY, border, credit() }
     draw   : st = { p:時刻, sad, happy, talking } を受け取って描く
     top    : 吹き出しを出す高さ（立ち位置からの差）
     credit : （任意）プレイ中に右下へ表示する文字列を返す関数
   セリフは MASCOT_CAPTIONS[family] に入れます。 */
function registerMascot(id, def) {
  if (!/^[A-Za-z0-9_]{1,32}$/.test(id) || ["skin", "none", "vrm", "buddy"].includes(id) || !def || typeof def.draw !== "function") return false;
  if (!MASCOT_IDS.includes(id)) MASCOT_IDS.splice(MASCOT_IDS.indexOf("vrm"), 0, id);
  MASCOT_FAMILY[id] = def.family || id;
  MASCOT_DEFS[id] = def;
  return true;
}

/* ---------- カスタムスキンの組み立て ---------- */
const FONT_PRESETS = {
  default:null, mono:'"Cascadia Mono","Consolas","Menlo","Noto Sans Mono",monospace',
  rounded:'"Trebuchet MS","Avenir Next",system-ui,sans-serif', serif:'Georgia,"Noto Serif JP","Noto Serif SC",serif'
};
const VIDEO_PRESETS = {
  mono:"grayscale(1) contrast(1.6)", color:"none", dim:"brightness(.45) saturate(.85)",
  warm:"sepia(.45) saturate(1.3) brightness(.85)", cool:"grayscale(.4) hue-rotate(180deg) saturate(1.4) brightness(.8)"
};
/* ---------- 背景グラデーション（プリセットとカスタム両方で使う） ---------- */
const GRAD_DIRS = ["none", "down", "up", "left", "right"];
const GRAD_ANGLE = { down:"180deg", up:"0deg", right:"90deg", left:"270deg" };
/* "linear-gradient(180deg,#a,#b)" から {from,to,dir} を読む（スキンのリミックス用。読めなければ null） */
function parseGrad(v) {
  if (typeof v !== "string" || !v.includes("gradient")) return null;
  const hex = [...v.matchAll(/#[0-9a-f]{6}/gi)].map(m => m[0].toLowerCase());
  if (hex.length < 2) return null;
  const deg = v.match(/(-?\d+(?:\.\d+)?)deg/i);
  const dir = deg ? { 0:"up", 90:"right", 180:"down", 270:"left" }[String(Math.round((+deg[1] % 360 + 360) % 360))] || "down" : "down";
  return { from:hex[0], to:hex[hex.length - 1], dir };
}
function sanitizeSkinDef(raw) {
  if (!raw || typeof raw !== "object" || !raw.colors || typeof raw.colors !== "object") return null;
  const colors = {};
  for (const k of ["bg", "panel", "text", "accent", "gold"]) {
    const v = raw.colors[k];
    if (typeof v !== "string" || !HEX.test(v)) return null;
    colors[k] = v.toLowerCase();
  }
  colors.bg2 = typeof raw.colors.bg2 === "string" && HEX.test(raw.colors.bg2) ? raw.colors.bg2.toLowerCase() : "";   // グラデ先用（任意）
  return {
    name: String(raw.name || "").trim().slice(0, 24) || "Custom",
    colors, glow: raw.glow === true, scanlines: raw.scanlines === true,
    gradDir: GRAD_DIRS.includes(raw.gradDir) ? raw.gradDir : "none",
    font: has(FONT_PRESETS, raw.font) ? raw.font : "default",
    video: has(VIDEO_PRESETS, raw.video) ? raw.video : "mono",
    mascot: MASCOT_IDS.includes(raw.mascot) ? raw.mascot : "none"
  };
}
function buildCustomSkin(def) {
  const c = def.colors, dark = luminance(c.bg) < .35;
  const grad = c.bg2 && def.gradDir && def.gradDir !== "none" ? `linear-gradient(${GRAD_ANGLE[def.gradDir]}, ${c.bg}, ${c.bg2})` : null;   // --ui-bg と game.stage はそのまま CSS background へ
  return {
    custom:true,
    label:{ en:def.name },
    desc:{ ja:"カスタムスキン", en:"Custom skin", zh:"自定义皮肤", ko:"커스텀 스킨" },
    ui:{ "--ui-bg":grad || c.bg, "--ui-panel":hexToRgba(c.panel, .96), "--ui-soft":hexToRgba(c.text, .05), "--ui-text":c.text,
      "--ui-muted":mixHex(c.text, c.panel, .38), "--ui-border":hexToRgba(c.text, .18),
      "--ui-button":mixHex(c.panel, c.text, .06), "--ui-button-hover":mixHex(c.panel, c.text, .13),
      "--ui-field":mixHex(c.bg, c.panel, .5), "--ui-accent":c.accent,
      "--ui-on-accent":luminance(c.accent) > .179 ? "#000000" : "#ffffff", "--ui-gold":c.gold,
      "--ui-shadow":dark ? "0 24px 80px rgba(0,0,0,.55)" : "0 24px 70px rgba(30,40,60,.16)",
      "--ui-glow":hexToRgba(c.accent, .14) },
    game:{ don:c.accent, ka:c.gold, stage:grad || c.bg, lane:hexToRgba(c.panel, dark ? .6 : .82), track:hexToRgba(c.text, .24),
      ink:c.text, inkShadow:dark ? "rgba(0,0,0,.85)" : "rgba(255,255,255,.9)", noteBorder:"#ffffff",
      panel:hexToRgba(c.panel, .95), perfect:c.gold, good:c.text, miss:mixHex(c.text, c.bg, .45),
      glow:def.glow, scanlines:def.scanlines },
    shapes:["circle","circle"],
    video:VIDEO_PRESETS[def.video],
    font:FONT_PRESETS[def.font] || undefined,
    mascot:def.mascot !== "none" ? def.mascot : undefined
  };
}

/* ---------- レイアウト（1920×1080基準の座標） ---------- */
const LAYOUTS = {
  classic:    { video:{x:0,y:0,w:W,h:H}, vertical:false, laneY:330, hitX:260, endX:1860 },
  vertical:   { video:{x:720,y:0,w:1200,h:H}, vertical:true, panel:{x:30,y:96,w:660,h:964,r:26}, centers:[250,470], laneW:200, topY:110, hitY:890 },
  center:     { video:{x:0,y:0,w:W,h:H}, vertical:true, panel:{x:730,y:0,w:460,h:H,r:0}, centers:[850,1070], laneW:200, topY:0, hitY:890 },
  commentary: { video:{x:0,y:0,w:W,h:740}, vertical:false, commentary:true, laneY:945, hitX:520, endX:1870 }
};
const MASCOT_POS = { classic:{x:1780,y:900}, vertical:{x:1790,y:930}, center:{x:1790,y:930}, commentary:{x:1800,y:630} };
const VRM_RECT = {
  classic:{x:1490,y:440,w:400,h:600}, vertical:{x:1490,y:440,w:400,h:600},
  center:{x:1490,y:440,w:400,h:600}, commentary:{x:1520,y:250,w:380,h:560}
};

/* ---------- 難易度（判定幅はms） ---------- */
const DIFFS = {
  easy:   { div:1, density:.55, perfect:50, good:120 },
  normal: { div:2, density:.48, perfect:42, good:105 },
  hard:   { div:4, density:.60, perfect:36, good:95 },
  master: { div:4, density:.82, perfect:30, good:80 },
  rush:   { div:4, target:2000, density:.95, perfect:28, good:75 }
};
const DIFF_IDS = Object.keys(DIFFS);

/* ---------- ノーツの見た目（スキンとは別に保存） ---------- */
const NOTE_SHAPES = ["circle", "diamond", "square"];
const NOTE_PRESETS = {
  classic: [{ color:"#ff3b55", shape:"circle" }, { color:"#55aaff", shape:"circle" }],
  clarity: [{ color:"#e69f00", shape:"circle" }, { color:"#56b4e9", shape:"diamond" }]
};
function sanitizeNotes(v) {
  return [0, 1].map(i => {
    const n = Array.isArray(v) && v[i] && typeof v[i] === "object" ? v[i] : {}, d = NOTE_PRESETS.classic[i];
    return {
      color: typeof n.color === "string" && HEX.test(n.color) ? n.color.toLowerCase() : d.color,
      shape: NOTE_SHAPES.includes(n.shape) ? n.shape : d.shape
    };
  });
}

/* ---------- 隠しSeed ----------
   EGG_KEYS ：Seedがこの文字列と同じとき（stagefx.js・catch.js も追加します）
   EGG_WORDS：Seedにこの言葉が含まれるとき
   どちらも大文字・小文字は区別しません。判定は core.js の seedEggs() */
const EGG_KEYS = { "143":"egg143", "765":"egg765", "2000":"egg2000" };
const EGG_WORDS = [
  { words:["olivier", "nightmare", "lunatic", "hentai"], key:"eggHard", master:true },   // MASTER を解放（765と同じ）
  { words:["1919", "go"], key:"eggGo", level:10 }                                       // 推定レベル Lv.10
];
/* ✅ data.js 完了 */

/* 公開名は据え置き（名前空間の移行の途中。window.Trk.* への移動は後の段階で行う） */
window.DIFFS = DIFFS;
window.DIFF_IDS = DIFF_IDS;
window.EGG_KEYS = EGG_KEYS;
window.EGG_WORDS = EGG_WORDS;
window.FONT_DEFAULT = FONT_DEFAULT;
window.H = H;
window.HEX = HEX;
window.LAYOUTS = LAYOUTS;
window.MASCOT_CAPTIONS = MASCOT_CAPTIONS;
window.MASCOT_DEFS = MASCOT_DEFS;
window.MASCOT_FAMILY = MASCOT_FAMILY;
window.MASCOT_IDS = MASCOT_IDS;
window.MASCOT_POS = MASCOT_POS;
window.NOTE_PRESETS = NOTE_PRESETS;
window.NOTE_SHAPES = NOTE_SHAPES;
window.SKINS = SKINS;
window.TAU = TAU;
window.VRM_RECT = VRM_RECT;
window.W = W;
window.buildCustomSkin = buildCustomSkin;
window.has = has;
window.hexToRgba = hexToRgba;
window.luminance = luminance;
window.mixHex = mixHex;
window.parseGrad = parseGrad;
window.registerMascot = registerMascot;
window.sanitizeNotes = sanitizeNotes;
window.sanitizeSkinDef = sanitizeSkinDef;
window.toHex = toHex;
/* 領域（window.Trk.data）：公開名の正規の場所。旧名（window.X）は別名として残す（利用者の決定） */
window.Trk = window.Trk || {};
window.Trk.data = Object.assign(window.Trk.data || {}, { DIFFS, DIFF_IDS, EGG_KEYS, EGG_WORDS, FONT_DEFAULT, H, HEX, LAYOUTS, MASCOT_CAPTIONS, MASCOT_DEFS, MASCOT_FAMILY, MASCOT_IDS, MASCOT_POS, NOTE_PRESETS, NOTE_SHAPES, SKINS, TAU, VRM_RECT, W, accentInk, accentInkBackground, buildCustomSkin, has, hexToRgba, luminance, mixHex, parseGrad, registerMascot, sanitizeNotes, sanitizeSkinDef, toHex });
})();
