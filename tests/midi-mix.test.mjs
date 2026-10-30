// SPDX-License-Identifier: GPL-3.0-or-later
/* TRK MIDI MIX is a code-generated effect chain for ordinary audio, independent of MIDI synthesis. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");
const core = read("js/core.js");
const fx = read("js/fx.js");
const dock = read("js/fx-dock.js");
const index = read("index.html");
const i18n = read("js/i18n.js");
const profileSource = read("js/midi-profiles.js");
const mixFunction = fx.match(/function midiMixEffects\(\) \{[\s\S]*?\n\}/)?.[0];

assert.ok(mixFunction, "midiMixEffects() can be isolated for a dependency-light behavior test");

describe("🎚 TRK MIDI MIX", () => {
  test("is off by default, Audio settings export its state, and reset/safe-mode disable it", () => {
    assert.match(core, /midiMixEnabled:\s*prefs\.midiMixEnabled === true/);
    assert.match(core, /out\.midiMixEnabled = settings\.midiMixEnabled/);
    assert.match(core, /settings\.midiMixEnabled = false/);
    assert.match(core, /midiMixProfile:[^\n]*"studio_gm"/);
  });

  test("returns no processing chain while off and selects the chosen profile while on", () => {
    const sandbox = { window:{}, settings:{ midiMixEnabled:false, midiMixProfile:"studio_gm", fxOn:false }, cleanFx:effect => effect };
    vm.createContext(sandbox);
    vm.runInContext(profileSource, sandbox);
    vm.runInContext(mixFunction, sandbox);
    assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext("midiMixEffects()", sandbox))), []);

    sandbox.settings.midiMixEnabled = true;
    sandbox.settings.midiMixProfile = "trk_orbit";
    const actual = JSON.parse(JSON.stringify(vm.runInContext("midiMixEffects()", sandbox)));
    const expected = JSON.parse(JSON.stringify(sandbox.window.Trk.midiProfiles.get("trk_orbit").mixChain));
    assert.deepEqual(actual, expected, "MIX uses its selected profile even when the general FX power is off");
    assert.ok(actual.length > 0);
  });

  test("routes MIDI MIX into the ordinary media graph and keeps the panel directly below #richPanel", () => {
    assert.match(fx, /const mixPath = buildMidiMixPath\(last, true\); last = mixPath\.last;/);
    assert.match(fx, /function tapElement\(el\)[\s\S]*?buildMidiMixPath\(src, false\)/);
    assert.match(fx, /settings\.fxOn \|\| settings\.midiMixEnabled/);
    assert.match(dock, /const midiMixOwner = \(\) => col\.querySelector\(":scope > #richPanel"\)/);
    assert.match(dock, /owner\.after\(midiMix\)/);
    assert.match(dock, /midiMixTitle:"🎚 TRK MIDI MIX"/);
    assert.match(dock, /midiMixUseInp\.checked = core\.settings\.midiMixEnabled === true/);
  });

  test("loads the 24-profile catalogue before local MIDI rendering and exposes the settings panel", () => {
    const profilesAt = index.indexOf('<script src="js/midi-profiles.js"></script>');
    const playerAt = index.indexOf('<script src="js/midi-player.js"></script>');
    const settingsAt = index.indexOf('<script src="js/midi-settings.js"></script>');
    const mediaAt = index.indexOf('<script src="js/media.js"></script>');
    assert.ok(profilesAt >= 0 && profilesAt < playerAt && playerAt < settingsAt && settingsAt < mediaAt);
    assert.match(index, /id="midiSoundPanel"/);
    assert.match(index, /id="midiSoundProfile"/);
    assert.equal((i18n.match(/midiSoundTitle:/g) || []).length, 4, "the MIDI profile panel is named in all four languages");
    assert.equal((dock.match(/midiMixTitle:/g) || []).length, 4, "the MIX panel is named in all four languages");
  });
});
