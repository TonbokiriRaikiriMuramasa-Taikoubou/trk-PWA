# trk! — English guide

> English guide (full). The short English summary is in README.md. The Japanese original of each section is in the linked file.

← [📚 Guide index](index.md)　／　[README](../../README.md)

## Contents

- [Media player only, and lighter builds](#media-player-only-and-lighter-builds)
- [Play: AUTO, radio, options, practice](#play-auto-radio-options-practice)
- [Difficulty names and Lv (auto charts)](#difficulty-names-and-lv-auto-charts)
- [Records and titles](#records-and-titles)
- [Controls](#controls)
- [Appearance](#appearance)
- [Sound effects](#sound-effects)
- [Spectrum](#spectrum)
- [Study Room](#study-room)
- [Packs and verified packs](#packs-and-verified-packs)
- [Playing on a phone](#playing-on-a-phone)
- [Requirements and saved data](#requirements-and-saved-data)
- [Making mods](#making-mods)
- [File layout](#file-layout)
- [Security](#security)
- [Inspirations and credits](#inspirations-and-credits)

## Media player only, and lighter builds

On the first launch, a “Welcome to trk!” box appears once (rhythm game, music player, video, Study Room for picture books and text, and everything works without an internet connection). You can show it again from **⚙ Settings → 🛟 Emergency Recovery → 👋 Show the welcome again**.

Press **Skip** in the quick guide if you do not need the tutorial. To listen without starting a game, tap **🎥 Base** beside **📚 Study Room** in the song-list header and load your own music. Long-pressing the TV dock's **⏻ power** button still works too.

Use **“← Back to song list”** at the top to leave the media player. **The song keeps playing** (just like when you open the player — only the volume drops back to the song-list preview level), so you can adjust effects and settings in the song list without the music stopping. Your playback position is saved. To stop the music, pause it in the player (or with ⏯ on the song banner) before leaving. The old behaviour — stopping and restarting from the preview start position on every exit — can be reproduced with **Settings → ❓ Mystery settings (bug reproductions) → “🚪 Reload the song when you leave the media player”** (off by default). The button stays at the top while the contents scroll. You can also press Esc (a confirmation may appear depending on your settings).

The optional FIRST SPARK demo lives in `assets/optional-demo-audio/` (about 704 KiB; the MP3 is fetched only when selected). It ships **handmade Easy / Normal / Hard charts** (27 / 54 / 111 notes on the song's 128 BPM four-on-the-floor grid) as plain `shadow-taiko-chart` JSON, fetched only when that difficulty is used; MASTER and RUSH stay generated from the seed. For a lighter build, delete the **entire folder**; without its `manifest.json`, the demo entry and button stay hidden. Set `"charts": false` (or remove only the chart JSON files) to keep the audio with generated charts. This does not affect the media player or your own songs. If the audio was already cached, clear the site's data/service-worker cache to reclaim that stored copy. The original songs of **trk's OST Vol.1** are no longer bundled: download `trk-ost-vol1.stpack` from the [music-library](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/music-library) Releases page and load it via Settings → 📦 Custom packs → "📂 Choose pack" (stored on this device, no automatic downloads, CC BY 4.0, generated charts). They also appear in the "🎓 trk's OST Vol.1" playlist.

In full-screen video, **hold the left half to rewind or the right half to fast-forward**. Seeking starts after about 0.45 seconds and gradually accelerates while held, without changing your playback-speed setting. Release to stop. The direction and seconds per step appear in the center. Short taps keep their existing play/pause behavior.

**Zooming the full-screen video:** turn the **mouse wheel** over the picture to zoom in (wheel up) or out (wheel down) **around the pointer**, so the part you are pointing at stays put. Zoom starts at 100% (the whole frame fits) and stops at 500%. Each wheel notch changes the zoom by **2% / 5% (default) / 10%**, chosen in **Settings → 🎨 Appearance → “Full-screen zoom (per wheel notch)”**. Once zoomed in, **drag (press and move)** to slide the view around; on touch screens **pinch with two fingers** to zoom. The **🔍 125%** button in the top bar shows the current zoom and resets it to 100% on click. Drag-to-move only works above 100%, so the left/right hold-to-seek gesture is unchanged at 100%. While dragging, the pointer is captured, so the view keeps sliding even when you move outside the picture (or the window). After a pinch, lifting one finger hands the drag over to the finger that stays down — no need to lift and press again.

The media player supports a play queue, next/previous track, repeat, shuffle, playback speed, resuming from the last position (optionally rewound 3–30 s so you never miss a word), a sleep timer (15 / 30 / 60 minutes with a 15-second fade-out, or stop at the end of the current track), 📌 picture-in-picture, 🔆 keeping the screen on while a video plays (Wake Lock; audio-only playback won't), and Media Session. Reverse playback (with audio reversed where the browser allows it) and A-B section looping are also available.

**⏮ Always start from the beginning (trk193):** to make song previews and the media player's "resume" always begin at 0:00, turn this on (off by default). The same switch lives in three places — **Settings → 🎵 Sound**, the **media player's options row**, and the start-position bar that opens when you **long-press "⏱ Set preview start here"** at the top right of the song title tab — and any of them changes the same setting. The bar's slider picks the start point in 0.1 s steps and seeks the preview as you drag; "Save this position" stores it per song and "Back to the song default" clears it. While this is on, per-song start points and saved positions are kept, not deleted (turn it off to use them again).

**⏱ “Set preview start here” is hidden at first (trk213):** so a stray tap can't change a song's start point, the button at the top right of the song tab is **off by default**. To use it, turn on **Settings → 📊 Spectrum** → “⏱ Show ‘Set the preview start here’” (the rack's “More settings” has the same checkbox). The button then appears on the song tab: click it to save the current position, or long-press it to open the start-position bar. Turning it off hides the button and closes the bar if it is open (per-song start points are kept). “⏮ Always start from the beginning” can still be switched from **Settings → 🎵 Sound** and the media player while the button is hidden.

**Loop Lab** can loop a 5 / 10 / 20-second section from the current position, or a random short section. You can save, recall, delete one by one, or clear all A-B presets per song. Presets store only a song identifier and the A/B seconds on your device; trk! does not cut, convert, export, or upload audio. The video can also be hidden temporarily behind a wallpaper or screensaver, with a clock, pause/resume of the video, toggle or long-press, and an image chosen from your device (kept for the session only). The cast antenna and the background-playback antenna can be set separately. The background-playback antenna can also sit **compactly at the top right, next to the language selector**, instead of on the dock (background playback still works when the dock antenna is hidden). Casting is off by default; on browsers that support it, the cast antenna opens the device picker (hiding the cast antenna does not remove the playback antenna).

Antenna shapes: telescopic rod, circular loop, parabola, or cyber beam, plus **ten dot characters**: 🚚 truck, 🤖 robot, 🐱 cat, 🫧 slime, 👻 ghost, and from Touhou Project: ⛩ Reimu, 🧹 Marisa, ❄ Cirno, 🦇 Flandre, 🗡 Youmu. The characters **wake up and walk when ON, and lie down and sleep when OFF**. All are original drawings by trk!, except the Touhou characters, which are fan-made pixel art (drawn under the official fan-work guidelines, offered as a free browser game; not official assets). You can also choose **two of your own illustrations** (one for ON, one for OFF); they are stored only on your device and removed by resetting settings.

**Supported formats:** MP4, MP3, M4A, OGG, OPUS, WAV, WebM, FLAC, AAC and MOV (subject to browser support), plus local `.mid` / `.midi` files rendered with the built-in soundfont-free, code-generated GM-style player. It offers 24 timbre profiles (10 broad reference-inspired directions and 14 trk originals); no sample bank or hardware emulation is included. See [Touhou MIDI and extraction](touhou-midi.md) for matching, format limits and safe extraction guidance.

## Play: AUTO, radio, options, practice

### ▶ AUTO and radio

Both work with any mode, using the buttons on the song select screen.

| Feature | What it does |
|---|---|
| **▶ AUTO** | Autoplay, so you can watch the notes flow. Useful for checking hard parts or looking for a seed you like. No life, records, or titles. |
| **📻 Radio** | When a song ends, the next song in the list starts after 5 seconds. With **AUTO + Radio + sound effects** it becomes a music player you can leave running. It stops with "play again" or "back to select". |

### 🎯 Play options

| Option | What it does |
|---|---|
| ❤ **Life mode** | Standard / Knight / **trk!** (one miss ends the run 🐔) / Infinite. The display can be hearts, a gauge, a battery, emoji, and more (7 styles). |
| **3・2・1・GO!** | A countdown matched to the song's BPM. It also counts in when you resume from pause. |
| **Judgement strictness** | Loose (counts as practice) / Standard / Strict. |
| ⏩ **Playback speed** | 0.5x to 2.0x (up to 3.0x in Settings). The default is a slightly fast **1.2x**. Pitch does not change. From 1.05x up, each speed keeps its own high score and a "🏁 fastest clear" record. |
| **HIDDEN / SUDDEN** | Notes vanish partway through / appear partway through. |
| 🎲 **RANDOM / ANTI-ROLL** (STAGE) | Shuffles the lane order / reshuffles so the same lane is not hit twice in a row. Decided by the seed, so they count for records. |
| **Mirror** (STAGE) | Left-right flip. |
| **Keys** | Main and sub keys. Presets: A / Space, osu!taiko-style F·J / D·K, 🕹 Arcade 1·2, 📺 Remote ←→. Left-right swap for left-handed play. |
| **🎮 Pad and remote** | Assign gamepad or rhythm-controller buttons and sticks directly (left note, right note, confirm, back, pause). Menus can be navigated with the D-pad or stick. A TV remote that sends keyboard keys works with the key settings. |
| **Video controls** | Zoom the video (0.5–3x), reverse, A-B loop, and playback speed / pause in the media player can all be key-assigned. Loop can be set to toggle or hold-only. |
| **Navigation** | Keys to return to the menu and to close the player, plus options for confirmation prompts and description text. |
| **Extra effects** | "Show all / Reduced / Extra effects off". This reduces screen flashes, shake, and hit effects only; sound effects are set separately. |
| 🎯 **Offset measurement** | Tap 16 times to a click sound and it suggests a timing correction. |
| **Auto fine-tune** | After a play, nudges the correction value based on whether you tended to hit early or late (off by default). |
| ▶ **Media player** | Starts with a long-press on the TV dock's power button. Play a queue, next/previous, repeat, shuffle, 0.5–2x speed, reverse, A-B loop, wallpaper / screensaver, a 15 / 30 / 60-minute sleep timer (fades the volume out before stopping; can also stop at the end of the current track or chapter), resume from the last position (with an optional 3–30 s rewind), 📌 picture-in-picture, 🔆 keep-screen-on while a video plays, and 🎤 lyrics (embedded tag lyrics, a same-named .lrc from the shared folder, or a file you choose, shown in sync with playback — click a synced line to jump there; lyrics are read-only and never leave the device), 💬 subtitles (for video songs: an SRT/VTT file you choose or a same-named .srt/.vtt from the shared folder, shown over the video, with a delay control in ±0.25 s steps; subtitles also appear in picture-in-picture — read-only and never uploaded), 🔖 chapters (for M4B-style files that carry chapter marks: a clickable chapter list to jump, ⏮/⏭ to step between chapters, the playing chapter highlighted — chapters are read-only and never leave the device), and a 🌊 waveform seek bar (the loudness envelope drawn on the seek bar with a time bubble on hover; can be turned off in Settings — songs without analysis results, like long tracks or lite mode, keep the plain bar), all without starting a game. **Loop Lab** creates 5 / 10 / 20-second and random sections and saves A-B presets per song on the device. There is no file cutting, conversion, or export. Set A and B points and release them with a toggle or hold of the assigned key. M returns to the menu, and ESC closes the player (the confirmation can be turned off). The cast and background antennas are set separately. |

### 🔁 Practice features

These work during AUTO, or when "show seek bar (practice)" is on. Any play that uses them counts as **practice**, and it is not saved as a high score.

| Feature | How |
|---|---|
| Seek bar | Move to any position with the bar at the bottom of the screen. |
| 10-second skip | ← / → (keys can be changed). |
| 🔁 Section repeat | **R key**: set A → set B → clear. The pause screen has buttons for this too. |
| Hold `` ` `` | Restart from the beginning immediately. |
| - / = | Adjust the timing correction by 5 ms. |
| [ / ] | Change the playback speed (a play where you change speed counts as practice). |

Also available:
- 👻 **Ghost**: shows the difference from your personal best during play.
- 📊 **Judgement average and spread**: shown on the results screen, e.g. "avg +3.2 ms · spread 11.4 ms".
- **Timing meter**: shows how far off each hit was.

### 🥁 How MANUAL matches presses to notes (dense runs)

Sixteenth notes from Advanced upward (94–75 ms apart at 160–200 BPM) are about as close as, or closer than, the GOOD window (Advanced ±95 ms, Master ±80 ms, RUSH ±75 ms), so the windows of neighbouring notes overlap. MANUAL therefore decides which note a press belongs to like this:

- **It looks for a note of the same colour, in time order.** Among same-colour notes the earliest wins (a slightly late press does not jump to the next note).
- **An earlier note of the other colour is skipped once its time has passed.** The skipped note becomes a MISS when it leaves the window (while it is still inside the window you can go back and hit it). Dropping one note no longer makes your next correct presses get swallowed by the previous note in a chain of misses.
- **A wrong colour is a MISS** (as in Taiko; mashing both buttons does not pay). But a wrong-colour press that is earlier than the PERFECT window counts as a **whiff** (nothing happens), so an early press or the second hit of a two-handed press does not consume the next note.

"**Use the old hit matching**" in ❓ Mystery settings restores the old rule (up to trk98): the earliest note inside the window is taken and a wrong colour is always a MISS. It is there for comparison and does not change how records are kept. The window sizes themselves are set by "Judgement strictness".

## Difficulty names and Lv (auto charts)

- **Difficulty names (Easy to RUSH) are a guide to note density.** The higher the difficulty, the more notes the same song gets in total.
- **Lv is decided by the busiest stretch of the song (the peak).** So the same song can show the same Lv for Hard and MASTER. Treat Lv as a number for how hard the peaks feel, not as a replacement for the difficulty name.
- Each difficulty has a cap on how many notes can be placed in quiet sections. Loud sections gain more notes when there are enough candidate positions.
- You can choose the auto-chart method (new or legacy) in Settings under "Auto-chart method".

## Records and titles

- Records are kept per song, per chart, per mode, and per speed: high score, accuracy, most PERFECTs, play count, and the last 30 plays. **A MIRROR / RANDOM run counts as the same chart**, and an exported chart keeps the original lanes rather than the ones the MOD produced (trk129 / trk132).
- **PERFECT✦**: a PERFECT that landed especially close to the exact timing. It does not change the score.
- **Titles** appear next to song names in the song list.

| Mark | Meaning |
|---|---|
| 🥁 🚚 🪐 🎪 🚛 | Cleared in that mode |
| ⚔ | S rank (95% accuracy) or better |
| 🐔 | No miss |
| ⭐ | ALL PERFECT |

## Five play styles

- 🥁 **MANUAL**: two-button Don/Ka drumming.
- 🚚 **TRUCK**: switch lanes and let your truck drive over the notes (easy mode for everyone).
- 🪐 **ORBIT**: one-button play; a winding path flows into the center target (inspired by Gitaroo Man).
- 🎪 **STAGE**: 4/5/6-lane vertical play with stairs, trills and wide notes (inspired by World Dai Star: Yume no Stellarium).
- 🚛 **CATCH**: catch falling parcels with your truck; grab nitro cans 🚀 for **Blast mode**.

**Also:** AUTO play for every mode, 📻 Radio (auto-advance to the next song), a song-banner volume button (tap for the slider, hold to mute/restore), life modes, countdown, playback speed with per-speed records, HIDDEN/SUDDEN, RANDOM/ANTI-ROLL, offset wizard, A-B repeat, ghost, timing stats, titles, custom skins, antenna character skins (described above), VRM 1.0 mascots, MMD mascots (65 original procedural motions grouped by daily movement, dance, Miku-tempo, classic poses, expressions, and singing/lip-sync; Lat morph tracks; the A-I-U-O mouth cycle with no audio sync is the default for new installs and the bundled Lat preset; saved choices are kept; bring your own model and check it with the on-device self check), ⭐ favorites folders (1st / 2nd / Frozen / Former, no cap, `trk-favs` export), 📤 **share your music folder** (one permission pulls the whole folder in, with an optional on-device copy of up to 150 songs / 300 MB), shareable `.stpack` packs, 🎛 **sound effects** (115 EQ/FX presets, a visual effect-chain editor, a bottom-left 🔥 **TRK amp** panel, automatic latency compensation, and shareable `trk-fx` JSON), and a 🎹 **play-along synthesizer** with 16 built-in sounds (electric guitar, electronic sax, layered ZUNPET-inspired brass), a saved ±8-semitone pitch control that also retunes held notes, QWERTY-mapped keys, a default option to lock mapped keys to the piano while synth mode is open, an optional wider on-screen keyboard, local sample layers, and Settings controls to disable it or shorten its launch hold to 0.2 seconds.

## Controls

| Key | Action |
|---|---|
| A / Space | Don / Ka (MANUAL; changeable) |
| ↑↓ / ←→ / A・Space | TRUCK lane change / CATCH movement (CATCH defaults: A = left, Space = right; ← → also work) |
| D F J K etc. | STAGE lanes |
| Any key | ORBIT |
| P / Esc | Pause and resume |
| Hold Esc for about a second | Return to song select (while playing, paused, or on the result screen; can be turned off in ❓ Mystery settings: “Don’t return to song select on a long Esc press”) |
| `` ` `` (left of 1), hold | Restart from the beginning |
| - / = | Timing correction ±5 ms |
| [ / ] | Playback speed |
| ← / → | 10-second skip (AUTO and practice) |
| R | Section repeat (AUTO and practice) |
| F | Fullscreen |

Touch is supported too: MANUAL, TRUCK and ORBIT use left and right buttons, STAGE uses tapping lanes, and CATCH uses swiping.

CATCH “Blast” (triggered by a 🚀 nitro can) lasts **10 seconds** by default. Taking another nitro can during a blast clears the parcels on screen and ends the blast. Turn on “Blast lasts until the next parcel” in the CATCH settings to keep it going until the next parcel is caught or dropped.

### 🎮 Pads, controllers, and TV remotes

Open Settings ⚙ → "⌨ Controls" → "**🎮 Controller, pad and remote**". You can **assign any pad button or axis (stick) directly**.

- **Connecting:** plug in over USB or Bluetooth, then **press a button once**; the browser recognizes it and the name appears in Settings.
- **Assigning:** press "Change", then the button or stick you want. The five actions are "Left note", "Right note", "Confirm", "Back", and "Pause / resume". **One button can serve two actions** (during play it is a note, in menus it confirms). Sticks show as, for example, "L-Stick ←".
- **Menu navigation:** D-pad or left stick moves (hold to repeat), confirm presses the highlighted button, and back works like ESC (it pauses during play). It can be turned off.
- **TV remotes:** most remotes arrive as keyboard keys (← → ↑ ↓, Enter, Back, ⏯⏭⏮). Set the notes to ← → (preset "📺 Remote") to play with the remote alone. **Back** works whether the device sends Escape, BrowserBack, or GoBack.
- **Arcade sticks and homemade controllers:** for devices that send buttons 1 and 2, use the preset "🕹 Arcade (1·2)". For a lever that sends axes, use "Left stick ← →".
- Note judgement is still based on the **audio clock**, so timing does not drift with a pad.
- `?reset=keys` resets only the keyboard and pad assignments.

## Appearance

- **Skins:** shadow, daylight, neon, sakura, terminal, clarity (color-vision friendly), Miku-based (PCL fan work), gradient, accessibility (high contrast, and a color-vision-friendly dark and light pair), everyday scenes (rainy window, night bathhouse, shoji light, station platform, morning kitchen, shopping street at dusk), ink wash, score paper, pixel night, misty forest, and more: **44 in all** (one is a reward skin 🎓 unlocked by five tutorial stamps). In **🖼 Skin shelf** in Settings, filter by chip: classic, Miku, dark, light, gradient, playful. You can build a **custom skin** by choosing colors (two-tone background with gradient in any direction; shareable as JSON). Small accent-colored text (settings sub-headings, links and so on) is nudged toward the text color only when needed, so it keeps at least 4.5:1 contrast on every skin, custom ones included.
- **Layout:** horizontal scroll / vertical left / vertical center / commentary-video style.
- **Display order:** in Settings, "Display order" switches between **Simple** (default; recommended order, the top six shelf skins come first, and video filters start with the classics) and **All** (the original order). The set of items does not change. Shelf skins re-sort immediately; video filter order applies on the next load.
- **🔧 Developer display (off by default):** shows the Loop Lab in the media player (quick, saved, presets; the basic A-B controls are always visible), the 👥 contributor tool, 🎨 Make a custom TV skin, and "+ Add or edit skins".
- **Notes:** color and shape (circle, diamond, square), chosen separately from the skin.
- **Background video:** color, monochrome, dimmed, or hidden, plus sliders for **darkness** and **blur**. From the 📺 TV dock on the song select screen, choose from **65 video filters** (retro, cinema, dreamy, nature, plus portrait/skin tone, anime/cel, texture, and studio/quality) and **30 TV skins** (CRT, wood, arcade, aquarium, projector, and more). Portrait looks are whole-screen color adjustments; they do not detect or correct skin areas. If the video looks wrong, `?safe=1` returns to a safe state. In the **bottom-left of the song select screen** there is a separate **✨ TRK effects** section with 20 richer looks from the portrait, anime, texture, and studio tabs (see below).
- **Safe brightness and blur:** the 🎛🎲 buttons randomize on tap, and **long-press resets both to 0**. Each slider also resets to 0 on long-press. You can save up to **8 brightness and blur combinations** as favorites and recall them with one tap. This does not reset the video filter or the TV itself.
- **Custom TV:** from the 🎨 button in Settings, choose six colors, a shape (button count, columns, corner rounding, screen border), 34 decorations, and surface finish (glow, glass reflection, scan lines). Saved TVs appear in the TV dock's skin list and can be shared as `trk-tvskin` (JSON). Up to 30.
- **📡 Antenna characters:** the background-playback antenna can use one of four shapes, the ten dot characters (including the Touhou ones), or **your own two illustrations** (ON and OFF, stored only on your device). The compact top-right antenna shows the same character. The Touhou characters are fan-made pixel art; no official assets are used.
- **📺 Channel buttons on the TV:** next to the power and pause buttons are **◀ ▶**, which move to the previous or next song like a TV channel. At the ends of the list they wrap around, and the screen shows `♪ song name`. **During playback, by default the song does not change** (to keep you focused). Tick "change songs with ◀ ▶ during play" to switch immediately (that play is not recorded).
- **Layout order:** song select shows **📺 TV → (favorites) → 🎛 Rack → (favorites) → 📺 TV details → 🎛 Rack details**. The rack sits right under the TV, like audio gear under a TV. The TV and rack order can be swapped inside "details".
- **⭐ Favorites in folders:** under the dock are chips for **⭐ 1st team / ⭐ 2nd team / 🧊 Frozen / 📤 Former favorites**, each with a count. Tap one to swap the buttons to that folder. 🔒 freezes it. Items that do not fit appear in the row below. Long-press (or ⋯) to move, pin with 📌, or remove. **No cap.**
- **🧩 Add-ons:** add features that are not built in. In Settings, "🧩 Add-ons" → "📄 Install an add-on" takes a `.js` or `.trk-addon` (JSON) file and saves it to `trk_addons_v1`. Add-ons can **add songs** (grouped in the 🧩 tab of the song list), **add UI** in places such as Settings, the song list, the TV details, and the rack details, and **route their own audio through the built-in effects** (`api.fx.tapElement`). See [docs/ADDONS.md](../ADDONS.md) and the example [`js/addons/example.js`](../../js/addons/example.js). If an add-on breaks, `?safe=1` keeps it from loading.
- **📤 Share your music folder:** in the song list, "📤 Share music folder" asks the device for permission **once** and pulls the whole music folder into the list **at once**. It also brings in things you did not look for (including videos), which pairs well with 🎲 Random. The app reports how many songs were added and how many files were skipped. The permission is remembered, so next time one tap on "🔗 Keep sharing" is enough. On top of that, **🔓 Read the previous folder automatically at startup** (trk194, on by default) means that if the browser still remembers the permission, **your songs are listed as soon as the app opens** (no click). When the browser needs to ask, one confirmation appears on your **first tap**; choose "**Allow on every visit**" there and later launches need neither a tap nor a prompt (Chrome 122+). Installed as an app (Add to Home Screen), the permission is kept automatically. Settings → 📤 Music folder sharing also has "**Read it now**" to read the folder on demand, plus **💾 Keep shared songs on the device** (up to 150 songs / 300 MB, so no permission is needed next time) and **🚫 Stop sharing** (removes the remembered permission and the songs on the device). **You can also share a video folder the same way** (**🎬 Share a video folder** under Settings → 📤 Folder sharing; it opens your videos folder first), and **you can register as many folders as you like** (up to 8). Each one is listed with 🎵 / 🎬 and its song count, and **× removes just that folder** (🚫 removes them all). Two folders with the same name stay apart as `Music (2)`, so song folders never blur together. The older "📁 Open music folder" is kept alongside for a quick look at a single folder. **Songs are never uploaded**; they are only read.
- **📚 Song tabs (shelves):** above the song list, **a tab for each source** is added automatically: 📚 All, 📦 by pack, 📁 by folder, 📄 added songs, ✔ verified. **💿 Albums / 🎤 Artists** shelves appear as soon as any song carries album/artist info (from embedded tags or a song profile): songs gather under sticky group headers, ordered by track number inside an album, and songs without a group collect in a "No tags" group at the end; tags are pre-read when the shelf opens and the list re-sorts as they arrive (read-only). A **⚡ Smart** shelf appears once there is any play history or added dates: 🕒 Recently played, 🔥 Most played and ➕ Recently added (up to 50 songs each) — media-player listens count once a track passes 30 seconds (or half of a short track), and quick skips never do (all of it stays on the device). **Installing a song pack adds a tab for it**, so songs you add later are easy to find. Search and sort work within the tab you are in, and a **📈 progress filter** (All / Unplayed / In progress / Finished) narrows the list from resume positions and play counts — a display-only filter that never rewrites records; TV ◀ ▶ moves through songs **in the open tab**. Each tab shows a count.
- **🏷 Embedded text tags:** when supported audio files carry text tags (title, artist, album, album artist, genre, track number — ID3 in MP3 and similar files, ©nam-style boxes in M4A/MP4, TITLE-style comments in FLAC and Ogg Vorbis/Opus), they are used for **display**: song names follow the priority "🎶 profile override → 🏷 tag title → catalog title → original file name", and artist/album appear in the song-list sub-line, the song-select banner, and the media player (queue, header, and lock-screen metadata). Tags are read on this device only (when a row becomes visible or a song is selected); the original files are **never modified** (no tag editing) and nothing is uploaded. Catalog matching (grey "songs I want" rows turning black) still uses the file name — tags never change matching.
- **🎨 Embedded album art:** when supported audio files contain artwork (ID3 in MP3 and similar files, M4A/MP4, FLAC, Ogg Vorbis/Opus), a small thumbnail appears in the song list. The selected song's banner and TV can show it too; by default, audio-only songs show the cover below the top-right timer while a chart is playing. On other screens, the artwork is centered in the video area and never enlarged beyond its original size (it is reduced only when needed to fit). The TV image filter—including monochrome, color adjustments, dimming, and blur—also applies to covers. Turn on **🖼 Show artwork full-screen** in Play options → **❓ Mystery settings** to replace the video with artwork enlarged to fill the gameplay screen (off by default). To show a small cover in the spectrum, turn on **🎨 Show the song thumbnail** under Settings → **Spectrum (see the sound)** (off by default). The other Mystery settings are **📚 Use artwork assigned in Study Room** and **🎼 Hide artwork while playing a chart**. All three Mystery settings are off by default. Artwork is read and downsized on this device only; the original file is not changed, and images are neither uploaded nor permanently stored. Songs without embedded art show a ♫ placeholder. Separate files such as `cover.jpg` are not searched automatically.
- **📚 Shelf skins (30):** the song tabs can look like 🎛 Tab player, 📝 Notebook, 🌈 Sticker book, 🗄 Card catalog, 📼 Cassette label, 🖍 Blackboard, 🕹 Retro PC, 📁 Clear folder, 🎰 Jukebox, 📻 Radio schedule, 🚉 Departure board, 💿 Record shelf, 📼 Rental video, 🎤 Karaoke index, 🗂 Library shelf, 🍱 Menu board, 🧰 Toolbox, 🌿 Plant specimen case, 💊 Medicine chest, 🏨 Inn shoe rack, 🍬 Candy shop shelf, 📌 Station message board, 📮 Mail sorting rack, 🎼 Score shelf, 🔷 Color-vision friendly (blue × orange), 🧵 Patterns, 🚧 Warning signs (yellow × black), 💥 Pop art, 🦄 Rainbow neon, 🍍 Tropical. Use the **🎨 button** above the song list to switch on the spot (including `🎲 Random`). Hide the 🎨 button in Settings "Appearance" if you do not need it.
- **Playing an mp4 from song select:** choosing a song shows its video on the TV dock screen (can be turned off). Under "🖼 Check video" in the details, you can check filters, TV skins, darkness and blur **before** playing, with the same view as in-game.
- **ORBIT:** path motion, note size (can show the judgement width), six hit-point shapes, and a star orbiting around.
- **STAGE:** lane width and darkness, note thickness, key beams, guide lines, lanes that light up at climaxes, spotlights, and other stage effects.
- **Judgement text:** size, position, the FAST/SLOW display range, and persistent AP/FC display.
- **Sway:** tilts the lanes with the beat or with drum hits (off by default; stops if the OS "reduce motion" setting is on).
- **Mascots:** an orange partner, Hatsune Miku (PCL, unofficial fan work), **your own VRM model** (VRM 1.0), and **your own MMD model** (.pmx / .pmd). Both VRM `.vrma` and MMD `.vmd` motions follow the song's BPM.
- **⭐ Favorites in folders:** songs, video filters, and effects can be kept in four folders: **⭐ 1st team, ⭐ 2nd team, 🧊 Frozen, 📤 Former favorites**. There is no cap; items that do not fit appear below the buttons. 🧊 freezes (no adding or removing). 📌 means "never removed"; pinned items always appear in 🎲 Random. Items you remove go to 📤 Former favorites and are not drawn by Random. Export and import (`trk-favs`) move them to another device.
- **🎧 Playlist tabs (your own shelves):** add a playlist with **+** in the tab bar, or middle-click / long-press **📚 All**. Source guides (rights notes) of lists imported from the official catalog appear in the selected UI language. Long-press a playlist tab for its name, icon, and color (🧊 Frozen prevents accidental additions; 🔒 Lock prevents accidental deletion; 🧩 marks an add-on). Middle-click deletes (you can change this to "same tab three times" in Settings; on phones, long-press → delete). Tabs for playlists **inside a folder** only close on middle-click — the playlist itself is kept — and **opened folder tabs stay in the bar until you close them** (like browser tabs). The tutorial's demo track no longer has its own tab: it lives in the **🎓 trk's OST Vol.1** playlist inside 🐔 trk's playlist (right below Game Vol.1). Opening it keeps its tab until you close it, and you can delete it from the tab's ⚙ (long-press) settings — the song itself stays in your library. Lists that trk! creates automatically (Game Vol.1, Classic Vol.1, trk's OST Vol.1 and the catalog lists) are **not recreated at the next start once you delete them**, and a list you moved to another folder is not moved back. To bring deleted lists back, press **♻ Restore deleted trk lists** in Settings → "🐔 trk's playlist". Playlists only reference songs, so deleting one leaves the songs in the library. Long-press a song to edit its profile (title, artist, album, composer, **source link**, **catalog match note**) and add or remove it from playlists. For example, for `BELIEVE.ogg`, a note of `Suguri` matches "Suguri - BELIEVE" without changing the display name. Either the title or the note alone is enough for a match. On PC you can also drag and drop songs onto playlists. Playlists can be placed in **📁 folders** (long-press 📚 All → "📁 New folder"; up to three levels deep). Deleting a folder moves its contents up a level; no songs are lost. Playlists can have up to five **🏷 tags**, which carry into shared files and clipboard summaries as #hashtags. The **📤 Share** option in the tab long-press menu exports a shared file **without any audio** (condition: **9 or more songs, all cleared or watched**. AUTO, radio, and faster speeds count as watched, but a song watched only in AUTO always gets **▶AUTO**; leaving out scores and mode titles is optional). A comment (up to 140 characters), creation date, **source link** (https only; a confirmation dialog appears before opening), per-song source links (the 🔗 in the profile, for example for YouTube compilations), and **🏷 tags** can be added. The person who receives the file can review it in the viewer and import only the songs they already have.
- **Mika music and videos:** Blue Archive includes “ミカ — kiss angel” (5 entries), “ミカ — Aria to the Star” (two vocal tracks and the full Global official mini musical), and “ミカ — ソロ＆参加曲” (three Japanese solo/ensemble songs and an official MV). All carry the Mika tag. English titles do not imply English vocals. Audio links use Apple Music China, UK or Japan (regional availability varies); videos link to official bilibili/YouTube posts. Matching separates audio and video using file information, not content identification. Streaming/purchase is neither a reuse license nor a guarantee of importable files. [Sources and scope](../BLUEARCHIVE-MIKA-INDEX.md).

- **🛒 Official playlist catalog:** long-press 📚 All (or ⚙ in the tab bar) → "🛒 Official catalog". It offers curated playlists that **never include audio**: 🎒 Blue Archive OST Vol. 1–8 (225 songs in official order, with artist, album, and Apple Music links per song, plus NexTone.Link per volume), 🩺 Arknights, 🛰️ Arknights: Endfield (Zeroth Directive OST Vol. 1–2 at the top — all 60 songs in official order, the game's opening BGM lives here, each linking to its official Spotify song page, each volume to the official ffm.to smart link from the announcement; plus six official albums, 81 songs — Eve of Departure, Thunder's Legacy, At the Wake of Spring, Contingency Contract Re-Ignition, Homecoming, Dreamscape of Wind and Snow — in release order, each song linking to its official Spotify page and each album to its official Spotify album page; the four character-theme songs (Blurring / ASHEN REMAINS / The Floaty Envelope / MAKER'S LUV) are grouped in the "Endfield Character Theme" shelf, followed by the intro lists), ⚔️ LoL (Creator-Safe Sessions, 3 series / 108 songs; recent Champion Themes, 41 songs; Worlds / WCS anthems 2014–25, and one 2026 announcement song; four MSI anthems with confirmed official sources; six official K/DA songs; the official SoundCloud albums split **one album per playlist** — the Season 1–9 game soundtracks (243 songs) and Warsongs (11); and 30 songs from the official SoundCloud popular-tracks page, a snapshot from 2026-10-09 (a few are region-blocked). Album links open the official SoundCloud album and each song links to its official Spotify page (popular tracks link to their official SoundCloud page). Every LoL list has been matched against Riot's official Creator-Safe Playlist (music 100% owned by Riot Games). The official embed shows only the first 100 entries, so the rest were matched on songdata.io, a third-party site that lists the whole playlist (2026-10-12). Every song is in it for Season 1–9 (243 songs), Sessions: Vi and Sessions: Star Guardian Taliyah; only some are for the Champion Themes (39 of 41), Sessions: Diana (42 of 43), Warsongs (10 of 11), the Worlds/WCS anthems (only "Worlds Collide", 2015) and the popular tracks (7 of 30); none of the MSI anthems or K/DA songs were found. Four more lists (158 songs, all Creator-Safe) were built from the playlist's songs that were not in the catalog yet: Pentakill, login/event/skin themes, esports themes and the 2025–26 soundtracks. Each list's source guide shows this status. Songs that were not found — such as the collaboration tracks (Worlds/MSI anthems, K/DA, True Damage) — are outside Creator-Safe or unconfirmed; not all LoL music), 🎯 VALORANT, 🛡️ Riot Games — League of Legends universe games (7 lists, 342 songs from Riot Forge's three games, Teamfight Tactics, 2XKO, Wild Rift and Legends of Runeterra, all Creator-Safe; unlike LoL they are not created automatically, so import them here), ⭐ Touhou Project, ⚡ NoCopyrightSounds, 🎼 Kevin MacLeod, ❄ Genshin Impact, 🍊 100% Orange Juice, and 🌟 Gakuen Idolmaster. Each list is a **"songs I want" list**: all songs appear as soon as you open it. Songs you do not have are shown in **grey**; tapping one opens the official source link. Arknights has "Babel" (5 songs), "🚀LONETRAIL" (10), "👹 Ruins" (7), and eight popular story OSTs (43 songs in all), each linking to Monster-Siren's official per-song page. **Put the audio you own in your Music folder and the grey row turns black and becomes playable.** Songs with the same title are added to the playlist automatically (not while 🧊 Frozen). File names such as `08_sometimes.fla` match the catalog title `08 sometimes`. If a title with a character name does not match, use the "catalog match note" in the song profile (for example `Suguri`). The note stays on the device, and it does not change the displayed title or shared playlists. Importing creates **category → series folders** (for example "Social games → Arknights"), and the tab's long-press menu shows source guides. Blue Archive audio is not included; each OST song links to its official Apple Music page and each OST volume to NexTone.Link. Mika sources are described above. Yostar's guidelines prohibit copying audio and music for fan works, and buying or subscribing does not lift that restriction. Check the [Yostar official guidelines](https://bluearchive.jp/fankit/guidelines) before use. Rights in songs and series belong to their owners; trk! is unofficial and does not guarantee the linked content. The catalog itself is `TRK_CATALOG` in `js/catalog.js`; add-ons can add series.
- **🎻 Classical title variants:** Beethoven’s Fifth Symphony, first movement, also matches the supplied title `Symphony no. 5 in Cm, Op. 67 - I. Allegro con brio`, without renaming or a match note. `Cm` / `C minor`, spacing and punctuation variants are supported. Keys, work numbers and movements are not simply discarded, to avoid matching a different work or movement. Not every download title is covered; use the existing catalog match note for unsupported names. Original files and display titles are unchanged.
- **🎧 Decorations and versions:** Recognized catalog filename wrappers include `【高音質】Constant Moderato.m4a` and `🎧Theme 22 - Daily Routine 247 by Nor.m4a`. Artist credits must match the catalog artist; this fallback does not choose between multiple local candidates. JP / CN / Short / Instrumental and arrangement labels are kept distinct. For unsupported names, use the song profile’s catalog match note with the full catalog title, including its version, rather than renaming the original file. This decoration fallback does not apply to shared playlist imports.
- **⭐ Touhou catalogue and MIDI:** the pinned community title snapshot contains Touhou Project game/CD groups and keeps 42 associated-game release IDs in a clearly separate, non-canon series. The catalogue contains metadata only. Local `.mid` / `.midi` files play through a lightweight built-in synthesizer, and IDs such as `th06_05.mid` and `th06_15.mid` display as their Japanese catalogue titles without changing the original filename. Not every release has MIDI. The in-app note links to the standalone Touhou Music Room audio extractor and its GPL-3.0-or-later license (with an additional permission); it exports rendered audio, not MIDI, and is not bundled. `thtk` has different BSD-style terms but its own guide says it cannot extract BGM archives. See the full [Touhou MIDI and extraction guide](touhou-midi.md) for limits, sources, tool licensing, and copyright cautions.
- **Scope and rights notes for the official catalog (2026-10-11):** VALORANT is split into Champions Anthems (6 songs, 2021–2026) and Agent Themes (3 songs), each linking to its official source and the [Riot Creator-Safe guide](https://www.riotgames.com/en/riot-music-creator-safe-guidelines). None of these 9 songs was found in the official VALORANT Creator-Safe Playlist (40 songs) or the Riot Games Creator-Safe Playlist (2026-10-12), so treat them as outside Creator-Safe or unconfirmed (details: [VALORANT ledger](../VALORANT-MUSIC.md)). Instead, the 39 songs of that official playlist can be imported as the "VALORANT Creator-Safe" list (all Creator-Safe). Publishing, buying, or subscribing does not by itself grant rights to reuse. Arknights links to Monster-Siren Records' music and OST pages; Genshin links to HOYO-MiX's Apple Music pages (12 songs). Neither is a license. Arknights: Endfield lists the 60 songs of the Zeroth Directive OST Vol. 1–2 at the top in official order, each song linking to its official Spotify page and each volume to the official ffm.to smart link, plus 81 songs from six official albums (Eve of Departure, Thunder's Legacy, At the Wake of Spring, Contingency Contract Re-Ignition, Homecoming, Dreamscape of Wind and Snow) in release order, each song linking to its official Spotify page and each album to its official Spotify album page; the four character-theme songs (Blurring / ASHEN REMAINS / The Floaty Envelope / MAKER'S LUV) are grouped in the "Endfield Character Theme" shelf (Zeroth checked 2026-10-10, the six albums 2026-10-11; an Apple Music listing for Zeroth and Chinese official titles for the six albums were not confirmed, which does not prove there are none — see the [Endfield music ledger](../ARKNIGHTS-ENDFIELD-MUSIC.md)). GRYPHLINE's [fan-content guidelines](https://endfield.gryphline.com/ja-jp/news/4497) prohibit copying or extracting official assets (audio included) and streaming or buying is not a reuse license; gameplay videos and streams are allowed without prior contact only when the guideline conditions are met (introducing the game and sharing play as the main purpose, and nothing on the prohibited list). SAM Free Music / 100% Orange Juice keep their 25-song selection, while Fruitbat Factory's **official game page** is used only as work information; per-song sources and permissions are not confirmed. Gakuen Idolmaster lists 50 instrumentals (two lists of 25) confirmed on the official Drive, and 14 songs from the official discography in a separate list. The discography list includes songs not currently found on the Drive, but this does not mean they cannot be distributed. **SEARCH RIGHT** is the official title; the Drive name **SEARCH LIGHT** is also registered for matching. The official Drive download terms are for limited fan videos; they are not a license for all songs or for general use, and owning or buying a song is not a license either. No audio is included in any list.
- **🐔 trk songs in your Music folder:** Settings → "🐔 trk's playlist" has instructions and a "📂 Load the trk folder in Music" button. Create a `trk` folder inside Music yourself, put songs in it, then select that folder with the button. The library then reads only that folder. To go back to all of Music, choose Music again with the normal folder picker. trk! only reads; it does not create folders or move songs.
- **👥 Contributor tool (for people who receive many shared playlists; in Developer display, off by default):** a shared playlist can carry a **contributor name** (set your own in Settings; the viewer shows 👤 with it). With Developer display on, turn on "👥 Contributor tool" in the settings of 📚 All. It adds **search by contributor name**, **🚫 Block** (hides that person's playlists from tabs and folders), and **show only starred contributors**. It is for handling large volumes of spammy submissions. Most people never see it. Contributor names are displayed as written in the file, so they cannot prevent impersonation.
- **🕹️ Short play (the second half of a long song):** in Advanced settings, choose **the last 90 / 120 / 180 seconds**. It starts from the end of the song, and **detects long silences near the end**, ending where the sound actually stops (songs with about 8 seconds of tail are fine). Clear, grade, and FC/AP are shown as usual, but records are **saved separately from full plays** (they do not touch full-play bests or watch proof). Titles use one 🕹️ mark in every mode. AUTO remains a full-length play.
- **⏯🔊 Title banner controls:** the volume button 🔊 at the bottom right of the title banner (the same as "song volume" in Settings). **A short press opens the slider. A long press mutes, and another long press restores the previous volume.** Left of it is a **play / pause button** (icon-only, the same size, trk126): while you are choosing a song it stops or plays the preview (it resumes from where it stopped). While a chart is playing or paused the same button pauses or resumes the game (the song-select screen is hidden during play, so normally you see it while choosing). **Touching a song title to choose a song clears the pause and plays again**, so a song never stays silent. It is disabled when there is nothing to stop (no song chosen, or the preview is off); its tip (on hover or for screen readers) says why. Going to Settings and back to song select also plays the preview again from its start point. A pause is meant to be temporary: choosing a song means you want to hear it. Settings also have **"Tap the title banner to pause / play"** (**off by default**). When on, tapping the banner pauses or resumes during play, and starts or stops preview while selecting. Buttons inside the banner and in the 🎚 effect area work as before. The right end of the banner holds **[◀][🎲][▶]** (kept to the right so they do not overlap the title). **◀ ▶** move to the previous or next song (within the open tab; the ends wrap). **🎲 is a long press (650 ms) for random by default**, so a stray tap while browsing does not change the song (a short press only shows a hint: "long-press for random"). If you want **tap-only** random, turn on "🎲 Random with a tap only" in Settings. If you do not need 🎲, turn off "🎲 Show the random button on the title banner". Pinned 📌 songs always appear in 🎲 Random's candidates.
- **🎮 Pads, controllers, and TV remotes:** in Settings ⚙ → "⌨ Controls" → "**🎮 Controller, pad and remote**". USB or Bluetooth gamepads and rhythm controllers can have their **buttons, D-pad, and sticks assigned directly** to left note, right note, confirm, back, and pause ("Change", then press the button). Presets include "A·B (Xbox / PS)", "D-pad ← →", and "Left stick ← →". One button can be both "left note" and "confirm" (during play it is a note, in menus it confirms). **Menus can be navigated with the pad** (D-pad or left stick moves, hold to repeat, confirm presses, back works like ESC). A **📺 TV remote** that sends keyboard keys works by setting the notes to ← → (the "📺 Remote" preset). Media keys (⏯⏭⏮) and Back can be assigned too. For **🕹 arcade cabinets and homemade controllers** (devices that send buttons 1 and 2), use the "🕹 Arcade (1·2)" preset. `?reset=keys` resets only key and pad assignments.
- **🪶 Lightweight mode (for phones):** in Settings ⚙ bottom right, "🪶 Lightweight" collects the frame-rate cap, 3D mascot draw rate, render resolution, savings for spectrum and blur, thinning of always-moving decorations, the number of rows in the song list, and skipping audio analysis or 3D model loading. **Auto** works only when needed, based on the device (mobile, cores, memory, data saver, battery, and the "reduce motion" setting). See [📱 Playing on a phone](mobile.md#playing-on-a-phone).
- **🩷 MMD mascots (bring your own):** move your own MMD model, such as Lat-style Miku or Tawashi-style CHAN×CO Miku. Select the texture folder. **All 65 built-in motions are generated by trk! code at run time as VMD**, grouped into six: daily, dance, Miku-tempo originals, classic Miku poses, expressions and acting, and 🎤 singing / lip-sync. They include smiles, winks, blushes, anger, troubled faces, and lip-sync that use real morph names from the Lat-style Miku. Expressions only move on models that have the same morph names. The lip-sync is a vowel loop and is not synced to the audio. Titles and "in the style of" references only suggest tempo and mood; they do not reproduce existing choreography. New installs and the Lat-style preset default to "🎤 A-I-U-O lip-sync (no audio sync)"; six more singing motions are in the 🎤 group. Saved choices are kept, and you can load your own `.vmd`. **Third-party models and VMD files are not bundled unless their redistribution terms can be confirmed.** One exception: a Lat-style model with its original terms and ReadMe is included in `assets/mmd/lat-miku/`. Scale, direction, and bottom-of-screen credit can be set and are restored when you next open the app. `?safe=1` does not load them. If something does not work, press **🔎 Check** on the same panel: it shows WebGL, the bundled 3D parts (three / three-mmd-loader), the model, and the motion in one block. Press "📋 Copy result" and paste it when asking for help.

### ✨ TRK effects (bottom-left, separate section)

On the song select screen, below **🔥 TRK amp**, is **✨ TRK effects**. It gathers only the **richer "beautify" looks** from the video filters (color styling that makes footage look nicer). **The contents are the same as the TV dock's video filters**, so either place stores the same value (no double application).

- Four tabs with five looks each, **20 in all**: portrait / skin tone, anime / cel, texture, and studio / quality. For example: natural skin, soft skin, flush, matte skin, ID photo; clear cel, cel fill, pastel, night anime, print (halftone); grain, paper, halftone dots, soft glow, velvet; balanced, clean, highlight, open, cinema.
- The section is open the first time (matching TRK amp). Closing it keeps it closed on later visits; reset returns it to open.
- **Use TRK effects** (switch) applies the current look. **Turning it off returns to the previous look** (↩ also restores it).
- **◀ ▶ 🎲** move through the looks or pick at random (🎲 only chooses among these 20).
- **🎛 Video filters in detail** opens the settings video filter list. The 45 classic looks, ⭐ favorites, and 🕘 recently used are still in the TV dock.
- Reset with `?reset=tv` (this also clears the memory and returns the section to open) or `?reset=all`. **`?safe=1` disables the switch**, but keeps the memory. Settings exports (JSON) include it.
- ⚠ These are whole-screen color adjustments. They **do not detect or outline faces or skin, paint over areas, enhance resolution, or recover blown highlights**. They are only for making things look nicer.

## Sound effects

trk! also works as a music player. Open "🎛 Sound effects" in Settings or from the song select menu. It does not affect scoring.

Below it is the **🎚 Effect rack**, where you can stack effects **in up to eight stages**, like a portable amp chain. Stages run after the preset and are included in saved presets and exports. Available stages are: **🚪 Noise gate** (closes when the signal falls below a threshold); **🧹 Noise reduction** (during a quiet passage, press "🔇 Learn the current sound as noise"; it learns that spectrum for two seconds and removes it, a self-made version of the approaches in Audacity, ReaFir, and Bertom Denoiser Classic); **🎚 Dynamic EQ** (reduces a band only when that band is loud, after TDR Nova and Ozone); **✨ Exciter** (adds harmonics to the highs); **🧲 Compressor**; and **📢 Volume**. Noise reduction is heard about 20 ms late, which the automatic timing compensation absorbs.

### 🔈 Switching the sound output does not stop the song (trk219)

When you change the system output device (Windows “Sound”, speakers / headphones / HDMI and so on), the browser rebuilds its audio path. Playback used to stop and stay stopped, so trk! now **notices the stop and starts the song again from where it was**.

- **A stop you asked for stays stopped**: pausing with ⏯, the lock screen, or a keyboard pause key is never undone.
- **Nothing resumes in the background**: while the tab is hidden or the window is minimized, playback is not restarted.
- **Restarts are kept modest**: if playback keeps stopping, trk! waits instead of retrying forever (up to six times a minute; after three failed tries it rests for 30 seconds).
- Audio stays on this device; nothing new is saved or sent.

### 🔊 Volume leveling (ReplayGain style, off by default)

In "🎛 Sound effects", below "Prevent clipping (limiter)", **"Level the volume across songs"** turns loud songs down and quiet songs up toward one listening level, so you do not have to reach for the volume between songs. It works **independently of the effects switch** (while leveling is on, audio runs through WebAudio — the same behavior as turning effects on).

- **Two sources, in priority order:** if the file carries a ReplayGain tag (`REPLAYGAIN_TRACK_GAIN` — ID3 TXXX in MP3-like files, Vorbis comments in FLAC/Ogg/Opus, the `----:com.apple.iTunes` freeform box in M4A/MP4), **that value is used as-is**; otherwise the loudness from the on-device analysis that already runs when a song loads (a gated RMS average in dB, silence excluded) is pulled toward a −16 dB target.
- **Kept safe:** the correction is clamped to −18…+9 dB, and boosting is capped so the loudest sample never passes full scale (no clipping). Huge files whose analysis is skipped, and songs with neither tag nor analysis, **pass through unchanged**. The status line under the switch shows the current correction and its source ("from tag" / "from analysis").
- **Files are never modified** — tags and analysis are read on this device only (read-only policy). Tags arrive when a song-list row becomes visible or a song is selected, so if a tag turns up during playback the volume follows it.
- Loudness and peak ride along in the on-device analysis cache (`trk_analysis_cache_v1`), so replays do not re-analyze (older cache entries stay valid and are recomputed on the fly).

### 🔥 Using TRK amp (own section, bottom-left)

On the song select screen, **directly below "🎛 Details (EQ, skins, menu)"** in the bottom-left is **🔥 Use TRK amp**. It is an entry point to the rack above (the stage-stacking system), so you can use it on the spot without opening Settings. It is the same rack and stays in sync with "🎚 Effect rack" in Settings.

- **The section is open the first time** so you notice it. Close it once and it stays closed next time (reset returns it to open).
- **Use TRK amp** (switch) turns the rack on. If the rack is empty, it first builds the standard four stages: **🚪 Noise gate → ✨ Exciter → 🧲 Compressor → 📢 Volume**.
- **Build a chain in one tap:** **🔥 TRK amp (standard), 🍯 Warm, 📻 Boombox, 🧹 Clean**. Each rebuilds the chain and plays immediately.
- **Stages appear as chips** (for example `🚪 Noise gate`). Reorder with **↑ ↓**, remove one with **✕**, or add with **＋ Add stage** (up to eight).
- **🎛 Adjust stages in detail:** edit knobs (threshold, frequency, ratio, and so on) in **"🎚 Effect rack" in Settings**. This section is for building, ordering, and switching.
- **Switching off keeps the stages** (off = plain sound). Use ✕ on everything to remove them.
- Resets: **`?reset=amp`** (empties the rack), **`?reset=all`** (factory; empties the rack too), **`?safe=1`** (keeps the stages but turns the amp off for safety). Exports (settings JSON and presets) include the stages.

### 🎹 Local MIDI timbre profiles (24 code-generated options)

Choose one in Settings → **🔊 Sound** → **🎹 Local MIDI timbre profile**. It is used when the next local `.mid` / `.midi` file is loaded and rendered to WAV.

- There are **10 broad reference-inspired profiles** (FluidR3-, SGM-, GeneralUser GS-, GS/GM2-era module-, XG-, WAV/PCM- and ROMpler-like tonal directions) and **14 trk originals**.
- All are generated by oscillator, waveform, filter and envelope calculations. **No SF2/SF3 bank, PCM/WAV samples, real instrument recordings, or ROM data is included; these are not product or hardware emulations.** Names indicate broad inspiration only, not affiliation or equivalence.
- No Touhou game audio or extracted assets are bundled. The original MIDI filename and saved song title stay unchanged; rendering is local.

### 🎚 TRK MIDI MIX (regular audio; off by default)

On the song-select screen, find it **directly below the “✨ TRK effects” panel** at the bottom-left. It applies the selected profile's EQ, chorus, reverb, and other audio effects to ordinary playback such as MP3 and WAV. It is **off by default** and has no effect until enabled.

This is not a SoundFont synthesizer or MIDI renderer, and it does not convert audio to MIDI. A locally rendered MIDI WAV uses the ordinary playback path too, but its MIDI timbre selection and TRK MIDI MIX are independent settings. Audio reset turns the MIX off; safe mode also disables it.

| Category | Count | Examples |
|---|---|---|
| Basic | 10 | Scooped sound, night mode, clear, mix check: phone |
| Genre | 16 | EDM, piano, jazz, orchestra, city pop, vocaloid |
| Scene | 20 | Goodnight, rainy day, campfire, night highway, snowy night, whisper |
| Space | 17 | Cathedral, next room, planetarium, inside a closet, station platform |
| Game | 15 | Boss battle, save point, flashback, ending roll |
| Fun | 21 | 8D-style, karaoke, record, string telephone, answering machine |
| Quirky | 16 | Robot, live house behind the wall, deep sea, near a black hole |

- **Simple EQ** (five bands, ±12 dB) applies on top of any preset.
- EDM pumping, gates, 8D, echo, and similar effects **follow the song's BPM**.
- 🎮 **Game-linked:** a brief muffle on a miss, brightness on combos, a heartbeat at low life, a bigger sound during 🚀 Blast mode (during play only).
- ⏱ **Automatic timing compensation:** the delay added by effects is corrected in the judgement (fine-tuning available).
- 📄 **Saved with the chart:** exported charts include the effects, so others hear the same sound.
- 🎛 **Effect chain editor:** connect 17 effects visually, reorder them, and adjust EQ and volume. Try them, save as presets, or load and save `trk-fx` JSON.
- 🎹 **Synth play mode:** long-press the ⏻ speaker on the rack (default 0.65 s; can be turned off or shortened to 0.2 s in Settings). It has 16 built-in tones (electric guitar, electronic sax, ZUNPET-inspired brass, and more), a pitch knob (−8 to +8 semitones, default 0, saved, and applied to held notes), up to six layers (stacked oscillators, or short samples from your device), and a two-octave keyboard with key assignments, so you can play along with the song preview. While the synth is open, mapped keys are locked to the keyboard by default (can be changed). The keyboard can be widened in Settings. The top of the screen shows video and the spectrum.

## 🧩 Personal presets (MOD)

Export the current settings as JSON with "⇩ Export current settings as JSON", edit the file, and import it to make your own preset (format `trk-fx`).

```json
{ "format":"trk-fx", "version":1, "name":"My city pop",
  "chain":[ { "type":"eq", "bands":[ { "type":"lowshelf", "freq":90, "gain":3 } ] },
            { "type":"reverb", "size":1.8, "decay":3, "mix":0.15 } ],
  "eq":[0,0,0,1,2], "volume":0 }
```

Available effects: `eq` `comp` `gain` `width` `vocalCut` `delay` `reverb` `drive` `lofi` `pump` `tremolo` `autopan` `sweep` `ringmod` `chorus` `noise` `crossfeed`

Only values of the allowed types and ranges are read, and no program is run, so you can safely try other people's JSON.

> Built-in presets stop at **115**. Make new sounds with personal presets and MODs, and share them with **#trkAGRG**.

## Spectrum

See what is playing on the song select screen. It reads **the sound after the effects**, so you can see how EQ and effects are applied.

- **30 display styles** (table below) and **16 colors** (neon, sunset, monochrome, rainbow, **trk (red × blue)**, sakura, toxic, VHS, gold, ice, forest, candy, lava, ocean, Game Boy-style, synthwave). Default: **⭕ Ring × neon**.
- **Sensitivity** slider and **peak lines**. Settings are saved in the same place as other settings (`shadow_taiko_preferences_v2`).

| Style | What you see |
|---|---|
| 📊 Bars / 🪞 Mirror / 〰 Waveform / ⭕ Ring | The classics: loudness as bars, mirrored bars, a wave, and a circle. |
| 🎚 DAW waveform | A recording-software timeline with waveform history, playhead, dB scale, and a REC dot. |
| 🧭 VU meter | Two analog needles (L/R) that bounce. |
| 🔴 LED ladder | A cassette-deck level meter: green → yellow → red, with "CLIP" when clipping. |
| 🌈 Spectrogram | Time × frequency heat map, scrolling right to left. |
| 💓 ECG | The waveform as an ECG trace; the sharpness of onsets shows clearly. BPM is shown too. |
| 📉 Seismograph | Red needle on drum paper; shows the strength as a seismic intensity. |
| 📡 Radar | A sweep with blips; each band leaves dots behind. |
| 🎹 Piano roll | Notes stretch above the keys in response to sound. |
| 📈 Business chart | Presentation-style bars with a target line and achievement rate. |
| 💹 Frequency board | Stock-board style, with four rows from bass to treble, values, and ▲▼. |
| 🤥 Lie detector | Three recording strips: pulse, breathing, and sweat. Loud sounds stamp "LIE". |
| 🔥 Campfire | The flame grows with loudness and sparks fly. |
| 🔵 Dot grid | Towers of dots that light up per band, like an LED panel. |
| 🏙 City lights | A night skyline; windows light up with the sound. |
| 🫧 Bubbles | Bubbles rise from each band. |
| 🏔 Mountains | Three ridges for bass, mids, and treble. |
| 🎸 Strings | Strings for each band vibrate. |
| 🌸 Flower | Petals open with the sound; a slowly turning flower. |
| 🌀 Kaleidoscope | An eight-way mirrored kaleidoscope. |
| ✨ Starfield | Scattered stars that twinkle with the sound's brightness. |
| 🟢 Matrix | Falling characters at the speed of sound. |
| 🎆 Fireworks | Fireworks launched by the sound's peaks. |
| 🌊 Swell | Three layers of rolling waves. |
| 🐚 Spiral | A spiraling line of light. |
| 🌬 Windmill | Blade length follows the sound; wind turns the windmill. |
| ⚡ Lightning | Bright bolts on peaks, with lights on the ground. |

- To turn it off everywhere, check **🚫 Do not use the spectrum** at the top of Settings → "📊 Spectrum". This removes it from the banner, details, TV overlay, and the audio path. Unchecking restores it.
- Three places: **📊 Title banner (on the song title, top right)**, **🎛 "⚙ Details" inside the rack**, and **"📊 Spectrum" in Settings**.
  - The title banner is a **skin**. Press **+** at the top left to open it wide (then "⇄ Next style" and color dots appear). Press again to close. **Long-press +** to jump to the spectrum section in Settings. The right end of the banner has **[◀][🎲][▶]** (move through songs, and 🎲 random in the current tab). You can limit 🎲 alone or hide the whole group in Settings.
  - Options such as "show peaks" and "📺 Overlay on TV" are in the settings.
- **📺 You can overlay it on the TV screen** (off by default). It sits over the video, so you can watch it throughout song select. It does not appear during play.
- ⚠ When shown, sound passes through **the same audio path as the effects (Web Audio)**. If you have never used effects, turning this on still creates that path. **Scores are not affected.** It does not appear in `?safe=1`.
- If the OS "reduce motion" setting is on, the number of bars is reduced and peaks are not drawn.

## Study Room

Study Room is a local image and text viewer. Long-press the title at the top left of the song list (or focus it and press Enter / Space) to open it. You can also use the **📚 Study** button on the right of the heading, which stays visible even when “Show buttons instead of long-press” is off. Press Esc to close.

Imported images, text, bookmarks, notes, and jacket assignments are saved **only in this browser** in IndexedDB `trk_study_room_v1`. Nothing is uploaded or sent over the network. Original files are not changed. `?safe=1` does not open Study Room and does not touch its storage.

- **⚙ Settings:** **the button in the Study header works before choosing a book, even with the shelf hidden.** The button to the left of “Full-screen image” also opens the former advanced options (shelf layout, key bindings, zoom step, mouse actions, import and export destinations). The shelf has another button for the same panel, usable without a book open. Changes apply and save immediately. Esc, Close, or clicking outside the panel returns to reading.
- **⛶ Full-screen fit:** the first setting, **“Always fit images to the screen in full screen”**, is off by default. When on, the whole image fits without changing its aspect ratio only while in full screen (each side of a spread fits separately; vertical mode fits one image at a time). Plus / minus, 0, Ctrl+wheel and pinch cannot change zoom during this time. Leaving full screen restores your original zoom; the saved zoom is untouched. Off keeps the existing enlarged view.
- **🗜 CBZ / ZIP:** pick `.cbz` (comic archives) or `.zip` files; each file becomes **one book** named after the file. Only the images inside are used as pages, in natural name order; Mac metadata such as `__MACOSX` is skipped. Normal limits match image folders (up to 3,000 pages, 600 MiB total, 100 MiB per page); an archive over a limit is not imported and the reason is shown. **Ignore storage limits does not remove the 100 MiB decompressed-page ceiling for CBZ / ZIP; it remains as a ZIP-bomb safeguard.** ZIP parsing also has fixed caps of 250,000 entries / a 64 MiB directory; the setting cannot bypass them. Broken or encrypted files show “could not be read”, and the other files still import. If a book with the same name exists, you are asked whether to replace it.
- **🗂 Shelf:** each image folder becomes **one album** (nested folders can be "one album per folder" or "one album total"). Each text file is one book. The shelf holds up to 500 books. Click or long-press the shelf heading to create organizing folders. Drag the **⋮⋮** handle to reorder cards, or drop them on a folder to move them. Search by title, path, or excerpt. Sort by **newest updated / oldest added / name / type / largest**. The shelf normally shows outside full-screen; with "show shelf" in the header you can restore it if hidden in Settings. Settings also include "don't use sorting" (manual layout), "show folders above books", and "don't confirm deletion". Books with a bookmark show 🔖; ✎ renames, × deletes (deleting a folder moves its books back to the shelf). The bottom of the shelf shows book count, image count, and usage (plus free space where the browser reports it).
- **📥 Import:** shows a progress bar and a **Cancel** button. Books already imported stay after a cancel. When a book has the same name, choose "replace contents" or "keep as a new book". Files that are too large, and similar cases, are skipped with a reason, and a final summary shows added / kept / failed counts.
- **📂 Share a folder and read it (no copy):** press **📂 Share a folder and read it** in the Study header and choose the folder that holds your images **once** — even a library with thousands of pictures. Nothing is copied onto the device: each page is read from that folder when you open it, so the shelf only stores a table of contents and **your storage does not grow**. This needs a Chromium-based browser that can pick folders (Chrome / Edge). The folder is remembered, and **one confirmation appears when you open a book** (choose "Allow on every visit" and it stops asking). Shelf cards show **📂 (read in place)**. If an image is moved or deleted inside the folder, that page says it could not be loaded and why. **Original files are never changed** — they are only read. On a new device, or after restoring a backup, **pick a folder with the same name** and the same books read it again. To keep a copy on the device instead, use **🖼 Import image folder** as before.
- **🖼 Images:** choose a folder and its images are sorted by name (numbers sorted as numbers). Album limits: up to 3,000 images, 600 MiB total, and 100 MiB per file (`jpg / png / webp / gif / avif / bmp`). A folder over a limit is not imported, and the reason is shown. Three layouts: **one page / spread (right first) / vertical comic**. **🇺🇸 American** swaps left-right and order. **Reverse page order** reverses the reading direction. **Tap the left side of an image or press →** for next; **the right side or ←** for previous (🇺🇸 reverses the tap positions). Swipe works too. **Zoom** from 0.5x to 4x by buttons, `Ctrl+wheel`, pinch, or `+` / `-` / `0` (`0` returns to 100%). How much one press changes is set in ⚙ Settings under "zoom step": **1 / 2 / 5 / 10 / 25%** (5% by default = 20 steps from 100% to 200%). When zoomed, drag to pan, or scroll the enlarged image with **`↑` / `↓`** (one press moves one screen; holding moves in small steps). At the top or bottom the keys go back to the "use ↑ / ↓ for image pages" setting, so page turning keeps working. **At any zoom level**, `PageDown` / `PageUp` jump to the bottom / top of an overflowing image (including 100% and reduced zoom), and pressing again at an edge opens the **next / previous page from the far edge** (PageDown = top of the next page, PageUp = bottom of the previous page; at the ends of the book they perform the **close action** = leaving full screen and returning to the shelf; this is the default; enable “Use PageUp / PageDown to turn pages” in ⚙ Settings to turn pages directly instead). **“Close the book with PageDown on the last page”** is on by default. Turn it off to stay at the bottom of the last image without closing the book or leaving full screen (applies to image-edge navigation; PageUp at the start and the middle-click setting are unchanged). Holding the key down stops at each edge; turning the page or closing needs a fresh press. Images that fit, vertical mode and text keep their usual behavior. An existing choice to disable edge jumps is carried over as direct page turning. Explicit custom next / previous key bindings still take priority. ⚙ Settings also has PC mouse options: **turn pages with the left / right click** (left = next, right = previous, with a **swap** for trackballs and left-handed use; it does not matter where on the page you click) and choose what the **middle click** does (nothing / next page / close to the shelf, leaving full screen) — off by default, mouse buttons only, while finger taps keep the left / right tap zones. In vertical mode only visible pages load, so long books stay light.
- **📄 Text:** import single files or whole folders (12 MiB per file, up to 200 files at a time; TXT, MD, JSON, CSV, logs, and similar). The encoding is detected automatically: **UTF-8 / UTF-16 (with BOM) / Shift_JIS**. Aozora-style ruby (`｜《》`) is rendered. There are **24 text skins** in total (writing and reading 6 / coding 6 / AI and prompt style 5 / free-form 7). The chosen colors, font, and background apply to both the reader and the editing text area. The AI-style skins are visual only; they do no AI processing and no networking. Adjust **text size, line height, and margins** in three steps each (the manuscript-paper style flows sideways). **In-book search** (`Ctrl+F` or 🔍; `Enter` / `Shift+Enter` for next / previous; matches are highlighted).
- **🔖 Bookmarks and progress:** hold `Enter` to bookmark, `M` for the **bookmark list** (jump to or remove). Hold `Space` for the **page slider** (images); `Home` / `End` jump to the first or last page. Reopening resumes from the page you left.
- **⌨️ Keys:** by default `→` next and `←` previous. In Settings you can rebind next and previous separately (you can also use `↑` / `↓` for image pages). While an image is zoomed, `↑` / `↓` scroll that enlarged image (the same place the mouse wheel moves). Left/right taps and swipes follow the binding direction.
- **📜 Auto-scroll:** in **vertical comic mode** only. Press the **⏩ Auto-scroll** toolbar button or `A` to scroll down at a steady speed for hands-free reading. Press `A` again, **tap** the page, use the **wheel**, or press any **navigation key** (`↑` `↓`, `Space`, `Enter`, `Page Up` / `Page Down`, `Home` / `End`, or your custom next / previous keys) to stop it — navigation keys only stop the scrolling and do not turn a page. At the **bottom (last page)** it stops on its own and tells you. The speed is chosen in Settings under **Auto-scroll speed** (slowest / slow / normal / fast / fastest = 20 / 45 / 75 / 120 / 180 pixels per second); **changes apply live** while it runs, and the choice is remembered. It keeps running in **full screen (⛶)**; switching the layout, closing the book, or leaving the study stops it quietly. Bookmarks and saved reading positions are untouched.
- **🌗 Brightness / contrast (reading filter):** Settings has **Brightness (reading)** and **Contrast (reading)** sliders (50–150%) plus a **Special filter (reading)** select (none / invert / grayscale / sepia). The filter applies to the **reading surfaces only** (images and text) — the shelf, menus and TV pane stay unchanged. Dragging updates the look **live**; releasing saves it (it survives reloads). It is **independent of the full-screen fit and the zoom**, so every combination works. At the defaults (100% / 100% / none) no filter is applied at all.
- **❓ Key help:** appears the first time and can be reopened any time from the top-right "❓ Keys" button or `?`.
- **✎ Text editing and export:** open a `.txt`, `.md`, or `.js` book and press "Edit a copy" to type. Input is saved automatically; `Ctrl` / `⌘+S` saves immediately; `Tab` indents; `Esc` returns to reading. Edits are saved to a copy inside Study Room, and the original file is not changed. **JavaScript, HTML, and Markdown are always treated as plain text**: they are never run, interpreted as HTML, or previewed. The export button works while reading too. Renaming a book in the shelf also changes the exported file name. In Settings you can choose a shelf folder for edited books, and in supported browsers you can choose an export folder on your device. When exporting to a folder you choose, the file is saved under a **new name** and existing files are not overwritten. The folder choice is kept only while the app is open. Browsers without support use a normal download (duplicate names are handled by the browser).
- **📺 TV and jacket:** Study Room has a TV (**top / bottom / hidden**). It has **six looks** (plain, CRT, wood frame, arcade, projector, aquarium), **three sizes**, **aspect ratios** (16:9, 4:3, 21:9, 1:1), and a title on or off. It shows the video when one is playing, or the jacket for an audio-only song. Assign a jacket by **long-pressing an image (680 ms)** or with "🖼 Use this page as the song's jacket". It is shown as the song-select background and on the TV dock, and is saved per song inside Study Room; the same action removes it. When Study Room closes, a song starts, or the song changes, any video is **always returned to where it was**.
- While Study Room is open, in-game key actions (mode keys, skip, speed, and so on) are paused. Leftover read-only images from an interrupted import are cleaned up automatically the next time you open it.

## Packs and verified packs

Like osu! skins, you can share many things in one file (`.stpack`). There is no server; share through Discord, cloud storage, or similar.

- **Look packs:** skins, note colors / shapes / images, sound effects, VRM, motions, and mascot lines.
- **Removing a pack puts things back:** the skin, note colors / shapes, effect strength, and SE-on that a pack set return to their values from before the pack (saved as `packPrev`, so it also works after a restart with the pack still on). **Items you changed yourself while the pack was on are kept** — your change is newer. Switching from pack A to pack B follows the same idea: what you changed yourself while A was on becomes the value B hands back to when it is removed (trk132).
- **Song packs:** audio, charts, background images, BPM, chart creator names, and a creator's message (up to 50 songs per pack).
- How to make one: "+ Make a pack from current settings" in Settings, or "📦 Make this song a song pack" on the song select screen.
- How to install: drop the file onto the screen.
- An optional `creditCard` in `pack.json` shows the creator name, title, rights notes, and terms like a business card. `contributors` shows up to 12 co-creators, and a `CREDITS.md` is generated inside the pack. A shareable SVG card can be downloaded from the pack list. The format is text-based (no images), so it is easy to handle when shared.

> ⚠ Only include **music and material you have the right to redistribute**.
> The contents are a ZIP file. The format name `shadow-taiko-pack` is kept for compatibility with older packs. The fields, limits, and a `pack.json` example are in [docs/pack-format.md](../pack-format.md).
>
> Static checks of the repository can be run with `node tools/check-repo.mjs`. These are not a substitute for testing in a real browser.

### ✔ Verified packs

A song pack whose creator's identity and rights have been confirmed shows a **✔ Verified** badge, along with a message from the creator (up to 280 characters, like a free X post).

- The SHA-256 fingerprint of the whole pack file is checked against [`verified.json`](../../verified.json) in the repository. If even one byte changes, the ✔ is not shown.
- Unverified song packs still show the **chart creator and BPM**.
- To apply for verification, send a DM to X [@ttrk143](https://x.com/ttrk143) or open an Issue. The steps and rights checklist are in [docs/verified.md](../verified.md).

## Playing on a phone

- Open the web play URL from the [README](../../README.md) in a phone browser and choose "**Add to Home Screen**" to play full-screen like an app.
- On phones, try "**📤 Share music folder**". On devices that can pick folders (such as Android Chrome), it pulls the whole music folder in at once. On devices without folder picking, add songs one at a time.
- Folder permission is **remembered** only in desktop Chrome / Edge. On phones, you can turn on "**💾 Keep shared songs on the device**" in Settings, and saved songs (up to 150 songs / 300 MB) can be played without permission.
- **📥 Receive from OS sharing (installed PWA):** with trk! installed via "Add to Home Screen", files sent from the OS share sheet — **songs and videos, CBZ/ZIP (Study Room), and .stpack packs** — are accepted. On desktop, right-click a file and choose "**Open with this app**". Files received through OS sharing show their names and count before import. Other websites can also submit to the share target, and the browser cannot distinguish that from OS sharing; cancel unexpected requests (declined files are removed from the temporary inbox). After confirmation, files go through the **same import paths, validation and limits** as in-app imports, and files that cannot be accepted are reported by name. **Files never leave the device.** iOS Safari does not support this (nothing appears — by design); on Android, Chrome and other browsers with Web share_target support work.
- An APK is not yet distributed. The static web assets are synced into an Android app with Capacitor, and the setup steps and limits are in [docs/android.md](../android.md).
- **🪶 Lightweight mode (bottom right of Settings):** settings for drawing lighter on phones, tablets, and apps (PWA / APK). Start with a **preset**:
  **🪶 Balanced (recommended)** / **🎯 Game priority (notes and response unchanged)** / **🔋 Maximum saving (lightest)** / **✨ No lightweight mode** / **🧩 Custom** (the state after you adjust the items below).
  Choosing any preset other than "No lightweight mode" turns lightweight mode **on** (it works on PC too). To go back to automatic detection, set "Lightweight mode" below to "Auto".
  **🎯 Game priority** puts **no cap on in-game drawing** (notes, background, and effects). It only lightens the menus, spectrum, 3D mascots, and render resolution. Judgement and response are the same in every preset, because judgement uses the audio clock.
  For detail, open Settings ⚙ → "**🪶 Lightweight (for phones)**" at the bottom right:
  **Lightweight mode** (Auto / always on / off), **frame-rate cap** (60 / 30 / 20 fps), **3D mascot (MMD / VRM) draw rate** (60 / 30 / 15 fps / no drawing), **render resolution** (device / up to 1.5x / 1.0x), **turn off spectrum**, **reduce blur and frosted glass**, **cap video blur at 2 px**, and four options that **reduce what is read**: **📡 Thin out always-moving decoration** (the antenna, characters, and skin lights are redrawn at the frame-rate cap); **songs drawn in the list at first** (all / up to 150 / up to 60); **🧠 Skip song audio analysis** (lighter for long songs and memory; auto charts then follow the BPM grid, and your own and imported charts are kept); **🩷 Do not load 3D mascots at startup** (three.js is not loaded either; it loads when you choose a mascot, open the ⚙ settings panel, or turn lightweight mode off). Models and files are never removed.
  "**Auto**" looks at mobile status, CPU cores, memory, the data-saver setting, **battery level (below 20% while not charging)**, and the OS "reduce motion" setting, and works only when it seems needed. The check runs on the device and nothing is sent. The current state and device information are shown in Settings; "🔄 Re-check this device" runs it again.
  **Gameplay judgement and timing use the audio clock (`gameTime`)**, so lowering the frame rate does not shift judgement. Only drawing is thinned. Silence detection, countdown, and input still run every frame. "🎯 Game priority" keeps note drawing uncapped.
  If you select a light preset while "No lightweight mode" is on, lightweight mode turns back on for that choice. On phone-like devices that have not used lightweight mode yet, a notice appears **once**. `?reset=lite` resets only lightweight settings.
- Privacy policy: [privacy.html](../../privacy.html). trk! uses no accounts, no ads, and no behavior tracking, and it keeps songs and settings on the device.
- Credits for code, Miku, bundled models, and third-party libraries are in [credits.html](../../credits.html) (the "rights and credits" gallery). The formal notices are in [NOTICE.md](../../NOTICE.md).

## Requirements and saved data

The latest **Chrome or Edge** is recommended. Firefox and Safari (16.4 and later) also work.

| Feature | Requirement |
|---|---|
| 📁 Remember music folder | Desktop Chrome / Edge (HTTPS or localhost). Other browsers ask for the folder each time. |
| 📤 Remember sharing (🔗 Keep sharing) | Desktop Chrome / Edge (HTTPS or localhost). Other browsers ask for the folder each time. |
| 🧠 Keep analysis results on the device | Automatic. Replaying a song skips audio analysis. Stored in IndexedDB `trk_analysis_cache_v1`: numbers only (no waveform), up to 30 songs. Not used in `?safe=1`. |
| 💾 Keep shared songs on the device | Only if turned on in Settings. IndexedDB `shadow_taiko_shared`, up to 150 songs / 300 MB. Not read back in `?safe=1`. |
| Loading packs | A browser that supports `DecompressionStream`. |
| Verified-pack checks | HTTPS or localhost (the fingerprint calculation needs it). |
| VRM | WebGL. three.js and three-vrm are bundled (`assets/vendor/`). Loaded only when you start using VRM. |
| MMD | WebGL. three.js and three-mmd-loader are bundled (`assets/vendor/`). Loaded only when you start using MMD. |
| ⭐ Favorites | On this device only (localStorage). Folder organization too. |
| 📚 Study Room | On this device only (IndexedDB `trk_study_room_v1`: books, pages, covers, settings). Normal limits: 3,000 images / 600 MiB per album / 100 MiB per image, 12 MiB per text file / 200 files per batch, 500 shelf books. Bookmarks, copied notes, jackets, and display settings are stored there too. It does not open in `?safe=1`. |

**About saving:** settings, records, packs, added songs, and personal presets are stored **only in this browser** (localStorage and IndexedDB). Analysis results (numbers such as loudness) are kept in the same places. The ♻️ factory reset does not delete them (only settings return to defaults). Clearing browser data deletes everything, so back up your records from time to time.

In Settings, **📦 Full backup** writes your settings, records, playlists, Study Room (books, images, bookmarks, notes), and custom packs to one ZIP file. Large media such as songs, VRM and MMD files is left out by default; you can tick a box to include them. Restoring asks for confirmation first and replaces the areas included in the backup. If packs were not included, installed packs are left unchanged. Packs are installed before extras are removed; if a pack fails to install, an existing pack with the same ID is kept. If it failed for lack of space, the report suggests deleting packs you no longer need and restoring again. The completion report lists pack installs, failures and removals, and says when cleanup was skipped because not every pack ID could be verified. Close the report to reload the app. The ZIP never leaves this device.

**Ignore storage limits** (off by default) removes the app's storage caps: Study Room's 500-book shelf, 3,000 images / 600 MiB per album / 100 MiB per ordinary image, 12 MiB per text file / 200 files per batch, and custom-pack limits of 500 MiB per pack / 1 GiB installed total. **Safety limits remain:** a CBZ / ZIP page may expand to at most 100 MiB, and packs keep their per-file type limits and 50-song cap (see the [pack format](../pack-format.md)). Backup ZIP parsing also has fixed caps: 250,000 entries / a 64 MiB directory, and per database store 64 MiB / 250,000 JSON records (settings JSON: 20 MiB). If creating a backup hits one of these fixed caps, leave out large areas such as the Study Room or split the data, and try again with a smaller backup. The browser's storage quota and available memory cannot be bypassed; a save can still fail if either is insufficient. Back up important data and import very large collections in smaller batches.

In Settings, **💾 Device storage** shows whether the browser has agreed to keep your data. When you import Study Room books or custom packs, the app asks the browser to keep them persistently. The browser decides whether to allow it; if it does not, export anything important as a backup.

## Making mods

trk! is split into files by feature, so it is easy to mod.

- **Your own mascot:** use `js/characters/miku.js` as a model, write a file that calls `registerMascot()`, and add one line in `index.html`.
- **Built-in skins:** add one entry to `SKINS` in `js/data.js` and it appears in the list. Use the `cat` tag to filter the shelf. `--ui-bg` and `game.stage` accept `linear-gradient(…)`. Setting `locked: true` keeps it locked until the unlock flag `settings.skinGradUnlocked` is set; on the shelf it shows as a "❓ ???" card. Example: the reward skin 🎓 Graduation gradient. Miku skins are registered in `js/characters/miku.js`.
- **Shelf skins (song tab look):** add one entry to `LIB_SKINS` and `LIB_SKIN_ORDER` in `js/lib-skins.js`, and add the style for `#libPanel[data-lib-skin="ID"] …` in `css/style.css`.
- **Add-ons:** add features without touching `js/*.js`. Call `TrkAddons.register({...})`, and either install it from Settings or add one line to `index.html`. The API is in [docs/ADDONS.md](../ADDONS.md), and the example is `js/addons/example.js`.
- **TV skins:** add one entry to `TV_DOCK_SKINS` in `js/tv-dock.js`, add decorations in `buildDeco()`, and add the style in `css/style.css`. To make your own without code, use the 🎨 (`#tvMaker`) in Settings.
- **Sound effects:** a personal preset (`trk-fx` JSON), or your own file added to `TRK_FX_PRESETS`.
- **Translations:** `TEXT.ja / en / zh / ko` in `js/i18n.js` and similar files.
- **Contributing:** [CONTRIBUTING.md](../../CONTRIBUTING.md).
- **Development handoff:** [docs/HANDOFF.md](../HANDOFF.md) (design thinking, the agreements between files, and the saved-data format).

When you publish a derivative version, please use a different name (see "License and rights" below).

## File layout

```
trk/
├─ index.html  privacy.html  credits.html  manifest.webmanifest  sw.js  verified.json
├─ package.json  capacitor.config.ts
├─ css/style.css  css/study-room.css  … looks for the shelf, reader, and TV
├─ icons/                        … app icons
├─ assets/optional-demo-audio/   … optional First Spark demo audio + three handmade charts (the whole folder can be deleted in lightweight builds)
├─ js/
│  ├─ i18n.js  i18n-options.js   … text in four languages
│  ├─ data.js                    … registration of skins, layouts, difficulties, and mascots
│  ├─ characters/miku.js         … Hatsune Miku (PCL). The game works without it.
│  ├─ core.js                    … settings, state, shared processing
│  ├─ player.js                  … playback controls and section repeat
│  ├─ media.js                   … loading, audio analysis, chart generation
│  ├─ judge-match.js             … matching MANUAL presses to notes (pure function)
│  ├─ game.js                    … progress, judgement, records
│  ├─ render.js                  … drawing
│  ├─ custom.js                  … note and skin creation, packs
│  ├─ truck.js  modes.js  stage.js  stagefx.js  catch.js   … modes, life, titles, effects
│  ├─ extras.js                  … offset measurement, ghost, and more
│  ├─ tv-presets.js  tv-dock.js  … video filters, TV dock, custom TV skins
│  ├─ fx-presets.js  fx.js  fx-dock.js   … sound effects, and the 🔥 TRK amp at bottom left
│  ├─ library.js                 … song select, AUTO, radio, song tabs (shelves)
│  ├─ lib-skins.js               … 30 shelf skins (song tab look and the 🎨 button)
│  ├─ verified.js                … verified packs
│  ├─ addons.js  addons/         … add-ons (a way to add features later, with an example)
│  ├─ main.js  speed.js          … input, startup, speed
│  ├─ vrm.js                     … VRM mascots
│  ├─ mmd.js                     … MMD mascots (bring your own; a Lat-style model with its terms is included)
│  ├─ favs.js                    … ⭐ favorite folders (1st / 2nd / Frozen / Former)
│  ├─ spectrum.js                … 📊 spectrum (shown over the TV screen too)
│  └─ study-room.js  study-room-utils.js  … 📚 Study Room (local image and text viewer)
├─ docs/  HANDOFF.md  pack-format.md  android.md  verified.md  og.png
├─ tools/make-icons.html         … tool to make icons and the OGP image
├─ tools/check-repo.mjs          … dependency-free static checks
├─ tools/check-study-room.mjs    … static checks for Study Room loading, encodings, and safety
├─ tools/prepare-mobile-web.mjs  … sync of web assets for Capacitor
├─ .github/ISSUE_TEMPLATE/       … forms for bugs and ideas
├─ README.md  NOTICE.md  CONTRIBUTING.md  LICENSE
```

## Security

trk! has no server, and neither songs nor Study Room books leave your device. The attack surfaces are **files others make** (packs, charts, skins, effects, playlists), **🧩 add-ons**, and **bundled third-party libraries** (`assets/vendor/`). On 2026-10-06 these were reviewed in depth. Shared-file URLs are limited to `https`, settings loading guards against prototype pollution, and `.stpack` files are checked against zip bombs. A static checker (`tools/check-security.mjs`) runs in `npm run check`.

- Findings, accepted risks, and recommendations are in **[docs/SECURITY.md](../SECURITY.md)**. Fixed issues are kept in the record.
- **Shared playlists (files received from others):** they contain **no audio and no code**. A sender can only **falsify a song title**, **display text**, or **offer an https link to open** (always confirm before opening). They **cannot read your files or run code**. Be careful of impersonation, and choose the songs you import yourself.
- 🎬 **Videos are loaded with "🎬 Load a video":** only files whose first frame confirms they have video are recorded as 🎬 (the mark appears in the song list). Once loaded they play in the full-screen viewer. **Large files (over 96 MB) skip audio analysis** so a 2 GB movie does not exhaust memory (charts follow the BPM grid).
- ♿ **Accessibility and robustness checks:** a one-time run of html-validate (HTML syntax), axe-core (on-screen content after startup), ESLint (typos), and css-tree (CSS syntax) is recorded in `docs/QUALITY-CHECKS.md`. It found and fixed 23 missing accessible names, nested tabs, and heading order. The **dependency-free checker** `tools/check-a11y.mjs` runs on every `npm run check` (duplicate IDs, input labels, `alt`, role misuse, and nested tabs).
- 🧾 **Cross-check with standard vulnerability lists:** `docs/SECURITY-CHECKLIST.md` maps each item of the OWASP Top 10 Client-Side Security Risks and the CWE Top 25 (2025) (✅ verified / 🟡 by design / 🔶 recommended but not done / ➖ not applicable).
- 🛡 **VRM and MMD libraries are bundled (no more CDN):** three.js, three-vrm, and three-mmd-loader are in `assets/vendor/`, and the import map uses relative paths. **There are zero external origins.** Contents are pinned in `tools/vendor-lock.json` (100 files, 4.98 MB, SHA-384), and **`npm run check` verifies them offline every time** (`npm run check:vendor:npm` also compares against the npm tarballs). They are not loaded at startup; they load only when you start using VRM or MMD (never in `?safe=1`).
- 📚 **Study Room text is always displayed as text:** `.txt` as well as `.html`, `.js`, `.md`, `.csv`, and `.json` appear **as source**. They are never interpreted as HTML or formatted as Markdown, so a file that contains HTML or JavaScript **does not run**. Only `jpg / png / webp / gif / avif / bmp` can be imported as images; SVG is excluded.
- Examples of what is protected: shared links are https-only and confirmed before opening (checked both on import and on open). Chart JSON is limited to 2 MiB and 50,000 notes, with numeric fields validated. Emergency settings import is limited to 2 MiB, shared playlists and add-on input files to 4 MiB, checked before reading. Pack format, size, and paths are validated. Custom skins use an allowlist of colors only. Dynamic code evaluation happens **only in add-on code the user explicitly agreed to** (this is not a sandbox). `innerHTML` is used in one place, the results screen, after `esc()`. File selection is read-only. Add-ons do not load in safe mode, and if the stored code's fingerprint has changed, startup stops.
- 🧩 **Add-ons are your own responsibility.** They run with full page permissions, so install **only ones you trust** (nothing installs itself from a shared file).
- Report vulnerabilities with exploit details privately through GitHub Security Advisories.

## Inspirations and credits

trk! draws on many rhythm games. It is an **unofficial fan project** with no relation to any of them.
trk! does not use the charts, images, audio, or names of any of those games. Built-in charts are generated automatically, except for the handmade charts (beginner, intermediate, advanced) included with the demo song "FIRST SPARK". Those were written from our own bar-structure table, and they use no chart data from other games (`tools/make-first-spark-charts.mjs`).

| trk! feature | Inspiration |
|---|---|
| Packs, skins, MOD culture, offset measurement, background dimming | osu! |
| 🪐 ORBIT path motion | Gitaroo Man's Trace Line |
| 🏁 Records per speed | A Dance of Fire and Ice's Speed Trial |
| 🎪 STAGE, PERFECT✦, curtain call | World Dai Star: Yume no Stellarium |
| 🚛 CATCH | osu!catch |
| Section repeat, judgement stats, sway | SOUND VOLTEX |
| Auto fine-tune, ghost; a whiff that does not consume the next note | beatmania IIDX |
| Dense-run hit matching (a later note becomes hittable once the earlier note's time has passed) | osu!lazer |
| Wrong colour = MISS | Taiko no Tatsujin |
| RANDOM / ANTI-ROLL | EZ2ON |
| 📻 Radio | DJMAX |
| 📡 Antenna characters (Reimu, Marisa, Cirno, Flandre, Youmu) | Touhou Project (fan-made pixel art; no official assets used) |

<details>
<summary>🤫 Hidden seeds (spoilers)</summary>

| Seed | Effect |
|---|---|
| `143` | Unlocks all hidden difficulties |
| `765` / `2000` | MASTER / 2000 RUSH |
| any seed containing `olivier`, `nightmare`, `lunatic`, or `hentai` | Unlocks MASTER |
| `20230726` / `20260929` / `curtaincall` | Curtain call (thank you for all the stages) |
| `nitro` / `buttobi` / `ぶっとばし` | CATCH stays in blast mode from start to finish (counts as practice) |

There may be more…?
</details>

## License and rights

**License:** code under **GPL-3.0-or-later**. The name "trk!" is not licensed, so please rename forks. The Hatsune Miku mascot (`js/characters/miku.js`) is fan art under the Piapro Character License (non-commercial only) and is **not** covered by the GPL. Delete that file and its `<script>` line for commercial forks. The Touhou Project antenna character skins (Reimu, Marisa, Cirno, Flandre, and Youmu, in `ANT_CHARS` of `js/fx-dock.js`) are original fan works (© Team Shanghai Alice / ZUN) following the official fan-work guidelines. No assets from the official games are used. Remove their entries for a Touhou-free build. MMD models and `.vmd` motions are normally loaded from your device, and their authors' terms apply. The redistributable Lat-style model under `assets/mmd/lat-miku/` includes its original terms and is not covered by the GPL. Songs, charts, and messages in verified packs belong to their creators.

This work depicts the character "Hatsune Miku" of Crypton Future Media, INC. under the Piapro Character License.

trk! is an unofficial fan project and is not affiliated with any of the games listed above.

## Run locally and feedback

**Run locally:** `python -m http.server 8000`, then open `http://localhost:8000`.

**Feedback:** casual thoughts on X [@ttrk143](https://x.com/ttrk143) (hashtag **#trkAGRG**), bugs and ideas on [GitHub Issues](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk/issues).
