(() => {
  const core = window.Trk.core;
// SPDX-License-Identifier: GPL-3.0-or-later
/* ==========================================================================
   trk! fx-dock.js — 🎛 さわれるエフェクト本体（メイン画面の曲リストの下）
   ・本体のスキン7種（ボタン数がそれぞれ違う）、「5ボタンにそろえる」
   ・⏻ 電源＝ミュート、📡 アンテナ＝バックグラウンド再生、📺 キャスト＝外部出力選択、ボタン長押し＝今のエフェクトを登録
   ・🎲 エフェクト／⭐🎲 お気に入りから／🎛🎲 パラメーター（EQの🔒ロック、中身ロック）
   ・ボタンに入りきらないお気に入りは本体の下に ⭐○○ と並べる
   ・Media Session（ロック画面・通知の 再生／一時停止／次の曲）
   ・🧊 fx.js は変更しない。窓口 TrkFX と、fx.js が作った #fxQuickPanel・#fxPanel を使う
   読み込み順：fx-presets.js → fx-dock.js → fx.js
     （お気に入りの初期値を fx.js が読む前に入れる／visibilitychange を library.js・main.js より先に受け取る）
   ========================================================================== */
"use strict";

/* 読み上げ名を結びつけるための連番（作り直しても id が重ならないように） */
let eqDockLabelSeq = 0;
(() => {

/* ============ 最初のお気に入り（fx.js より先に prefs へ入れる。1回だけ） ============ */
const DEFAULT_FAV = ["vshape", "warp", "itodenwa", "spacesuit", "study"];
if (!core.prefs.fxFavSeeded) {
  const cur = Array.isArray(core.prefs.fxFav) ? core.prefs.fxFav : [];
  core.prefs.fxFav = [...DEFAULT_FAV, ...cur.filter(id => !DEFAULT_FAV.includes(id))];
}
core.settings.fxFavSeeded = true;

/* ============ 本体のスキン ============ */
const L4 = (ja, en, zh, ko) => ({ ja, en, zh, ko });
const DOCK_SKINS = {
  standard:{ n:5,  cols:5, deco:"",        label:L4("スタンダード", "Standard", "标准", "스탠다드") },
  cassette:{ n:4,  cols:4, deco:"reels",   label:L4("📼 ラジカセ", "📼 Boombox", "📼 收录机", "📼 카세트 라디오") },
  cd:      { n:6,  cols:3, deco:"disc",    label:L4("💿 CDプレーヤー", "💿 CD player", "💿 CD机", "💿 CD 플레이어") },
  md:      { n:3,  cols:3, deco:"disc",    label:L4("🎧 MDプレーヤー", "🎧 MiniDisc player", "🎧 MD播放器", "🎧 MD 플레이어") },
  keypad:  { n:12, cols:4, deco:"",        label:L4("⌨ 左手キーパッド", "⌨ Left-hand keypad", "⌨ 左手键盘", "⌨ 왼손 키패드") },
  future:  { n:8,  cols:4, deco:"scan",    label:L4("🛸 未来端末", "🛸 Future device", "🛸 未来终端", "🛸 미래 단말기") },
  aero:    { n:5,  cols:5, deco:"bubbles", label:L4("🫧 Frutiger Aero", "🫧 Frutiger Aero", "🫧 Frutiger Aero", "🫧 Frutiger Aero") }
};
const FAV_MAX = 0, TEMP_ID = "__chart", LONG_MS = 600;   /* 0＝上限なし（⭐は js/favs.js がフォルダ分けする） */
core.settings.fxDockSkin = core.pick(core.prefs.fxDockSkin, Object.keys(DOCK_SKINS), "standard");
core.settings.fxDockFive = !!core.prefs.fxDockFive;
core.settings.fxDockOpen = core.prefs.fxDockOpen === true;      // くわしい欄は最初は閉じる
core.settings.ampOpen = typeof core.prefs.ampOpen === "boolean" ? core.prefs.ampOpen : true;   // 🔥 TRKアンプの欄は最初から開いておく（「なんだこれ！」と気づいてもらう。触って閉じた人の記憶は残す）
core.settings.castPolicy = core.pick(core.settings.castPolicy, ["off", "antenna"], "off");
core.settings.backgroundPolicy = core.pick(core.settings.backgroundPolicy, ["off", "antenna", "corner"], core.settings.castPolicy === "antenna" ? "antenna" : "off");
core.settings.fxAntenna = core.settings.backgroundPolicy === "off" ? false : !!core.prefs.fxAntenna;
const antShapePref = core.prefs.fxAntennaShape === "miko" ? "reimu" : core.prefs.fxAntennaShape;   /* 旧保存値の移行 */
core.settings.fxAntennaShape = core.pick(antShapePref, ["rod", "loop", "dish", "beam", "truck", "robot", "cat", "slime", "ghost", "reimu", "marisa", "cirno", "flandre", "youmu", "custom"], "rod");
/* 🖼 自分のイラスト2枚（ON／OFF）の検証（純粋関数・テスト対象） */
function antCustomOk(u) { return typeof u === "string" && u.startsWith("data:image/") && u.length <= 400000; }
core.settings.fxAntennaCustomOn = antCustomOk(core.prefs.fxAntennaCustomOn) ? core.prefs.fxAntennaCustomOn : "";
core.settings.fxAntennaCustomOff = antCustomOk(core.prefs.fxAntennaCustomOff) ? core.prefs.fxAntennaCustomOff : "";
/* ---- 📡 アンテナのドットキャラ（16×16・全部trk!の描きおろし。東方キャラ5体の権利メモは NOTICE.md 2b節） ---- */
const ANT_CHARS = {
  truck: {
    pal: {"k": "#37474f", "r": "#ef5350", "R": "#b71c1c", "w": "#eceff1", "W": "#81d4fa", "y": "#ffee58", "o": "#546e7a", "O": "#b0bec5", "c": "#4dd0e1", "z": "#cfd8dc", ".": null},
    on: [["................", "................", "................", ".....kkkkkk.....", "....kwwwwwwk....", "....kWWkWWWk....", "....kwwwwwwk....", "..kkkkkkkkkkkk..", ".krrrrrrrrrrrrk.", ".krrrrrrrrrrryk.", ".kRRRRRRRRRRRRk.", ".krrrrrrrrrrrrk.", "..kkkkkkkkkkkk..", "...kkk....kkk...", "...kOok...kOok..", "....kk....kk...."], ["................", "................", "................", ".....kkkkkk.....", "....kwwwwwwk....", "....kWWWkWWk....", "....kwwwwwwk....", "c.kkkkkkkkkkkk..", "c.krrrrrrrrrrrk.", "..krrrrrrrrrryk.", "c.kRRRRRRRRRRRk.", "..krrrrrrrrrrrk.", "..kkkkkkkkkkkk..", "...kkk....kkk...", "...koOk...koOk..", "....kk....kk...."]],
    off: [["...........zz...", "..........z.....", "................", "................", ".....kkkkkk.....", "....kwwwwwwk....", "....kkkkkkkk....", "....kwwwwwwk....", "..kkkkkkkkkkkk..", ".krrrrrrrrrrrrk.", ".krrrrrrrrrrrrk.", ".kRRRRRRRRRRRRk.", ".krrrrrrrrrrrrk.", "..kkkkkkkkkkkk..", "...kkk....kkk...", "...kOok...kOok.."], ["..........zzz...", ".........z..z...", "................", "................", ".....kkkkkk.....", "....kwwwwwwk....", "....kkkkkkkk....", "....kwwwwwwk....", "..kkkkkkkkkkkk..", ".krrrrrrrrrrrrk.", ".krrrrrrrrrrrrk.", ".kRRRRRRRRRRRRk.", ".krrrrrrrrrrrrk.", "..kkkkkkkkkkkk..", "...kkk....kkk...", "...kOok...kOok.."]]
  },
  robot: {
    pal: {"k": "#37474f", "b": "#b0bec5", "B": "#78909c", "i": "#4dd0e1", "I": "#00e5ff", "a": "#ff7043", "A": "#ffca28", "z": "#cfd8dc", ".": null},
    on: [[".......A........", ".......k........", ".....kkkkk......", "....kbbbbbk.....", "....kibbbik.....", "....kbbbbbk.....", "...kkBBBBBkk....", "..kbbkbbbkbbk...", "..kbbkbbbkbbk...", "..kbbkkkkkbbk...", "....kbbbbbk.....", "....kbkbkbk.....", "....kbk.kbk.....", "....kkk.kkk.....", "................", "................"], [".......a........", ".......k........", ".....kkkkk......", "....kbbbbbk.....", "....kIbbbik.....", "....kbbbbbk.....", "...kkBBBBBkk....", "..kBbkbbbkbbk...", "..kbbkbbbkbBk...", "..kbbkkkkkbbk...", "....kbbbbbk.....", "....kbbkbbk.....", "....kbk.kbk.....", "....kkk.kkk.....", "................", "................"]],
    off: [["...........z.z..", "............z...", "................", "................", "................", "................", "..k.k..k.k......", "..k.k..k.k......", "..kkk..kkk......", "..kkkkkkkkkk....", "..kbbbbbbibk....", "..kbBBBBBBbk....", "..kbBBBBBBbk....", "..kkkkkkkkkk....", "..aa............", "................"], ["..........z.z...", "...........z....", "................", "................", "................", "................", "..k.k...k.k.....", "..k.k...k.k.....", "..kkk...kkk.....", "..kkkkkkkkkk....", "..kbbbbbbibk....", "..kbBBBBBBbk....", "..kbBBBBBBbk....", "..kkkkkkkkkk....", "..aa............", "................"]]
  },
  cat: {
    pal: {"k": "#37474f", "o": "#ffb74d", "O": "#f57c00", "w": "#fff8e1", "p": "#f48fb1", "z": "#cfd8dc", ".": null},
    on: [["................", "..........k..k..", "..........kokok.", "..........kooook", ".........koooook", ".........kokOook", "........koooooo.", "kk......kooooo..", "kok.....kppko...", ".kok...koooooo..", "..kok.kooooooo..", "...kookooooooo..", "....kooooooo....", "....ko.ok.o.....", "....kO.k.O......", "................"], ["................", "..........k..k..", "..........kokok.", "..........kooook", ".........koooook", ".........kokOook", "........koooooo.", ".k......kooooo..", "kok.....kppko...", "..ok...koooooo..", "..ok.kooooooo...", "...kookooooooo..", "....kooooooo....", "...ko..ok..o....", "...kO..k..O.....", "................"]],
    off: [["................", "................", "................", "................", "................", "................", "................", "................", "................", "................", "....kkkkkk......", "..kkoooooookk...", ".koooOOOOooook..", ".koookkkkooook..", ".koooooooook....", "..kkkkkkkkk....."], [".............z..", "..........z.....", "................", "................", "................", "................", "................", "................", "................", "................", "....kkkkkk......", "..kkoooooookk...", ".koooOOOOooook..", ".koookkkkooook..", ".koooooooook....", "..kkkkkkkkk....."]]
  },
  slime: {
    pal: {"k": "#1b5e20", "g": "#66bb6a", "G": "#43a047", "w": "#ffffff", "b": "#b2dfdb", "z": "#e0f2f1", ".": null},
    on: [["................", "................", "................", "................", ".....kkkkkk.....", "...kkggggggkk...", "..kgggggggggk...", "..kggwggwgggk...", "..kggkgggkggk...", ".kgggggggggggk..", ".kggggggggggGk..", ".kgggkkkkggGGk..", ".kgggggggggGGk..", "..kGGGGGGGGGk...", "...kkkkkkkkk....", "................"], ["................", "................", "................", "................", "................", "......kkkk......", "....kkggggkk....", "...kggggggggk...", "..kggwggwgggk...", ".kggkgggkggggk..", "kgggggggggggggk.", "kgggkkkkkgggGGk.", "kggggggggggGGGk.", "kGGGGGGGGGGGGGk.", ".kkkkkkkkkkkkk..", "................"]],
    off: [["................", "................", "................", "................", "................", "................", "................", "................", "................", ".....kkkkk......", "...kkkggggkk.b..", "..kgggggggggk...", ".kggkkggkkggGk..", "kggggggggggGGk..", "kGGGGGGGGGGGGk..", ".kkkkkkkkkkkk..."], ["................", "..........b.....", ".........bbb....", "................", "................", "................", "................", "................", "................", ".....kkkkk......", "...kkkggggkk....", "..kgggggggggk...", ".kggkkggkkggGk..", "kggggggggggGGk..", "kGGGGGGGGGGGGk..", ".kkkkkkkkkkkk..."]]
  },
  ghost: {
    pal: {"k": "#455a64", "w": "#eceff1", "W": "#b0bec5", "p": "#f8bbd0", "z": "#cfd8dc", ".": null},
    on: [["................", ".....kkkkk......", "...kkwwwwwkk....", "..kwwwwwwwwwk...", "..kwwkwwwkwwk...", "..kwwkwwwkwwk...", "..kwwwwwwwwwk...", "..kwwwpppwwwk...", "..kwwwwwwwwwk...", "kkwwwwwwwwwkk...", "kwwkwwwwwwkwk...", "kwwkkwwwwkkwk...", ".kww.kww.kwwk...", ".kw..kw..kwk....", "................", "................"], ["................", "......kkkkk.....", "....kkwwwwwkk...", "...kwwwwwwwwwk..", "...kwwkwwwkwwk..", "...kwwkwwwkwwk..", "...kwwwwwwwwwk..", "...kwwwpppwwwk..", "...kwwwwwwwwwk..", "...kwwwwwwwwwkk.", "...kwwwwwwwwkwk.", "...kwwwwwwwkkwk.", "...kww.kww.kwwk.", "....kw..kw..kwk.", "................", "................"]],
    off: [["................", "................", "................", "................", "................", "................", "................", "................", "....kkkkkkk.....", "...kwwwwwwwk....", "..kwwkwwwkwwk...", ".kwwwwwwwwwwwk..", ".kwwWwwWwwWwwk..", ".kwwWwwWwwWwwk..", ".kWWWWWWWWWWWk..", "..kkkkkkkkkkk..."], [".............z..", "..........z.z...", "................", "................", "................", "................", "................", "................", "....kkkkkkk.....", "...kwwwwwwwk....", "..kwwkwwwkwwk...", ".kwwwwwwwwwwwk..", ".kwwWwwWwwWwwk..", ".kwwWwwWwwWwwk..", ".kWWWWWWWWWWWk..", "..kkkkkkkkkkk..."]]
  },
  reimu: {
    pal: {"k": "#263238", "h": "#4e342e", "s": "#ffcc80", "r": "#e53935", "R": "#b71c1c", "w": "#fafafa", "b": "#ff8a80", "z": "#cfd8dc", ".": null},
    on: [["................", ".....kkkkk......", "....khhhhhk.....", "...khhhhhhhk....", "..khhsssshhk....", "..khsksskshk....", "..khsssssshk....", "...ksskkssk.....", "bb.kkkkkkk..b...", "bbkwwwwwwwkkb...", "..kwrrrrrwk.....", "..krrrrrrrk.....", "..krrrrrrrk.....", "..kRr..rRk......", "..kk....kk......", "................"], ["................", ".....kkkkk......", "....khhhhhk.....", "...khhhhhhhk....", "..khhsssshhk....", "..khsksskshk....", "..khsssssshk....", "...ksskkssk.....", "bbbkkkkkkkk.b...", "bbkwwwwwwwkkb...", "..kwrrrrrwk.....", "..krrrrrrrrk....", "..krrrrrrrk.....", "..kRr...rRk.....", "..kk.....kk.....", "................"]],
    off: [["................", "................", "................", "................", "....kkkkk.......", "...khhhhhk......", "..khhssshhk.....", "..khskksshk.....", "..khssssshk.....", "...ksskkssk.....", "..kkkkkkkkk.....", ".kwwrrrrrwwk....", ".kwrrrrrrrwk....", ".krrRRRRrrrk....", ".krrrrrrrrrk....", ".kkkkkkkkkkk...."], ["...........zz...", "..........z.....", "................", "................", "....kkkkk.......", "...khhhhhk......", "..khhssshhk.....", "..khskksshk.....", "..khssssshk.....", "...ksskkssk.....", "..kkkkkkkkk.....", ".kwwrrrrrwwk....", ".kwrrrrrrrwk....", ".krrRRRRrrrk....", ".krrrrrrrrrk....", ".kkkkkkkkkkk...."]]
  },
  marisa: {
    pal: {"k": "#37474f", "y": "#ffee58", "b": "#263238", "w": "#eceff1", "B": "#8d6e63", "S": "#a1887f", "s": "#fff176", "z": "#cfd8dc", ".": null},
    on: [["........s.......", ".......k........", "......kbk.......", ".....kwwwk......", "..kkkbbbbkkk....", "..kyyyyyyyk.....", "..kykyyykyk.....", "..kyyyyyyyk..s..", "..kwwwwwwwk.....", "..kbbwwwbbk.....", "..kbbbbbbbk.....", "..kbbbbbbbk.kk..", "...BBBBBBBBBBBB.", ".......kSSSSSSk.", "................", "................"], [".......s........", ".......k........", "......kbk.......", ".....kwwwk......", "..kkkbbbbkkk....", "..kyyyyyyyk.....", "..kyyyyyyyk.....", "..kyyyyyyyk.....", "..kwwwwwwwk.....", "..kbbwwwbbk.....", "..kbbbbbbbk.....", "..kbbbbbbbk.kk..", "...BBBBBBBBBBBB.", ".s....kSSSSSSk..", "................", "................"]],
    off: [["...z.z..........", "....z...........", "................", "................", "................", "....kkkkkkk.....", "...kbbbbbbbk....", "..kkbbbbbbbkk...", "..kyyyyyyyyk....", "..kwwwwwwwwk....", ".kbbwwwwwwbbk...", ".kbbbbbbbbbbk...", "..kk......kk....", ".BBBBBBSSSSSSS..", "................", "................"], ["..z..z..........", "...z............", "................", "................", "................", "....kkkkkkk.....", "...kbbbbbbbk....", "..kkbbbbbbbkk...", "..kyyyyyyyyk....", "..kwwwwwwwwk....", ".kbbwwwwwwbbk...", ".kbbbbbbbbbbk...", "..kk......kk....", ".BBBBBBBSSSSSS..", "................", "................"]]
  },
  cirno: {
    pal: {"k": "#37474f", "c": "#4fc3f7", "C": "#1565c0", "w": "#ffffff", "W": "#b3e5fc", "i": "#e1f5fe", "z": "#cfd8dc", ".": null},
    on: [["................", ".....kkkkk......", "....kccccck.....", ".W..kckckck..W..", ".WW.kcccccck.WW.", "..WWkcccccckWW..", "...WkcccccckW...", "....kwwwwwk.....", "....kCCCCCk.....", "...kCCCCCCCk....", "...kCCCCCCCk....", "....kkkkkkk.....", ".....k.k.k......", "................", "................", "................"], ["..i..........i..", ".....kkkkk......", ".W..kccccck..W..", ".WW.kckckck.WW..", "..WWkcccccckWW..", "...WkcccccckW...", "....kcccccck....", "....kwwwwwk.....", "....kCCCCCk.....", "...kCCCCCCCk....", "...kCCCCCCCk....", "....kkkkkkk.....", ".....k.k.k......", "................", "................", "................"]],
    off: [["................", "...z.z..........", "....z...........", "................", "................", ".....kkkkk......", "....kccccck.....", "...kccccccck....", "..kwwwwwwwwk....", "..kCCCCCCCCk....", ".kCCCCCCCCCCk...", ".kiiiiiiiiiik...", ".kiiiiiiiiiik...", ".kkkkkkkkkkkk...", "................", "................"], ["................", "..z..z..........", "...z............", "................", "..........i.....", ".....kkkkk......", "....kccccck.....", "...kccccccck....", "..kwwwwwwwwk....", "..kCCCCCCCCk....", ".kCCCCCCCCCCk...", ".kiiiiiiiiiik...", ".kiiiiiiiiiik...", ".kkkkkkkkkkkk...", "................", "................"]]
  },
  flandre: {
    pal: {"k": "#37474f", "y": "#ffee58", "r": "#e53935", "R": "#b71c1c", "w": "#fafafa", "o": "#ff9800", "G": "#ab47bc", "z": "#cfd8dc", ".": null},
    on: [["................", "......kkkk......", ".....kwwwwk.....", "....kwwrrwwk....", ".....kyyyyk.....", "....kyyyyyyk....", "....kykyykyk....", "o...kyyyyyyk...o", ".o..kwwwwwwk..o.", ".o..krrrrrrk..o.", "G.o.krrRRrrk.o.G", ".o..krrrrrrk..o.", "G...kkkkkkk...G.", ".....k...k......", "................", "................"], ["................", "......kkkk......", ".....kwwwwk.....", "....kwwrrwwk....", ".....kyyyyk.....", "....kyyyyyyk....", "....kyyyyyyk....", ".o..kyyyyyyk..o.", "..o.kwwwwwwk.o..", "..o.krrrrrrk.o..", ".oG.krrRRrrk.Go.", "..o.krrrrrrk.o..", ".G..kkkkkkk..G..", ".....k...k......", "................", "................"]],
    off: [["................", "....z.z.........", ".....z..........", "................", "................", "......kkkk......", ".....kwwwwk.....", "....kwwrrwwk....", "....kyyyyyyk..o.", "...kyyyyyyyyk.G.", "...kwwwwwwwwk.o.", "..kkrrrrrrrrkko.", ".krrrRRRRRRrrk..", "..kkkkkkkkkk....", "................", "................"], ["................", "...z..z.........", "....z...........", "................", "................", "......kkkk......", ".....kwwwwk.....", "....kwwrrwwk....", "....kyyyyyyk.o..", "...kyyyyyyyyk..G", "...kwwwwwwwwk..o", "..kkrrrrrrrrkk..", ".krrrRRRRRRrrk..", "..kkkkkkkkkk....", "................", "................"]]
  },
  youmu: {
    pal: {"k": "#37474f", "s": "#eceff1", "g": "#66bb6a", "w": "#ffffff", "D": "#4527a0", "m": "#f5f5f5", "t": "#90a4ae", "z": "#cfd8dc", ".": null},
    on: [["................", ".....kkkkkk.....", "....kssssssk....", "....kskskssk....", "....kssssssk....", "tt.kssssssk.....", "tt.kwwwwwk..mm..", "tt.kgwggwgk.mmm.", "tt.kggggggk.mmm.", "tt.kwwwwwwk.mm..", "tt.kDDDDDDk.....", ".tkDDDDDDDDk....", ".tkkkkkkkkk.....", "..k..kk..k......", "................", "................"], ["................", ".....kkkkkk.....", "....kssssssk....", "....kssssssk....", "....kssssssk....", "tt.kssssssk.....", "tt.kwwwwwk.mm...", "tt.kgwggwgk.mmm.", "tt.kggggggk..mm.", "tt.kwwwwwwk.....", "tt.kDDDDDDk.....", ".tkDDDDDDDDk....", ".tkkkkkkkkk.....", "..k..kk..k......", "................", "................"]],
    off: [["................", "...z.z..........", "....z...........", "................", "...........mmm..", "..........mmmm..", ".....kkkkkmmm...", "....kssssskm....", "...kssssssk.....", "...kgwwwgk......", "..kgggggggk.....", "..kDDDDDDk......", "..kkkkkkkk......", "................", "................", "................"], ["................", "..z..z..........", "...z............", "................", "..........mmmm..", ".........mmmmm..", ".....kkkkk.mm...", "....kssssskmm...", "...kssssssk.....", "...kgwwwgk......", "..kgggggggk.....", "..kDDDDDDk......", "..kkkkkkkk......", "................", "................", "................"]]
  }
};
const CHAR_SHAPE_IDS = Object.keys(ANT_CHARS);
const isCharShape = s => !!ANT_CHARS[s] || s === "custom";
/* フレーム選び（純粋関数・テスト対象）：ON＝起きる・歩く／OFF＝倒れる・眠る */
function antCharFrame(shape, on, t, ms) {
  const c = ANT_CHARS[shape];
  if (!c) return null;
  const frames = on ? c.on : c.off;
  return frames[Math.floor((t || 0) / (ms || 480)) % frames.length];
}
/* 1フレームを描く（純粋関数・テスト対象）：描いたドット数を返す */
function drawAntCharMatrix(g, chr, frame, px) {
  if (!chr || !frame) return 0;
  let n = 0;
  for (let y = 0; y < frame.length; y++) {
    const row = frame[y];
    for (let x = 0; x < row.length; x++) {
      const col = chr.pal[row[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x * px, y * px, px, px);
      n++;
    }
  }
  return n;
}

/* 📡 アンテナの置き場（純粋関数・テスト対象）：off＝許さない / antenna＝ドックの上 / corner＝右上（言語の左） */
function bgAntennaView(policy) {
  const p = policy === "antenna" || policy === "corner" ? policy : "off";
  return { allowed: p !== "off", dock: p === "antenna", corner: p === "corner" };
}
core.settings.fxEqLock = Array.isArray(core.prefs.fxEqLock) && core.prefs.fxEqLock.length === 5 ? core.prefs.fxEqLock.map(Boolean) : [false, false, false, false, false];
core.settings.fxLockChain = !!core.prefs.fxLockChain;
const skinDef = () => Object.prototype.hasOwnProperty.call(DOCK_SKINS, core.settings.fxDockSkin) ? DOCK_SKINS[core.settings.fxDockSkin] : DOCK_SKINS.standard;
const slotCount = () => core.settings.fxDockFive ? 5 : skinDef().n;
const slotCols = () => core.settings.fxDockFive ? 5 : skinDef().cols;

/* ============ 文章（接頭辞 dock…） ============ */
Object.assign(TEXT.ja, {
  dockTitle:"🎛 くわしく（EQ・スキン・メニュー）", dockFavLabel:"⭐ ボタンに入りきらないお気に入り",
  dockNoFavShort:"⭐ お気に入りがありません",
  dockNoFav:"お気に入りはまだありません。ボタンを長押しすると、今のエフェクトを登録できます。",
  dockMore:"⚙ 詳しい設定（ゲーム連動・マイプリセットなど）",
  dockPower:"⏻ 電源（ミュート）", dockAntenna:"📡 アンテナ（バックグラウンド再生）", dockCastButton:"キャスト",
  dockAntOn:"📡 バックグラウンド再生ON：裏にしても再生を続けます", dockAntOff:"📡 バックグラウンド再生OFF", dockMute:"🔇 MUTE", dockFxOff:"FX OFF", dockCastOn:"📡 キャスト先の選択を開きました", dockCastOffDone:"📡 キャストを切断しました", dockCastFailed:"外部出力を開始できませんでした。", dockCastUnsupported:"このブラウザは外部出力選択に対応していません。",
  dockBackgroundPolicy:"バックグラウンド再生アンテナ", dockBackgroundOff:"表示しない（バックグラウンド再生なし）", dockBackgroundAntenna:"ドックにアンテナを表示", dockBackgroundCorner:"右上に置く（言語の左・コンパクト）", dockBackgroundHint:"キャストとは別に、バックグラウンド再生だけを許可します。「ドックにアンテナを表示」か「右上に置く」のときONにすると、裏にしても再生を続けます。",
  dockCastPolicy:"キャストアンテナ", dockCastOff:"キャストしない（キャストアンテナを隠す）", dockCastAntenna:"キャストアンテナを表示", dockCastHint:"キャストアンテナはバックグラウンド再生のアンテナと別々に表示/非表示できます。ここで消しても、曲の再生用のアンテナは消えません。自動接続はせず、クリックしたときだけ対応ブラウザーの選択画面を開きます。",
  dockRandFx:"🎲 エフェクト", dockRandFav:"⭐🎲 お気に入りから", dockRandParam:"🎛🎲 パラメーター",
  dockParamDone:"パラメーターをランダムにしました", dockSlotHint:"ボタンを長押し：今のエフェクトを登録（もとの登録は1つ後ろへ）",
  dockEmptySlot:"空きボタン：長押しで今のエフェクトを登録", dockNeedOn:"先にエフェクトを選んでください",
  dockTempNo:"一時プリセットは登録できません（⚙設定のJSON編集で保存してください）", dockSaved:"{n}番に「{name}」を登録しました",
  dockSkinLabel:"本体のスキン", dockFive:"どのスキンでも5ボタンにする（往年の名機に5ボタン）",
  dockAntCheckLabel:"通常のアンテナを使う（バックグラウンド再生モード）",
  dockAntShapeLabel:"アンテナの形状", dockAntShapeRod:"伸縮ロッド（標準）", dockAntShapeLoop:"円形ループ", dockAntShapeDish:"パラボラ", dockAntShapeBeam:"サイバービーム",
  dockAntGroupChar:"ドットキャラ（ON＝起きる／OFF＝眠る）", dockAntGroupTouhou:"東方Project（二次創作）",
  dockAntCharTruck:"🚚 トラック", dockAntCharRobot:"🤖 ロボット", dockAntCharCat:"🐱 ネコ", dockAntCharSlime:"🫧 スライム", dockAntCharGhost:"👻 オバケ", dockAntCharCustom:"🖼 自分のイラスト2枚（ON／OFF）", dockAntCharReimu:"⛩ 霊夢", dockAntCharMarisa:"🧹 魔理沙", dockAntCharCirno:"❄ チルノ", dockAntCharFlandre:"🦇 フランドール", dockAntCharYoumu:"🗡 妖夢",
  dockAntCharHint:"ドットキャラはONで起きて動き、OFFで倒れて眠ります。どれもtrk!の描きおろしドット絵です（東方Projectのキャラは二次創作で、公式ガイドラインに従い無料のブラウザゲームとして提供しています。公式の素材ではありません）。",
  dockAntCustomOn:"ONの画像", dockAntCustomOff:"OFFの画像", dockAntCustomClear:"画像を消す", dockAntCustomNg:"画像を読み込めませんでした", dockAntCustomCleared:"ON／OFFの画像を消しました",
  dockAntCustomHint:"2枚の画像は端末内にだけ保存されます（設定を初期化すると消えます）。ONの画像＝アンテナが立っているとき、OFFの画像＝眠っているとき。大きい画像は自動で小さくします。",
  dockLockChain:"🔒 パラメーターのランダムでは、プリセットの中身を変えない（EQだけ）", dockLockHint:"🔒 を付けたEQは、ランダムでも動きません",
  dockAntHint:"アンテナを立てると、アプリを裏にしたり画面を消したりしても再生を続けます（選曲中のプレビュー・ラジオの待ち時間・AUTO中）。自分で遊んでいる最中は、記録を守るため今までどおり一時停止します。裏にしている間は、ビートに合わせて動くエフェクトと画面の動きが止まり、カウントダウンは省きます。ロック画面や通知から 再生・一時停止・次の曲 を操作できます。端末の省電力設定によっては止まることがあります。",
  /* 🔥 TRKアンプ（エフェクターラックを、左下から直接さわる） */
  ampTitle:"🔥 TRKアンプを使う",
  ampHint:"ポータブルアンプを段で積む「エフェクターラック」を、ここから直接さわれます（最大8段）。段はプリセットの後ろに重なります。",
  ampUse:"TRKアンプを使う（段を重ねる）",
  ampStateOn:"🔥 オン・{n}段", ampStateOff:"オフ・{n}段（段はそのまま残ります）",
  ampEmpty:"まだ段がありません。「TRKアンプを使う」を入れると標準の段を組みます。",
  ampStacksLabel:"ワンタップで段を組む",
  ampStackTrk:"🔥 TRKアンプ（標準）", ampStackWarm:"🍯 あたたか", ampStackRadio:"📻 ラジカセ", ampStackClean:"🧹 クリーン",
  ampStackSet:"🔥 {name}：{n}段を組みました", ampOnMsg:"🔥 TRKアンプ ON（{n}段）", ampOffMsg:"🔥 TRKアンプ OFF（段はそのまま）",
  ampCleared:"段を全部外しました", ampFull:"ラックは8段までです。",
  ampStageAdd:"＋ 段を追加", ampStagePick:"追加する段", ampClear:"✕ 全部外す",
  ampMore:"🎛 段をくわしく調整（設定を開く）",
  ampAdjustHint:"段のつまみ（しきい値・周波数など）は、設定の「🎚 エフェクターラック（段で重ねる）」で調整できます。アンプを切っても、プリセットの音はそのまま残ります。",
  midiMixTitle:"🎚 TRK MIDI MIX",
  midiMixHint:"MP3・WAVなど通常の再生音に音響効果をかけます。SoundFont音源や音声からMIDIへの変換ではありません。MIDI音色プロフィールとは独立し、初期設定はオフです。",
  midiMixEnable:"通常音声にTRK MIDI MIXを使う（初期オフ）", midiMixProfile:"MIXプロフィール"
});
Object.assign(TEXT.en, {
  dockTitle:"🎛 More (EQ, skin, menu)", dockFavLabel:"⭐ Favorites that don't fit on the buttons",
  dockNoFavShort:"⭐ No favorites yet",
  dockNoFav:"No favorites yet. Long-press a button to save the current effect there.",
  dockMore:"⚙ More settings (game-reactive, my presets, …)",
  dockPower:"⏻ Power (mute)", dockAntenna:"📡 Antenna (background playback)", dockCastButton:"Cast",
  dockAntOn:"📡 Background playback ON: keeps playing in the background", dockAntOff:"📡 Background playback OFF", dockMute:"🔇 MUTE", dockFxOff:"FX OFF", dockCastOn:"📡 Opened the cast picker", dockCastOffDone:"📡 Cast disconnected", dockCastFailed:"Couldn't start external playback.", dockCastUnsupported:"This browser doesn't support the external playback picker.",
  dockBackgroundPolicy:"Background playback antenna", dockBackgroundOff:"Hide (no background playback)", dockBackgroundAntenna:"Show on the dock", dockBackgroundCorner:"Top-right (left of Language, compact)", dockBackgroundHint:"Background playback can be allowed separately from casting. With \"Show on the dock\" or \"Top-right\", turning it on keeps playing in the background.",
  dockCastPolicy:"Cast antenna", dockCastOff:"Don't cast (hide the cast antenna)", dockCastAntenna:"Show the cast antenna", dockCastHint:"The cast antenna is toggled separately from the background playback antenna — hiding it never hides the playback one. It never auto-connects; clicking it opens the picker on supported browsers only.",
  dockRandFx:"🎲 Effect", dockRandFav:"⭐🎲 From favorites", dockRandParam:"🎛🎲 Parameters",
  dockParamDone:"Parameters randomized", dockSlotHint:"Long-press a button: save the current effect (the old one moves back one slot)",
  dockEmptySlot:"Empty button: long-press to save the current effect", dockNeedOn:"Pick an effect first",
  dockTempNo:"Temporary presets can't be saved here (save them via JSON in ⚙ Settings)", dockSaved:"Saved “{name}” to button {n}",
  dockSkinLabel:"Device skin", dockFive:"Use 5 buttons on every skin (5 buttons on a classic)",
  dockAntCheckLabel:"Use standard antenna (background playback mode)",
  dockAntShapeLabel:"Antenna shape", dockAntShapeRod:"Telescopic rod (default)", dockAntShapeLoop:"Circular loop", dockAntShapeDish:"Satellite dish", dockAntShapeBeam:"Cyber beam",
  dockAntGroupChar:"Dot characters (ON = awake / OFF = asleep)", dockAntGroupTouhou:"Touhou Project (fan art)",
  dockAntCharTruck:"🚚 Truck", dockAntCharRobot:"🤖 Robot", dockAntCharCat:"🐱 Cat", dockAntCharSlime:"🫧 Slime", dockAntCharGhost:"👻 Ghost", dockAntCharCustom:"🖼 Your own two images (ON / OFF)", dockAntCharReimu:"⛩ Reimu", dockAntCharMarisa:"🧹 Marisa", dockAntCharCirno:"❄ Cirno", dockAntCharFlandre:"🦇 Flandre", dockAntCharYoumu:"🗡 Youmu",
  dockAntCharHint:"Dot characters wake up and move when ON, and fall asleep when OFF. All are original pixel art drawn for trk! (the Touhou Project characters are fan works following the official guidelines, shipped as a free browser game; not official assets).",
  dockAntCustomOn:"ON image", dockAntCustomOff:"OFF image", dockAntCustomClear:"Remove images", dockAntCustomNg:"Couldn't load that image", dockAntCustomCleared:"ON/OFF images removed",
  dockAntCustomHint:"The two images are stored on your device only (cleared when settings are reset). ON image = antenna up, OFF image = asleep. Larger images are scaled down automatically.",
  dockLockChain:"🔒 Parameter random keeps the preset itself (EQ only)", dockLockHint:"EQ bands marked 🔒 don't move when randomizing",
  dockAntHint:"With the antenna up, playback continues when the app is in the background or the screen is off (song previews, the radio wait, and AUTO). While you're playing yourself, it still pauses to protect your records. In the background, beat-synced effects and animations stop and the countdown is skipped. You can play/pause/skip from the lock screen or notification. Some devices' battery savers may still stop it.",
  /* 🔥 TRK amp (reach the effect rack right from the bottom-left) */
  ampTitle:"🔥 Use the TRK amp",
  ampHint:"The layered “effect rack” — stacking stages like a portable amp — is right here (up to 8 stages). The stages stack after the preset.",
  ampUse:"Use the TRK amp (stack stages)",
  ampStateOn:"🔥 On · {n} stages", ampStateOff:"Off · {n} stages (kept as they are)",
  ampEmpty:"No stages yet. Turning the TRK amp on builds the standard stack.",
  ampStacksLabel:"Build a stack in one tap",
  ampStackTrk:"🔥 TRK amp (standard)", ampStackWarm:"🍯 Warm", ampStackRadio:"📻 Boombox", ampStackClean:"🧹 Clean",
  ampStackSet:"🔥 {name}: {n} stages built", ampOnMsg:"🔥 TRK amp ON ({n} stages)", ampOffMsg:"🔥 TRK amp OFF (stages kept)",
  ampCleared:"Removed every stage", ampFull:"The rack holds up to 8 stages.",
  ampStageAdd:"＋ Add stage", ampStagePick:"Stage to add", ampClear:"✕ Remove all",
  ampMore:"🎛 Fine-tune the stages (open settings)",
  ampAdjustHint:"Stage knobs (thresholds, frequencies…) live in Settings → 🎚 Effect rack (stack your own). Turning the amp off keeps your preset sound.",
  midiMixTitle:"🎚 TRK MIDI MIX",
  midiMixHint:"Adds audio effects to ordinary playback such as MP3 and WAV. It is not a SoundFont synthesizer or audio-to-MIDI converter. It is independent of the MIDI timbre profiles and starts off.",
  midiMixEnable:"Use TRK MIDI MIX on regular audio (off by default)", midiMixProfile:"MIX profile"
});
Object.assign(TEXT.zh, {
  dockTitle:"🎛 详细（均衡器·皮肤·菜单）", dockFavLabel:"⭐ 按钮放不下的收藏",
  dockNoFavShort:"⭐ 还没有收藏",
  dockNoFav:"还没有收藏。长按按钮即可登记当前音效。", dockMore:"⚙ 详细设置（游戏联动·我的预设等）",
  dockPower:"⏻ 电源（静音）", dockAntenna:"📡 天线（后台播放）", dockCastButton:"投放",
  dockAntOn:"📡 后台播放开启：切到后台也继续播放", dockAntOff:"📡 后台播放关闭", dockMute:"🔇 MUTE", dockFxOff:"FX OFF", dockCastOn:"📡 已打开投放选择", dockCastOffDone:"📡 已断开投放", dockCastFailed:"无法开始外部输出。", dockCastUnsupported:"此浏览器不支持外部输出选择。",
  dockBackgroundPolicy:"后台播放天线", dockBackgroundOff:"不显示（无后台播放）", dockBackgroundAntenna:"在机台上显示天线", dockBackgroundCorner:"放到右上角（语言左侧·紧凑）", dockBackgroundHint:"可以与投放分开，只允许后台播放。选择「在机台上显示」或「放到右上角」并开启后，切到后台也会继续播放。",
  dockCastPolicy:"投放天线", dockCastOff:"不投放（隐藏投放天线）", dockCastAntenna:"显示投放天线", dockCastHint:"投放天线与后台播放的天线分别开关，在这里隐藏也不会隐藏播放用的天线。不会自动连接，只在点击时于支持的浏览器打开选择画面。",
  dockRandFx:"🎲 音效", dockRandFav:"⭐🎲 从收藏", dockRandParam:"🎛🎲 参数",
  dockParamDone:"已随机调整参数", dockSlotHint:"长按按钮：登记当前音效（原来的往后挪一位）",
  dockEmptySlot:"空按钮：长按登记当前音效", dockNeedOn:"请先选择音效",
  dockTempNo:"临时预设无法登记（请在 ⚙设置 的JSON编辑中保存）", dockSaved:"已将“{name}”登记到 {n} 号",
  dockSkinLabel:"机身皮肤", dockFive:"所有皮肤都用5个按钮（给经典机型装上5键）",
  dockAntCheckLabel:"使用标准天线（后台播放模式）",
  dockAntShapeLabel:"天线形状", dockAntShapeRod:"伸缩拉杆（默认）", dockAntShapeLoop:"环形天线", dockAntShapeDish:"抛物面天线", dockAntShapeBeam:"赛博光束",
  dockAntGroupChar:"点阵角色（ON＝醒来／OFF＝睡着）", dockAntGroupTouhou:"东方Project（二次创作）",
  dockAntCharTruck:"🚚 卡车", dockAntCharRobot:"🤖 机器人", dockAntCharCat:"🐱 猫", dockAntCharSlime:"🫧 果冻", dockAntCharGhost:"👻 幽灵", dockAntCharCustom:"🖼 自己的两张图（ON／OFF）", dockAntCharReimu:"⛩ 灵梦", dockAntCharMarisa:"🧹 魔理沙", dockAntCharCirno:"❄ 琪露诺", dockAntCharFlandre:"🦇 芙兰朵露", dockAntCharYoumu:"🗡 妖梦",
  dockAntCharHint:"点阵角色在ON时醒来活动，OFF时倒下睡着。全部是trk!原创点绘（东方Project角色为二次创作，遵循官方指南、以免费浏览器游戏形式提供，并非官方素材）。",
  dockAntCustomOn:"ON的图片", dockAntCustomOff:"OFF的图片", dockAntCustomClear:"删除图片", dockAntCustomNg:"无法读取该图片", dockAntCustomCleared:"已删除ON／OFF图片",
  dockAntCustomHint:"两张图片只保存在设备内（初始化设置后会消失）。ON图＝天线立起时，OFF图＝睡着时。过大的图片会自动缩小。",
  dockLockChain:"🔒 参数随机时不改变预设本身（只改均衡器）", dockLockHint:"标记 🔒 的均衡器在随机时不会变化",
  dockAntHint:"竖起天线后，切到后台或关闭屏幕也会继续播放（选曲试听·电台等待·AUTO中）。自己游玩时为了保护记录，仍会照常暂停。后台期间，随节拍变化的音效和画面动画会停止，倒计时会省略。可以在锁屏或通知中播放·暂停·切到下一首。部分设备的省电设置仍可能停止播放。",
  /* 🔥 TRK 功放（在左下角直接操作效果机架） */
  ampTitle:"🔥 使用 TRK 功放",
  ampHint:"在这里直接操作“像多段便携功放一样叠段”的效果机架（最多8段）。段会叠加在预设之后。",
  ampUse:"使用 TRK 功放（叠加段）",
  ampStateOn:"🔥 开 · {n} 段", ampStateOff:"关 · {n} 段（段会保留）",
  ampEmpty:"还没有段。打开“使用 TRK 功放”会组好标准段。",
  ampStacksLabel:"一键组段",
  ampStackTrk:"🔥 TRK 功放（标准）", ampStackWarm:"🍯 温暖", ampStackRadio:"📻 收录机", ampStackClean:"🧹 清爽",
  ampStackSet:"🔥 {name}：已组 {n} 段", ampOnMsg:"🔥 TRK 功放 开（{n} 段）", ampOffMsg:"🔥 TRK 功放 关（段保留）",
  ampCleared:"已移除全部段", ampFull:"机架最多8段。",
  ampStageAdd:"＋ 添加一段", ampStagePick:"要添加的段", ampClear:"✕ 全部移除",
  ampMore:"🎛 细致调整段（打开设置）",
  ampAdjustHint:"段的旋钮（阈值、频率等）在设置的“🎚 效果器机架（分段叠加）”里调整。关闭功放不会改变预设的音色。",
  midiMixTitle:"🎚 TRK MIDI MIX",
  midiMixHint:"为 MP3、WAV 等普通播放音频添加音效。这不是 SoundFont 合成器，也不会将音频转换成 MIDI。它独立于 MIDI 音色配置，默认关闭。",
  midiMixEnable:"对普通音频使用 TRK MIDI MIX（默认关闭）", midiMixProfile:"MIX 配置"
});
Object.assign(TEXT.ko, {
  dockTitle:"🎛 자세히 (EQ·스킨·메뉴)", dockFavLabel:"⭐ 버튼에 다 들어가지 않는 즐겨찾기",
  dockNoFavShort:"⭐ 즐겨찾기가 없습니다",
  dockNoFav:"아직 즐겨찾기가 없습니다. 버튼을 길게 누르면 지금 이펙트를 등록할 수 있습니다.", dockMore:"⚙ 자세한 설정 (게임 연동·내 프리셋 등)",
  dockPower:"⏻ 전원 (음소거)", dockAntenna:"📡 안테나 (백그라운드 재생)", dockCastButton:"캐스트",
  dockAntOn:"📡 백그라운드 재생 ON: 백그라운드에서도 계속 재생", dockAntOff:"📡 백그라운드 재생 OFF", dockMute:"🔇 MUTE", dockFxOff:"FX OFF", dockCastOn:"📡 캐스트 선택을 열었습니다", dockCastOffDone:"📡 캐스트 연결을 끊었습니다", dockCastFailed:"외부 출력을 시작하지 못했습니다.", dockCastUnsupported:"이 브라우저는 외부 출력 선택을 지원하지 않습니다.",
  dockBackgroundPolicy:"백그라운드 재생 안테나", dockBackgroundOff:"표시하지 않기 (백그라운드 재생 없음)", dockBackgroundAntenna:"독에 안테나 표시", dockBackgroundCorner:"오른쪽 상단에 두기 (언어 왼쪽·컴팩트)", dockBackgroundHint:"캐스트와 별도로 백그라운드 재생만 허용할 수 있습니다. 독에 안테나 표시 또는 오른쪽 상단에 두기를 켜면 백그라운드에서도 계속 재생합니다.",
  dockCastPolicy:"캐스트 안테나", dockCastOff:"캐스트 안 함 (캐스트 안테나 숨기기)", dockCastAntenna:"캐스트 안테나 표시", dockCastHint:"캐스트 안테나는 백그라운드 재생 안테나와 별도로 켜고 끌 수 있으며, 여기서 숨겨도 재생용 안테나는 사라지지 않습니다. 자동 연결 없이 클릭할 때만 지원 브라우저의 선택기를 엽니다.",
  dockRandFx:"🎲 이펙트", dockRandFav:"⭐🎲 즐겨찾기에서", dockRandParam:"🎛🎲 파라미터",
  dockParamDone:"파라미터를 랜덤으로 바꿨습니다", dockSlotHint:"버튼 길게 누르기: 지금 이펙트 등록 (원래 것은 한 칸 뒤로)",
  dockEmptySlot:"빈 버튼: 길게 눌러 지금 이펙트 등록", dockNeedOn:"먼저 이펙트를 골라 주세요",
  dockTempNo:"임시 프리셋은 등록할 수 없습니다 (⚙설정의 JSON 편집으로 저장하세요)", dockSaved:"{n}번에 '{name}'을(를) 등록했습니다",
  dockSkinLabel:"본체 스킨", dockFive:"모든 스킨을 5버튼으로 (명기에 5버튼 달기)",
  dockAntCheckLabel:"일반 안테나 사용 (백그라운드 재생 모드)",
  dockAntShapeLabel:"안테나 모양", dockAntShapeRod:"신축식 로드 (기본)", dockAntShapeLoop:"원형 루프", dockAntShapeDish:"파라볼라 안테나", dockAntShapeBeam:"사이버 빔",
  dockAntGroupChar:"도트 캐릭터 (ON = 깨어남 / OFF = 잠듦)", dockAntGroupTouhou:"동방프로젝트 (2차 창작)",
  dockAntCharTruck:"🚚 트럭", dockAntCharRobot:"🤖 로봇", dockAntCharCat:"🐱 고양이", dockAntCharSlime:"🫧 슬라임", dockAntCharGhost:"👻 유령", dockAntCharCustom:"🖼 직접 고른 이미지 2장 (ON/OFF)", dockAntCharReimu:"⛩ 레이무", dockAntCharMarisa:"🧹 마리사", dockAntCharCirno:"❄ 치르노", dockAntCharFlandre:"🦇 플랑드르", dockAntCharYoumu:"🗡 요무",
  dockAntCharHint:"도트 캐릭터는 ON일 때 깨어서 움직이고 OFF일 때 쓰러져 잠듭니다. 모두 trk!의 오리지널 도트 그림입니다 (동방프로젝트 캐릭터는 2차 창작으로, 공식 가이드라인에 따라 무료 브라우저 게임으로 제공하며 공식 소재가 아닙니다).",
  dockAntCustomOn:"ON 이미지", dockAntCustomOff:"OFF 이미지", dockAntCustomClear:"이미지 삭제", dockAntCustomNg:"이미지를 읽지 못했습니다", dockAntCustomCleared:"ON/OFF 이미지를 삭제했습니다",
  dockAntCustomHint:"두 장의 이미지는 기기에만 저장됩니다(설정 초기화로 사라집니다). ON 이미지 = 안테나가 서 있을 때, OFF 이미지 = 잠들어 있을 때. 큰 이미지는 자동으로 줄입니다.",
  dockLockChain:"🔒 파라미터 랜덤에서 프리셋 자체는 바꾸지 않기 (EQ만)", dockLockHint:"🔒 표시한 EQ는 랜덤에서도 움직이지 않습니다",
  dockAntHint:"안테나를 세우면 앱을 백그라운드로 보내거나 화면을 꺼도 계속 재생합니다 (곡 선택 미리듣기·라디오 대기·AUTO 중). 직접 플레이하는 중에는 기록을 지키기 위해 지금처럼 일시정지합니다. 백그라운드에서는 비트에 맞춰 움직이는 이펙트와 화면 애니메이션이 멈추고, 카운트다운은 생략합니다. 잠금 화면이나 알림에서 재생·일시정지·다음 곡을 조작할 수 있습니다. 기기의 절전 설정에 따라 멈출 수도 있습니다.",
  /* 🔥 TRK 앰프 (왼쪽 아래에서 이펙터 랙을 바로 만지기) */
  ampTitle:"🔥 TRK 앰프 사용",
  ampHint:"휴대용 앰프처럼 단을 쌓는 ‘이펙터 랙’을 여기서 바로 만질 수 있어요 (최대 8단). 단은 프리셋 뒤에 겹쳐져요.",
  ampUse:"TRK 앰프 사용 (단 쌓기)",
  ampStateOn:"🔥 켜짐 · {n}단", ampStateOff:"꺼짐 · {n}단 (단은 그대로)",
  ampEmpty:"아직 단이 없어요. ‘TRK 앰프 사용’을 켜면 표준 단을 만들어요.",
  ampStacksLabel:"한 번에 단 구성하기",
  ampStackTrk:"🔥 TRK 앰프 (표준)", ampStackWarm:"🍯 따뜻하게", ampStackRadio:"📻 카세트 라디오", ampStackClean:"🧹 클린",
  ampStackSet:"🔥 {name}: {n}단을 구성했어요", ampOnMsg:"🔥 TRK 앰프 ON ({n}단)", ampOffMsg:"🔥 TRK 앰프 OFF (단은 그대로)",
  ampCleared:"모든 단을 뺐어요", ampFull:"랙은 최대 8단이에요.",
  ampStageAdd:"＋ 단 추가", ampStagePick:"추가할 단", ampClear:"✕ 전부 빼기",
  ampMore:"🎛 단을 자세히 조정 (설정 열기)",
  ampAdjustHint:"단의 노브(임계값·주파수 등)는 설정의 ‘🎚 이펙터 랙 (단으로 쌓기)’에서 조정해요. 앰프를 꺼도 프리셋 소리는 그대로예요.",
  midiMixTitle:"🎚 TRK MIDI MIX",
  midiMixHint:"MP3, WAV 등 일반 재생 오디오에 음향 효과를 적용합니다. SoundFont 신시사이저나 오디오를 MIDI로 변환하는 기능이 아닙니다. MIDI 음색 프로필과 독립적이며 기본값은 꺼짐입니다.",
  midiMixEnable:"일반 오디오에 TRK MIDI MIX 사용 (기본 꺼짐)", midiMixProfile:"MIX 프로필"
});

/* ============ 📡 アンテナ：バックグラウンド再生 ============
   library.js（プレビューを止める）・main.js（プレイを一時停止）より先に visibilitychange を受け取り、
   続けてよい場面だけ止める処理を飛ばす。自分で遊んでいる最中は止める（記録のため） */
const keepAlive = () => core.settings.fxAntenna &&
  (core.phase === "title" || core.phase === "ended" || (core.phase === "playing" && core.settings.autoPlay));
function wakeAC() { if (typeof audioCtx !== "undefined" && window.Trk.media.audioCtx && window.Trk.media.audioCtx.state === "suspended") window.Trk.media.audioCtx.resume().catch(() => {}); }
document.addEventListener("visibilitychange", e => {
  if (!document.hidden || !keepAlive()) return;
  e.stopImmediatePropagation();
  wakeAC();                                            // 裏ではブラウザが音の処理を止めることがあるので、再開を試みる
}, true);
/* 裏では画面の更新（requestAnimationFrame）が止まり、カウントダウンが進まないので省く */
function skipCountsIfHidden() {
  if (!document.hidden) return;
  const a = core.settings.countdown, b = core.settings.resumeCountdown;
  core.settings.countdown = false; core.settings.resumeCountdown = false;
  setTimeout(() => { core.settings.countdown = a; core.settings.resumeCountdown = b; }, 0);
}
on("beforePlay", skipCountsIfHidden);

/* ============ ロック画面・通知の操作（Media Session） ============ */
const ms = "mediaSession" in navigator ? navigator.mediaSession : null;
const setAct = (a, f) => { try { ms.setActionHandler(a, f); } catch (_) {} };
async function goNext() {
  if (typeof nextSong !== "function" || typeof selectSong !== "function") return;
  const nx = nextSong(); if (!nx) return;
  if (core.phase !== "title") window.Trk.play.toTitle();
  await selectSong(nx);
  if (core.settings.autoPlay && core.phase === "title" && core.videoReady && core.chart.length && core.currentSong === nx) { skipCountsIfHidden(); window.Trk.play.startGame(); }
}
function msMeta() {
  if (!ms || typeof MediaMetadata === "undefined") return;
  const s = core.currentSong || {};
  try {
    ms.metadata = new MediaMetadata({ title:s.title || core.baseName(core.mediaName) || "trk!", artist:s.artist || "trk!", album:"trk!",
      artwork:[{ src:"icons/icon-512.png", sizes:"512x512", type:"image/png" }, { src:"icons/icon-192.png", sizes:"192x192", type:"image/png" }] });
  } catch (_) {}
}
if (ms) {
  setAct("play", () => { skipCountsIfHidden(); if (core.phase === "paused") window.Trk.play.resumeGame(); else core.video.play().catch(() => {}); });
  setAct("pause", () => { if (core.phase === "playing") window.Trk.play.pauseGame(); else core.video.pause(); });
  setAct("nexttrack", () => { goNext(); });
}

/* ============ 🎛🎲 パラメーターのランダム ============ */
const BEATS = [.25, .5, 1, 2, 4];
const FREQ_KEYS = ["freq", "from", "to", "cutoff", "tone", "keepBass"];
function jitter(o) {
  if (Array.isArray(o)) return o.map(jitter);
  if (!o || typeof o !== "object") return o;
  const r = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v !== "number") { r[k] = jitter(v); continue; }
    if (k === "beats") r[k] = v ? BEATS[Math.floor(Math.random() * BEATS.length)] : 0;   // 0 は「ミリ秒で指定」のまま
    else if (FREQ_KEYS.includes(k)) r[k] = Math.round(v * Math.pow(2, (Math.random() * 2 - 1) * .6));
    else if (k === "bits") r[k] = Math.round(v + Math.random() * 4 - 2);
    else if (k === "gain" || k === "db") r[k] = Math.round((v + Math.random() * 6 - 3) * 2) / 2;
    else r[k] = +(v * (1 + (Math.random() * 2 - 1) * .35)).toFixed(3);
  }
  return r;                                            // 範囲外の値は fx.js の検証で自動的に丸められる
}

/* ============ 画面の組み立て（全部のファイルを読み終えてから） ============ */
addEventListener("DOMContentLoaded", () => {
  const col = document.querySelector(".songCol"), quick = core.$("fxQuickPanel"), full = core.$("fxPanel");
  if (!col || !quick || !full || !window.TrkFX) return;
  core.saveUserPrefs();

  const tx = (tag, key, cls) => { const n = core.el(tag, cls || "", tr(key)); n.dataset.i18n = key; return n; };
  const btn = (cls, ...kids) => { const b = core.el("button", cls); b.type = "button"; b.append(...kids); return b; };
  const names = () => Object.fromEntries(TrkFX.list().map(p => [p.id, p.name]));

  /* ---- 本体 ---- */
  const dock = core.el("div"); dock.id = "fxDock";
  const dev = core.el("div", "dockDev");
  const antWrap = core.el("div", "antWrap");
  const antBody = core.el("div", "antBody"), antTip = core.el("div", "antTip"), antSignal = core.el("div", "antSignal");
  const dockCharCv = core.el("canvas", "antChar"); dockCharCv.width = 48; dockCharCv.height = 48;
  antWrap.append(antBody, antTip, antSignal, dockCharCv);

  const powLed = core.el("i", "led"), antLed = core.el("i", "led ledAnt");
  const pow = btn("dockKey dockPow", powLed, core.el("span", "", "⏻"));
  const ant = btn("dockKey dockAnt", antLed, core.el("span", "antIcon", "📡"), core.el("span", "antTxt", "ANT"));
  const castTxt = core.el("span", "castTxt"), castAnt = btn("dockKey dockCast", castTxt);
  const lcd = core.el("div", "dockLcd");
  const top = core.el("div", "dockTop"); top.append(pow, lcd, ant, castAnt);
  const deco = core.el("div", "dockDeco");
  const slots = core.el("div", "dockSlots");
  const rFx = btn("dockKey"), rFav = btn("dockKey"), rPar = btn("dockKey");
  const rnd = core.el("div", "dockRand"); rnd.append(rFx, rFav, rPar);
  const slotHint = tx("div", "dockSlotHint", "hint dockHint");
  dev.append(antWrap, top, deco, slots, rnd, slotHint);

  /* 📡 右上（言語選択の左）のコンパクトなアンテナ。backgroundPolicy="corner"のときだけ出る */
  const cornerAnt = btn("cornerAnt", core.el("span", "caIcon", "📡"), core.el("i", "caSignal"));
  const cornerCharCv = core.el("canvas", "caCanvas"); cornerCharCv.width = 48; cornerCharCv.height = 48;
  cornerAnt.append(cornerCharCv);
  const headTools = document.querySelector(".headTools");
  if (headTools) headTools.prepend(cornerAnt);   /* 言語選択の左＝headTools の先頭 */

  /* ---- ⭐ お気に入り（フォルダのチップと、ボタンに入りきらないぶん） ---- */
  const overLabel = tx("div", "dockFavLabel", "hint");
  const overflow = core.el("div", "fxFavRow");
  const favChips = core.el("div", "favChipsWrap");

  /* ---- くわしい欄（メニュー・EQ・スキン） ---- */
  const body = core.el("details", "panel dockMore"); body.open = core.settings.fxDockOpen;
  body.addEventListener("toggle", () => { core.settings.fxDockOpen = body.open; core.saveUserPrefs(); });
  quick.classList.add("inDock");
  const eqRanges = Array.from(full.querySelectorAll('input[type="range"]')).slice(0, 5);   // fx.js のかんたんEQ
  const eqBox = core.el("div", "fxDockEq");
  eqBox.append(tx("div", "sfxEqLabel", "hint"));
  const mirrors = eqRanges.map((o, i) => {
    const row = core.el("div", "inline tight"), m = document.createElement("input"), val = core.el("span", "mono");
    m.type = "range"; m.min = o.min; m.max = o.max; m.step = o.step;
    m.addEventListener("input", () => { o.value = m.value; o.dispatchEvent(new Event("input", { bubbles:true })); });
    const lock = btn("fxMini dockLock");
    lock.addEventListener("click", () => { core.settings.fxEqLock[i] = !core.settings.fxEqLock[i]; core.saveUserPrefs(); render(); });
    const nameSpan = core.el("span", "", ["60Hz", "250Hz", "1kHz", "4kHz", "12kHz"][i]);
    nameSpan.id = "fxDockEqLab" + (++eqDockLabelSeq); m.setAttribute("aria-labelledby", nameSpan.id);
    row.append(nameSpan, m, val, lock);
    eqBox.append(row);
    return { o, m, val, lock, oVal:o.parentElement.querySelector(".mono") };
  });
  const origReset = full.querySelector('[data-i18n="sfxEqReset"]');
  if (origReset) { const r = tx("button", "sfxEqReset", "fxMini"); r.type = "button"; r.addEventListener("click", () => origReset.click()); eqBox.append(r); }
  const mkCheck = (key, label) => {
    const lab = core.el("label", "check"), inp = document.createElement("input");
    inp.type = "checkbox"; lab.append(inp, tx("span", label));
    inp.addEventListener("change", () => {
      if (key === "fxAntenna") { toggleAntenna(inp.checked); return; }
      core.settings[key] = inp.checked; core.saveUserPrefs(); render();
    });
    return { lab, inp };
  };
  const lockChain = mkCheck("fxLockChain", "dockLockChain");
  const skinRow = core.el("label", "field"), skinSel = document.createElement("select");
  skinRow.append(tx("span", "dockSkinLabel"), skinSel);
  skinSel.addEventListener("change", () => { core.settings.fxDockSkin = skinSel.value; core.saveUserPrefs(); render(true); });
  const five = mkCheck("fxDockFive", "dockFive");

  /* 📡 アンテナの形状 & 通常アンテナを使う（バックグラウンド再生モード）チェックボックス */
  const antShapeRow = core.el("label", "field antShapeField");
  const antShapeSel = document.createElement("select");
  const antShapes = [
    ["rod", "dockAntShapeRod"],
    ["loop", "dockAntShapeLoop"],
    ["dish", "dockAntShapeDish"],
    ["beam", "dockAntShapeBeam"]
  ];
  /* 🎭 キャラ肌：ON＝起きる・歩く／OFF＝倒れる・眠る（描きおろしドット絵＋自分のイラスト2枚） */
  const antChars = [
    ["truck", "dockAntCharTruck"],
    ["robot", "dockAntCharRobot"],
    ["cat", "dockAntCharCat"],
    ["slime", "dockAntCharSlime"],
    ["ghost", "dockAntCharGhost"],
    ["custom", "dockAntCharCustom"]
  ];
  /* ⛩🧹❄🦇🗡 東方Project（二次創作・NOTICE.md 2b節）：霊夢・魔理沙・チルノ・フランドール・妖夢 */
  const antTouhou = [
    ["reimu", "dockAntCharReimu"],
    ["marisa", "dockAntCharMarisa"],
    ["cirno", "dockAntCharCirno"],
    ["flandre", "dockAntCharFlandre"],
    ["youmu", "dockAntCharYoumu"]
  ];
  const buildAntShapes = () => {
    antShapeSel.textContent = "";
    const g1 = document.createElement("optgroup"); g1.label = tr("dockAntShapeLabel");
    for (const [k, lbl] of antShapes) {
      const o = document.createElement("option"); o.value = k; o.textContent = tr(lbl); o.dataset.i18n = lbl;
      g1.append(o);
    }
    /* optgroupの見出しは label 属性（data-i18n を付けると適用時の textContent 書き換えで子optionが消えるので使わない） */
    const g2 = document.createElement("optgroup"); g2.label = tr("dockAntGroupChar");
    for (const [k, lbl] of antChars) {
      const o = document.createElement("option"); o.value = k; o.textContent = tr(lbl); o.dataset.i18n = lbl;
      g2.append(o);
    }
    const g3 = document.createElement("optgroup"); g3.label = tr("dockAntGroupTouhou");
    for (const [k, lbl] of antTouhou) {
      const o = document.createElement("option"); o.value = k; o.textContent = tr(lbl); o.dataset.i18n = lbl;
      g3.append(o);
    }
    antShapeSel.append(g1, g2, g3);
    antShapeSel.value = core.settings.fxAntennaShape || "rod";
  };
  buildAntShapes();
  antShapeSel.addEventListener("change", () => {
    core.settings.fxAntennaShape = antShapeSel.value;
    core.saveUserPrefs();
    render();
  });
  antShapeRow.append(tx("span", "dockAntShapeLabel"), antShapeSel);

  /* 🖼 自分のイラスト2枚（ON／OFF）— 端末内にだけ保存 */
  const antCustomRow = core.el("div", "antCustomRow");
  function fileToAntImage(file, cb) {
    if (!file || !/^image\//.test(file.type)) { cb(""); return; }
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 96;   /* 大きい画像はこの寸法に収まるまで小さくする */
        const s = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d");
        if (!g) { cb(""); return; }
        g.drawImage(img, 0, 0, w, h);
        cb(c.toDataURL("image/png"));
      };
      img.onerror = () => cb("");
      img.src = String(r.result);
    };
    r.onerror = () => cb("");
    r.readAsDataURL(file);
  }
  const mkAntUpload = (which, labelKey) => {
    const lab = core.el("label", "antUploadLab"), inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    lab.append(tx("span", labelKey), inp);
    inp.addEventListener("change", () => {
      fileToAntImage(inp.files && inp.files[0], url => {
        if (antCustomOk(url)) {
          core.settings["fxAntennaCustom" + (which === "on" ? "On" : "Off")] = url;
          core.saveUserPrefs(); render();
        } else lcdFlash(tr("dockAntCustomNg"));
        inp.value = "";
      });
    });
    return lab;
  };
  const antCustomClear = tx("button", "dockAntCustomClear", "fxMini"); antCustomClear.type = "button";
  antCustomClear.addEventListener("click", () => {
    core.settings.fxAntennaCustomOn = ""; core.settings.fxAntennaCustomOff = "";
    core.saveUserPrefs(); lcdFlash(tr("dockAntCustomCleared")); render();
  });
  antCustomRow.append(mkAntUpload("on", "dockAntCustomOn"), mkAntUpload("off", "dockAntCustomOff"),
    antCustomClear, tx("div", "dockAntCustomHint", "hint"));

  const backgroundRow = core.el("label", "field"), backgroundSel = document.createElement("select");
  backgroundRow.append(tx("span", "dockBackgroundPolicy"), backgroundSel);
  for (const [value, key] of [["off", "dockBackgroundOff"], ["antenna", "dockBackgroundAntenna"], ["corner", "dockBackgroundCorner"]]) {
    const o = document.createElement("option"); o.value = value; o.dataset.i18n = key; o.textContent = tr(key); backgroundSel.append(o);
  }
  backgroundSel.value = core.settings.backgroundPolicy;
  const backgroundHint = tx("div", "dockBackgroundHint", "hint");
  backgroundSel.addEventListener("change", () => {
    core.settings.backgroundPolicy = backgroundSel.value === "antenna" || backgroundSel.value === "corner" ? backgroundSel.value : "off";
    if (core.settings.backgroundPolicy === "off") core.settings.fxAntenna = false;
    core.saveUserPrefs(); render();
  });
  const castRow = core.el("label", "field"), castSel = document.createElement("select");
  castRow.append(tx("span", "dockCastPolicy"), castSel);
  for (const [value, key] of [["off", "dockCastOff"], ["antenna", "dockCastAntenna"]]) {
    const o = document.createElement("option"); o.value = value; o.dataset.i18n = key; o.textContent = tr(key); castSel.append(o);
  }
  castSel.value = core.settings.castPolicy;
  const castHint = tx("div", "dockCastHint", "hint");
  castSel.addEventListener("change", () => {
    core.settings.castPolicy = castSel.value === "antenna" ? "antenna" : "off";
    if (core.settings.castPolicy === "off") disconnectExternalPlayback();
    core.saveUserPrefs(); render();
  });
  const antCheck = mkCheck("fxAntenna", "dockAntCheckLabel");

  const more = tx("button", "dockMore", "fxMini"); more.type = "button";
  more.addEventListener("click", () => {
    core.openSettings(); full.open = true;
    setTimeout(() => full.scrollIntoView({ behavior:"smooth", block:"start" }), 50);
  });
  body.append(tx("summary", "dockTitle"), quick, eqBox, tx("div", "dockLockHint", "hint"), lockChain.lab,
    skinRow, five.lab, backgroundRow, backgroundHint, castRow, castHint, antShapeRow, antCustomRow, tx("div", "dockAntCharHint", "hint"), antCheck.lab, tx("div", "dockAntHint", "hint"), more);

  /* ============ 🔥 TRKアンプ（左下・「くわしく」の下の独立カテゴリー） ============
     ポータブルアンプを段で積むエフェクターラック（fx.js）を、ここから直接さわる。
     ここはオン／オフ・組み方・並べ替え。つまみ（しきい値など）は設定の
     「🎚 エフェクターラック（段で重ねる）」＝#fxPanel で調整する。 */
  const AMP_MAX = 8;                                  /* fx.js の RACK_MAX と合わせる */
  const AMP_STACKS = {
    trk:   { label:"ampStackTrk",   stages:[
      { type:"gate", threshold:-58, floor:-34, attack:2, release:120 },
      { type:"exciter", freq:3200, amount:.28, mix:.4 },
      { type:"comp", threshold:-20, ratio:2.5, attack:.015, release:.3, knee:14, makeup:3 },
      { type:"gain", db:-1 }] },
    warm:  { label:"ampStackWarm",  stages:[
      { type:"exciter", freq:2600, amount:.32, mix:.45 },
      { type:"comp", threshold:-22, ratio:2.5, attack:.02, release:.3, knee:14, makeup:2.5 },
      { type:"gain", db:-1 }] },
    radio: { label:"ampStackRadio", stages:[
      { type:"comp", threshold:-30, ratio:6, attack:.005, release:.2, knee:8, makeup:4 },
      { type:"dynEQ", freq:3200, q:1.1, threshold:-38, range:7, attack:2, release:120 },
      { type:"gain", db:-2.5 }] },
    clean: { label:"ampStackClean", stages:[
      { type:"gate", threshold:-52, floor:-28, attack:1.5, release:120 },
      { type:"denoise", amount:10 },
      { type:"comp", threshold:-20, ratio:3, attack:.01, release:.25, knee:10, makeup:2 }] }
  };
  const amp = core.el("details", "panel dockAmp"); amp.id = "ampPanel";
  amp.open = core.settings.ampOpen;
  amp.addEventListener("toggle", () => { core.settings.ampOpen = amp.open; core.saveUserPrefs(); if (amp.open) renderAmp(); });
  const ampUseLab = core.el("label", "check"), ampUseInp = document.createElement("input");
  ampUseInp.type = "checkbox"; ampUseInp.id = "ampUseInp"; ampUseLab.append(ampUseInp, tx("span", "ampUse"));
  const ampState = core.el("div", "hint status"); ampState.id = "ampState";
  const ampStacks = core.el("div", "seg ampStacks"); ampStacks.id = "ampStacks";
  const ampStages = core.el("div", "ampStages");
  const ampRow = core.el("div", "miniActions");
  const ampSel = document.createElement("select"); ampSel.className = "fxQuickSelect";
  ampSel.setAttribute("aria-label", tr("ampStagePick"));
  const ampAdd = tx("button", "ampStageAdd", "fxMini"); ampAdd.type = "button";
  const ampClearBtn = tx("button", "ampClear", "fxMini"); ampClearBtn.type = "button";
  const ampMore = tx("button", "ampMore", "fxMini"); ampMore.type = "button";
  ampRow.append(ampSel, ampAdd, ampClearBtn);
  amp.append(tx("summary", "ampTitle"), tx("div", "ampHint", "hint"), ampUseLab, ampState,
    tx("div", "ampStacksLabel", "hint"), ampStacks, ampStages, ampRow, ampMore, tx("div", "ampAdjustHint", "hint"));
  for (const [id, st] of Object.entries(AMP_STACKS)) {
    const b = tx("button", st.label); b.type = "button"; b.dataset.ampstack = id; ampStacks.append(b);
  }
  const ampMini = (txt, fn) => {
    const b = core.el("button", "fxMini"); b.type = "button"; b.textContent = txt;
    b.addEventListener("click", fn); return b;
  };
  const ampTypeList = () => (window.TrkFX && typeof TrkFX.rackTypes === "function" ? TrkFX.rackTypes() : []);
  const ampMetaOf = type => ampTypeList().find(t => t.type === type) || { icon:"🎚", name:type };
  /* 名前（sfxType…）には絵文字が入っているので、二重にしない */
  const ampLabel = m => (m.name && m.icon && m.name.indexOf(m.icon) >= 0) ? m.name : (m.icon + " " + m.name);
  function ampBuildTypes() {
    ampSel.textContent = "";
    for (const t of ampTypeList()) ampSel.append(new Option(ampLabel(t), t.type));
  }
  function renderAmp() {
    const F = window.TrkFX;
    if (!F || typeof F.rack !== "function") { amp.hidden = true; return; }
    const info = F.rack(), list = Array.isArray(info.list) ? info.list : [];
    ampUseInp.checked = !!info.on;
    ampState.textContent = list.length ? tr(info.on ? "ampStateOn" : "ampStateOff", { n:list.length }) : tr("ampEmpty");
    ampState.classList.toggle("on", !!info.on && list.length > 0);
    ampStages.textContent = "";
    const types = list.map(f => f.type).join();
    list.forEach((f, i) => {
      const meta = ampMetaOf(f.type);
      const chip = core.el("div", "ampStage");
      chip.append(core.el("span", "ampName", ampLabel(meta)));
      const up = ampMini("↑", () => ampMove(i, -1));
      const dn = ampMini("↓", () => ampMove(i, 1));
      const rm = ampMini("✕", () => {
        F.rackSet(list.filter((_, j) => j !== i));
        ampFlash(F.rack().list.length ? "ampStateOn" : "ampCleared", F);
        renderAmp();
      });
      up.title = tr("sfxRackUp"); dn.title = tr("sfxRackDown"); rm.title = tr("sfxRackRemove");
      up.disabled = i === 0; dn.disabled = i === list.length - 1;
      chip.append(up, dn, rm);
      ampStages.append(chip);
    });
    for (const b of ampStacks.querySelectorAll("button[data-ampstack]")) {
      const st = AMP_STACKS[b.dataset.ampstack];
      b.classList.toggle("selected", !!st && st.stages.map(x => x.type).join() === types);
    }
    ampAdd.disabled = list.length >= AMP_MAX;
  }
  const ampFlash = (key, F, vars) => {
    const n = F && F.rack ? F.rack().list.length : 0;
    lcdFlash(tr(key, { n, ...(vars || {}) }));
  };
  function ampMove(i, dir) {
    const list = TrkFX.rack().list.slice(), j = i + dir;
    if (j < 0 || j >= list.length) return;
    const [x] = list.splice(i, 1); list.splice(j, 0, x);
    TrkFX.rackSet(list); renderAmp();
  }
  ampUseInp.addEventListener("change", () => {
    const F = TrkFX;
    if (ampUseInp.checked && !F.rack().list.length) {
      F.rackSet(AMP_STACKS.trk.stages.map(x => ({ ...x })));      // 空なら標準の段を組む
      F.rackOn(true);
      ampFlash("ampOnMsg", F);
    } else {
      F.rackOn(ampUseInp.checked);
      ampFlash(ampUseInp.checked ? "ampOnMsg" : "ampOffMsg", F);
    }
    renderAmp(); render();
  });
  for (const b of ampStacks.querySelectorAll("button[data-ampstack]")) b.addEventListener("click", () => {
    const st = AMP_STACKS[b.dataset.ampstack]; if (!st) return;
    TrkFX.rackSet(st.stages.map(x => ({ ...x })));
    TrkFX.rackOn(true);
    lcdFlash(tr("ampStackSet", { name:tr(st.label), n:TrkFX.rack().list.length }));
    renderAmp(); render();
  });
  ampAdd.addEventListener("click", () => {
    const n = TrkFX.rackAdd(ampSel.value);
    if (n < 0) { lcdFlash(tr("ampFull")); return; }
    TrkFX.rackOn(true);
    ampFlash("ampOnMsg", TrkFX);
    renderAmp(); render();
  });
  ampClearBtn.addEventListener("click", () => { TrkFX.rackClear(); lcdFlash(tr("ampCleared")); renderAmp(); render(); });
  ampMore.addEventListener("click", () => {
    core.openSettings(); full.open = true;
    const head = full.querySelector('[data-i18n="sfxRackTitle"]');
    setTimeout(() => { try { (head || full).scrollIntoView({ behavior:"smooth", block:"center" }); } catch (_) {} }, 60);
  });

  /* 🎚 通常音声向けの独立MIX（SoundFont合成や音声→MIDI変換ではない。初期オフ） */
  const midiMix = core.el("details", "panel dockMidiMix"); midiMix.id = "midiMixPanel";
  midiMix.open = core.settings.midiMixOpen !== false;
  midiMix.addEventListener("toggle", () => { core.settings.midiMixOpen = midiMix.open; core.saveUserPrefs(); });
  const midiMixUseLab = core.el("label", "check"), midiMixUseInp = document.createElement("input");
  midiMixUseInp.type = "checkbox"; midiMixUseLab.append(midiMixUseInp, tx("span", "midiMixEnable"));
  const midiMixProfileRow = core.el("label", "field"), midiMixProfileSel = document.createElement("select");
  midiMixProfileRow.append(tx("span", "midiMixProfile"), midiMixProfileSel);
  function buildMidiMixProfiles() {
    const api = window.Trk && window.Trk.midiProfiles;
    if (!api || typeof api.list !== "function") { midiMix.hidden = true; return; }
    midiMix.hidden = false;
    const selected = api.normalize(core.settings.midiMixProfile);
    if (selected !== core.settings.midiMixProfile) {
      core.settings.midiMixProfile = selected;
      core.saveUserPrefs();
    }
    midiMixProfileSel.textContent = "";
    for (const [category, labelKey] of [["reference", "midiProfileReference"], ["trk", "midiProfileOriginal"]]) {
      const group = document.createElement("optgroup"); group.label = tr(labelKey);
      for (const profile of api.list().filter(p => p.category === category)) {
        const option = document.createElement("option"); option.value = profile.id;
        const name = profile.name || {};
        option.textContent = name[core.settings.language] || name.en || name.ja || profile.id;
        group.append(option);
      }
      if (group.children.length) midiMixProfileSel.append(group);
    }
    midiMixProfileSel.value = selected;
  }
  function syncMidiMix() {
    midiMixUseInp.checked = core.settings.midiMixEnabled === true;
    midiMix.open = core.settings.midiMixOpen !== false;
    const api = window.Trk && window.Trk.midiProfiles;
    if (!api || typeof api.normalize !== "function") return;
    const selected = api.normalize(core.settings.midiMixProfile);
    if (selected !== core.settings.midiMixProfile) {
      core.settings.midiMixProfile = selected;
      core.saveUserPrefs();
    }
    midiMixProfileSel.value = selected;
  }
  midiMixUseInp.checked = core.settings.midiMixEnabled === true;
  midiMixUseInp.addEventListener("change", () => {
    const F = window.TrkFX;
    core.settings.midiMixEnabled = !!(F && typeof F.midiMixOn === "function" && F.midiMixOn(midiMixUseInp.checked));
    midiMixUseInp.checked = core.settings.midiMixEnabled;
  });
  midiMixProfileSel.addEventListener("change", () => {
    const F = window.TrkFX;
    const selected = F && typeof F.midiMixProfile === "function" ? F.midiMixProfile(midiMixProfileSel.value) : "studio_gm";
    core.settings.midiMixProfile = selected;
    midiMixProfileSel.value = selected;
  });
  midiMix.append(tx("summary", "midiMixTitle"), tx("div", "midiMixHint", "hint"), midiMixUseLab, midiMixProfileRow);
  buildMidiMixProfiles(); syncMidiMix();
  if (typeof on === "function") {
    on("language", () => { buildMidiMixProfiles(); syncMidiMix(); });
    on("midiMix", syncMidiMix);
    on("audioPrefsReset", () => { buildMidiMixProfiles(); syncMidiMix(); });
  }

  ampBuildTypes(); renderAmp();
  if (typeof on === "function") { on("fxRack", renderAmp); on("language", () => { ampBuildTypes(); renderAmp(); }); }

  dock.append(dev, favChips, overLabel, overflow, body);
  col.append(dock);

  /* 🔥 TRKアンプは「くわし」の直下（列のいちばん下）に置く独立カテゴリー。
     tv-dock.js が .songCol を並べ替える（くわしを列の下へ出す）ので、
     置き場所は「くわしの次の要素」を守り続ける：組み立て直後・次のタスク・
     列の並べ替え（MutationObserver）の3回そろえて合わせる。 */
  const ampOwner = () => col.querySelector(":scope > details.dockMore");
  const placeAmp = () => {
    const owner = ampOwner();
    if (owner && owner.nextElementSibling !== amp) owner.after(amp);
    else if (!owner && amp.parentElement !== col) col.append(amp);
  };
  if (!amp.parentElement) col.append(amp);
  placeAmp();
  setTimeout(placeAmp, 0);
  if (typeof MutationObserver === "function") {
    try { new MutationObserver(placeAmp).observe(col, { childList:true }); } catch (_) {}
  }

  /* 🎚 MIXは #richPanel の直下を維持する（TVドックの並べ替え・再生成にも追従）。 */
  const midiMixOwner = () => col.querySelector(":scope > #richPanel");
  const placeMidiMix = () => {
    const owner = midiMixOwner();
    if (owner && owner.nextElementSibling !== midiMix) owner.after(midiMix);
    else if (!owner && amp.parentElement === col && amp.nextElementSibling !== midiMix) amp.after(midiMix);
    else if (!owner && amp.parentElement !== col && midiMix.parentElement !== col) col.append(midiMix);
  };
  if (!midiMix.parentElement) col.append(midiMix);
  placeMidiMix(); setTimeout(placeMidiMix, 0);
  if (typeof MutationObserver === "function") {
    try { new MutationObserver(placeMidiMix).observe(col, { childList:true }); } catch (_) {}
  }

  /* ---- 液晶の一時メッセージ ---- */
  let flash = null;
  function lcdFlash(text) { flash = { text, until:Date.now() + 2000 }; render(); setTimeout(render, 2100); }

  /* ---- ボタンの動き ---- */
  function disconnectExternalPlayback() {
    try {
      if (core.video.remote && core.video.remote.state === "connected" && typeof core.video.remote.disconnect === "function") core.video.remote.disconnect();
    } catch (_) {}
  }
  async function requestExternalPlayback() {
    if (core.settings.castPolicy !== "antenna") return;
    try {
      if (core.video.remote && typeof core.video.remote.prompt === "function") {
        await core.video.remote.prompt();
        lcdFlash(tr("dockCastOn")); render(); return;
      }
      if (typeof core.video.webkitShowPlaybackTargetPicker === "function") {
        core.video.webkitShowPlaybackTargetPicker();
        lcdFlash(tr("dockCastOn")); render(); return;
      }
      lcdFlash(tr("dockCastUnsupported"));
    } catch (_) { lcdFlash(tr("dockCastFailed")); }
  }
  function castConnected() { return !!(core.video.remote && core.video.remote.state === "connected"); }
  function openCastPicker() {
    if (core.settings.castPolicy !== "antenna") return;
    if (castConnected()) { disconnectExternalPlayback(); lcdFlash(tr("dockCastOffDone")); render(); return; }
    requestExternalPlayback();
  }
  function toggleAntenna(forced) {
    if (!bgAntennaView(core.settings.backgroundPolicy).allowed) {
      core.settings.fxAntenna = false; core.saveUserPrefs(); lcdFlash(tr("dockBackgroundOff")); render(); return;
    }
    core.settings.fxAntenna = forced !== undefined ? !!forced : !core.settings.fxAntenna;
    core.saveUserPrefs();
    lcdFlash(tr(core.settings.fxAntenna ? "dockAntOn" : "dockAntOff"));
    render();
  }
  pow.addEventListener("click", () => { core.video.muted = !core.video.muted; render(); });
  core.video.addEventListener("volumechange", () => render());
  ant.addEventListener("click", () => toggleAntenna());
  antWrap.addEventListener("click", () => toggleAntenna());
  cornerAnt.addEventListener("click", () => toggleAntenna());

  /* 📡 ドットキャラを描き続ける（キャラ肌のときだけ絵を更新。置き場は render() が教える） */
  const charWhere = { dock: false, corner: false };
  const customImgs = { on: null, onSrc: "", off: null, offSrc: "" };
  function customImgOf(which) {
    const src = which === "on" ? core.settings.fxAntennaCustomOn : core.settings.fxAntennaCustomOff;
    if (!src) return null;
    if (customImgs[which + "Src"] !== src) {
      const img = new Image();
      img.src = src;
      customImgs[which] = img; customImgs[which + "Src"] = src;
    }
    const img = customImgs[which];
    return img && img.complete && img.naturalWidth > 0 ? img : null;
  }
  function drawAntChar(cv, on, t) {
    const g = cv.getContext("2d"); if (!g) return;
    g.clearRect(0, 0, cv.width, cv.height);
    const shape = core.settings.fxAntennaShape;
    if (shape === "custom") {
      const img = customImgOf(on ? "on" : "off");
      if (!img) { g.font = "18px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("📡", cv.width / 2, cv.height / 2 + 2); return; }
      const s = Math.min(cv.width / img.naturalWidth, cv.height / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      g.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
      return;
    }
    const c = ANT_CHARS[shape]; if (!c) return;
    drawAntCharMatrix(g, c, antCharFrame(shape, on, t), cv.width / 16);
  }
  function antCharTick(ts) {
    requestAnimationFrame(antCharTick);
    if (!isCharShape(core.settings.fxAntennaShape) || document.hidden) return;
    /* 🪶 軽量化：装飾を間引く設定では、このキャラの描き直しだけフレームレートを落とす
       （ドックは選曲中にも常時動いていたので、スマホではここで発熱が残っていた） */
    if (typeof TrkLite === "object" && typeof TrkLite.decorAllow === "function" && !TrkLite.decorAllow(performance.now())) return;
    if (charWhere.dock && dockCharCv.isConnected) drawAntChar(dockCharCv, core.settings.fxAntenna, ts || 0);
    if (charWhere.corner && cornerCharCv.isConnected) drawAntChar(cornerCharCv, core.settings.fxAntenna, ts || 0);
  }
  requestAnimationFrame(antCharTick);
  castAnt.addEventListener("click", () => openCastPicker());
  rFx.addEventListener("click", () => TrkFX.random());
  rFav.addEventListener("click", () => {
    const F = window.TrkFavs;
    const src = F ? F.pool("fx") : (core.settings.fxFav || []);
    const list = src.filter(id => id !== core.settings.fxPreset && names()[id]);
    if (list.length) TrkFX.select(list[Math.floor(Math.random() * list.length)]);
    else lcdFlash(tr("dockNoFavShort"));
  });
  rPar.addEventListener("click", () => {
    const eq = core.settings.fxEq.map((v, i) => core.settings.fxEqLock[i] ? v : Math.round((Math.random() * 12 - 6) * 2) / 2);
    const cur = TrkFX.current();
    if (!core.settings.fxLockChain && cur && cur.chain.length) {
      const base = cur.name.replace(/ 🎲$/, "").slice(0, 21);
      TrkFX.apply({ format:"trk-fx", version:1, name:base + " 🎲", chain:jitter(cur.chain), eq, volume:cur.volume });
    } else {
      eqRanges.forEach((o, i) => { if (core.settings.fxEqLock[i]) return; o.value = eq[i]; o.dispatchEvent(new Event("input", { bubbles:true })); });
    }
    lcdFlash("🎛🎲 " + tr("dockParamDone"));
  });

  /* ボタンに今のエフェクトを登録（もとの登録は1つ後ろへずらすので、消えない） */
  function assign(i) {
    if (!core.settings.fxOn) { lcdFlash(tr("dockNeedOn")); return; }
    const id = core.settings.fxPreset;
    if (id === TEMP_ID || !names()[id]) { lcdFlash(tr("dockTempNo")); return; }
    const F = window.TrkFavs;
    if (F) {
      /* ⭐ いま選んでいるフォルダ（1軍／2軍／🧊）へ入れる。上限なし。🧊は凍結中なら断る */
      const g = ["main", "sub", "frozen"].includes(F.activeOf("fx")) ? F.activeOf("fx") : "main";
      const r = F.add("fx", id, { group:g, index:i });
      if (!r.ok) { lcdFlash(F.msg(r.why)); return; }
      core.emit("language");
      lcdFlash(tr("dockSaved", { n:i + 1, name:names()[id] }));
      return;
    }
    const arr = (core.settings.fxFav || []).filter(x => x !== id);
    arr.splice(Math.min(i, arr.length), 0, id);
    core.settings.fxFav = arr; core.saveUserPrefs();
    core.emit("language");
    lcdFlash(tr("dockSaved", { n:i + 1, name:names()[id] }));
  }
  function slotButton(i, id, nm) {
    const on = core.settings.fxOn && core.settings.fxPreset === id;
    const b = btn("dockKey slot" + (id ? "" : " empty") + (on ? " selected" : ""), core.el("span", "num", String(i + 1)), core.el("span", "nm", nm || "—"));
    b.title = id ? nm : tr("dockEmptySlot");
    b.setAttribute("aria-pressed", String(on));
    let timer = 0, long = false;
    b.addEventListener("pointerdown", () => { long = false; timer = setTimeout(() => { long = true; assign(i); }, LONG_MS); });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, () => clearTimeout(timer));
    b.addEventListener("contextmenu", e => e.preventDefault());   // スマホの長押しメニューを出さない
    b.addEventListener("click", () => {
      if (long) return;
      if (!id) { lcdFlash(tr("dockEmptySlot")); return; }
      if (on) TrkFX.off(); else TrkFX.select(id);
    });
    return b;
  }

  /* ---- 飾り（スキンごと） ---- */
  function buildDeco() {
    deco.textContent = "";
    const d = skinDef().deco; deco.className = "dockDeco " + d; deco.hidden = !d;
    if (d === "reels") deco.append(core.el("i", "reel"), core.el("i", "reel"));
    else if (d === "disc") deco.append(core.el("i", "disc"));
    else if (d === "scan") deco.append(core.el("i", "scanbar"));
    else if (d === "bubbles") for (let k = 0; k < 4; k++) deco.append(core.el("i", "bubble"));
  }

  /* ---- 表示 ---- */
  let lastSkin = "";
  function render(skinChanged) {
    const nm = names();
    dock.dataset.skin = core.settings.fxDockSkin;
    dock.dataset.antShape = core.settings.fxAntennaShape || "rod";
    antWrap.dataset.shape = core.settings.fxAntennaShape || "rod";
    const charShape = isCharShape(core.settings.fxAntennaShape);
    antWrap.classList.toggle("char", charShape);
    cornerAnt.classList.toggle("char", charShape);
    if (antCustomRow) antCustomRow.hidden = core.settings.fxAntennaShape !== "custom";
    dock.classList.toggle("ant", core.settings.fxAntenna);
    dock.classList.toggle("playing", !core.video.paused);
    if (skinChanged || lastSkin !== core.settings.fxDockSkin) { buildDeco(); lastSkin = core.settings.fxDockSkin; }
    /* 電源・アンテナ・液晶 */
    powLed.classList.toggle("on", !core.video.muted);
    antLed.classList.toggle("on", core.settings.fxAntenna);
    ant.classList.toggle("on", core.settings.fxAntenna);
    const bgView = bgAntennaView(core.settings.backgroundPolicy);   /* off / antenna（ドック）/ corner（右上） */
    if (castSel) castSel.value = core.settings.castPolicy || "off";
    if (backgroundSel) backgroundSel.value = core.settings.backgroundPolicy || "off";
    ant.hidden = !bgView.dock; antWrap.hidden = !bgView.dock;
    cornerAnt.hidden = !bgView.corner;                         /* 右上のコンパクト版（言語の左） */
    charWhere.dock = bgView.dock; charWhere.corner = bgView.corner;   /* 📡 ドットキャラを描く場所 */
    cornerAnt.classList.toggle("on", core.settings.fxAntenna);
    cornerAnt.title = tr(core.settings.fxAntenna ? "dockAntOn" : "dockAntOff");
    cornerAnt.setAttribute("aria-label", cornerAnt.title);
    cornerAnt.setAttribute("aria-pressed", String(core.settings.fxAntenna));
    if (antCheck) { antCheck.lab.hidden = !bgView.allowed; antCheck.inp.checked = core.settings.fxAntenna; antCheck.inp.disabled = !bgView.allowed; }
    if (antShapeSel) antShapeSel.value = core.settings.fxAntennaShape || "rod";
    pow.title = tr("dockPower"); pow.setAttribute("aria-label", pow.title); pow.setAttribute("aria-pressed", String(!core.video.muted));
    ant.title = tr("dockAntenna"); ant.setAttribute("aria-label", ant.title); ant.setAttribute("aria-pressed", String(core.settings.fxAntenna));
    castAnt.hidden = core.settings.castPolicy !== "antenna";
    castAnt.classList.toggle("selected", castConnected());
    castAnt.title = castConnected() ? tr("dockCastOffDone") : tr("dockCastButton");
    castAnt.setAttribute("aria-label", castAnt.title); castAnt.setAttribute("aria-pressed", String(castConnected()));
    castTxt.textContent = tr("dockCastButton");
    lcd.textContent = flash && Date.now() < flash.until ? flash.text
      : (core.video.muted ? tr("dockMute") + " · " : "") + (core.settings.fxOn ? (nm[core.settings.fxPreset] || "FX") : tr("dockFxOff")) + (core.settings.fxAntenna ? " 📡" : "");
    /* ランダム */
    rFx.textContent = tr("dockRandFx"); rFav.textContent = tr("dockRandFav"); rPar.textContent = tr("dockRandParam");
    /* ⭐ ボタン（いまのフォルダの中身。1軍＝これまでの settings.fxFav）と、入りきらないぶん */
    const F = window.TrkFavs;
    const favGroup = F && ["main", "sub", "frozen"].includes(F.activeOf("fx")) ? F.activeOf("fx") : "main";
    const favAll = F ? F.list("fx", favGroup) : (core.settings.fxFav || []);
    const fav = favAll.filter(id => nm[id]), n = slotCount();
    slots.style.setProperty("--cols", slotCols());
    slots.textContent = "";
    for (let i = 0; i < n; i++) slots.append(slotButton(i, fav[i], nm[fav[i]]));
    if (F) {
      favChips.textContent = "";
      favChips.append(F.chips("fx", { former:true, onChange: () => render() }));
    }
    overflow.textContent = "";
    const rest = fav.slice(n);
    if (!F) overLabel.hidden = !rest.length && fav.length > 0;
    else {
      const lock = F.locked("fx", favGroup) ? " 🔒" : "";
      const former = F.count("fx", "former");
      overLabel.textContent = tr("favHintDock", { g: F.label(favGroup) + lock, n: favAll.length, m: n })
        + (former ? " ／ " + tr("favHintN", { g: F.label("former"), n: former }) : "");
      overLabel.hidden = !favAll.length;
    }
    if (!fav.length) overflow.append(tx("div", "dockNoFav", "hint"));
    for (const id of rest) {
      const on = core.settings.fxOn && core.settings.fxPreset === id;
      const b = btn(on ? "selected" : "", "⭐" + (F && F.pinned("fx", id) ? "📌" : "") + nm[id]);
      b.setAttribute("aria-pressed", String(on));
      b.addEventListener("click", () => { if (on) TrkFX.off(); else TrkFX.select(id); });
      if (F) {
        /* 長押しでメニュー（1軍／2軍／🧊／📌／外す） */
        let t = 0, lng = false;
        b.addEventListener("pointerdown", () => { lng = false; t = setTimeout(() => { lng = true; F.menu(b, "fx", id); }, LONG_MS); });
        for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, () => clearTimeout(t));
        b.addEventListener("click", e => { if (lng) { e.stopImmediatePropagation(); lng = false; } }, true);
        b.addEventListener("contextmenu", e => { e.preventDefault(); F.menu(b, "fx", id); });
      }
      overflow.append(b);
    }
    /* くわしい欄 */
    skinSel.textContent = "";
    for (const [id, d] of Object.entries(DOCK_SKINS)) {
      const o = document.createElement("option"); o.value = id; o.textContent = `${d.label[lang] || d.label.en}（${d.n}）`; skinSel.append(o);
    }
    skinSel.value = core.settings.fxDockSkin;
    five.inp.checked = core.settings.fxDockFive; lockChain.inp.checked = core.settings.fxLockChain;
    for (const [i, r] of mirrors.entries()) {
      r.m.value = r.o.value; if (r.oVal) r.val.textContent = r.oVal.textContent;
      r.lock.textContent = core.settings.fxEqLock[i] ? "🔒" : "🔓";
      r.lock.setAttribute("aria-pressed", String(core.settings.fxEqLock[i]));
    }
  }

  /* fx.js が表示を作り直したら（プリセット・お気に入り・EQ・言語の変更）こちらも更新 */
  let queued = false;
  const update = () => {
    if (queued) return; queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (typeof buildAntShapes === "function") buildAntShapes();
      render();
    });
  };
  const mo = new MutationObserver(update);
  const sel = quick.querySelector("select"); if (sel) mo.observe(sel, { childList:true });
  for (const r of mirrors) if (r.oVal) mo.observe(r.oVal, { childList:true, characterData:true, subtree:true });
  core.video.addEventListener("play", () => { if (ms) ms.playbackState = "playing"; msMeta(); wakeAC(); update(); });
  core.video.addEventListener("pause", () => { if (ms) ms.playbackState = "paused"; update(); });
  on("chart", msMeta);
  on("language", update);
  render(true);
});
})();
/* ✅ fx-dock.js 完了 */
})();
