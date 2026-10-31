// SPDX-License-Identifier: GPL-3.0-or-later
/* 🧭 trk224（2026-10-31 レビュー F1）：配布ZIPの時刻が、組み立てた人のタイムゾーンで変わらない。

   何が起きていたか：`js/zip-io.js` の `zipDosDateTime()` がローカル時刻の getter（getFullYear・getHours 等）を
   使っていたため、同じ瞬間 `2026-10-27T12:00:00Z` でも、日本では DOS の時刻欄が 21:00 になっていた。
   ・`tests/release-layout.test.mjs`（trk204）は `unzip -Z -T` の表示が `20261027.120000` であることを見るので、
     UTC 以外の環境では落ちる。CI（GitHub Actions）は UTC なので、緑に見えていた。
   ・配布ZIPは「同じ入力なら同じバイト（同じ sha256）」であってほしいので、これは実害もある。

   ここでは **タイムゾーンを変えた子プロセス** で実際にZIPを組み、バイトとDOSの時刻欄が一致することを見ます
   （1つのプロセスの中で TZ を変えても、Date の解釈は起動時に決まるため）。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT } from "./helpers/browser-data.mjs";

/* js/zip-io.js を（ブラウザと同じように）window へ読み込み、決まった時刻でZIPを1つ組み立てて、
   先頭のローカルヘッダー（時刻・日付の欄）と、全体の sha256 を出す小さなプログラム */
const CHILD = `
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
const src = fs.readFileSync(${JSON.stringify(path.join(ROOT, "js/zip-io.js"))}, "utf8");
const sandbox = { window: {}, Blob, Response, CompressionStream, DecompressionStream, TextEncoder, TextDecoder, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: "js/zip-io.js" });
const zipIO = sandbox.window.Trk.zipIO;
const stamp = Date.parse("2026-10-27T12:00:00Z");
const blob = await zipIO.zipWrite([{ name: "index.html", blob: new Blob(["<!doctype html>\\n"]) }], { mtime: stamp });
const bytes = Buffer.from(await blob.arrayBuffer());
const dosTime = bytes.readUInt16LE(10), dosDate = bytes.readUInt16LE(12);
const sha = crypto.createHash("sha256").update(bytes).digest("hex");
const decode = (time, date) => ({
  year: ((date >> 9) & 0x7f) + 1980, month: (date >> 5) & 0x0f, day: date & 0x1f,
  hour: time >> 11, minute: (time >> 5) & 0x3f, second: (time & 0x1f) * 2
});
console.log(JSON.stringify({ sha, dosTime, dosDate, at: decode(dosTime, dosDate), bytes: bytes.length }));
`;

function buildIn(tz) {
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", CHILD], {
    encoding: "utf8",
    env: { ...process.env, TZ: tz },
  });
  return JSON.parse(out.trim().split("\n").pop());
}

describe("trk224 F1: 配布ZIPの時刻はタイムゾーンに依存しない", () => {
  /* 日本（+9）・UTC・米国西海岸（-8/-7）・ライン諸島（+14）・インド（+5:30）。端と端を入れておく */
  const zones = ["UTC", "Asia/Tokyo", "America/Los_Angeles", "Pacific/Kiritimati", "Asia/Kolkata"];

  test("どのタイムゾーンで組んでも、バイトも時刻欄も同じ", () => {
    const results = zones.map(tz => ({ tz, ...buildIn(tz) }));
    const first = results[0];
    for (const r of results.slice(1)) {
      assert.equal(r.sha, first.sha, `${r.tz} でも同じバイト（同じ sha256）`);
      assert.equal(r.dosTime, first.dosTime, `${r.tz} でも DOS の時刻欄が同じ`);
      assert.equal(r.dosDate, first.dosDate, `${r.tz} でも DOS の日付欄が同じ`);
    }
  });

  test("時刻欄は「渡した瞬間を UTC で読んだ値」（12:00Z は 12:00）", () => {
    const r = buildIn("Asia/Tokyo");
    assert.deepEqual(r.at, { year: 2026, month: 10, day: 27, hour: 12, minute: 0, second: 0 },
      "日本で組んでも 21:00 にならない（F1 の再発防止）");
    /* DOS の時刻欄そのもの（2秒単位）: 12 << 11 | 0 << 5 | 0 */
    assert.equal(r.dosTime, (12 << 11));
    /* 日付欄: (2026-1980) << 9 | 10 << 5 | 27 */
    assert.equal(r.dosDate, (46 << 9) | (10 << 5) | 27);
  });

  test("時計の進み方（+14 と -8）で日付がまたいでも、UTC の日付を書く", () => {
    /* 2026-10-27T23:30:00Z は、ライン諸島では翌日 13:30、西海岸では同日 16:30。UTC では 10/27 23:30 */
    const child = CHILD.replace("2026-10-27T12:00:00Z", "2026-10-27T23:30:00Z");
    const at = ["Pacific/Kiritimati", "America/Los_Angeles"].map(tz => {
      const out = execFileSync(process.execPath, ["--input-type=module", "-e", child], { encoding: "utf8", env: { ...process.env, TZ: tz } });
      return JSON.parse(out.trim().split("\n").pop());
    });
    for (const r of at) {
      assert.deepEqual(r.at, { year: 2026, month: 10, day: 27, hour: 23, minute: 30, second: 0 });
    }
    assert.equal(at[0].sha, at[1].sha, "日付をまたぐ時刻でも同じバイト");
  });

  test("mtime を渡さない書き出し（バックアップ・.stpack）は今までどおり 1980-01-01 固定", () => {
    const child = CHILD.replace(", { mtime: stamp }", "");
    const at = ["Asia/Tokyo", "UTC"].map(tz => {
      const out = execFileSync(process.execPath, ["--input-type=module", "-e", child], { encoding: "utf8", env: { ...process.env, TZ: tz } });
      return JSON.parse(out.trim().split("\n").pop());
    });
    for (const r of at) {
      assert.deepEqual(r.at, { year: 1980, month: 1, day: 1, hour: 0, minute: 0, second: 0 }, "決定的な既定のまま");
    }
    assert.equal(at[0].sha, at[1].sha);
  });

  test("組み立ての道具（tools/prepare-release.mjs）も、どちらのタイムゾーンでも同じZIP", () => {
    /* buildRelease は中の Date の解釈が TZ に従うので、子プロセスで組み立ててハッシュを比べる */
    const runner = `
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { buildRelease } from ${JSON.stringify(path.join(ROOT, "tools/prepare-release.mjs"))};
const dir = mkdtempSync(path.join(os.tmpdir(), "trk-tz-"));
const app = path.join(dir, "app");
mkdirSync(path.join(app, "js"), { recursive: true });
writeFileSync(path.join(app, "index.html"), "<!doctype html><title>trk!</title>\\n");
writeFileSync(path.join(app, "sw.js"), '// sw\\nconst CACHE = "trk-v2026.10.27-trk205";\\n');
writeFileSync(path.join(app, "js/app.js"), "console.log(1);\\n");
const readme = path.join(dir, "README.txt");
writeFileSync(readme, "trk! かんたん起動\\n");
const { zipPath } = await buildRelease({ app, readme, version: "1.0.8", out: path.join(dir, "dist"), zip: true, date: "2026-10-27T12:00:00Z" });
console.log(crypto.createHash("sha256").update(readFileSync(zipPath)).digest("hex"));
`;
    const hashIn = tz => execFileSync(process.execPath, ["--input-type=module", "-e", runner], {
      encoding: "utf8", env: { ...process.env, TZ: tz }, cwd: ROOT,
    }).trim().split("\n").pop();
    const tokyo = hashIn("Asia/Tokyo"), utc = hashIn("UTC");
    assert.match(tokyo, /^[0-9a-f]{64}$/, "ZIPができている");
    assert.equal(tokyo, utc, "日本で組んだZIPと UTC で組んだZIPが同じバイト");
  });
});
