// SPDX-License-Identifier: GPL-3.0-or-later
/* trk204: 📦 配布ZIPの形をそろえる（ZIPを開くと index.html・README.txt・trk-files/ の3つだけ）。
   1.0.6 のころに試作した「index.html と README だけが見える構成」を、1.0.8 から本番の形にする。
   ルートの index.html は入口（trk-files/index.html へ進むだけ）、アプリ本体は trk-files/ の中。
   ・OS別のZIPは作らない（同じアプリ本体で Windows・macOS・Linux が動く）
   tests で確かめること：組み立て（形・時刻・manifest）・検査（余計なものがルートにあったら失敗）・
   ZIP の名前・入口の作り（file:// でも進める・古い Service Worker を外す）・.gitignore */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT } from "./helpers/browser-data.mjs";
import { buildRelease, checkLayout, checkDocLinks, LAUNCHER_HTML, WRAPPER_ENTRIES, assertNewerThan, defaultReleaseDate, DEFAULT_README } from "../tools/prepare-release.mjs";

const TOOL = path.join(ROOT, "tools/prepare-release.mjs");

function fixture({ cache = "trk-v2026.10.27-trk205" } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trk-release-"));
  const app = path.join(dir, "app");
  fs.mkdirSync(path.join(app, "js"), { recursive: true });
  fs.mkdirSync(path.join(app, "icons"), { recursive: true });
  fs.writeFileSync(path.join(app, "index.html"), "<!doctype html><title>trk!</title>\n");
  fs.writeFileSync(path.join(app, "sw.js"), `// sw\nconst CACHE = "${cache}";\n`);
  fs.writeFileSync(path.join(app, "release-manifest.json"), JSON.stringify({ product:"trk!", version:"1.0.8", service_worker_cache:"stale", platform:"win-linux" }, null, 2));
  fs.writeFileSync(path.join(app, "js/app.js"), "console.log(1);\n");
  fs.writeFileSync(path.join(app, "icons/icon.svg"), "<svg/>\n");
  const readme = path.join(dir, "README.txt");
  fs.writeFileSync(readme, "trk! かんたん起動\n");
  return { dir, app, readme, cache };
}

test("trk204: the release has just the launcher, the readme and trk-files/", async () => {
  const f = fixture();
  const out = path.join(f.dir, "dist");
  const { stage, files } = await buildRelease({ app: f.app, readme: f.readme, version: "1.0.8", out });
  assert.deepEqual(fs.readdirSync(stage).sort(), [...WRAPPER_ENTRIES].sort(), "ルートは3つだけ");
  assert.deepEqual(WRAPPER_ENTRIES.slice().sort(), ["README.txt", "index.html", "trk-files"], "決めた名前");
  assert.ok(files.includes("trk-files/js/app.js"), "アプリ本体は trk-files/ の中");
  assert.ok(files.includes("README.txt") && files.includes("index.html"));
  assert.ok(!files.some(f2 => f2.startsWith("trk-files/00_START_HERE")), "配布用の起動案内はルートの README.txt に集約");
  assert.equal(fs.readFileSync(path.join(stage, "README.txt"), "utf8"), "trk! かんたん起動\n", "README はそのまま置く");
});

test("trk204: the manifest records the wrapper layout, the archive and the real cache name", async () => {
  const f = fixture();
  const { stage } = await buildRelease({ app: f.app, readme: f.readme, version: "1.0.8", out: path.join(f.dir, "dist") });
  const m = JSON.parse(fs.readFileSync(path.join(stage, "trk-files/release-manifest.json"), "utf8"));
  assert.equal(m.version, "1.0.8");
  assert.equal(m.archive, "trk-1.0.8.zip");
  assert.equal(m.layout, "wrapper");
  assert.deepEqual(m.wrapper, { launcher:"index.html", readme:"README.txt", app:"trk-files", platforms:["win", "linux", "mac"] });
  assert.equal(m.service_worker_cache, f.cache, "sw.js の CACHE を書き写す");
  assert.equal(m.platform, undefined, "OS別に分けない（platform は持たない）");
  assert.equal(m.native_installer, false);
});

test("trk204: the launcher works with no server, and clears an old root-level worker", () => {
  assert.ok(LAUNCHER_HTML.includes('url=trk-files/index.html'), "JavaScript が動かなくても進める（meta refresh）");
  assert.ok(LAUNCHER_HTML.includes('href="trk-files/index.html"'), "リンクでも進める");
  assert.ok(LAUNCHER_HTML.includes("location.replace(dest)"), "履歴を増やさずに置き換える（file:// でも動く）");
  assert.ok(LAUNCHER_HTML.includes('location.protocol !== "file:"'), "file:// では Service Worker を触らない");
  assert.ok(/var oldSw = new URL\("sw\.js", location\.href\)\.href;/.test(LAUNCHER_HTML), "1.0.7 以前のルート直下の worker");
  assert.ok(/w\.scriptURL === oldSw \? r\.unregister\(\) : null/.test(LAUNCHER_HTML), "trk! のものだけ外す");
  assert.ok(LAUNCHER_HTML.includes('var dest = "trk-files/index.html" + location.search + location.hash'), "?safe=1 などを渡す");
});

test("trk204: the layout check refuses stray files, a missing app and a stale cache name", async () => {
  const f = fixture();
  const out = path.join(f.dir, "dist");
  const { stage } = await buildRelease({ app: f.app, readme: f.readme, version: "1.0.8", out });
  assert.equal(checkLayout(stage).ok, true, "組み上がったものは通る");

  const stray = path.join(f.dir, "stray");
  fs.cpSync(stage, stray, { recursive: true });
  fs.writeFileSync(path.join(stray, "00_START_HERE.html"), "x");
  const bad = checkLayout(stray);
  assert.equal(bad.ok, false);
  assert.match(bad.problems.join(" "), /余計なものがあります/);

  const missing = path.join(f.dir, "missing");
  fs.cpSync(stage, missing, { recursive: true });
  fs.rmSync(path.join(missing, "trk-files/sw.js"));
  assert.match(checkLayout(missing).problems.join(" "), /trk-files\/sw\.js がありません/);

  const guide = path.join(f.dir, "guide");
  fs.cpSync(stage, guide, { recursive: true });
  fs.writeFileSync(path.join(guide, "trk-files/01_README_WIN_LINUX.txt"), "x");
  assert.match(checkLayout(guide).problems.join(" "), /配布用の起動案内が残っています/);

  const stale = path.join(f.dir, "stale");
  fs.cpSync(stage, stale, { recursive: true });
  const mp = path.join(stale, "trk-files/release-manifest.json");
  const m = JSON.parse(fs.readFileSync(mp, "utf8")); m.service_worker_cache = "trk-v2026.01.01-old";
  fs.writeFileSync(mp, JSON.stringify(m));
  assert.match(checkLayout(stale).problems.join(" "), /service_worker_cache/);
});

test("trk204: the zip keeps the wrapper folder and the same paths", async () => {
  const f = fixture();
  const out = path.join(f.dir, "dist");
  const { zipPath } = await buildRelease({ app: f.app, readme: f.readme, version: "1.0.8", out, zip: true, date: "2026-10-27T12:00:00Z" });
  assert.equal(path.basename(zipPath), "trk-1.0.8.zip", "OS別に分けないので名前は1つ");
  const listing = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" }).trim().split("\n").sort();
  assert.deepEqual(listing, [
    "trk-1.0.8/README.txt", "trk-1.0.8/index.html", "trk-1.0.8/trk-files/icons/icon.svg",
    "trk-1.0.8/trk-files/index.html", "trk-1.0.8/trk-files/js/app.js",
    "trk-1.0.8/trk-files/release-manifest.json", "trk-1.0.8/trk-files/sw.js",
  ].sort(), "全部 trk-1.0.8/ の下、形はディレクトリと同じ");
  execFileSync("unzip", ["-t", zipPath], { stdio:"pipe" });
  const stamp = execFileSync("unzip", ["-Z", "-T", zipPath], { encoding: "utf8" });
  assert.match(stamp, /20261027\.120000/, "全エントリの時刻をそろえる（決定的なZIP）");
});

test("trk204: the CLI writes the same layout, and the output is git-ignored", () => {
  const f = fixture();
  const out = path.join(f.dir, "dist");
  execFileSync(process.execPath, [TOOL, `--app=${f.app}`, `--readme=${f.readme}`, "--version=1.0.8", `--out=${out}`, "--zip"], { encoding:"utf8" });
  assert.deepEqual(fs.readdirSync(path.join(out, "trk-1.0.8")).sort(), [...WRAPPER_ENTRIES].sort());
  assert.ok(fs.existsSync(path.join(out, "trk-1.0.8.zip")));
  const ignored = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  assert.match(ignored, /^dist\/$/m, "組み立ての出力は Git に入れない");
  assert.ok(fs.readFileSync(path.join(ROOT, "package.json"), "utf8").includes("prepare-release"), "npm からも呼べる");
});

test("trk205: a release is dated now (to the minute) and records built_at", async () => {
  const f = fixture();
  const { stage } = await buildRelease({ app: f.app, readme: f.readme, version: "1.0.8", out: path.join(f.dir, "dist"), date: "2026-10-27T13:00:00Z" });
  const m = JSON.parse(fs.readFileSync(path.join(stage, "trk-files/release-manifest.json"), "utf8"));
  assert.equal(m.built_at, "2026-10-27T13:00:00.000Z", "組んだ時刻を manifest に残す（次の版はこれより新しく）");

  const now = new Date("2026-10-27T00:41:37.123Z");
  assert.equal(defaultReleaseDate(now), "2026-10-27T00:41:00.000Z", "既定は「いま」を分まで丸める（固定値にしない）");
  const f2 = fixture();
  const auto = await buildRelease({ app: f2.app, readme: f2.readme, version: "1.0.8", out: path.join(f2.dir, "dist") });
  const m2 = JSON.parse(fs.readFileSync(path.join(auto.stage, "trk-files/release-manifest.json"), "utf8"));
  assert.ok(Math.abs(Date.parse(m2.built_at) - Date.now()) < 5 * 60_000, "既定の built_at は組み立てた時刻");
  assert.equal(new Date(m2.built_at).getSeconds(), 0, "分まで丸める（ZIP の DOS 時刻は2秒きざみ）");
});

test("trk205: a release must be newer than the previous one, or 304 keeps the old app", async () => {
  /* 1.0.7 と 1.0.8 が同じ 2026-10-27 12:00 で組まれ、同じポートの python http.server が 304 を返して
     旧 index.html（旧アプリ）が残った（2026-10-27 レビュー）。同じ時刻は必ず失敗させる。 */
  assert.throws(() => assertNewerThan("2026-10-27T12:00:00Z", "2026-10-27T12:00:00Z"), /304/, "同じ時刻は不可");
  assert.throws(() => assertNewerThan("2026-10-27T11:59:00Z", "2026-10-27T12:00:00Z"), /304/, "古い時刻も不可");
  assert.throws(() => assertNewerThan("2026-10-27T12:00:00Z", "not-a-date"), /newer-than/);
  assert.doesNotThrow(() => assertNewerThan("2026-10-27T13:00:00Z", "2026-10-27T12:00:00Z"), "新しい時刻は通る");
  assert.doesNotThrow(() => assertNewerThan("2026-10-27T00:00:00Z", undefined), "--newer-than が無ければ検査しない");

  const f = fixture();
  await assert.rejects(
    buildRelease({ app: f.app, readme: f.readme, version: "1.0.8", out: path.join(f.dir, "dist"), date: "2026-10-27T12:00:00Z", newerThan: "2026-10-27T12:00:00Z" }),
    /304/,
    "組み立てでも止める",
  );
});

test("trk205: the quick-start README lives in the repo, so the zip can be rebuilt", async () => {
  assert.equal(DEFAULT_README, path.join(ROOT, "release", "README.txt"), "既定は release/README.txt");
  const readme = fs.readFileSync(DEFAULT_README, "utf8");
  assert.match(readme, /trk! 1\.\d+\.\d+/, "版を書く（版を上げたら release/README.txt も上げる）");
  assert.match(readme, /index\.html をダブルクリック/, "かんたん起動");
  assert.match(readme, /README-1\.\d+\.\d+\.md/, "アプリ内READMEの名前も版に合わせる（1.1.0 から 1.x.y を許す）");
  assert.match(readme, /trk-files\//, "アプリ本体の置き場所");
  assert.match(readme, /python3? -m http\.server --bind 127\.0\.0\.1 8000/, "ローカルサーバーの方法");
  assert.match(readme, /GPL-3\.0-or-later/, "ライセンス");
  assert.match(readme, /English/, "英語の短い案内");

  const f = fixture();
  const out = path.join(f.dir, "dist");
  execFileSync(process.execPath, [TOOL, `--app=${f.app}`, "--version=1.0.8", `--out=${out}`, "--zip"], { encoding:"utf8" });
  assert.equal(
    fs.readFileSync(path.join(out, "trk-1.0.8/README.txt"), "utf8"),
    readme,
    "--readme を省いてもリポジトリの README.txt がそのまま入る",
  );
});

/* ---------- trk214：配布物の中の文書のリンク切れ ---------- */
test("trk214: the release check finds documents that point at files the ZIP does not contain", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trk-docs-"));
  fs.mkdirSync(path.join(dir, "trk-files/docs/guide"), { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), '<meta http-equiv="refresh" content="0;url=trk-files/index.html"><script>location.replace("trk-files/index.html")</script>\n');
  fs.writeFileSync(path.join(dir, "README.txt"), "同梱の `trk-files/README-1.1.4.md` を読んでください。\n");
  fs.writeFileSync(path.join(dir, "trk-files/sw.js"), 'const CACHE = "trk-v2026.10.27-trk214";\n');
  fs.writeFileSync(path.join(dir, "trk-files/release-manifest.json"),
    JSON.stringify({ version:"1.1.4", layout:"wrapper", service_worker_cache:"trk-v2026.10.27-trk214" }, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, "trk-files/index.html"), '<a href="docs/guide/files.md">guide</a>\n');
  fs.writeFileSync(path.join(dir, "trk-files/README-1.1.4.md"), "使い方は [ガイド](docs/guide/files.md) に。\n");
  fs.writeFileSync(path.join(dir, "trk-files/docs/guide/index.md"), "# 📚 ガイド目次\n");
  fs.writeFileSync(path.join(dir, "trk-files/docs/guide/files.md"),
    "# ファイル構成\n\n← [ガイド目次](index.md)／[README](../../README-1.1.4.md)\n\n- `README-1.1.4.md` — 利用者向けREADME\n");
  assert.deepEqual(checkDocLinks(dir), [], "入っている物だけを指していれば通る");
  assert.equal(checkLayout(dir).ok, true, "形の検査も通る");

  /* 1.1.3 で実際にあった2種類の取りこぼし */
  fs.writeFileSync(path.join(dir, "trk-files/docs/guide/files.md"),
    "# 📁 ファイル構成（1.0.4 ポータブルZIP）\n\n← [README 1.0.4](../../README-1.0.4.md)\n\n- `README-1.0.4.md` — 利用者向けREADME\n");
  fs.writeFileSync(path.join(dir, "trk-files/README-1.1.4.md"),
    "古い説明：[README 1.0.8](trk-files/README-1.0.8.md) を見てください。\n");
  const problems = checkDocLinks(dir);
  assert.ok(problems.some(p => p.includes("docs/guide/files.md") && p.includes("README-1.0.4.md")), problems.join(" / "));
  assert.ok(problems.some(p => p.includes("README-1.1.4.md") && p.includes("README-1.0.8.md")), "本文に書いただけの名前も拾う");
  assert.match(checkLayout(dir).problems.join(" "), /見つかりません/, "形の検査は赤くなる");
  assert.equal(checkLayout(dir).ok, false);
});

test("trk214: http(s)・mailto・ページ内アンカー・配布物の外は見にいかない", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trk-docs2-"));
  fs.writeFileSync(path.join(dir, "doc.md"),
    "[a](https://example.com/x.md) [b](mailto:a@example.com) [c](#ここ) [d](../../outside.md)\n" +
    '[e](<https://example.com/y z>) <a href="https://example.com/z.html">z</a>\n');
  assert.deepEqual(checkDocLinks(dir), []);
});

test("trk214: the cache name moves on with the zoom fixes", () => {
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const m = sw.match(/^const CACHE = "trk-v([\d.]+)-trk(\d+)";$/m);
  assert.ok(m, "cache 名の形");
  assert.ok(Number(m[2]) >= 214, `cache は trk214 以降（いまは trk${m[2]}）`);
});
