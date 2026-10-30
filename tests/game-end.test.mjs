// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gameSource = fs.readFileSync(path.join(root, "js/game.js"), "utf8");
const mainSource = fs.readFileSync(path.join(root, "js/main.js"), "utf8");

function between(source, start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, `start marker not found: ${start}`);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(b, -1, `end marker not found: ${end}`);
  return source.slice(a, b);
}

const mediaEndLogic = between(gameSource, "/* ---------- 曲終端の扱い ---------- */", "/* ---------- 時計 ---------- */");
const tickClockLogic = between(gameSource, "function tickClock() {", "function gameTime(");
const endGameLogic = between(gameSource, "function endGame(", "/* ---------- セリフ ---------- */");

function makeContext({
  phase = "playing", duration = 20, currentTime = 20, ended = false,
  paused = true, seeking = false, leadIn = null, playMode = "manual", autoPlay = false,
} = {}) {
  const calls = { end:[], pause:0, countdown:0, shortSilence:0 };
  const core = {
    phase,
    video:{ duration, currentTime, ended, paused, seeking, playbackRate:1 },
    settings:{ rate:1, latency:0, playMode, autoPlay },
    clock:{ t:0, perf:0, lastCt:-1 },
  };
  const sandbox = {
    core,
    leadIn,
    runShort:0,
    performance:{ now:() => 1000 },
    endGame(failed = false) { calls.end.push(failed); core.phase = "ended"; },
    pauseGame() { calls.pause++; core.phase = "paused"; },
    countTick() { calls.countdown++; },
    finishLeadIn() {},
    shortSilenceWatch() { calls.shortSilence++; },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(`${mediaEndLogic}\n${tickClockLogic}\nglobalThis.handlers = { canEndGame, finishIfMediaEnded, handleVideoEnded, handleVideoPause, tickClock };`, context);
  return { core, calls, handlers:context.handlers };
}

function runEndGameWithRecordFailure() {
  const nodes = new Map();
  const shown = [], statuses = [], errors = [], emitted = [];
  const node = id => {
    if (!nodes.has(id)) {
      const value = { id, hidden:false, textContent:"", innerHTML:"", children:[], append(...children) { this.children.push(...children); } };
      if (id === "endScreen") value.querySelector = () => (value.heading ||= { textContent:"" });
      nodes.set(id, value);
    }
    return nodes.get(id);
  };
  const core = {
    phase:"playing", chart:[], stats:{ perfect:3, good:0, miss:0, crash:0, maxCombo:3, star:0, fast:0, slow:0, goodFast:0, goodSlow:0 },
    settings:{ playMode:"manual", autoPlay:false, perfectStar:false, rate:1 },
    video:{ ended:false, seeking:false, playbackRate:1 }, chartDiff:"easy", currentLevel:1, practice:false,
    currentSong:{ title:"Test song", source:"pack" }, mediaName:"test.ogg",
    $(id) { return node(id); },
    setPhase(phase) { this.phase = phase; },
    showScreen(id) { shown.push(id); },
    emit(name, ...args) { emitted.push([name, ...args]); },
    setStatus(...args) { statuses.push(args); },
    esc:text => String(text), el(_tag, _className, text) { return { textContent:text }; },
    baseName:name => name,
  };
  const sandbox = {
    core, leadIn:null, runShort:0,
    canEndGame:() => true,
    shortCleanup() {},
    modeLabel:() => "MANUAL", modeIcon:() => "",
    currentAcc:() => 100, currentScore:() => 123456,
    recordPlay() { throw new Error("storage unavailable"); },
    runMods:() => [], rateKey:() => null, rateUnranked:() => false,
    showStar:() => false, tr:key => key,
    console:{ error(...args) { errors.push(args); } },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(`${endGameLogic}\nglobalThis.runEndGame = endGame;`, context);
  context.runEndGame(false);
  return { core, nodes, shown, statuses, errors, emitted };
}

test("tickClock catches a paused terminal video before its paused/seeking early return in every mode", () => {
  const modes = ["manual", "truck", "orbit", "stage", "catch"];
  for (const playMode of modes) {
    for (const autoPlay of [false, true]) {
      const state = makeContext({
        phase:"playing", duration:20, currentTime:19.8, ended:false, paused:true,
        playMode, autoPlay,
      });
      state.handlers.tickClock();
      assert.deepEqual(state.calls.end, [false], `${playMode}${autoPlay ? " AUTO" : " MANUAL"} must finish once`);
      assert.equal(state.core.phase, "ended");
    }
  }
});

test("an ended event still opens results if the game phase was already paused", () => {
  const state = makeContext({ phase:"paused", duration:20, currentTime:20, ended:true, paused:true });
  assert.equal(state.handlers.canEndGame(false), true, "a paused game may end once media is actually ended");
  state.handlers.handleVideoEnded();
  assert.deepEqual(state.calls.end, [false]);
  assert.equal(state.core.phase, "ended");
  assert.equal(state.handlers.canEndGame(false), false, "endGame must not accept a duplicate after the transition");
});

test("a manual pause near the end waits for the real ended state", () => {
  const state = makeContext({ phase:"paused", duration:20, currentTime:19.8, ended:false, paused:true });
  assert.equal(state.handlers.canEndGame(false), false);
  assert.equal(state.handlers.finishIfMediaEnded(), false);
  assert.deepEqual(state.calls.end, []);
});

test("an ordinary mid-song pause pauses the game instead of finishing it", () => {
  const state = makeContext({ phase:"playing", duration:20, currentTime:10, ended:false, paused:true });
  state.handlers.handleVideoPause();
  assert.deepEqual(state.calls.end, []);
  assert.equal(state.calls.pause, 1);
  assert.equal(state.core.phase, "paused");
});

test("very short tracks are not mistaken for an end at time zero", () => {
  const state = makeContext({ phase:"playing", duration:.2, currentTime:0, ended:false, paused:false });
  assert.equal(state.handlers.finishIfMediaEnded(), false);
  assert.deepEqual(state.calls.end, []);
  assert.equal(state.core.phase, "playing");
});

test("a record-storage failure cannot block the visible and populated result screen", () => {
  const result = runEndGameWithRecordFailure();
  assert.deepEqual(result.shown, ["endScreen"]);
  assert.equal(result.core.phase, "ended");
  assert.equal(result.nodes.get("endScreen").heading.textContent, "finished");
  assert.match(result.nodes.get("result").innerHTML, /123,456/);
  assert.equal(result.errors.length, 1);
});

test("game.js owns ended/pause handling and keeps the result visible if record saving fails", () => {
  assert.match(gameSource, /core\.video\.addEventListener\("ended",\s*handleVideoEnded\)/);
  assert.match(gameSource, /core\.video\.addEventListener\("pause",\s*handleVideoPause\)/);
  assert.doesNotMatch(mainSource, /core\.video\.addEventListener\("(?:ended|pause)"/,
    "the event handlers should have one owner, not compete between game.js and main.js");

  const showAt = endGameLogic.indexOf('core.showScreen("endScreen")');
  const recordAt = endGameLogic.indexOf("recordPlay(");
  assert.ok(showAt >= 0 && recordAt > showAt, "show the result screen before optional record persistence");
  assert.match(endGameLogic, /try\s*\{\s*rec\s*=\s*recordPlay\(/,
    "a record/storage error must not prevent rendering the result");
});

test("the result DOM is filled before the screen event, so screen listeners (judge stats, title tier) land in it", () => {
  const resultAt = endGameLogic.indexOf('core.$("result").innerHTML');
  const showAt = endGameLogic.indexOf('core.showScreen("endScreen")');
  const recordAt = endGameLogic.indexOf("recordPlay(");
  assert.ok(resultAt >= 0 && resultAt < showAt, "render the result body before showing the screen");
  assert.ok(showAt < recordAt, "show before the record is saved (trk95 contract)");
  assert.match(endGameLogic, /core\.emit\("resultRecorded"/, "title tier is added after the record exists");
  const modesSource = fs.readFileSync(path.join(root, "js/modes.js"), "utf8");
  assert.match(modesSource, /on\("resultRecorded",/, "the title tier listener must wait for the saved record");
  assert.doesNotMatch(modesSource, /on\("screen", id => \{\s*if \(id !== "endScreen"\) return;\s*const pair = TITLE_MODES/);
});

test("the MODS line of the result reaches lifeTags across files (trk97 regression: ReferenceError left the result blank)", () => {
  /* modes.js は IIFE なので、game.js から裸の名前では届かない。公開名（window.Trk.modes）経由で呼ぶこと。
     以前は裸の lifeTags() を呼んでいたため、endGame が runMods で止まり、結果画面が出なかった。 */
  const modesSource = fs.readFileSync(path.join(root, "js/modes.js"), "utf8");
  assert.match(modesSource, /window\.Trk\.modes = Object\.assign\(window\.Trk\.modes \|\| \{\}, \{ lifeTags \}\)/,
    "modes.js must expose lifeTags on window.Trk.modes");
  assert.match(gameSource, /const runMods = \(\) => \[\.\.\.core\.activeMods\(\), \.\.\.window\.Trk\.modes\.lifeTags\(\)/,
    "runMods must call the exposed lifeTags");
  assert.doesNotMatch(gameSource, /(?<![\w.$])lifeTags\(/, "game.js must not call a bare lifeTags()");
});
