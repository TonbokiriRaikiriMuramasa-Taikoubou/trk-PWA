#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/* 📦 配布ZIPの組み立て（trk204）
   1.0.8 から配布物の形をそろえる：ZIPを開くと **index.html・README.txt・trk-files/** の3つだけ。
   アプリ本体は trk-files/ の中に入れ、ルートの index.html は「アプリを開く」だけの入口にする
   （1.0.6 のころに試作した形＝前回のレビューで「この形にそろえる」と決めたもの）。

   使い方：
     node tools/prepare-release.mjs --app=<アプリのディレクトリ> --readme=<README.txt> \
       --version=1.0.9 --out=dist [--zip] [--date=2026-10-27T15:00:00Z]
     node tools/prepare-release.mjs --check=<組み上がったディレクトリ>   （形だけを検査）

   ・アプリのディレクトリは「index.html・sw.js・release-manifest.json がある場所」。
     ここを trk-files/ として丸ごと写す（中身は触らない。時刻だけそろえる）。
   ・書き出す release-manifest.json には layout（wrapper）と archive を記録する。
   ・ZIP は js/zip-io.js の zipWrite をそのまま使う（新しい ZIP 実装を増やさない）。
   ・出力先（既定 dist/）は .gitignore 済み。 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const WRAPPER_INDEX = "index.html";
export const WRAPPER_README = "README.txt";
export const APP_DIR = "trk-files";
/* 配布用の「かんたん起動」README.txt はリポジトリにも置く（release/README.txt）。
   これがあればDriveを見なくても同じZIPを作り直せる。--readme を省いたときはこれを使う。 */
export const DEFAULT_README = path.join(ROOT, "release", "README.txt");
/* ルートに見えてよいもの（これ以外がルートにあったら失敗＝「index.html と README だけ」を守る） */
export const WRAPPER_ENTRIES = [WRAPPER_INDEX, WRAPPER_README, APP_DIR];
/* ルートの入口。アプリ本体は trk-files/ にある（1.0.6 の試作と同じ作り）。
   ・file:// でも http:// でも app/index.html へ置き換えで進む
   ・古い（ルート直下に置いていた）版の Service Worker だけを外してから進む
   ・JavaScript が動かない環境でも <a> で進める */
export const LAUNCHER_HTML = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>trk!</title>
<meta http-equiv="refresh" content="0; url=${APP_DIR}/index.html">
<style>html,body{margin:0;height:100%;background:#0b0d16;color:#f1f5f9;font-family:system-ui,sans-serif}main{display:grid;place-items:center;height:100%;text-align:center}a{color:#ff8a4c;font-size:20px;font-weight:700}</style>
<script>
/* trk! の入口。本体は ${APP_DIR}/ にあります（ZIPを開いたときに index.html と README.txt だけが見えるようにするため）。
   1.0.7 以前をローカルサーバーで使っていた場合、ルートに残った trk! の Service Worker だけを外します。 */
(function () {
  var dest = "${APP_DIR}/index.html" + location.search + location.hash;
  try {
    if (location.protocol !== "file:" && navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      var oldSw = new URL("sw.js", location.href).href;
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) {
          var w = r.active || r.waiting || r.installing;
          return w && w.scriptURL === oldSw ? r.unregister() : null;
        }));
      }).catch(function () {}).then(function () { location.replace(dest); });
      return;
    }
  } catch (e) {}
  location.replace(dest);
})();
</script>
</head>
<body><main><p><a href="${APP_DIR}/index.html">▶ trk! をひらく / Open trk!</a></p></main>
</body>
</html>
`;

/* ⏱ 既定の時刻は「いま」（分まで）。前の版と同じ時刻にすると、同じポートのローカルサーバーが
   If-Modified-Since に 304 を返し、ブラウザーが前の版の index.html（入口ではなく旧アプリ）を使い続ける。
   1.0.7 と 1.0.8 がどちらも 2026-10-27 12:00 だったため、1.0.7 を使っていた人は 1.0.8 の入口が開かなかった（2026-10-27 レビュー）。
   --date を渡すときも、必ず前の版より新しい時刻にする。 */
export function defaultReleaseDate(now = new Date()) {
  const d = new Date(now.getTime()); d.setSeconds(0, 0);
  return d.toISOString();
}
/* ⏱ 前の版と同じ時刻のZIPを作らない。python -m http.server は If-Modified-Since に 304 を返すため、
   同じ時刻だとブラウザーが前の版の index.html（入口ではなく旧アプリ）を使い続け、一覧が空の壊れた画面になる。
   --newer-than=<前の版の built_at> を渡すと、それ以前の時刻では組み立てない。 */
export function assertNewerThan(date, newerThan) {
  if (!newerThan) return;
  const d = new Date(date).getTime(), n = new Date(newerThan).getTime();
  if (!Number.isFinite(n)) fail(`--newer-than を読めません: ${newerThan}`);
  if (!Number.isFinite(d)) fail(`--date を読めません: ${date}`);
  if (d <= n) fail(`--date（${new Date(d).toISOString()}）は前の版（${new Date(n).toISOString()}）より新しくしてください（同じ時刻だと 304 で旧版が残ります）`);
}
const VALID_VERSION = /^\d+\.\d+\.\d+$/;
/* 既に圧縮されている形式は deflate しない（時間とサイズの無駄） */
const STORE_EXT = new Set(["mp3", "m4a", "aac", "ogg", "oga", "opus", "flac", "wav", "mp4", "mov", "webm", "mkv", "png", "jpg", "jpeg", "gif", "webp", "woff", "woff2", "zip", "stpack", "pmd", "vmd", "vrm"]);

function fail(message) { throw new Error(message); }

/** ディレクトリを sort して歩き、相対パス（/ 区切り）の一覧を返す */
export function walkFiles(dir, prefix = "") {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.name !== ".DS_Store" && e.name !== "Thumbs.db")
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkFiles(abs, rel));
    else if (e.isFile()) out.push(rel);
    else fail(`対応していない種類のファイルです: ${rel}`);
  }
  return out;
}

/* ---------- 配布物の中の文書（trk214） ----------
   前の版の trk-files/ に「変わったファイル」だけを載せ替える作り方なので、配布版だけの
   文書（docs/guide/*.md・CONTRIBUTING.md・docs/SECURITY.md・privacy.html・README-1.x.y.md）は
   版が上がっても古いまま残りやすい。1.1.3 では「1.0.4 ポータブルZIP」の表記と、
   入っていない README-1.0.4.md / README-1.0.8.md への参照が残っていた（2026-10-27 レビュー）。
   ここでは、組み上がった配布物の中の .md / .html / .txt を読んで
   ・相対リンクの先が実在するか
   ・README-x.y.z.md の名前が実在するか（リンクでなく本文に書いてあるだけでも）
   を見る。版の表記そのもの（「1.0.4」など）は文脈が要るので人（§9 の手順）で直す。 */
const DOC_EXT = new Set([".md", ".html", ".htm", ".txt"]);
const DOC_URL = /^[a-z][a-z0-9+.-]*:/i;
function docTarget(base, raw) {
  const clean = String(raw || "").trim().replace(/^<|>$/g, "").split("#")[0].split("?")[0];
  if (!clean || DOC_URL.test(clean) || clean.startsWith("//") || clean.startsWith("/")) return "";
  let decoded = clean;
  try { decoded = decodeURIComponent(clean); } catch (_) {}
  return path.posix.normalize(base === "." ? decoded : `${base}/${decoded}`);
}
export function checkDocLinks(dir) {
  const problems = [];
  if (!fs.existsSync(dir)) return problems;
  /* 見るのはアプリ本体（trk-files/）。ルートの README.txt は release/README.txt が元で、
     版の名前は組み立てのたびに人が直す（§9）。 */
  const root = fs.existsSync(path.join(dir, APP_DIR)) ? path.join(dir, APP_DIR) : dir;
  const files = walkFiles(root);
  /* 配布物の外（../）を指すものは、ここでは見ない（配布物の中で閉じているかは別の話） */
  const outside = rel => !rel || rel === ".." || rel.startsWith("../");
  const exists = rel => outside(rel) || fs.existsSync(path.join(root, rel));
  const basenames = new Set(files.map(f => path.posix.basename(f)));
  for (const rel of files) {
    if (!DOC_EXT.has(path.extname(rel).toLowerCase())) continue;
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    const base = rel.includes("/") ? path.posix.dirname(rel) : ".";
    const seen = new Set(), flagged = new Set();
    const report = (raw, resolved) => {
      if (!resolved || seen.has(resolved)) return;
      seen.add(resolved);
      if (exists(resolved)) return;
      flagged.add(path.posix.basename(resolved));
      problems.push(`${rel}: ${raw} が見つかりません（配布物に入っていない名前を指しています）`);
    };
    for (const m of text.matchAll(/\]\(([^)\s]+)/g)) report(m[1], docTarget(base, m[1]));
    for (const m of text.matchAll(/\bhref="([^"]+)"/g)) report(m[1], docTarget(base, m[1]));
    /* リンクでなく本文に書いてある README-x.y.z.md は、同じ名前のファイルが
       配布物のどこかに入っていれば通す（書き方の場所は問わない）。 */
    for (const m of text.matchAll(/[\w./-]*README-\d+\.\d+\.\d+\.md/g)) {
      const name = path.posix.basename(m[0]);
      if (basenames.has(name) || flagged.has(name)) continue;
      if (seen.has(`name:${name}`)) continue;
      seen.add(`name:${name}`);
      flagged.add(name);
      problems.push(`${rel}: ${m[0]} が見つかりません（配布物に入っていない名前を指しています）`);
    }
  }
  return problems;
}

/** 組み上がったディレクトリが「決められた形」か検査する（人が作っても同じ検査を通す） */
export function checkLayout(dir) {
  const problems = [];
  if (!fs.existsSync(dir)) return { ok:false, problems:[`${dir} がありません`] };
  const top = fs.readdirSync(dir, { withFileTypes: true }).map(e => e.name).sort();
  const extra = top.filter(n => !WRAPPER_ENTRIES.includes(n));
  for (const n of WRAPPER_ENTRIES) if (!top.includes(n)) problems.push(`ルートに ${n} がありません`);
  if (extra.length) problems.push(`ルートに余計なものがあります: ${extra.join(", ")}（見えてよいのは ${WRAPPER_ENTRIES.join(" / ")} だけ）`);
  const app = path.join(dir, APP_DIR);
  if (fs.existsSync(app)) {
    for (const need of ["index.html", "sw.js", "release-manifest.json"]) {
      if (!fs.existsSync(path.join(app, need))) problems.push(`${APP_DIR}/${need} がありません`);
    }
    /* 1.0.7 までの配布用の起動案内（OS別の 00_START_HERE.html / 01_README_*.txt）はルートの README.txt に集約する。
       アプリ自身の README（README-*.md）は中身の説明なので残す。 */
    const stray = fs.readdirSync(app).filter(n => n === "00_START_HERE.html" || /^0\d_README_.*\.txt$/i.test(n));
    if (stray.length) problems.push(`${APP_DIR}/ に配布用の起動案内が残っています: ${stray.join(", ")}（かんたん起動はルートの ${WRAPPER_README}）`);
    if (fs.existsSync(path.join(app, "release-manifest.json"))) {
      try {
        const m = JSON.parse(fs.readFileSync(path.join(app, "release-manifest.json"), "utf8"));
        const sw = fs.readFileSync(path.join(app, "sw.js"), "utf8").match(/^const CACHE = "([^"]+)";$/m);
        if (sw && m.service_worker_cache !== sw[1]) problems.push(`release-manifest.json の service_worker_cache（${m.service_worker_cache}）と sw.js の CACHE（${sw[1]}）が違います`);
        if (m.layout !== "wrapper") problems.push("release-manifest.json の layout が wrapper ではありません");
      } catch (error) { problems.push(`release-manifest.json を読めません: ${error.message}`); }
    }
  }
  for (const p of checkDocLinks(dir)) problems.push(p);
  const index = path.join(dir, WRAPPER_INDEX);
  if (fs.existsSync(index)) {
    const html = fs.readFileSync(index, "utf8");
    if (!html.includes(`${APP_DIR}/index.html`)) problems.push(`ルートの ${WRAPPER_INDEX} が ${APP_DIR}/index.html を指していません`);
    if (!html.includes("location.replace")) problems.push(`ルートの ${WRAPPER_INDEX} に置き換えの処理がありません`);
  }
  return { ok: problems.length === 0, problems };
}

/* ---------- ZIP（js/zip-io.js の zipWrite をそのまま使う） ---------- */
async function loadZipWriter() {
  const source = fs.readFileSync(path.join(ROOT, "js/zip-io.js"), "utf8");
  const sandbox = { window: {}, TextEncoder, TextDecoder, Blob, Response, CompressionStream, DecompressionStream, DataView, Uint8Array, ArrayBuffer, crypto: globalThis.crypto };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "js/zip-io.js" });
  return sandbox.window.Trk.zipIO.zipWrite;
}

export async function writeZip(entries, mtime) {
  const zipWrite = await loadZipWriter();
  const blobs = entries.map(e => {
    const ext = path.extname(e.name).slice(1).toLowerCase();
    return { name: e.name, blob: new Blob([fs.readFileSync(e.abs)]), deflate: !STORE_EXT.has(ext) };
  });
  const blob = await zipWrite(blobs, { mtime: Date.parse(mtime) });
  return Buffer.from(await blob.arrayBuffer());
}

export async function buildRelease({ app, readme = DEFAULT_README, version, out, date = defaultReleaseDate(), newerThan = "", zip = false }) {
  if (!app || !fs.existsSync(app)) fail(`--app のディレクトリがありません: ${app}`);
  if (!readme || !fs.existsSync(readme)) fail(`--readme がありません: ${readme}`);
  if (!VALID_VERSION.test(String(version || ""))) fail(`--version は x.y.z の形で: ${version}`);
  assertNewerThan(date, newerThan);
  const stage = path.join(out, `trk-${version}`);
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(path.join(stage, APP_DIR), { recursive: true });

  /* アプリ本体は丸ごと写す（中身は変えない） */
  const appFiles = walkFiles(app);
  if (!appFiles.includes("index.html")) fail(`${app}/index.html がありません`);
  for (const rel of appFiles) {
    const to = path.join(stage, APP_DIR, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(app, rel), to);
  }
  /* release-manifest.json：版・置き場所・ZIPの名前を記録する */
  const manifestPath = path.join(stage, APP_DIR, "release-manifest.json");
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { product:"trk!" };
  const swCache = fs.readFileSync(path.join(stage, APP_DIR, "sw.js"), "utf8").match(/^const CACHE = "([^"]+)";$/m);
  Object.assign(manifest, {
    version: String(version),
    distribution: "portable-static-web-zip",
    native_installer: false,
    service_worker_cache: swCache ? swCache[1] : manifest.service_worker_cache,
    archive: `trk-${version}.zip`,
    layout: "wrapper",
    built_at: new Date(date).toISOString(),   /* ⏱ 次の版はこれより新しい時刻で組む（304 で旧版が残らないように） */
    wrapper: { launcher: WRAPPER_INDEX, readme: WRAPPER_README, app: APP_DIR, platforms: ["win", "linux", "mac"] },
  });
  delete manifest.platform;   /* 1.0.8 からOS別に分けない（同じアプリ本体で動く） */
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  fs.writeFileSync(path.join(stage, WRAPPER_INDEX), LAUNCHER_HTML);
  fs.copyFileSync(readme, path.join(stage, WRAPPER_README));

  /* 時刻をそろえる（ZIPの見た目を決定的にする） */
  const stamp = new Date(date);
  if (!Number.isFinite(stamp.getTime())) fail(`--date を読めません: ${date}`);
  const touch = p => { try { fs.utimesSync(p, stamp, stamp); } catch (_) {} };
  const all = walkFiles(stage);
  for (const rel of all) touch(path.join(stage, rel));
  for (const rel of all) {   /* ディレクトリは中身のあとで触る（作成時刻に引きずられないように） */
    const parts = rel.split("/"); parts.pop();
    while (parts.length) { touch(path.join(stage, ...parts)); parts.pop(); }
  }

  const check = checkLayout(stage);
  if (!check.ok) fail(`組み上がった形が決まりと違います:\n - ${check.problems.join("\n - ")}`);

  let zipPath = "";
  if (zip) {
    const entries = all.map(rel => ({ name: `trk-${version}/${rel}`, abs: path.join(stage, rel) }));
    const bytes = await writeZip(entries, date);
    zipPath = path.join(out, `trk-${version}.zip`);
    fs.writeFileSync(zipPath, bytes);
  }
  return { stage, zipPath, files: all };
}

/* ---------- コマンドライン ---------- */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = {};
  for (const raw of process.argv.slice(2)) {
    const m = raw.match(/^--([\w-]+)(?:=(.*))?$/);
    if (!m) continue;
    args[m[1]] = m[2] === undefined ? true : m[2];
  }
  if (args.check) {
    const result = checkLayout(path.resolve(args.check));
    if (!result.ok) { console.error("❌ 形が違います:\n - " + result.problems.join("\n - ")); process.exitCode = 1; }
    else console.log(`✅ ${WRAPPER_INDEX} / ${WRAPPER_README} / ${APP_DIR}/ の形です`);
  } else if (!args.app) {
    console.error("使い方: node tools/prepare-release.mjs --app=<アプリ> [--readme=<README.txt>] --version=1.0.9 --out=dist [--zip] [--date=...] [--newer-than=...]");
    console.error("  --readme を省くと release/README.txt（リポジトリ同梱の配布用README）を使います。");
    console.error("  --date は前の版の built_at より新しくしてください（同じ時刻だとブラウザーが旧版を使い続けます）。");
    process.exitCode = 2;
  } else {
    const out = path.resolve(args.out || "dist");
    buildRelease({
      app: path.resolve(args.app), readme: path.resolve(args.readme || DEFAULT_README), version: args.version,
      out, date: args.date || defaultReleaseDate(), newerThan: args["newer-than"] || "", zip: !!args.zip,
    }).then(({ stage, zipPath, files }) => {
      console.log(`📦 ${stage}（${files.length} files）`);
      if (zipPath) {
        const size = fs.statSync(zipPath).size;
        console.log(`🗜 ${zipPath}（${size} bytes）`);
      }
    }).catch(error => { console.error("❌ " + error.message); process.exitCode = 1; });
  }
}
