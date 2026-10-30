#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/* tests/*.test.mjs を node --test で実行する（依存パッケージ不要）。
   シェルの glob に頼らないので、Windows の cmd でも同じように動く。 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "tests");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".test.mjs")).sort().map(f => path.join(dir, f));
if (!files.length) { console.error("FAIL  tests/*.test.mjs が見つかりません"); process.exit(1); }
const r = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit", cwd: root });
process.exit(r.status === null ? 1 : r.status);
