// SPDX-License-Identifier: GPL-3.0-or-later
/* trk160: backup reconciliation derives pack IDs with the exact identity routine used by installation. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const custom = fs.readFileSync(`${ROOT}/js/custom.js`, "utf8");
const start = custom.indexOf("function packIdentityFromManifest(");
const end = custom.indexOf("\nfunction manifestPaths(", start);
assert.ok(start >= 0 && end > start, "the shared pack identity helper can be isolated");
const identitySource = custom.slice(start, end);

test("pack identity helper returns the normalized name/author hash used by the installer", () => {
  const context = vm.createContext({
    core:{ hashString:input => input === "Sanitized Name|Creator" ? 35 : -1 },
    sanitizeManifest:raw => raw && raw.valid ? { name:"Sanitized Name", author:"Creator" } : null,
  });
  vm.runInContext(`${identitySource}\nglobalThis.__identity = packIdentityFromManifest;`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.__identity({ valid:true }))), { id:"pz", man:{ name:"Sanitized Name", author:"Creator" } });
  assert.equal(context.__identity({ valid:false }), null);
  const installer = custom.slice(custom.indexOf("async function installPackFileSerial("), custom.indexOf("function loadImageBlob("));
  assert.ok(installer.includes("const identity = packIdentityFromManifest(raw)"));
});
