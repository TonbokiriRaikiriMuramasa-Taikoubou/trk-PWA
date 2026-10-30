// SPDX-License-Identifier: GPL-3.0-or-later
/* All built-in game skins (including the four optional Miku skins) must keep
 * button states, song-list subtext and tutorial text readable. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const sandbox = {
  console, Math, Array, Object, Number, String, JSON, Set, Map, Date,
  window: {},
  TEXT: { ja:{}, en:{}, zh:{}, ko:{} },
  tr: () => "",
  document: { getElementById: () => null },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/data.js"), "utf8"), sandbox, { filename: "js/data.js" });
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/characters/miku.js"), "utf8"), sandbox, { filename: "js/characters/miku.js" });
const { SKINS, buildCustomSkin } = sandbox.window.Trk.data;
const css = fs.readFileSync(path.join(ROOT, "css/style.css"), "utf8");

function luminance(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex || "");
  assert.ok(match, `expected opaque #rrggbb, got ${hex}`);
  const channels = [0, 2, 4].map(i => parseInt(match[1].slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(fg, bg) {
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const ids = Object.keys(SKINS);

describe("game UI contrast across the skin catalogue", () => {
  test("includes the 40 built-in themes and four optional Miku themes", () => {
    assert.equal(ids.length, 44);
    for (const id of ["miku39", "mikuNoir", "mikuClassic", "mikuIdol"]) assert.ok(SKINS[id], id);
  });

  test("selected play-mode buttons use AA text on the accent background", () => {
    for (const [id, skin] of Object.entries(SKINS)) {
      const ui = skin.ui;
      assert.ok(contrast(ui["--ui-on-accent"], ui["--ui-accent"]) >= 4.5,
        `${id}: selected button ${ui["--ui-on-accent"]} on ${ui["--ui-accent"]} is ${contrast(ui["--ui-on-accent"], ui["--ui-accent"]).toFixed(2)}:1`);
    }
  });

  test("unselected and hovered buttons keep readable text", () => {
    assert.match(css, /button:hover\{[^}]*color:var\(--ui-text\)/,
      "generic hover feedback uses the readable text color while the border carries the accent");
    assert.match(css, /\.fileBtn\.small:hover\{[^}]*color:var\(--ui-text\)/);
    assert.match(css, /\.libRow\.cur\{[^}]*color:var\(--ui-text\)[^}]*background:var\(--ui-button-hover\)/);
    assert.match(css, /\.miniActions button\.selected\{[^}]*color:var\(--ui-text\)/);
    for (const [id, skin] of Object.entries(SKINS)) {
      const ui = skin.ui;
      assert.ok(contrast(ui["--ui-text"], ui["--ui-field"]) >= 4.5, `${id}: unselected segmented field`);
      assert.ok(contrast(ui["--ui-text"], ui["--ui-button"]) >= 4.5, `${id}: normal button`);
      assert.ok(contrast(ui["--ui-text"], ui["--ui-button-hover"]) >= 4.5, `${id}: hovered button`);
    }
  });

  test("muted song-list and guide text meet AA on their opaque skin backgrounds", () => {
    for (const [id, skin] of Object.entries(SKINS)) {
      const ui = skin.ui, muted = ui["--ui-muted"];
      const backgrounds = [ui["--ui-button"], ui["--ui-button-hover"], ui["--ui-field"]];
      if (/^#[0-9a-f]{6}$/i.test(ui["--ui-bg"] || "")) backgrounds.push(ui["--ui-bg"]);
      for (const bg of backgrounds) {
        assert.ok(contrast(muted, bg) >= 4.5,
          `${id}: muted ${muted} on ${bg} is ${contrast(muted, bg).toFixed(2)}:1`);
      }
    }
  });

  test("tutorial progress and guide text use full-opacity skin text colors", () => {
    const progress = css.match(/\.guideProgress\{([^}]*)\}/)?.[1] || "";
    assert.match(progress, /color:var\(--ui-muted\)/);
    assert.doesNotMatch(progress, /opacity\s*:/, "the small progress count must not be faded with opacity");
    assert.match(css, /\.guideStep span\{color:var\(--ui-muted\)\}/);
  });

  test("select elements and shelf counter use solid skin colors with AA contrast", () => {
    // Bare select base rule guarantees background and text color match skin field variables
    assert.match(css, /select\{[^}]*background:var\(--ui-field\)[^}]*color:var\(--ui-text\)/,
      "bare select elements must explicitly use skin field background and text colors");

    // All select elements in index.html must be covered
    const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    const selectMatches = [...indexHtml.matchAll(/<select[^>]*id="([^"]+)"[^>]*>/g)];
    assert.ok(selectMatches.length >= 35, `expected at least 35 select elements in index.html, found ${selectMatches.length}`);
    for (const [, id] of selectMatches) {
      assert.ok(id, "select element must have an id");
    }

    // Shelf counter uses --ui-muted without opacity fading
    const shelfCount = css.match(/#skinShelfCount\{([^}]*)\}/)?.[1] || "";
    assert.match(shelfCount, /color:var\(--ui-muted\)/, "#skinShelfCount must use solid --ui-muted");
    assert.doesNotMatch(shelfCount, /opacity\s*:/, "#skinShelfCount must not use opacity");

    // Verify text on field contrast across all 44 skins
    for (const [id, skin] of Object.entries(SKINS)) {
      const ui = skin.ui;
      assert.ok(contrast(ui["--ui-text"], ui["--ui-field"]) >= 4.5,
        `${id}: select text ${ui["--ui-text"]} on ${ui["--ui-field"]} is ${contrast(ui["--ui-text"], ui["--ui-field"]).toFixed(2)}:1`);
    }
  });

  test("small accent-colored text uses --ui-accent-ink, which reaches AA even inside nested settings panels", () => {
    /* trk114: the nested "skin shelf" heading was 4.34 (cbLight), 3.88 (shojiLight) and 3.95 (morningKitchen) on the
       opaque cards. Semi-transparent cards hid the same shortfall from the browser audit, so every skin is computed here
       on the worst surface: card (--ui-panel) + panel (--ui-soft) + sub-panel (--ui-soft). */
    const { accentInk, accentInkBackground } = sandbox.window.Trk.data;
    const toHex = rgb => "#" + rgb.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
    for (const [id, skin] of Object.entries(SKINS)) {
      const ink = accentInk(skin.ui), back = toHex(accentInkBackground(skin.ui));
      const inkHex = /^#[0-9a-f]{6}$/i.test(ink) ? ink : sandbox.window.Trk.data.toHex(ink);
      assert.ok(contrast(inkHex, back) >= 4.5, `${id}: accent ink ${ink} on nested ${back} is ${contrast(inkHex, back).toFixed(2)}:1`);
      if (contrast(sandbox.window.Trk.data.toHex(skin.ui["--ui-accent"]), back) >= 4.6) assert.equal(ink, skin.ui["--ui-accent"], `${id}: a passing accent is left unchanged`);
    }
    for (const id of ["cbLight", "shojiLight", "morningKitchen"]) assert.notEqual(accentInk(SKINS[id].ui), SKINS[id].ui["--ui-accent"], `${id} needed a darker ink`);
    const core = fs.readFileSync(path.join(ROOT, "js/core.js"), "utf8");
    assert.match(core, /root\.setProperty\("--ui-accent-ink", window\.Trk\.data\.accentInk\(s\.ui\)\)/, "applySkin sets the ink for every skin, custom ones included");
    assert.match(css, /\.subPanel>summary\{[^}]*color:var\(--ui-accent-ink,var\(--ui-accent\)\)/);
    const bareAccentText = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(m => /(?:^|;)\s*color:\s*var\(--ui-accent\)\s*(?:;|$)/.test(m[2])).map(m => m[1].trim());
    assert.deepEqual(bareAccentText, [".brand h1 span"], "only the 58px brand heading (large text, 3:1) may use the raw accent");
    for (const accent of ["#b78be0", "#39c5bb", "#ffd166", "#e69f00"]) {
      const custom = buildCustomSkin({ name: "ink test", colors: { bg: "#fbf8f1", bg2: "", panel: "#ffffff", text: "#2b2620", accent, gold: "#a67c2e" },
        glow: false, scanlines: false, gradDir: "none", font: "default", video: "mono", mascot: "none" });
      assert.ok(contrast(accentInk(custom.ui), toHex(accentInkBackground(custom.ui))) >= 4.5, `custom light skin with accent ${accent}`);
    }
  });

  test("custom-skin accent labels choose a black or white foreground with AA contrast", () => {
    const accents = ["#000000", "#101010", "#333333", "#767676", "#777777", "#808080", "#b78be0", "#e69f00", "#39c5bb", "#ff3b55", "#fefefe"];
    for (const accent of accents) {
      const skin = buildCustomSkin({
        name: "contrast test",
        colors: { bg:"#101820", bg2:"", panel:"#243040", text:"#f2f4f8", accent, gold:"#ffd166" },
        glow:false, scanlines:false, gradDir:"none", font:"default", video:"mono", mascot:"none",
      });
      assert.ok(contrast(skin.ui["--ui-on-accent"], accent) >= 4.5,
        `${accent}: custom accent text ${skin.ui["--ui-on-accent"]} is below 4.5:1`);
    }
  });
});
