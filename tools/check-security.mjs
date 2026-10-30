#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * trk! static security check (🛡).
 *
 * `npm run check` の一部として走る、静的な「守りが残っているか」の見張り番。
 * ここが見ているのは、過去に洗い出して塞いだ穴が **戻ってこないこと**（回帰よけ）:
 *
 *   1. 動的コード評価は同意フローのアドオン実行器1か所だけ（ほかに new Function / document.write / srcdoc / 素の innerHTML がない）
 *   2. 外から来た文字列を <a href> にするときに、https の関所（safeHttpUrl / safeLink）を通しているか
 *   3. 共有ファイル（パック・譜面・スキン・TVスキン・エフェクト・公認リスト）の検証関数が残っているか
 *   4. 設定の読み込みが __proto__ / constructor / prototype を踏まないか
 *   5. ZIP（.stpack）の展開が、宣言サイズを信用せず上限で止まるか
 *   6. アドオンが安全モードで止まり、遠隔のコードを取りに行かないか
 *   7. ページから出ていく通信が、許した相手だけか（同一オリジンのみ。ライブラリは assets/vendor に同梱＝F-5）
 *   8. 入力ファイルは読み取り専用で、明示的なStudy書き出しだけが選択先に新規コピーを作るか（既存ファイルを上書きしないか）
 *
 * 実行: node tools/check-security.mjs
 */
import fs from "node:fs";
import { restoreCoreAlias, sourceOf } from "./lib/js-source.mjs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => sourceOf(rel, fs.readFileSync(path.join(root, rel), "utf8"));
const exists = rel => fs.existsSync(path.join(root, rel));
const jsFiles = fs.readdirSync(path.join(root, "js")).filter(f => f.endsWith(".js"));
/* 名前空間 D：js/ の本文では領域の接頭辞 window.Trk.<領域>. を取り除いて照合する（window.Trk.overlay は残す） */
const js = Object.fromEntries(jsFiles.map(f => ["js/" + f, read("js/" + f).replace(/window\.Trk\.(?!overlay\b)[A-Za-z]\w*\./g, "")]));
const allJs = Object.entries(js);
const indexHtml = read("index.html");
const sw = read("sw.js");

let pass = 0, failed = 0;
const rule = (ok, label, detail = "") => {
  if (ok) { pass++; console.log("OK    " + label + (detail ? " — " + detail : "")); }
  else { failed++; console.log("FAIL  " + label + (detail ? " — " + detail : "")); }
};
const occurrences = (text, re) => [...text.matchAll(re)];

/* ---------- 1. コード実行につながる書き方 ---------- */
{
  const bad = [], indirectEval = [];
  for (const [file, text] of allJs) {
    for (const re of [/\beval\s*\(/g, /new\s+Function\s*\(/g, /document\.write\s*\(/g, /\bsrcdoc\b/g,
      /createContextualFragment\s*\(/g, /set(?:Timeout|Interval)\s*\(\s*["'`]/g]) {
      for (const m of occurrences(text, re)) bad.push(`${file}: ${m[0].trim()}`);
    }
    for (const m of occurrences(text, /\(\s*0\s*,\s*eval\s*\)\s*\(/g)) indirectEval.push({ file, call:m[0] });
  }
  const addonRunner = indirectEval.length === 1 && indirectEval[0].file === "js/addons.js" &&
    /function runCode\(code\)[\s\S]{0,220}\(0, eval\)\(code\)/.test(js["js/addons.js"]);
  rule(bad.length === 0 && addonRunner, "dynamic evaluation is confined to the single indirect-eval add-on runner",
    [...bad.slice(0, 2), ...indirectEval.map(x => x.file + ": " + x.call)].join(" · "));

  /* innerHTML は、ゲーム結果画面の1か所だけ（すべて esc() を通した文字列）。増えたら気づけるようにする。 */
  const inner = [];
  for (const [file, text] of allJs) for (const m of occurrences(text, /\.innerHTML\s*=/g)) inner.push(file);
  const gameOnly = inner.every(f => f === "js/game.js");
  const gameUsesEsc = !js["js/game.js"] || !inner.includes("js/game.js") || /esc\(/.test(js["js/game.js"]);
  rule(gameOnly && gameUsesEsc, "innerHTML is limited to the esc()d result screen", inner.join(", ") || "none");
}

/* ---------- 2. リンクの関所 ---------- */
{
  const helpers = js["js/core.js"].includes("function safeHttpUrl(") && js["js/core.js"].includes("function safeLink(") &&
    js["js/core.js"].includes('u.protocol === "https:"');
  rule(helpers, "safeHttpUrl / safeLink exist in core.js (https only, no javascript:/data:)");

  /* `X.href = 何か.url` のような「外から来た URL をそのまま href にする」形を探す */
  const rawHref = [];
  for (const [file, text] of allJs) {
    for (const m of occurrences(text, /\.href\s*=\s*[^;\n]*?\.(?:url|link|srcUrl|href)\b[^;\n]*/g)) {
      const line = m[0];
      if (/safeHttpUrl|safeLink|createObjectURL/.test(line)) continue;
      rawHref.push(file + ": " + line.trim());
    }
  }
  rule(rawHref.length === 0, "no raw `href = …url` assignments left (use safeLink)", rawHref.slice(0, 2).join(" · "));

  /* target=_blank には rel=noopener。JS と HTML の両方を見る。 */
  const jsBlank = [];
  for (const [file, text] of allJs) {
    for (const m of occurrences(text, /target\s*=\s*"_blank"/g)) {
      /* 同じ文の前後（rel は target の前でも後でも書ける。safeLink は次の行で rel を付けている） */
      const around = text.slice(Math.max(0, m.index - 200), m.index + 220);
      if (/noopener/.test(around)) continue;
      jsBlank.push(file + ": " + text.slice(m.index, m.index + 40).trim());
    }
  }
  const htmlBlank = occurrences(indexHtml, /<a\b[^>]*target="_blank"[^>]*>/g)
    .filter(m => !/rel="[^"]*noopener/.test(m[0])).map(m => m[0].slice(0, 60));
  rule(jsBlank.length === 0 && htmlBlank.length === 0, "every target=_blank link carries rel=noopener",
    [...jsBlank, ...htmlBlank].slice(0, 2).join(" · "));
}

/* ---------- 3. 共有ファイルの検証関数 ---------- */
{
  const need = [
    ["js/custom.js", "function sanitizeManifest(", "パック（pack.json）"],
    ["js/data.js", "function sanitizeSkinDef(", "カスタムスキン"],
    ["js/custom.js", "function sanitizeCreditCard(", "作者の名刺"],
    ["js/custom.js", "const safePath =", "パック内のファイルパス（../ と絶対パスを弾く）"],
    ["js/tv-dock.js", "function sanitizeTvDef(", "カスタムTVスキン"],
    ["js/media.js", "function validateChartData(", "譜面"],
    ["js/verified.js", "function cleanVerified(", "公認リスト"],
    ["js/fx.js", "function cleanPreset(", "エフェクトのプリセット"],
    ["js/fx.js", "function cleanFx(", "エフェクトの段"],
    ["js/favs.js", "function importObj(", "⭐の書き出し/読み込み"],
  ];
  const missing = need.filter(([file, token]) => !js[file].includes(token)).map(([, , what]) => what);
  rule(missing.length === 0, "validators for every shared file format are present", missing.join(", "));

  const packGuards = js["js/custom.js"].includes('!p.includes("..")') && js["js/custom.js"].includes("PATH_RE.test(p)") &&
    js["js/custom.js"].includes("file.size > packCap(PACK_MAX)");
  rule(packGuards, "pack paths and size caps are enforced (no zip-slip, no 500MB+ packs)");

  const httpsOnly = js["js/library.js"].includes("/^https:\\/\\/\\S+$/i") && js["js/verified.js"].includes("/^https:\\/\\/[^\\s\"'<>]+$/");
  rule(httpsOnly, "shared links are https-only at import time (playlists / verified list)");
}

/* ---------- 4. 設定の読み込み（プロトタイプ汚染よけ） ---------- */
{
  const core = js["js/core.js"];
  const guard = core.includes('const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"])') &&
    core.includes("UNSAFE_KEYS.has(k)") && core.includes("Object.prototype.hasOwnProperty.call(settings, k)");
  rule(guard, "the settings import skips __proto__ / constructor / prototype and inherited keys");

  const enumFnStart = core.indexOf("function validImportedSettingEnum(");
  const enumFnEnd = core.indexOf("\n}", enumFnStart);
  const enumFn = enumFnStart >= 0 && enumFnEnd >= 0 ? core.slice(enumFnStart, enumFnEnd + 2) : "";
  let enumBehavior = false;
  try {
    /* 🪶 軽量化と 🐔 trk タブ表示名の許可リストは core.js 側の定数なので、実物を取り出して同じもので検証する */
    const liteSrc = /const LITE_ENUM_VALUES = \{[\s\S]*?\n\};/.exec(core);
    const LITE_ENUM_VALUES = liteSrc ? vm.runInNewContext(`(()=>{${liteSrc[0]}; return LITE_ENUM_VALUES;})()`) : null;
    const trkSrc = /const TRK_ENUM_VALUES = \{[\s\S]*?\n\};/.exec(core);
    const TRK_ENUM_VALUES = trkSrc ? vm.runInNewContext(`(()=>{${trkSrc[0]}; return TRK_ENUM_VALUES;})()`) : null;
    const validate = vm.runInNewContext(`(${enumFn})`, { window:{
      TrkSpec:{ styles:() => ["bars"], themes:() => ["neon"] },
      TrkMMD:{ builtins:() => ["faceSing"] },
      TrkFX:{ list:() => [{ id:"flat" }, { id:"my_test" }] },
      Trk:{ midiProfiles:{ list:() => [{ id:"studio_gm" }, { id:"trk_pixel" }] } }
    }, LITE_ENUM_VALUES, TRK_ENUM_VALUES });
    enumBehavior = validate("specStyle", "bars") && !validate("specStyle", "constructor") &&
      validate("specTheme", "neon") && !validate("specTheme", "__proto__") &&
      validate("mmdMotionKind", "faceSing") && validate("mmdMotionKind", "auto") && validate("mmdMotionKind", "none") &&
      !validate("mmdMotionKind", "file") && !validate("mmdMotionKind", "constructor") &&
      validate("fxPreset", "flat") && validate("fxPreset", "my_test") && !validate("fxPreset", "constructor") &&
      validate("midiSoundProfile", "studio_gm") && validate("midiMixProfile", "trk_pixel") &&
      !validate("midiSoundProfile", "constructor") && !validate("midiMixProfile", "__proto__") &&
      /* 🪶 M-02：{ "60":60, … }[settings.liteFps] || 30 に継承キーが入ると Object 関数が truthy で返り、
         || 30 の保険が効かずゲート間隔が NaN になる（軽量化が一瞬効かなくなる）。Import時点で弾く。 */
      validate("liteFps", "30") && validate("liteFps", "60") && validate("liteFps", "20") &&
      !validate("liteFps", "constructor") && !validate("liteFps", "__proto__") && !validate("liteFps", "999") &&
      validate("liteMascot", "30") && validate("liteMascot", "off") &&
      !validate("liteMascot", "constructor") && !validate("liteMascot", "toString") &&
      validate("liteScale", "device") && validate("liteScale", "1.5") &&
      !validate("liteScale", "constructor") && !validate("liteScale", "9") &&
      /* 🪶 曲リストの行数も同じ関門を通す（"0" や "9999" で画面を空にされないように） */
      validate("liteLibRows", "device") && validate("liteLibRows", "150") && validate("liteLibRows", "60") &&
      !validate("liteLibRows", "constructor") && !validate("liteLibRows", "__proto__") &&
      !validate("liteLibRows", "0") && !validate("liteLibRows", "9999") &&
      validate("liteMode", "auto") && !validate("liteMode", "constructor") &&
      /* 🐔 trk's playlist のタブ表示名：3種類だけを通す。"" や継承キーで「アイコンだけ」に化けないよう弾く */
      validate("trkTabName", "full") && validate("trkTabName", "short") && validate("trkTabName", "icon") &&
      !validate("trkTabName", "constructor") && !validate("trkTabName", "__proto__") && !validate("trkTabName", "") &&
      !validate("trkTabName", "icon ") && !validate("trkTabName", "bogus") &&
      /* 一覧そのものも3種類ちょうど（あとから値を足すと「表示名」が増える＝UIの選択肢とずれる） */
      JSON.stringify(TRK_ENUM_VALUES.trkTabName) === JSON.stringify(["full", "short", "icon"]);
  } catch (_) {}
  /* 許可リストに載っていても SETTING_ENUM_KEYS から外れていたら関門を通らない（両方そろって初めて効く） */
  const enumKeyListed = /const SETTING_ENUM_KEYS = \[[\s\S]*?"trkTabName"[\s\S]*?"midiSoundProfile"[\s\S]*?"midiMixProfile"[\s\S]*?\]/.test(core);
  rule(!!enumFn && enumBehavior && enumKeyListed && core.includes('!validImportedSettingEnum(k, incoming)'),
    "emergency settings import allowlists spectrum, MMD, FX, lite-mode, trk-tab and MIDI profile enum IDs before assignment");

  /* 緊急Importで弾いたキーは黙って捨てない（「読み込みました」なのに反映されない事故を防ぐ）。
     理由（この端末に無いID／型が違う／この設定に無いキー）でも対応が変わるので、区別して出す。 */
  const importFeedback = core.includes("let applied = [], rejected = []") &&
    core.includes("const reject = (k, why) =>") && core.includes("const SKIP_WHY = {") &&
    core.includes('reject(k, "enum")') && core.includes('reject(k, "type")') && core.includes('reject(k, "unknown")') &&
    /* ⚠ rejected は**表示用の文字列**が入るので、重複よけは生のキーで持たないと二重に出る */
    core.includes("const rejectedKeys = new Set()") && core.includes("if (rejectedKeys.has(k)) return;") &&
    core.includes("if (applied.includes(k) || rejectedKeys.has(k) || UNSAFE_KEYS.has(k)) continue;") &&
    core.includes('if (rejected.length) setSt("prefImportedPartial"') &&
    core.includes('else setSt("prefImported"') &&
    core.includes("SETTING_ENUM_KEYS.includes(k)") &&
    ["prefImported", "prefImportedPartial", "prefSkipWhyId", "prefSkipWhyType", "prefSkipWhyUnknown"]
      .every(key => read("js/i18n.js").split(`${key}:`).length - 1 === 4);
  rule(importFeedback, "the emergency settings import reports every key it refused, with a reason, in all four languages");

  /* ✨ M-03（tv-rich.js）：tvRichId／tvRichPrev を実在IDで検証する。
     ⚠ 二つは行き先が違う（tvRichId＝リッチ20種／tvRichPrev＝元の映像フィルター全70種）。
       同じ許可リストにすると保存済みの「戻る先」が毎回リセットされるので、別々に検証する。 */
  /* ⚠ 関数を直接呼ぶだけでは「配線が外れていても通る」。実際に保存値を入れて settings の結果を見る。 */
  const richSrc = js["js/tv-rich.js"];
  let richBehavior = false;
  try {
    const i18nScript = new vm.Script(read("js/i18n.js"));
    const presetScript = new vm.Script(read("js/tv-presets.js"));
    /* 即時関数で包まれていても、その中の関数を同じ方法で動かす（包みの先頭だけを外す） */
    const headSrc = richSrc.slice(0, richSrc.indexOf('addEventListener("DOMContentLoaded"')).replace(/^\(\(\) => \{\n/, "");
    /* 保存済みの値 v を入れたとき、settings に何が残るか */
    const probe = v => {
      const ctx = { console, document:{ addEventListener(){} }, addEventListener(){} };
      ctx.window = {}; ctx.globalThis = ctx;
      vm.createContext(ctx);
      i18nScript.runInContext(ctx);
      presetScript.runInContext(ctx);
      vm.runInContext("window.TrkTV = { list: () => TRK_TV_PRESETS.map(p => ({ id:p.id, cat:p.cat, off:!!p.off })) };", ctx);
      const src = `var prefs = { tvRichId: ${JSON.stringify(v)}, tvRichPrev: ${JSON.stringify(v)} }; var settings = {};\n` + headSrc;
      new vm.Script(src, { filename: "tv-rich-probe.js" }).runInContext(ctx);
      return vm.runInContext("({ id: settings.tvRichId, prev: settings.tvRichPrev })", ctx);
    };
    const DEFAULT_ID = "portrait_natural";
    const poisoned = probe("constructor");        // 継承キー → 両方はじかれる
    const plain = probe("skin");                  // リッチではない元の映像フィルター → tvRichPrev だけ残る
    const rich = probe("anime_clear");            // リッチ20種 → 両方残る
    const bogus = probe("my_custom");             // 存在しないID → 両方はじかれる
    richBehavior = poisoned.id === DEFAULT_ID && poisoned.prev === "" &&
      plain.id === DEFAULT_ID && plain.prev === "skin" &&
      rich.id === "anime_clear" && rich.prev === "anime_clear" &&
      bogus.id === DEFAULT_ID && bogus.prev === "" &&
      /* 配線（pickRich に検証関数が渡っていること）も見る */
      richSrc.includes('pickRich("tvRichId", richIdOk') && richSrc.includes('pickRich("tvRichPrev", videoIdOk');
  } catch (_) {}
  rule(richBehavior, "tvRichId and tvRichPrev are checked against real preset IDs (separate lists: rich vs. any video filter)");

  /* spectrum.js の ID 辞書は「増えたらこの検査も更新」する前提で、名前と個数の両方で見張る */
  const spectrumSrc = js["js/spectrum.js"];
  const SPECTRUM_ID_MAPS = ["STYLE_KEYS", "THEME_KEYS", "THEME_SWATCH", "STYLE_DRAW", "IDLE_LINE", "TV_ALPHA"];
  const nullProto = name => new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*Object\\.assign\\(Object\\.create\\(null\\)`).test(spectrumSrc);
  const missingMaps = SPECTRUM_ID_MAPS.filter(name => !nullProto(name));
  const spectrumMapCount = (spectrumSrc.match(/Object\.create\(null\)/g) || []).length;
  const prototypeSafeMaps = js["js/mmd.js"].includes("Object.assign(Object.create(null), {") &&
    js["js/fx.js"].includes("let custom = Object.create(null)") &&
    missingMaps.length === 0 && spectrumMapCount === SPECTRUM_ID_MAPS.length;
  rule(prototypeSafeMaps, "MMD, FX and spectrum ID dictionaries have no inherited property lookups",
    missingMaps.length ? `not null-prototype: ${missingMaps.join(", ")}` :
      spectrumMapCount === SPECTRUM_ID_MAPS.length ? "" :
        `spectrum has ${spectrumMapCount} null-prototype maps but this check lists ${SPECTRUM_ID_MAPS.length} — update SPECTRUM_ID_MAPS`);

  /* ほかに「外から来たオブジェクトを settings へ丸ごと代入」する形がないか */
  const loose = [];
  for (const [file, text] of allJs) {
    for (const m of occurrences(text, /settings\[[a-zA-Z_$][\w$]*\]\s*=\s*[^;\n]*(?:data|raw|json)\b[^;\n]*/g)) {
      if (file === "js/core.js" && /UNSAFE_KEYS/.test(text)) continue;
      loose.push(file + ": " + m[0].trim().slice(0, 60));
    }
  }
  rule(loose.length === 0, "no unguarded mass-assignment of imported objects into settings", loose.slice(0, 2).join(" · "));
}

/* ---------- 5. ZIP の展開上限（圧縮爆弾よけ） ---------- */
{
  const custom = js["js/custom.js"];
  const core = js["js/core.js"];
  const zipIO = js["js/zip-io.js"];
  const capped = custom.includes("async function readZip(blob)") && custom.includes("zip = await zipIO.zipOpen(blob)") &&
    custom.includes("async function inflateEntry(e, limit = 0, label = \"\")") &&
    custom.includes("if (limit > 0 && e.usize > limit) throw new PackError(\"packFileTooBig\"") &&
    custom.includes("zipIO.zipEntryBlob(e.zip, e.entry, limit > 0 ? limit : Infinity, true)") &&
    custom.includes("if (err.key === \"zipTooBig\") throw new PackError(\"packFileTooBig\"") &&
    custom.includes("await inflateEntry(ent, lim, path)") && custom.includes("await inflateEntry(entries[mf], PACK_MB, mf)") &&
    zipIO.includes("if (size > Math.min(limit, e.usize))") && zipIO.includes("if (verifyCrc && (size !== e.usize") &&
    custom.includes("return await zipIO.zipWrite(entries)") && zipIO.includes("crc32Stream(raw.stream())");
  rule(capped, "pack ZIP I/O uses streaming CRC checks and declared/actual size caps (lying usize cannot exhaust memory)");

  const backup = js["js/backup.js"], i18n = js["js/i18n.js"];
  const boundedArchive = zipIO.includes("ZIP_LIMITS = Object.freeze({ entries:250000, centralBytes:64 * 1048576 })") &&
    zipIO.includes('ZipIOError("zipLimit")') && backup.includes("MAX_RECORDS = 250000") &&
    backup.includes("MAX_DB_JSON = 64 * 1048576") && backup.includes("Z.limits.entries - 1") &&
    backup.includes('new BackupError("backupHardLimit")') && backup.includes("utf8LengthWithin(rec, remaining)") &&
    (i18n.match(/backupHardLimit:/g) || []).length === 4;
  rule(boundedArchive, "ZIP entry/central-directory and backup JSON/record safety ceilings are fixed, early, and translated in all UI locales");

  /* trk163：Info-ZIP の標準入力メンバー出力は、32bit で足りていても ZIP64 終端レコード＋ロケーターを必ず置く。
     ロケーターが正しく指し、終端レコードの中身（件数・中央目録の大きさ／位置）が EOCD と一致するときだけ
     中央目録の終わりとして認める＝「EOCD と ZIP64 の中身を食い違わせる二重解釈」は引き続き拒否する */
  const optionalZip64 = zipIO.includes("zip64Off === null && eocd >= 20") &&
    zipIO.includes("z.getBigUint64(24, true) === z.getBigUint64(32, true)") &&
    zipIO.includes("z.getBigUint64(32, true) === BigInt(count)") &&
    zipIO.includes("z.getBigUint64(40, true) === BigInt(cdSize)") &&
    zipIO.includes("z.getBigUint64(48, true) === BigInt(cdOff)") &&
    zipIO.includes("expectedCdEnd = zip64Off === null ? eocdAbs : zip64Off");
  rule(optionalZip64, "an optional ZIP64 end record (Info-ZIP stdin output) is accepted only when its contents match the EOCD (no dual interpretation)");

  /* trk163：書斎の復元は参照される側から書く（pages→covers→books→settings）。
     容量不足などで途中失敗しても「存在しないページを指す本」にならない。案内文言（領域を外す・不要パックを消す）は4言語 */
  const studyOrder = backup.includes('STUDY_WRITE_ORDER = ["pages", "covers", "books", "settings"]') &&
    backup.includes("orderStudyStores(plan.dbs)") && backup.includes("p.spec === DB_STUDY") &&
    (i18n.match(/backupRestorePackFailedKept:/g) || []).length === 4 &&
    i18n.includes("導入に失敗したパックと同じIDの既存パックは削除していません。空き容量が足りなかったときは");
  rule(studyOrder, "study-room restore writes referenced stores first (pages→covers→books), and pack-failure reporting keeps its space hint in four languages");

  const recordStart = custom.indexOf("function packRecordBytes(");
  const recordEnd = custom.indexOf("\nasync function checkPackStorageCapacity", recordStart);
  const budgetSource = recordStart >= 0 && recordEnd >= 0 ? custom.slice(recordStart, recordEnd) : "";
  let budgetBehavior = false;
  try {
    const budget = vm.runInNewContext(`(()=>{${budgetSource}; return { bytes:packRecordBytes, projected:packProjected };})()`);
    /* レコード1件ぶん：新しいものは size を優先、古い/壊れたものだけ files を数え直す */
    budgetBehavior = budget.bytes({ id:"newer", size:200, files:{ a:{ size:10 } } }) === 200 &&
      budget.bytes({ id:"legacy", files:{ a:{ size:40 } } }) === 40 &&
      budget.bytes({ id:"broken", size:Number.NaN, files:{ a:{ size:5 } } }) === 5 &&
      budget.bytes(null) === 0 &&
      /* 保存後の見込み＝合計 − 置き換える分 ＋ 今回の分 */
      budget.projected({ stored:220, replacing:150 }, 50) === 120 &&
      budget.projected({ stored:0, replacing:0 }, 10) === 10 &&
      budget.projected({ stored:100, replacing:100 }, 500) === 500;
  } catch (_) {}
  const storeCap = custom.includes("PACK_STORE_MAX = 1024 * PACK_MB") &&
    custom.includes("await checkPackStorageCapacity(id, total)") && custom.includes("storage.estimate()") &&
    custom.includes("packDB.putIf(id, record") && js["js/core.js"].includes("putIf: (k, v, predicate)") &&
    custom.includes("let packInstallQueue = Promise.resolve()") && budgetBehavior;
  rule(storeCap, "pack imports serialize and enforce a net 1 GiB installed-pack budget plus browser quota preflight");

  /* F-32 の大型修正：合計を「size index のキーだけ」で数える（レコード本体＝Blob を復元しない）。
     ⚠ size を持たないレコードは index に載らず**合計が過小**になる＝上限を素通しする危険な向き。
        だから ①v1→v2 の移行で size を書き戻し ②件数と食い違ったら全件を数え直す、の二段構え。 */
  const idbIndexed = core.includes("const IDB_VERSION = 2") &&
    core.includes("os.createIndex(sizeKey, sizeKey)") &&
    core.includes("readStats(os, null, res)") &&
    core.includes("readStats(os, v && v[idKey], stats =>") &&
    custom.includes('idbStore("shadow_taiko_packs", "packs", { sizeKey:"size", sizeOf:packRecordBytes })');
  rule(idbIndexed, "pack totals come from a size index (no blob deserialization) instead of reading every record");

  const idbMigration = /os\.openCursor\(\)[\s\S]{0,500}?c\.update\(Object\.assign\(\{\}, rec, \{ \[sizeKey\]: sizeOf\(rec\) \}\)\)/.test(core);
  rule(idbMigration, "the v1→v2 migration backfills size on legacy records (otherwise the index under-counts)");

  /* 件数の食い違い＝「index に載らないレコードがある」→ null を返して全件を数え直させる */
  let statsGuard = false;
  try {
    const m = /const statsFromKeys =[\s\S]*?\n  \};/.exec(core);
    const f = vm.runInNewContext(`(()=>{${m[0]}; return statsFromKeys;})()`,
      { sizeOf: r => (r && Number.isFinite(r.size) ? r.size : 0) });
    const full = f([100, 250, 70], 3, null);
    const mismatch = f([100], 2, null);                 /* ← index に載らないレコードがある状態 */
    const withPrev = f([100, 50], 2, { size:50 });
    statsGuard = !!full && full.stored === 420 && full.replacing === 0 && full.fast === true &&
      mismatch === null &&                              /* null＝「測れない」ので全件読みへ落ちる */
      !!withPrev && withPrev.stored === 150 && withPrev.replacing === 50 && withPrev.count === 2 &&
      f(["x", 3], 2, null) === null;                    /* 数値でないキーも過小計上につながるので弾く */
  } catch (_) {}
  rule(statsGuard, "a size-index/count mismatch forces a full recount instead of under-counting the pack budget");

  /* バージョンを上げたので、古いタブが掴んでいるとブロックされる。onblocked が無いと永遠に固まる。 */
  const idbBlocked = core.includes('r.onblocked = () => { p = null; rej(new Error("idb-blocked")); };') &&
    custom.includes('blockedError ? "packDbBlocked"') &&
    read("js/i18n.js").split("packDbBlocked:").length - 1 === 4;
  rule(idbBlocked, "a blocked IndexedDB version upgrade rejects instead of hanging, and says so in four languages");

  const storageErrors = custom.includes('e.name === "QuotaExceededError"') &&
    custom.includes('"packStorageQuota"') && custom.includes('"packStorageCheckFailed"') &&
    ["packStoreLimit", "packStorageQuota", "packStorageCheckFailed"].every(key =>
      read("js/i18n.js").split(`${key}:`).length - 1 === 4);
  rule(storageErrors, "pack size/quota failures have actionable status text in all four languages");
}

/* ---------- 5b. 共有プレイリスト（他人から受け取るファイル） ---------- */
{
  const lib = js["js/library.js"];
  const openGuard = lib.includes("function plOpenLink(url)") && lib.includes("url = safeHttpUrl(url);") &&
    lib.includes("if (!url) return;");
  rule(openGuard, "plOpenLink re-validates https at the moment it opens (not only at import)", "");

  const metaGuard = lib.includes("function songMetaClean(raw)") && lib.includes("function songMetaCleanAll(obj)") &&
    lib.includes("let SONG_META = songMetaCleanAll(") && lib.includes("const SONG_META_MAX = 3000") &&
    lib.includes('["matchHint", 80]') && lib.includes("/^https:\\/\\/\\S+$/i.test(url)");
  rule(metaGuard, "per-song profiles (SONG_META) and the 80-character catalog match hint are sanitised on load, https-only, and capped");

  /* コメント（「handle.remove() は呼ばない」という注意書き）を外してから、実行される呼び出しだけを見る */
  const libCode = lib.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const shareClean = lib.includes('await libKV.del("share")') && lib.includes('await libKV.del("dir")') &&
    !/[\w.]*handle\.remove\s*\(/.test(libCode);
  rule(shareClean, "🚫 共有をやめる drops both remembered folder handles and never calls handle.remove() (which would delete the real folder)");

  const sharedOk = lib.includes('raw.format !== "trk-playlist"') && lib.includes("https:\\/\\/\\S+$/i.test(String(s.srcUrl") &&
    lib.includes("slice(0, 1000)") && lib.includes("slice(0, 24)");
  rule(sharedOk, "shared playlist files are format-checked with song/tag/length caps (no media, no code)");
}

/* ---------- 6. アドオン ---------- */
{
  const addons = js["js/addons.js"];
  const safeGate = addons.includes("const safeNow = () => {") && addons.includes('window.TrkSafeMode') &&
    addons.includes('sp.has("safe")') && addons.includes('sp.has("factory")') && addons.includes("if (safeNow())");
  const codeCap = addons.includes("MAX_CODE = 512 * 1024") && addons.includes("function exceedsUtf8Limit(value, limit)") &&
    addons.includes("bytes += 4; i++") && addons.includes("bytes += 3") && addons.includes("if (bytes > limit) return true") &&
    addons.includes("exceedsUtf8Limit(rawText, MAX_ADDON_FILE)") && addons.includes("exceedsUtf8Limit(code, MAX_CODE)") &&
    addons.includes("exceedsUtf8Limit(entry.code, MAX_CODE)");
  const fileSizeCap = addons.includes("MAX_ADDON_FILE = 4 * 1024 * 1024") && addons.includes("f.size > MAX_ADDON_FILE") &&
    addons.indexOf("f.size > MAX_ADDON_FILE") < addons.indexOf("await f.text()");
  rule(safeGate && codeCap && fileSizeCap, "add-ons stay off in safe mode and have code/file size caps before file.text()");

  const sample = (addons.match(/const SAMPLE_URL = "([^"]+)"/) || [])[1] || "";
  const remoteFetches = [];
  for (const [file, text] of allJs) {
    for (const m of occurrences(text, /fetch\(\s*["'`](https?:\/\/[^"'`\s]+)/g)) remoteFetches.push(file + ": " + m[1]);
  }
  rule(!/^https?:/.test(sample) && remoteFetches.length === 0, "no remote code/JSON is fetched from js/ at runtime",
    remoteFetches.slice(0, 3).join(" · ") || "sample: " + (sample || "?"));
}

/* ---------- 7. 外へ出る通信の許しリスト ---------- */
{
  const mapStart = indexHtml.indexOf('type="importmap"');
  const mapBlock = mapStart < 0 ? "" : indexHtml.slice(mapStart, indexHtml.indexOf("</script>", mapStart) + 9);
  /* 第三者コードは CDN から読まず、assets/vendor に同梱したコピー（ハッシュ固定）を使う。
     tools/check-vendor.mjs が「lockとの一致・相対importの解決・import mapの被覆」を検査する。 */
  const remoteMap = [...mapBlock.matchAll(/https?:\/\//g)];
  rule(remoteMap.length === 0, "the import map has no third-party origin left (the code is vendored)",
    remoteMap.length ? `${remoteMap.length} remote url(s)` : "local only");

  let lock = null;
  try { lock = JSON.parse(fs.readFileSync(new URL("../tools/vendor-lock.json", import.meta.url), "utf8")); } catch (_) {}
  const lockEntries = Object.entries((lock && lock.entries) || {});
  const badLocal = lockEntries.filter(([, e]) => typeof e.local !== "string" || !e.local.startsWith("assets/vendor/") ||
    !/^[A-Za-z0-9+/=]{40,}$/.test(String(e.sha384 || "")));
  rule(lockEntries.length >= 20 && badLocal.length === 0,
    `tools/vendor-lock.json pins every vendored module by SHA-384 (${lockEntries.length} modules)`);

  const dyn = [];
  for (const [name, text] of Object.entries(js))
    for (const m of text.matchAll(/\bimport\s*\(\s*"([^"]+)"/g)) dyn.push([name, m[1]]);
  const lazyOk = dyn.length > 0 && dyn.every(([name, spec]) =>
    ["js/vrm.js", "js/mmd.js"].includes(name) && (/^(three|@pixiv\/three-vrm)/.test(spec) || spec.startsWith("three/addons/") || spec.startsWith("@yohawing/")));
  rule(lazyOk, "the 3D modules are imported lazily and only from the VRM / MMD files",
    dyn.map(d => `${d[0]}: ${d[1]}`).join(" · "));

  const safeVrm = js["js/core.js"].includes('settings.mascot === "vrm") settings.mascot = "skin"') &&
    js["js/core.js"].includes('settings.mascot === "mmd") settings.mascot = "skin"');
  rule(safeVrm, "safe mode steps back from both VRM and MMD (so it never loads the 3D code)");

  const swGuards = sw.includes("url.origin !== SCOPE.origin") && sw.includes('response.type === "basic"') &&
    sw.includes('request.method !== "GET"');
  rule(swGuards, "the service worker caches only same-origin, basic, GET responses");

  const swSafe = sw.includes("const safeClients") && sw.includes("function safeWanted") &&
    sw.includes('params.has("safe")') && sw.includes('String(url.hash || "").toLowerCase().includes("safe")') && sw.includes("if (safeClient)") &&
    /const safeClient = safeClients\.has\(event\.clientId\) \|\| \(request\.mode === "navigate" && safeWanted\(url\)\);/.test(sw) &&
    sw.indexOf("safeClients.add") < sw.indexOf("caches.match");
  rule(swSafe, "the service worker never serves cached copies to a ?safe=1 client (no cache poisoning bypass)");
  const safeSmoke = read("tools/smoke-browser.mjs");
  const offlineSafeRegression = safeSmoke.includes('path:"/index.html?safe=1"') && safeSmoke.includes('path:"/?safe=1"') &&
    safeSmoke.includes('path:"/#safe"') && safeSmoke.includes('"POISONED-SHELL"') &&
    safeSmoke.includes("await closeServer(server)") && safeSmoke.includes("status === 503") &&
    safeSmoke.includes("window.__trkSmokePoisonRan");
  rule(offlineSafeRegression, "the browser smoke seeds a poisoned app shell, stops HTTP, and checks safe query/hash navigations for a 503");

  const media = js["js/media.js"], library = js["js/library.js"];
  const analysisCaps = media.includes("const ANALYZE_MAX = 96 * 1024 * 1024") &&
    media.includes("const ANALYZE_MAX_SEC = 20 * 60") && media.includes("const ANALYZE_LITE_MAX_SEC = 10 * 60") &&
    media.includes("video.duration > (liteActive ? ANALYZE_LITE_MAX_SEC : ANALYZE_MAX_SEC)") &&
    media.includes('liteLong ? "analysisSkippedLiteLong"') && media.includes('tooLong ? "analysisSkippedLong"') &&
    media.includes('tooBig ? "analysisSkipped"') &&
    (read("js/i18n.js").match(/\banalysisSkippedLiteLong:/g) || []).length === 4 &&
    !/file\.arrayBuffer\(\)[^\n]*\n[^\n]*ANALYZE/ .test(media);
  rule(analysisCaps,
    "audio analysis keeps the 96 MiB file cap and 20-minute normal cap, with a distinct 10-minute lite cap and localized skip reason");
  const chartCap = media.includes("const CHART_FILE_MAX = 2 * 1024 * 1024") &&
    media.includes("file.size > CHART_FILE_MAX") && media.indexOf("file.size > CHART_FILE_MAX") < media.indexOf("file.text()") &&
    media.includes("!Number.isFinite(file.size)") && media.includes('typeof time === "number"') && media.includes('typeof lane === "number"') &&
    media.includes("DIFF_IDS.includes(data.difficulty)") && media.includes("!DIFF_IDS.includes(diff)") && media.includes('typeof data.bpm === "number"') &&
    media.includes('has("bpm")') && media.includes('has("offset")') && media.includes("!Number.isFinite(data.offset)") &&
    /* F-33: bpm は 0（小節線なし）か 1〜1000。範囲外だと小節線の描画ループが終わらない */
    media.includes("(data.bpm === 0 || (data.bpm >= 1 && data.bpm <= 1000))") &&
    /* 名前空間の別名を戻したあと、window.Trk.core. の接頭辞を外して照合するので、ここでは chartMeta.bpm で書く */
    js["js/render.js"].includes("if (!(chartMeta.bpm >= 1 && chartMeta.bpm <= 1000)) return;") &&
    js["js/stage.js"].includes("if (chartMeta.bpm >= 1 && chartMeta.bpm <= 1000) {") &&
    js["js/modes.js"].includes("const bpmOk = chartMeta.bpm >= 1 && chartMeta.bpm <= 1000;");
  rule(chartCap, "standalone chart JSON is size-capped, note/BPM values are bounded JSON numbers, and the measure-line loops refuse out-of-range BPM");

  /* F-34: 共有プレイリストの取り込みも、読み込む前に大きさを確かめる（1000曲の上限は解析の後にしか効かない） */
  const libSource = read("js/library.js");
  const pickStart = libSource.indexOf("function plImportPick()");
  const pickEnd = pickStart >= 0 ? libSource.indexOf("\n}\n", pickStart) : -1;
  const pickSource = pickEnd > pickStart ? libSource.slice(pickStart, pickEnd) : "";
  const playlistImportCap = libSource.includes("const PLAYLIST_IMPORT_MAX = 4 * 1024 * 1024") &&
    pickSource.includes("f.size > PLAYLIST_IMPORT_MAX") && pickSource.includes("await f.text()") &&
    pickSource.indexOf("f.size > PLAYLIST_IMPORT_MAX") < pickSource.indexOf("await f.text()") &&
    (libSource.match(/\bplImportTooBig:/g) || []).length === 4;
  rule(playlistImportCap, "shared playlist import is size-capped before the file is read (F-34, four languages)");

  /* F-38: share_target is an ordinary POST endpoint; the browser cannot identify OS shares versus cross-site forms.
     Consume the inbox before confirmation, refuse without routing, and keep file_handlers as the explicit-user-action path. */
  const shareInbox = js["js/share-inbox.js"], backupSource = js["js/backup.js"], i18nSource = js["js/i18n.js"];
  const drainStart = shareInbox.indexOf("async function drainShareInbox()");
  const drainEnd = shareInbox.indexOf("\n}\nfunction shareStartup", drainStart);
  const drainSource = drainStart >= 0 && drainEnd >= 0 ? shareInbox.slice(drainStart, drainEnd) : "";
  const shareConsent = drainSource.includes('confirm(tr("shareInboundAsk"') &&
    drainSource.includes("if (!ok) return -1") &&
    drainSource.indexOf("await cache.delete(req)") < drainSource.indexOf('confirm(tr("shareInboundAsk"') &&
    drainSource.indexOf('confirm(tr("shareInboundAsk"') < drainSource.indexOf("await routeInboundFiles(files)") &&
    shareInbox.includes("function shareDisplayName(name)") && drainSource.includes("files.map(f => shareDisplayName(f.name))") &&
    shareInbox.includes("launchQueue.setConsumer") && (shareInbox.match(/shareInboundAsk:/g) || []).length === 4;
  rule(shareConsent, "OS share inbox explains cross-site delivery, asks before routing, clears refusals, and keeps launchQueue user-initiated (F-38)");

  const backupAddonGuard = backupSource.includes("function disableRestoredAddons(raw)") &&
    backupSource.includes("addonRow[1] = disableRestoredAddons(addonRow[1])") &&
    backupSource.includes("addonCount, addonNames") && (i18nSource.match(/backupRestoreAsk:/g) || []).length === 4;
  rule(backupAddonGuard, "backup restore previews add-ons and forces restored add-ons off before writing them");
  const backupLocalTextKeys = backupSource.includes('"trk_lyrics_v1", "trk_subs_v1"');
  rule(backupLocalTextKeys, "manually selected lyrics and subtitle files (including delay) remain in the backup localStorage allowlist");

  const corePrefs = js["js/core.js"];
  const packPrevSafe = corePrefs.includes("packPrev: cleanPackPrev(prefs.packPrev)") && corePrefs.includes("function cleanPackPrev(") &&
    corePrefs.includes('typeof v.skin !== "string"') && corePrefs.includes("!Array.isArray(v.notes) || v.notes.length !== 2") &&
    corePrefs.includes("settings.packPrev = null;") &&
    js["js/custom.js"].includes("if (persist) packRestoreSettings();") && js["js/custom.js"].includes("if (!restore) { packSnapshot(); packRebase(); }");
  rule(packPrevSafe, "the pack snapshot (packPrev) is shape-checked while loading preferences");

  const core = js["js/core.js"], tv = js["js/tv-dock.js"];
  const safeUrlSettings = core.includes("VIDEO_STYLE_IDS.includes(f)") && core.includes("pick(data.videoStyle, VIDEO_STYLE_IDS, \"\")") &&
    core.includes("window.TrkTV.skins().some") && core.includes('window.__trkPendingTvDockSkin = s') &&
    tv.includes("hasTvSkin(requestedTvSkin)") && tv.includes("Object.prototype.hasOwnProperty.call(TV_DOCK_SKINS, id)") &&
    core.includes("Object.prototype.hasOwnProperty.call(baseMap, settings.videoStyle)");
  rule(safeUrlSettings, "URL/import video and TV skin values are allowlisted before persistence or map lookup");
  const skinMapSafe = js["js/data.js"].includes("const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k)") &&
    core.includes("has(SKINS, prefs.skin)") && core.includes("has(SKINS, settings.skin)") && core.includes("has(SKINS, id)") &&
    js["js/custom.js"].includes("has(SKINS, id) ? SKINS[id] : SKINS.shadow") &&
    js["js/lib-skins.js"].includes("Object.prototype.hasOwnProperty.call(LIB_SKINS, id)") &&
    js["js/fx-dock.js"].includes("Object.prototype.hasOwnProperty.call(DOCK_SKINS, settings.fxDockSkin)");
  rule(skinMapSafe, "built-in/custom skin selection rejects inherited object properties such as __proto__");
  const customSkin = js["js/custom.js"], skinFilesSafe = customSkin.includes("CUSTOM_SKIN_FILE_MAX = 256 * 1024") &&
    customSkin.includes("f.size > CUSTOM_SKIN_FILE_MAX") && customSkin.indexOf("f.size > CUSTOM_SKIN_FILE_MAX") < customSkin.indexOf("await f.text()") &&
    customSkin.includes("Object.prototype.hasOwnProperty.call(customSkinDefs, settings.skin)") &&
    js["js/data.js"].includes("glow: raw.glow === true, scanlines: raw.scanlines === true") &&
    tv.includes("TV_SKIN_FILE_MAX = 256 * 1024") && tv.includes("f.size > TV_SKIN_FILE_MAX") &&
    tv.indexOf("f.size > TV_SKIN_FILE_MAX") < tv.indexOf("await f.text()") && tv.includes('typeof v === "number" && Number.isFinite(v)') &&
    tv.includes("tvMakerPreset = id => Object.prototype.hasOwnProperty.call(TV_MAKER_PRESETS, id)");
  rule(skinFilesSafe, "custom skin files are capped before parsing; skin maps and imported TV numeric values are validated");
  const prefsImportCap = core.includes("PREFS_IMPORT_MAX = 2 * 1024 * 1024") && core.includes("f.size > PREFS_IMPORT_MAX") &&
    core.indexOf("f.size > PREFS_IMPORT_MAX") < core.indexOf("await f.text()") && core.includes("Array.isArray(data)") &&
    core.includes("typeof incoming === typeof current") && core.includes("UNSAFE_KEYS.has(k)") &&
    core.includes("const hasImported = key => Object.prototype.hasOwnProperty.call(data, key)");
  rule(prefsImportCap, "emergency preferences import has a pre-read size cap, object root and prototype/type guards");
  const enumMapSafe = media.includes("!DIFF_IDS.includes(diff)") && core.includes("DIFF_IDS.includes(chartDiff)") &&
    core.includes("Object.prototype.hasOwnProperty.call(JUDGE_SCALE, settings.judge)") &&
    core.includes("Object.prototype.hasOwnProperty.call(LIVES_TAG, settings.lives)") &&
    js["js/modes.js"].includes("Object.prototype.hasOwnProperty.call(LIFE_TAGS, settings.lives)");
  rule(enumMapSafe, "settings-imported difficulty, judge and life IDs cannot select inherited dictionary properties");

  const addons = js["js/addons.js"];
  const installAt = addons.indexOf("function installWithConsent(");
  const consentAt = addons.indexOf("askConsent(shown,", installAt);
  const installTextAt = addons.indexOf("function installText(", installAt);
  const installEvalAt = addons.indexOf("runCode(code)", installTextAt);
  const consentFlow = installAt >= 0 && consentAt > installAt && installTextAt > consentAt && installEvalAt > installTextAt &&
    addons.includes("entry.consentAt = Date.now()") && addons.includes("entry.consentSha = fingerprint") &&
    addons.includes("await codeFingerprint(code)") && addons.indexOf("installWithConsent(text, f.name)") > 0;
  rule(consentFlow, "file-installed add-on code is evaluated only from the post-consent path and gets a fingerprint");

  const bootAt = addons.indexOf("async function boot()");
  const bootRunAt = addons.indexOf("runCode(entry.code)", bootAt);
  const staleGuardAt = addons.indexOf('if (state === "stale")', bootAt);
  const bootCapAt = addons.indexOf("if (exceedsUtf8Limit(entry.code, MAX_CODE))", bootAt);
  const staleBootGuard = bootAt >= 0 && bootRunAt > bootAt && staleGuardAt > bootAt && staleGuardAt < bootRunAt &&
    bootCapAt > bootAt && bootCapAt < bootRunAt && addons.includes("await Promise.all(entries.map");
  rule(staleBootGuard, "changed/oversize stored add-ons are rejected before boot evaluates their code");

  const parserAt = addons.indexOf("function parseAddonFile(");
  const parserEnd = addons.indexOf("/* ---------- ✅ 同意の記録", parserAt);
  const parser = addons.slice(parserAt, parserEnd);
  const jsonFailClosed = parser.includes("const isJsonFile =") && parser.includes("if (isJsFile)") &&
    parser.includes("if (allowRawCode && !isJsonFile) return { code:t, meta:{} }") &&
    parser.includes("if (isJsonFile || !allowRawCode)") && parser.includes("対応拡張子は .js / .json / .trkaddon") &&
    parser.includes('why:"JSON として読めませんでした：" + e.message') &&
    !/catch \(e\) \{ return \{ code:t/.test(parser);
  rule(jsonFailClosed, "malformed JSON add-on files are rejected instead of falling back to JavaScript");

  const strongFingerprint = addons.includes('crypto.subtle.digest("SHA-256"') && addons.includes('return "sha256:"') &&
    addons.includes("codeShaLegacy(entry.code)");
  rule(strongFingerprint, "new add-on consent fingerprints use SHA-256 where Web Crypto is available (legacy hashes remain compatible)");

  /* Behaviour lives in node:test, which runs with npm test and npm run check. Keep the reset behavior test independent of
     restoreCoreAlias/string-spelling guards so harmless refactors do not erase coverage of the destructive path. */
  const safetyTests = fs.existsSync(path.join(root, "tests/core-safety.test.mjs"))
    ? fs.readFileSync(path.join(root, "tests/core-safety.test.mjs"), "utf8") : "";
  const factoryBehaviorCovered = safetyTests.includes("factory reset waits for explicit confirmation") &&
    safetyTests.includes("?factory enters safe mode") && safetyTests.includes("safe mode disables risky output");
  rule(factoryBehaviorCovered, "query/hash factory-reset and safe-mode behavior is covered by node:test");

  /* ?factory 単体は**セーフモード**（壊す動作にしない）。js/addons.js の safeNow() と同じ解釈。 */
  const factorySafe = core.includes('if (has("safe") || has("safety") || sp.has("factory"))') &&
    js["js/addons.js"].includes('sp.has("factory")');
  rule(factorySafe, "?factory alone enters safe mode, matching js/addons.js (never a destructive reset)");

  /* 文書ドリスト：実装はセーフモードなのに「?factory で全リセット」と書いてあったら FAIL にする */
  /* README（概要）と docs/guide/*.md（くわしい説明）の両方を見る */
  const guideDocs = fs.readdirSync(path.join(root, "docs/guide")).filter(f => f.endsWith(".md")).map(f => "docs/guide/" + f);
  const factoryDrift = ["docs/HANDOFF.md", "docs/SECURITY.md", "js/core.js", "README.md", ...guideDocs]
    .filter(f => { try { return /`\?reset=all`\s*[／/]\s*`\?factory`/.test(read(f)) || /\?factory\s*→\s*全設定リセット/.test(read(f)); } catch (_) { return false; } });
  rule(factoryDrift.length === 0, "no documentation claims ?factory resets every setting (it is a safe-mode alias)",
    factoryDrift.length ? `still claims it: ${factoryDrift.join(", ")}` : "");

  rule(library.includes("async function addVideoFiles") && library.includes("function probeVideoFile") &&
    library.includes("el.videoWidth > 0 && el.videoHeight > 0") && library.includes("videoReady"),
    "the 🎬 video import waits for a real first frame before marking an item as video, then opens the viewer");
}

/* ---------- 8. ローカル入力は読み取り専用、書き出しは明示的な新規コピーだけ ---------- */
{
  const writes = [], study = js["js/study-room.js"];
  /* 📂 trk208：共有フォルダーは**読むだけ**。readFileAt の中の getFileHandle は create 無しの取得だけで、
     すぐ getFile() で読む（＝書き込みの口ではない）。ここだけを例外として認める。 */
  const sharedFolders = js["js/shared-folders.js"] || "";
  const readAt = sharedFolders.match(/async function readFileAt\(handle, path\) \{[\s\S]*?^  \}/m);
  const readOnlyReadAt = !!readAt && !/create\s*:/.test(readAt[0]) && !/removeEntry/.test(readAt[0]) && readAt[0].includes(".getFile()");
  const exportWriter = study.match(/async function studyWriteExportCopy\(directory, blob, title, extension\) \{[\s\S]*?^\}/m);
  const exportText = study.match(/async function studyExportText\(\) \{[\s\S]*?^\}/m);
  const exportPicker = study.match(/async function studyChooseExportDirectory\(\) \{[\s\S]*?^\}/m);
  const inBlock = (match, index) => !!match && index >= match.index && index < match.index + match[0].length;
  for (const [file, text] of allJs) {
    for (const re of [/createWritable\s*\(/g, /\.write\s*\(\s*[a-zA-Z]/g, /removeEntry\s*\(/g, /getFileHandle\s*\(/g]) {
      for (const m of occurrences(text, re)) {
        if (file === "js/study-room.js" && inBlock(exportWriter, m.index) && !/removeEntry/.test(m[0])) continue;
        if (file === "js/shared-folders.js" && readOnlyReadAt && inBlock(readAt, m.index) && m[0].trim() === "getFileHandle(") continue;
        writes.push(file + ": " + m[0].trim());
      }
    }
  }
  let pickers = true;
  for (const [file, text] of allJs) {
    for (const m of occurrences(text, /(?:window\.)?showDirectoryPicker\s*\(\s*\{[^}]*\}\s*\)/g)) {
      const explicitExport = file === "js/study-room.js" && inBlock(exportPicker, m.index) && /mode\s*:\s*"readwrite"/.test(m[0]);
      const readOnly = /mode\s*:\s*"read"/.test(m[0]);
      if (!explicitExport && !readOnly) pickers = false;
    }
  }
  const exportCalls = occurrences(study, /studyWriteExportCopy\s*\(/g);
  const exportCalledOnlyByButton = !!exportWriter && !!exportText && exportCalls.length === 2 &&
    inBlock(exportWriter, exportCalls[0].index) && inBlock(exportText, exportCalls[1].index);
  const exportCollisionGuard = exportCalledOnlyByButton && exportWriter[0].includes("directory.getFileHandle(candidate)") &&
    exportWriter[0].includes('error.name !== "NotFoundError"') &&
    exportWriter[0].includes('directory.getFileHandle(filename, { create:true })') && exportWriter[0].includes("writable.write(blob)");
  rule(writes.length === 0 && pickers && exportCollisionGuard,
    "local inputs remain read-only; explicit Study export alone writes a collision-checked new copy to a user-selected folder",
    writes.slice(0, 3).join(" · "));
}

/* ---------- 8b. 📚 書斎（本文はすべて文字として描く・細工した本文で固まらない） ---------- */
{
  const study = js["js/study-room.js"], util = js["js/study-room-utils.js"];
  const textOnly = !/\.innerHTML\s*=/.test(study) && !/\.outerHTML\s*=/.test(study) &&
    !study.includes("insertAdjacentHTML") && !study.includes("document.write");
  const oneSrc = occurrences(study, /(?:[\w$.\[\]]*\.)src\s*=\s*[^;]+/g)
    .every(m => m[0].startsWith("img.src = url"));   /* 唯一の代入は、許可リストの画像ブロブだけ */
  rule(textOnly && oneSrc, "the study reader renders text only as text nodes (no HTML, no markdown, one blob img.src)",
    onlyIf(!textOnly, "innerHTML/HTML sink found") + onlyIf(!oneSrc, "unexpected .src assignment"));

  /* ルビは線形走査。後戻りのある正規表現に戻っていないか（1MBの漢字だけで数分固まっていた原因） */
  const linear = util.includes("function aozoraSegments(input)") && util.includes("const closeAfter = at =>") &&
    util.includes("const sameLine = p =>") && util.includes("const KANJI_LIKE =") && !util.includes("rubyPattern");
  rule(linear, "the Aozora ruby parser is a single forward scan (no backtracking regex)");

  const noTests = /\/\*[\s\S]*?\*\//g;
  const utilCode = util.replace(noTests, "");
  const risky = [...utilCode.matchAll(/\/[^\/\n]*(?:\[\^[^\]]*\]|\.)[+*][^\/\n]*\/[gimsuy]*/g)]
    .filter(m => /\[\^[^\]]*\]\+|\[\.\]\+/.test(m[0]))
    .map(m => m[0]);
  rule(risky.length === 0, "no backtracking-prone text-matching regex left in the study utils", risky.slice(0, 2).join(" · "));
}
function onlyIf(cond, text) { return cond ? text : ""; }

/* ---------- 9. 説明が残っているか ---------- */
{
  const doc = exists("docs/SECURITY.md") && read("README.md").includes("docs/SECURITY.md") &&
    read("docs/HANDOFF.md").includes("check-security.mjs");
  rule(doc, "docs/SECURITY.md exists and is linked from README / HANDOFF");

  const i18n = read("js/i18n.js") + read("js/addons.js");
  const textsAllLangs = ["factoryAskTitle", "factoryAskYes", "addonConsentTitle", "addonConsentYes", "addonConsentBadge", "addonFileTooBig"]
    .every(key => (i18n.match(new RegExp(`\\b${key}:`, "g")) || []).length === 4);
  rule(textsAllLangs, "the reset-confirmation and add-on consent texts exist in all four languages");

  const checklist = exists("docs/SECURITY-CHECKLIST.md") && read("docs/SECURITY-CHECKLIST.md").includes("OWASP") &&
    read("docs/SECURITY-CHECKLIST.md").includes("CWE") && read("README.md").includes("SECURITY-CHECKLIST.md") &&
    read("docs/SECURITY.md").includes("SECURITY-CHECKLIST.md");
  rule(checklist, "docs/SECURITY-CHECKLIST.md maps the OWASP client-side list and the CWE Top 25, and is linked");
}

console.log("");
if (failed) {
  console.log(`Security check: ${failed} failure(s) · ${pass} check(s) passed`);
  process.exit(1);
}
console.log(`Security check: passed · ${pass} check(s) · 0 warning(s)`);
