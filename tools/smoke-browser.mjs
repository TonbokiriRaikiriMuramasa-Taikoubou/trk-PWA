#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/* 実ブラウザでのスモーク検査（レビュー項目4の安全網）。npm run check には入れない（ブラウザが要るため）。
 *
 *   SMOKE_CHROME=/path/to/chromium [SMOKE_CHROME_ARGS='["--no-sandbox", …]'] \
 *   SMOKE_PUPPETEER=puppeteer-core \
 *   node tools/smoke-browser.mjs --write      … 意図した変更と理由を記録した後で基準を tests/fixtures/smoke-baseline.json に書く
 *   node tools/smoke-browser.mjs --compare    … 基準と比べる（譜面・キー集合の差、未解決名、新しいエラーで終了コード1）
 *
 * 見ること：
 *   1. 起動直後のエラー（pageerror／console.error）
 *   2. 監査（tools/globals-audit.mjs）が大域に残ると判定した名前（包みの外の宣言・window に出す名前）が、実行時に本当に解決できるか
 *   3. 合成analysis注入の譜面（生成方式 1／2 × 難易度すべて）のハッシュとキー集合の完全一致
 *   4. 実 WAV のデコード・音声解析にエラーがなく、キー集合一致・件数±5%以内か
 *   5. 公開 API を通す場面（書斎の開閉・一覧・統計・掃除）の結果と、その間のエラー
 *   6. 画面の見えているボタンを順に押したときの新しいエラー
 *   7. 360×800 portrait／800×360 landscape で #stage が viewport 内に収まるか
 *   8. 汚染した index.html をSW cacheへ入れ、HTTPサーバーを停止した状態で safe URL が 503 になり、偽スクリプトを実行しないか
 * window に増減した名前は、名前空間の移行で意図して変わるので「報告のみ」。 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { audit } from "./globals-audit.mjs";
import { SYNTH_SONGS, synthAnalysis } from "../tests/helpers/synth.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODE = process.argv.includes("--write") ? "write" : process.argv.includes("--compare") ? "compare" : null;
if (!MODE) { console.error("使い方：--write か --compare を付けてください（先頭のコメント参照）"); process.exit(2); }
const CLICK_LIMIT = Number(process.env.SMOKE_CLICKS || 400);
const BASELINE = path.join(ROOT, "tests/fixtures/smoke-baseline.json");
const SW_SOURCE = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const CACHE_NAME = SW_SOURCE.match(/CACHE\s*=\s*['"]([^'"]+)['"]/)?.[1];
if (!CACHE_NAME) throw new Error("sw.js cache name could not be read for the offline safe-mode smoke test");

/* ---- 合成曲（tests/helpers/synth.mjs と同じ考え方：区間ごとに音量を変える） ---- */
function makeWav() {
  const SR = 22050, DUR = 90, BPM = 120;
  const n = SR * DUR, pcm = new Int16Array(n);
  let s = 99991;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const amp = t => (t < 20 ? 0.04 : t < 40 ? 0.25 : t < 70 ? 0.6 : 0.3);
  const beat = 60 / BPM;
  for (let i = 0; i < n; i++) {
    const t = i / SR, a = amp(t), bt = t % beat;
    const kick = bt < 0.25 ? Math.sin(2 * Math.PI * (120 * Math.exp(-bt * 25)) * bt) * Math.exp(-bt * 18) : 0;
    const hat = (t % (beat / 2)) < 0.02 ? (rnd() * 2 - 1) * 0.25 : 0;
    pcm[i] = Math.max(-32767, Math.min(32767, Math.round(a * (kick * 0.9 + hat) * 32767)));
  }
  const hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + pcm.length * 2, 4); hdr.write("WAVE", 8);
  hdr.write("fmt ", 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
  hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34);
  hdr.write("data", 36); hdr.writeUInt32LE(pcm.length * 2, 40);
  return Buffer.concat([hdr, Buffer.from(pcm.buffer)]);
}

/* chart-gen の比較には tests と同じ合成 analysis を渡す。
   decodeAudioData の環境差は、この決定的な譜面比較には混ぜない。 */
const CHART_SMOKE_SONG_ID = "contrast";
const CHART_SMOKE_SEED = "834271";
const CHART_SMOKE_OFFSET = 0;
const chartSmokeSong = SYNTH_SONGS[CHART_SMOKE_SONG_ID];
const chartSmokeAnalysis = synthAnalysis(chartSmokeSong, 7);
const CHART_SMOKE_INPUT = {
  song: CHART_SMOKE_SONG_ID,
  seed: CHART_SMOKE_SEED,
  offset: CHART_SMOKE_OFFSET,
  bpm: chartSmokeSong.bpm,
  durationMs: chartSmokeSong.durSec * 1000,
  analysis: {
    frames: chartSmokeAnalysis.frames,
    frameMs: chartSmokeAnalysis.frameMs,
    maxRms: chartSmokeAnalysis.maxRms,
    scale: chartSmokeAnalysis.scale,
    rms: Array.from(chartSmokeAnalysis.rms),
    onset: Array.from(chartSmokeAnalysis.onset),
    ratio: Array.from(chartSmokeAnalysis.ratio),
  },
};

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".mjs": "text/javascript", ".wasm": "application/wasm" };
function serve() {
  const wav = makeWav();
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (u === "/__smoke.wav") { res.writeHead(200, { "Content-Type": "audio/wav" }); return res.end(wav); }
    if (u === "/__blank.html") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return res.end("<!doctype html><title>blank</title>"); }
    const f = path.join(ROOT, u === "/" ? "index.html" : u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r(server)));
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    if (!server.listening) return resolve();
    server.close(err => err ? reject(err) : resolve());
    server.closeAllConnections?.();
  });
}

async function loadPuppeteer() {
  const spec = process.env.SMOKE_PUPPETEER || "puppeteer-core";
  const mod = await import(spec.startsWith("/") ? pathToFileURL(spec).href : spec);
  return mod.default || mod;
}

const uniq = a => [...new Set(a)].sort();

async function main() {
  const puppeteer = await loadPuppeteer();
  const server = await serve();
  const port = server.address().port;
  const launch = { headless: true, args: JSON.parse(process.env.SMOKE_CHROME_ARGS || "[]") };
  if (process.env.SMOKE_CHROME) launch.executablePath = process.env.SMOKE_CHROME;
  let browser = null, serverStopped = false;
  const report = { boot: {}, globals: {}, unresolved: [], charts: {}, scenarios: {}, clicks: {}, mobileStage: null, safeOffline: null, pageErrors: [] };
  try {
    browser = await puppeteer.launch(launch);
    /* 基準：何も読み込んでいない about:blank の window の名前 */
    const blank = await browser.newPage();
    await blank.goto(`http://127.0.0.1:${port}/__blank.html`, { waitUntil: "load" });
    const baseNames = await blank.evaluate(() => Object.getOwnPropertyNames(window));
    await blank.close();

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const errors = [];
    page.on("pageerror", e => errors.push("pageerror: " + e.message));
    const pending = [];
    page.on("console", m => {
      if (m.type() !== "error") return;
      pending.push(Promise.all(m.args().map(a => a.evaluate(x => (x && x.message) ? x.message : String(x)).catch(() => "?")))
        .then(parts => { errors.push("console: " + parts.join(" ").slice(0, 300)); }));
    });
    const flush = async () => { await Promise.all(pending.splice(0)); };
    page.on("dialog", d => d.dismiss().catch(() => {}));
    page.on("filechooser", () => {});
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));
    await flush();
    report.boot.errors = uniq(errors);
    errors.length = 0;

    /* 2. 名前の解決：監査が宣言とみなした名前（トップレベル）は、実行時に参照できるはず */
    /* 包んだ中の私有の名前は大域に無いのが正しいので、確かめるのは大域に残る名前だけ */
    const audited = audit().files;
    const globalAll = uniq(audited.flatMap(f => f.globalNames));
    report.unresolved = await page.evaluate(names => names.filter(n => {
      try { (0, eval)(n); return false; } catch (_) { return true; }
    }), globalAll);
    report.declCount = uniq(audited.flatMap(f => f.names)).length;
    report.globalCount = globalAll.length;

    /* 1・3. window に増えた名前（報告のみ） */
    const appNames = await page.evaluate(() => Object.getOwnPropertyNames(window));
    report.globals.added = uniq(appNames.filter(n => !baseNames.includes(n)));

    /* 3. 譜面の比較は合成 analysis を直接注入し、node:test と同じ入力・Seedに固定する。
       これにより AudioContext のサンプルレートやデコード実装差で基準が揺れない。 */
    const diffIds = await page.evaluate(() => window.Trk.data.DIFF_IDS);
    const injectedCharts = await page.evaluate((fixture, diffs) => {
      const analysis = {
        frames:fixture.analysis.frames, frameMs:fixture.analysis.frameMs,
        maxRms:fixture.analysis.maxRms, scale:fixture.analysis.scale,
        rms:Float32Array.from(fixture.analysis.rms),
        onset:Float32Array.from(fixture.analysis.onset),
        ratio:Float32Array.from(fixture.analysis.ratio),
      };
      const out = {};
      for (const gen of ["1", "2"]) for (const diff of diffs) {
        const rand = window.Trk.core.mulberry32(window.Trk.core.hashString(`${String(fixture.seed).trim()}|${diff}|${fixture.bpm}|${fixture.offset}`));
        const notes = window.Trk.chart.buildChartNotes({
          analysis, durationMs:fixture.durationMs, diff, spec:window.Trk.data.DIFFS[diff],
          bpm:fixture.bpm, offset:fixture.offset, rand, chartGen:gen,
        });
        out[`gen${gen}/${diff}`] = { notes:notes.length, level:window.Trk.chart.cgEstimateLevel(notes), body:JSON.stringify(notes) };
      }
      return out;
    }, CHART_SMOKE_INPUT, diffIds);
    for (const [key, row] of Object.entries(injectedCharts)) {
      report.charts[key] = {
        notes:row.notes, level:row.level,
        hash:crypto.createHash("sha256").update(row.body).digest("hex").slice(0, 16),
      };
    }

    /* 4. 実 WAV はデコード／解析の経路だけを検査する。
       サンプル値は環境依存なので、譜面のハッシュではなくエラーと件数±5%だけを見る。 */
    const decodeStart = errors.length;
    const decoded = await page.evaluate(async diffs => {
      const buf = await (await fetch("/__smoke.wav")).arrayBuffer();
      const loaded = await window.Trk.media.loadMedia(new File([buf], "smoke.wav", { type:"audio/wav" }), {});
      const core = window.Trk.core;
      const result = { loaded:!!loaded, analyzed:!!core.analysis, duration:core.video.duration, charts:{} };
      if (loaded) for (const gen of ["1", "2"]) for (const diff of diffs) {
        const notes = window.Trk.media.generateNotes(diff, 120, 0, "834271", gen);
        result.charts[`gen${gen}/${diff}`] = { notes:notes.length };
      }
      return result;
    }, diffIds);
    await new Promise(r => setTimeout(r, 100));
    await flush();
    report.decoded = { ...decoded, errors:uniq(errors.slice(decodeStart)) };
    errors.length = 0;

    /* 5. 公開 API を通す場面（書斎：開閉・一覧・統計・掃除）。値は基準と一致すること */
    const scenarios = [
      ["study:open", "() => { TrkStudyRoom.open(); return TrkStudyRoom.isOpen(); }"],
      ["study:stats", "() => JSON.stringify(TrkStudyRoom.stats())"],
      ["study:books", "() => Array.isArray(TrkStudyRoom.books())"],
      ["study:close", "() => { TrkStudyRoom.close(); return !TrkStudyRoom.isOpen(); }"],
      ["study:toggle", "() => { TrkStudyRoom.toggle(); const o = TrkStudyRoom.isOpen(); TrkStudyRoom.toggle(); return o && !TrkStudyRoom.isOpen(); }"],
      ["study:sweep", "async () => { await TrkStudyRoom.sweepOrphans(); return true; }"],
    ];
    report.scenarios = {};
    for (const [name, fn] of scenarios) {
      const before = errors.length;
      try {
        const value = await page.evaluate(`(${fn})()`);
        await new Promise(r => setTimeout(r, 100));
        await flush();
        report.scenarios[name] = { value: value === undefined ? "undefined" : String(value), newErrors: errors.slice(before) };
      } catch (e) {
        report.scenarios[name] = { value: "throw", newErrors: [String(e && e.message || e).split("\n")[0]] };
      }
    }
    errors.length = 0;

    /* 6. 見えているボタンを順に押す。押すたびに新しいエラーが出ないかを見る */
    const clickLabels = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("button, [role=button]").forEach((b, i) => {
        if (!b.offsetParent || b.disabled) return;
        const label = (b.getAttribute("data-i18n") || b.textContent || b.getAttribute("aria-label") || b.id || "").trim().replace(/\s+/g, " ").slice(0, 40);
        b.setAttribute("data-smoke", String(i));
        out.push({ i, label });
      });
      return out;
    });
    const seen = new Set();
    const clickErrors = [];
    let clicked = 0;
    for (const { i, label } of clickLabels.slice(0, CLICK_LIMIT)) {
      if (/reset|リセット|share|共有|削除|delete|remove|clear|消去|https?:/i.test(label)) continue; // 状態を大きく壊す／外へ出る操作は押さない
      const before = errors.length;
      const ok = await page.evaluate(idx => {
        const b = document.querySelector(`[data-smoke="${idx}"]`);
        if (!b || !b.offsetParent) return false;
        b.click(); return true;
      }, String(i)).catch(() => false);
      if (!ok) continue;
      clicked++;
      await new Promise(r => setTimeout(r, 120));
      await flush();
      if (errors.length > before) {
        for (const e of errors.slice(before)) {
          const key = `${label} :: ${e}`;
          if (!seen.has(key)) { seen.add(key); clickErrors.push({ label, error: e }); }
        }
      }
      // 押した結果でページを離れたら戻す
      const pages = await browser.pages();
      for (const p of pages) if (p !== page && p.url() !== "about:blank") await p.close().catch(() => {});
      await page.keyboard.press("Escape").catch(() => {});
    }
    report.clicks = { candidates: clickLabels.length, clicked, errors: clickErrors };

    /* 7. Narrow portrait and short landscape viewports: #stage must remain inside the layout viewport. */
    const mobilePage = await browser.newPage();
    const mobileOrigin = `http://127.0.0.1:${port}`;
    const mobileSizes = [{ name:"portrait", width:360, height:800 }, { name:"landscape", width:800, height:360 }];
    const mobileMeasurements = {};
    for (const size of mobileSizes) {
      await mobilePage.setViewport({ width:size.width, height:size.height, isMobile:true, deviceScaleFactor:1 });
      await mobilePage.goto(`${mobileOrigin}/index.html`, { waitUntil:"load", timeout:60000 });
      await mobilePage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      mobileMeasurements[size.name] = await mobilePage.evaluate(expected => {
        const stage = document.getElementById("stage"), r = stage?.getBoundingClientRect();
        if (!r) return { expected, missingStage:true };
        const viewport = { width:innerWidth, height:innerHeight };
        const rect = { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
        const inBounds = Math.abs(viewport.width - expected.width) <= 1 && Math.abs(viewport.height - expected.height) <= 1 &&
          rect.left >= -1 && rect.top >= -1 && rect.right <= viewport.width + 1 && rect.bottom <= viewport.height + 1 &&
          document.documentElement.scrollWidth <= viewport.width + 1 && document.documentElement.scrollHeight <= viewport.height + 1;
        return { expected, viewport, rect, scroll:{ width:document.documentElement.scrollWidth, height:document.documentElement.scrollHeight }, inBounds };
      }, { width:size.width, height:size.height });
    }
    await mobilePage.close();
    const mobileOk = mobileSizes.every(size => mobileMeasurements[size.name]?.inBounds === true);
    report.mobileStage = { ok:mobileOk, viewports:mobileMeasurements };
    report.scenarios["layout:mobile-stage"] = {
      value:mobileOk ? "portrait and landscape stage bounds inside viewport" : JSON.stringify(mobileMeasurements),
      newErrors:mobileOk ? [] : ["#stage is outside the mobile layout viewport or caused document overflow"],
    };

    /* 8. Seed the active SW cache with a deliberately executable index.html, then stop the HTTP server.
       Navigation is deliberately from a fresh client, where event.clientId is empty. */
    const controlled = async () => page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      try {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) await new Promise(resolve => {
          const timer = setTimeout(resolve, 5000);
          navigator.serviceWorker.addEventListener("controllerchange", () => { clearTimeout(timer); resolve(); }, { once:true });
        });
        return !!navigator.serviceWorker.controller;
      } catch (_) { return false; }
    });
    let hasController = await controlled();
    if (!hasController) {
      await page.reload({ waitUntil:"load", timeout:60000 });
      hasController = await controlled();
    }
    if (!hasController) throw new Error("service worker did not control the app page for the offline safe-mode regression");
    const poisonSeeded = await page.evaluate(async cacheName => {
      const cache = await caches.open(cacheName), root = new URL("./", location.href);
      const poison = '<!doctype html><meta charset="utf-8"><title>POISONED-SHELL</title><script>window.__trkSmokePoisonRan=true;document.title="POISONED-SHELL"</script>';
      const response = new Response(poison, { status:200, headers:{ "Content-Type":"text/html; charset=utf-8" } });
      await cache.put(new URL("index.html", root).href, response.clone());
      await cache.put(root.href, response.clone());
      return (await cache.match(new URL("index.html", root).href))?.status === 200;
    }, CACHE_NAME);
    if (!poisonSeeded) throw new Error("could not seed the active service-worker cache for the safe-mode regression");
    await closeServer(server);
    serverStopped = true;
    const safeTargets = [
      { name:"index-query", path:"/index.html?safe=1" },
      { name:"root-query", path:"/?safe=1" },
      { name:"root-hash", path:"/#safe" },
    ];
    const safeResults = [];
    for (const target of safeTargets) {
      const offlinePage = await browser.newPage();
      let response = null, navigationError = "";
      try { response = await offlinePage.goto(`${mobileOrigin}${target.path}`, { waitUntil:"load", timeout:15000 }); }
      catch (e) { navigationError = String(e && e.message || e).split("\n")[0]; }
      const landed = await offlinePage.evaluate(() => ({
        title:document.title, poisoned:window.__trkSmokePoisonRan === true,
        body:(document.body?.innerText || "").slice(0, 240), href:location.href,
      })).catch(() => ({ title:"", poisoned:false, body:"", href:"" }));
      const status = response?.status() ?? null;
      const safeMessage = landed.body.includes("Safe mode does not use the cached copy");
      const passed = status === 503 && safeMessage && !landed.poisoned && landed.title !== "POISONED-SHELL";
      safeResults.push({ name:target.name, path:target.path, status, navigationError, safeMessage, poisoned:landed.poisoned, passed });
      await offlinePage.close();
    }
    const safeOk = safeResults.length === safeTargets.length && safeResults.every(row => row.passed) && !server.listening;
    report.safeOffline = {
      ok:safeOk, cacheSeeded:poisonSeeded, serverStopped:!server.listening,
      blocked:safeResults.filter(row => row.passed).length, poisonExecutions:safeResults.filter(row => row.poisoned).length,
      routes:safeResults,
    };
    report.scenarios["security:safe-offline-shell"] = {
      value:`blocked=${report.safeOffline.blocked}/${safeTargets.length}; poisonRuns=${report.safeOffline.poisonExecutions}; serverStopped=${report.safeOffline.serverStopped}`,
      newErrors:safeOk ? [] : safeResults.filter(row => !row.passed).map(row => `${row.name}: HTTP ${row.status ?? "none"}, poison=${row.poisoned}, safeMessage=${row.safeMessage}${row.navigationError ? `, ${row.navigationError}` : ""}`),
    };

    await flush();
    report.pageErrors = uniq(errors);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (!serverStopped) await closeServer(server).catch(() => {});
  }
  return report;
}

let report;
try {
  report = await main();
} catch (e) {
  console.log("NG\n- 実行中の例外: " + String(e && e.message || e).split("\n")[0]);
  process.exit(1);
}
const summary = {
  boot: report.boot.errors.length, unresolved: report.unresolved.length,
  decls: report.declCount, globals: report.globalCount, added: report.globals.added.length,
  charts: Object.keys(report.charts).length, decodedCharts: Object.keys(report.decoded.charts).length,
  decodeErrors: report.decoded.errors.length, scenarios: Object.keys(report.scenarios).length, clicks: report.clicks.clicked,
  clickErrors: report.clicks.errors.length, mobileStage: report.mobileStage?.ok === true, safeOffline: report.safeOffline?.ok === true,
};
console.log(JSON.stringify(summary));
if (MODE === "write") {
  const required = [];
  if (!report.mobileStage?.ok) required.push("mobile #stage viewport geometry");
  if (!report.safeOffline?.ok) required.push("offline safe-mode rejection of the poisoned shell");
  if (required.length) { console.log("NG\n- smoke gate failed: " + required.join(" / ")); process.exit(1); }
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(BASELINE, JSON.stringify(report, null, 1) + "\n");
  console.log(`wrote ${path.relative(ROOT, BASELINE)}`);
} else {
  const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  const problems = [];
  if (!report.mobileStage?.ok) problems.push("モバイル portrait/landscape で #stage が viewport 内に収まらない");
  if (!report.safeOffline?.ok) problems.push("停止したサーバー上の safe URL が汚染 index.html を拒否できない");
  const baseChartKeys = Object.keys(base.charts || {}).sort();
  const nowChartKeys = Object.keys(report.charts).sort();
  if (JSON.stringify(baseChartKeys) !== JSON.stringify(nowChartKeys)) problems.push(`合成analysisの譜面キーが違う: ${baseChartKeys.join(", ")} → ${nowChartKeys.join(", ")}`);
  for (const [k, v] of Object.entries(base.charts || {})) {
    const now = report.charts[k];
    if (!now || now.hash !== v.hash || now.notes !== v.notes || now.level !== v.level) problems.push(`合成analysis注入の譜面が変わった: ${k}（${v.notes} → ${now ? now.notes : "なし"}）`);
  }
  if (!report.decoded.loaded || !report.decoded.analyzed) problems.push(`実WAVのデコード／解析に失敗: loaded=${report.decoded.loaded}, analyzed=${report.decoded.analyzed}`);
  for (const e of report.decoded.errors) problems.push(`実WAVのデコード経路でエラー: ${e}`);
  const decodedBase = base.decoded && base.decoded.charts;
  if (!decodedBase || !Object.keys(decodedBase).length) problems.push("基準に decoded.charts がありません（--write で更新してください）");
  const decodedBaseKeys = Object.keys(decodedBase || {}).sort();
  const decodedNowKeys = Object.keys(report.decoded.charts).sort();
  if (JSON.stringify(decodedBaseKeys) !== JSON.stringify(decodedNowKeys)) problems.push(`実WAV譜面のキーが違う: ${decodedBaseKeys.join(", ")} → ${decodedNowKeys.join(", ")}`);
  for (const [k, v] of Object.entries(decodedBase || {})) {
    const now = report.decoded.charts[k];
    const tolerance = Math.max(1, Math.floor(Number(v.notes) * 0.05));
    if (!now || Math.abs(now.notes - Number(v.notes)) > tolerance) {
      problems.push(`実WAVのノーツ件数が±5%を超えた: ${k}（${v.notes} → ${now ? now.notes : "なし"}、許容±${tolerance}）`);
    }
  }
  for (const [k, v] of Object.entries(base.scenarios || {})) {
    const now = report.scenarios[k];
    if (!now || now.value !== v.value) problems.push(`場面の結果が変わった: ${k}（${v.value} → ${now ? now.value : "なし"}）`);
    if (now && now.newErrors.length) problems.push(`場面で新しいエラー: ${k}: ${now.newErrors.join(" / ")}`);
  }
  if (report.unresolved.length) problems.push(`実行時に解決できない宣言: ${report.unresolved.join(", ")}`);
  const baseErr = new Set([...base.boot.errors, ...base.pageErrors, ...base.clicks.errors.map(e => e.error)]);
  for (const e of [...report.boot.errors, ...report.pageErrors, ...report.clicks.errors.map(x => x.error)]) {
    if (!baseErr.has(e)) problems.push(`新しいエラー: ${e}`);
  }
  const addedNow = new Set(report.globals.added), addedBase = new Set(base.globals.added);
  const diff = { gained: [...addedNow].filter(n => !addedBase.has(n)), lost: [...addedBase].filter(n => !addedNow.has(n)) };
  const short = a => `${a.length}件 ${a.slice(0, 12).join(", ")}${a.length > 12 ? " …" : ""}`;
  if (diff.gained.length || diff.lost.length) console.log(`window の名前の増減（報告のみ）: 増 ${short(diff.gained)} ／ 減 ${short(diff.lost)}`);
  if (problems.length) { console.log("NG\n- " + problems.join("\n- ")); process.exit(1); }
  console.log("OK：譜面・未解決の名前・新しいエラーはありません");
}
