// SPDX-License-Identifier: GPL-3.0-or-later
/* trk177（レビュー）：「core.」を使うファイルには core の束縛がある。
   trk168 の fx.js（applyNorm）は束縛の無い core を参照し、平準化が効かず ReferenceError を出していた。
   コメントを外したコードだけを見る（コメント内の「core.js」は対象外）。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\"'`])\/\/.*$/gm, "$1");
const BINDING = /\b(?:const|let|var)\s+core\b|\bcore\s*=\s*window\.Trk|function\s*\w*\s*\([^)]*\bcore\b/;
const fxSrc = fs.readFileSync(path.join(ROOT, "js/fx.js"), "utf8");
const applyNormSource = fxSrc.match(/function applyNorm\(\) \{[\s\S]*?\n\}/)?.[0] || "";

test("every file that calls core.* has a core binding in scope", () => {
  const dir = path.join(ROOT, "js");
  const missing = [];
  for (const name of fs.readdirSync(dir).filter(n => n.endsWith(".js") && n !== "core.js")) {
    const code = strip(fs.readFileSync(path.join(dir, name), "utf8"));
    if (!/(^|[^.\w$])core\.[A-Za-z_$]/m.test(code)) continue;
    if (!BINDING.test(code)) missing.push(name);
  }
  assert.deepEqual(missing, [], "files using core.* without binding it");
});

function applyNormHarness(core) {
  const calls = { plan:null, gain:[], sync:0, song:null, analysis:null };
  const window = { Trk:{
    core,
    library:{ songTagsOf(song) { calls.song = song; return { rgTrackGain:-3.5 }; } },
    media:{ loudnessDb(analysis) { calls.analysis = analysis; return -8.25; } },
  } };
  const sandbox = {
    window,
    G:{ src:{}, norm:{ gain:{ setTargetAtTime(...args) { calls.gain.push(args); } } }, ac:{ currentTime:12.5 } },
    settings:{ fxNorm:true },
    normPlan(input) { calls.plan = input; return { lin:0.72, src:"tag", db:-2.8 }; },
    syncNormStatus() { calls.sync++; },
  };
  vm.createContext(sandbox);
  vm.runInContext(`let lastNormPlan = null;\n${applyNormSource}\nwindow.__applyNorm = applyNorm;\nwindow.__lastNormPlan = () => lastNormPlan;`, sandbox);
  return { window, calls };
}

test("fx.js applyNorm() safely returns without Trk.core and uses the bound core when present", () => {
  assert.ok(applyNormSource, "the production applyNorm() function can be isolated");
  const missing = applyNormHarness(undefined);
  assert.doesNotThrow(() => missing.window.__applyNorm(), "missing Trk.core must not throw ReferenceError");
  assert.equal(missing.calls.plan, null);
  assert.equal(missing.calls.gain.length, 0);
  assert.equal(missing.calls.sync, 0);

  const song = { id:"song-1" }, analysis = { peak:0.5, rms:[0.1, 0.2] };
  const present = applyNormHarness({ currentSong:song, analysis });
  present.window.__applyNorm();
  assert.strictEqual(present.calls.song, song);
  assert.strictEqual(present.calls.analysis, analysis);
  assert.equal(present.calls.plan.on, true);
  assert.equal(present.calls.plan.rgDb, -3.5);
  assert.equal(present.calls.plan.loudness, -8.25);
  assert.equal(present.calls.plan.peak, 0.5);
  assert.deepEqual(present.calls.gain, [[0.72, 12.5, 0.08]]);
  assert.equal(present.calls.sync, 1);
  assert.equal(present.window.__lastNormPlan().src, "tag");
});
