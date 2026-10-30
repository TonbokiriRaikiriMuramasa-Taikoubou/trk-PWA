# Optional tutorial demo audio

This folder contains the optional 30-second **FIRST SPARK** tutorial track (about 704 KiB) and the tiny manifest that enables its button in trk!. The MP3 is fetched only when the player/demo button is used; keeping this folder does not preload the audio.

## Handmade demo charts

`first-spark-tutorial.easy.json`, `first-spark-tutorial.normal.json` and `first-spark-tutorial.hard.json` are hand-placed charts for the demo track (27 / 54 / 111 notes over the full 30 seconds). They are ordinary `shadow-taiko-chart` JSON files, regenerated from a documented pattern table:

```sh
node tools/make-first-spark-charts.mjs           # rewrite the three files
node tools/make-first-spark-charts.mjs --check   # verify they still match the generator
```

Easy uses two notes a bar (beats 1 and 3), normal one note per beat, hard continuous 8th notes; don lands on the kick and ka on the off-beat synths, and the break bars are thinned out. **MASTER and RUSH have no bundled chart** — they keep being generated from the Seed. The charts are fetched only when the demo song is selected and the difficulty has one, so they cost nothing until used.

To ship the audio without the bundled charts (auto-generated charts for every difficulty), set `"charts": false` in `manifest.json`. A missing chart file is not an error: trk! falls back to the generated chart.

## To build a lighter, media-player-focused copy

Delete this **entire `assets/optional-demo-audio/` folder** before serving/building. The app treats it as optional: without `manifest.json`, the demo button and built-in song entry stay hidden. This does not affect local music/video playback, the media player, or the rest of the tutorial. If only the MP3 is deleted but the manifest is left behind, selecting the demo will fail gracefully and hide the missing entry.

If a browser has already cached the MP3, clearing that site's data/service-worker cache releases its cached copy. The app loads user songs locally; they are not affected by removing this folder.

To skip the tutorial in the app, open the quick guide and press **Skip**. To use trk! as a media player without starting a game, long-press the TV dock's **⏻ power** button, then load your own music folder/files.
