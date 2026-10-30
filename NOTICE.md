# NOTICE — trk!

trk! is AGRG! — an All-Generation Rhythm Game
Copyright (C) 2026 trk! contributors (originally "Shadow-Taiko")

This program is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software Foundation,
either version 3 of the License, or (at your option) any later version.
See the LICENSE file for the full text.

The following items are NOT granted by the GPL, because they are not ours to grant
or are not part of the software license.

## 1. Bundled third-party libraries (`assets/vendor/`)

trk! does not load code from a CDN. three.js, @pixiv/three-vrm, @pixiv/three-vrm-animation and
@yohawing/three-mmd-loader are copied into `assets/vendor/` as published on npm (MIT License,
copyright their authors). Their LICENSE files sit next to the code, the exact bytes are recorded
in `tools/vendor-lock.json`, and `npm run check` verifies them offline. Regenerate with
`npm run vendor:update`; never edit those files by hand.

## 2. The "trk!" name
The GPL covers the code, not the name. Forks and derivative works are welcome,
but please use a different name (e.g. "trk-plus", "my-drum-fork") so players
are not confused about which version is official.
"Based on trk!" in your description is fine and appreciated.

## 2. Hatsune Miku (Piapro Character License)
この作品はピアプロ・キャラクター・ライセンスに基づいてクリプトン・フューチャー・メディア株式会社のキャラクター「初音ミク」を描いたものです。
This work depicts the character "Hatsune Miku" of Crypton Future Media, INC.
under the Piapro Character License (PCL). https://piapro.jp/license/pcl/summary

- **Everything Miku-related is in one file: `js/characters/miku.js`.**
  (The UI text in `js/i18n.js` only contains names and the credit line.)
- The character rights belong to Crypton Future Media, INC. and are not ours,
  so the GPL cannot grant them. Anyone using `js/characters/miku.js` must follow
  the PCL: non-commercial and free of charge only (no sales, ads, paid features,
  donations or tips of any kind).
- **To make a commercial fork or a Miku-free build:** delete `js/characters/miku.js`
  and its `<script>` line in `index.html`. Nothing else needs to change.
- "Winter Miku", "Spring Miku" and "Chibi Miku" in trk! are original arrangements.
  They are NOT the official derivative characters (Snow Miku, Sakura Miku, Mikudayo).

## 2b. Touhou Project fan works (antenna character skins)
アンテナの東方キャラ肌（⛩霊夢・🧹魔理沙・❄チルノ・🦇フランドール・🗡妖夢）は、
東方Project（著作権：上海アリス幻樂団／ZUN）を題材にした trk! の描きおろしドット絵
（二次創作）です。公式ゲームの素材は一切使っていません。
The Touhou Project antenna character skins (Reimu, Marisa, Cirno, Flandre and Youmu)
are original pixel drawings by trk!, fan works based on the Touhou Project
(© Team Shanghai Alice / ZUN). No assets from the official games are used.

- 東方Project二次創作ガイドライン（https://touhou-project.news/guideline/）に従い、
  無料のブラウザゲームとして提供しています（ガイドラインは、無料のアプリであること・
  スクリーンショット等以外のゲーム素材の使用・公開をしないこと・二次創作である旨の明記
  を求めています。いずれも満たしています）。
- The character rights belong to Team Shanghai Alice (ZUN) and are not ours, so the
  GPL cannot grant them.
- **To make a Touhou-free build:** remove the `reimu`, `marisa`, `cirno`,
  `flandre` and `youmu` entries from `ANT_CHARS` in `js/fx-dock.js`, the
  `antTouhou` list, and the `dockAntCharReimu/Marisa/Cirno/Flandre/Youmu` and
  `dockAntGroupTouhou` label keys (4 languages). Nothing else needs to change.

## 3. User content
Songs, charts, skins, `.stpack` packs, VRM models, motions and character mods are
owned by their creators. The same goes for MMD models (`.pmx`/`.pmd`), their
textures and `.vmd` motions: by default **trk! does not bundle, host or upload them.**
You pick a model or a folder from your own device in the settings panel, and the
MMD terms of that model's author apply (most MMD models forbid redistribution,
use outside MMD/MMM, and commercial use).
The 65 built-in motion choices (daily actions, dances, Miku-inspired gestures,
expression acting and singing/lip-sync routines) are **original code-generated
routines**. `js/mmd.js`
creates their `.vmd` bytes at runtime from pose and facial-weight formulas; no
third-party VMD or choreography file is bundled. The facial tracks refer to
existing morph names in the redistributable Lat-style PMD; they do not include
new model geometry, and they animate only on models with matching morph names.
The motion-generation code is covered by the GPL like the rest of the source.
Song names and “inspired” labels are tempo/mood references, not claims that an
original song choreography is reproduced. A motion being free to download or
available on a hosting page is not, by itself, permission to redistribute its
VMD; no third-party VMD is added unless the redistribution terms for the actual
file are clear.
The 📚 Study Room (書斎) reads the image folders and text files **you** choose and
keeps its own copies inside this browser only (IndexedDB `trk_study_room_v1`);
nothing is uploaded or shared, the original files are never modified, and the
rights in imported books and images stay with their authors. The reader, its
text decoding and its display styles are original trk! code under the GPL.

### Optional original tutorial audio and demo charts (`assets/optional-demo-audio/`)

**trk's OST Vol.1** (SUNRISE DASH, POPCORN SMILE, MOONLIT LULLABY, CRIMSON BLAZE, bonus NEON DIVE) is distributed separately from https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/music-library as a `.stpack`. The audio is © 2026 TRMTKB, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); scores are under MIT in that repository (the same scores also stay in this repository at `tools/ost-scores/<key>.json` plus `<key>.abc`). Each song is rendered from its committed score by original procedural synthesis; no third-party recording, sample pack, loop, or quoted melody is used. trk!'s GPL-3.0 notice covers the application code, not this audio. trk! does not fetch the pack at runtime; the user downloads and imports it on their own device.

`assets/optional-demo-audio/first-spark-tutorial.mp3` is an optional 30-second instrumental edit of **FIRST SPARK**, created for the trk! tutorial. The whole folder may be omitted from a lightweight build; its manifest controls whether the demo is shown. It is rendered from original procedural synthesis; no third-party recording, sample pack, loop, or quoted melody is bundled. This note records the asset's provenance and intended in-app demo use; the application's GPL notice should not be read as a blanket license for extracting this audio into unrelated works.

`first-spark-tutorial.easy.json` / `.normal.json` / `.hard.json` are original chart data written for the same tutorial, not transcriptions of any commercial chart. Notes are placed on the track's own 128 BPM / 4/4 grid (kick on every beat, brighter synth on the off-beats, a break in bars 9-10, one accent in the last bar) from a documented pattern table in `tools/make-first-spark-charts.mjs`. They use the public `shadow-taiko-chart` format, so they can be inspected, exported and re-imported like any other chart. MASTER and RUSH deliberately ship no chart and stay generated from the Seed.

### 3a. Bundled MMD models (`assets/mmd/`)
A model may be bundled under `assets/mmd/` ONLY when its own readme explicitly
allows redistribution. Example — Lat-style Miku's readme states that, within the
rights holder's guidelines (Crypton's PCL), any use including modification and
redistribution is OK. For every bundled model:
- the author's **original readme is included in the same folder** and its terms apply;
- the model, textures and readme are **NOT covered by the GPL** — they are not ours to license;
- character rights (Hatsune Miku etc.) remain with Crypton Future Media, INC. under
  the PCL: non-commercial and free of charge only.
**To make a commercial fork:** delete the `assets/mmd/` folder entirely
(together with `js/characters/miku.js`, see section 2).

### 3b. TV/video looks (original effects)

The built-in TV color looks in `js/tv-presets.js` use standard browser CSS filter
functions. New portrait, anime/cel, texture and studio/quality looks were written
for trk!; Canvas overlays (soft light, grain, paper fibers and halftone dots) are
drawn procedurally by `js/tv-dock.js`.

- No third-party LUTs, preset files, footage, texture images, or effect code are
  bundled or copied for these looks. The general color-grading concepts are not
  proprietary; the filter combinations and drawing logic here are original.
- “Portrait” and skin-tone descriptions mean **global image color adjustments**.
  They do not detect faces or isolate/correct skin independently of the rest of
  the frame.
- Glow, contrast and texture overlays change appearance only. They do not increase
  source resolution, sharpen recovered detail, or restore clipped image information.
- No proprietary TV, film, camera, or grading-product branding is used for these
  presets; descriptive labels are not product endorsements.

## 4. Third-party libraries

### 4a. Web runtime libraries

Loaded from jsDelivr only when the VRM or MMD mascot is used:
- three.js — MIT License — https://github.com/mrdoob/three.js
- @pixiv/three-vrm, @pixiv/three-vrm-animation — MIT License — https://github.com/pixiv/three-vrm
- @yohawing/three-mmd-loader — MIT License — https://github.com/yohawing/three-mmd-loader
  (PMX/PMD/VMD loading; MMD is a trademark of Yu Higuchi / MikuMikuDance, and this
  loader is an independent, unaffiliated implementation)

These libraries are not bundled into the normal page as local source; the Web app
loads them from jsDelivr only when the corresponding 3D feature is used. Their
copyright and license terms remain with their respective authors.

### 4b. Optional Android wrapper

The repository includes an optional Capacitor build path. If an Android project
is generated with `docs/android.md`, the following Capacitor runtime packages are
used in the generated app:
- `@capacitor/core` — MIT License — https://github.com/ionic-team/capacitor
- `@capacitor/android` — MIT License — https://github.com/ionic-team/capacitor

The following are build-time tools, not trk!'s Web runtime:
- `@capacitor/cli` — MIT License — https://github.com/ionic-team/capacitor
- TypeScript — Apache License 2.0 — https://github.com/microsoft/TypeScript

`package-lock.json` records transitive npm packages used by the optional build
toolchain. Each package keeps its own license and copyright notices; the generated
Android project and its release process must preserve the notices required by
those packages. This file does not grant GPL rights to third-party software.

### 4c. Pro-audio effect concepts (original implementations)

The 🚪 noise gate, 🧹 spectral noise reduction, 🎚 dynamic EQ and ✨ exciter in
js/fx-worklet.js and js/fx.js are original implementations written for trk!.
Their *concepts* are inspired by well-known pro-audio tools — noise reduction
in Audacity, ReaFir (Cockos), Bertom Denoiser Classic, and the dynamic EQ /
exciter ideas popularized by TDR Nova and iZotope Ozone. No code, UI assets,
preset data, or product names from those tools are used; the DSP (radix-2 FFT,
RBJ biquad formulas, spectral subtraction) is built from textbook algorithms.
Product names are mentioned here and in the README for explanation only, and
trk! is not affiliated with or endorsed by their authors.

### 4d. Official-source playlist catalog (trademarks, factual listings)

js/catalog.js (`TRK_CATALOG`) contains curated playlists for Blue Archive,
Arknights, Arknights: Endfield, League of Legends "Sessions: Vi", VALORANT,
Riot Games' Creator-Safe playlists (League of Legends, Teamfight Tactics, 2XKO,
Wild Rift, Legends of Runeterra and the Riot Forge titles),
Touhou Project, NoCopyrightSounds, Kevin MacLeod (incompetech), Genshin Impact,
100% Orange Juice and Gakuen iDOLM@STER.
It bundles **no audio files, charts, or copyrighted works** — only factual
metadata (track / artist / album names, which are facts) and links that point
exclusively to official sources (bluearchive.jp, Monster-Siren Records, the
official Spotify song pages and ffm.to smart links announced for Arknights:
Endfield, riotgames.com creator-safe guidelines, ZUN's official site). Series
names, logos, characters and trademarks belong to their respective owners
(Nexon/Yostar, Hypergravity/Hypergryph, GRYPHLINE/GRYPH FRONTIER, Riot Games,
Team Shanghai Alice); they are used here for factual reference only, without
permission, and their inclusion does not imply any affiliation with or
endorsement of trk!.
Riot Games music is displayed under Riot's fan-content / creator-safe policy
(keep it free, don't imply official affiliation); see
https://www.riotgames.com/en/legal — "Courtesy of Riot Games".
Arknights: Endfield songs (Zeroth Directive OST Vol. 1–2, six further Metal
Scar Radio albums — Eve of Departure, Thunder's Legacy, At the Wake of Spring,
Contingency Contract Re-Ignition, Homecoming, Dreamscape of Wind and Snow —
and character OSTs) are listed as factual metadata pointing to their official
streaming pages (Spotify song/album pages and the announced ffm.to smart links);
GRYPHLINE's fan-content guidelines prohibit copying or extracting official
assets and streaming or buying is not a reuse license — see
https://endfield.gryphline.com/ja-jp/news/4497 and
docs/ARKNIGHTS-ENDFIELD-MUSIC.md.
Blue Archive’s Mika playlists include two official game PV links (bilibili, with
the official TapTap announcement) and three Apple Music China audio links for
“Do you wanna kiss angel” (℗ 2024 NEXON Games Co., Ltd.). No media is included.
Availability is region-dependent; streaming/subscription access does not
guarantee an importable local file or grant reuse rights. See
docs/BLUEARCHIVE-MIKA-MUSIC.md for the source ledger and the distinction
between official titles and trk’s organizational aliases.
The Aria to the Star list adds two Apple Music UK audio links (Mika, CV. Kang
Eunae; ℗ 2026 Quarter Music) and the full mini musical on the official Global
YouTube channel. Japanese solo/ensemble songs link to Apple Music Japan;
Let's Go With... also links to the official Japanese MV. Ensemble display
credits retain every character name but omit the voice-actor parentheses.
See docs/BLUEARCHIVE-MIKA-ARIA.md and docs/BLUEARCHIVE-MIKA-INDEX.md.
Per the same principle, trk! never implies that any of these publishers
officially distribute, endorse, or bundle anything with this app, and users
are directed to obtain the music themselves from the linked official stores.

The 🎻 trk classic series in the same catalog lists only factual metadata
(composer, work/piece title) for compositions whose copyright has expired,
and points to public-domain recordings hosted by Musopen
(https://musopen.org/, CC-PD / public-domain recordings), IMSLP and
archive.org. It bundles no audio, no scores and no recordings either.
Musopen and the performing ensembles are credited as the sources users are
sent to; they do not endorse this project. The rightmost 🐔 trk's playlist
and 🎻 trk classic tabs in the song library are only views onto this catalog
(names of tracks and links), displayed non-commercially.

## 5. Not affiliated
trk! is an independent fan project. It is not affiliated with or endorsed by
ppy Pty Ltd (osu!), Bandai Namco (Taiko no Tatsujin), Crypton Future Media, INC.,
VRChat Inc., pixiv Inc., Nexon Games / Yostar (Blue Archive), Hypergravity /
Hypergryph (Arknights / Monster-Siren Records), GRYPHLINE / GRYPH FRONTIER
(Arknights: Endfield / Metal Scar Radio), Riot Games (League of Legends,
VALORANT, Teamfight Tactics, 2XKO, Wild Rift, Legends of Runeterra, Riot Forge), Team Shanghai Alice / ZUN (Touhou Project), miHoYo / HOYO-MiX
(Genshin Impact), Orange-Juice / Fruitbat Factory (100% Orange Juice), or
Bandai Namco Entertainment (Gakuen iDOLM@STER / THE iDOLM@STER).
