// SPDX-License-Identifier: GPL-3.0-or-later
/* trk164: ▶ メディアプレーヤーの新機能（⏪ スマート巻き戻し／💤 スリープタイマー強化／📌 画中画／🔆 Wake Lock）の単体テスト。
   media-analysis-limit.test.mjs と同じく、実物の関数を js/media-player-mode.js から切り出して vm で動かす。
   コピーをテスト内に持たない（本物との差が生まれるため）。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const src = fs.readFileSync(`${ROOT}/js/media-player-mode.js`, "utf8");
const coreSrc = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");
const count = (hay, needle) => hay.split(needle).length - 1;

const grab = (pattern, label) => {
  const m = src.match(pattern);
  assert.ok(m, `${label} can be isolated from js/media-player-mode.js`);
  return m[0];
};
const fnPositionKey = grab(/function mediaPositionKey\(\)[^\n]*\n/, "mediaPositionKey()");
const fnRewindSeconds = grab(/function resumeRewindSeconds\(v\)[^\n]*\n/, "resumeRewindSeconds()");
const fnRewindPosition = grab(/function rewindResumePosition\(p, seconds\) \{[\s\S]*?\n\}/, "rewindResumePosition()");
const fnPlanFade = grab(/function planSleepFade\(totalSeconds, fadeSeconds\) \{[\s\S]*?\n\}/, "planSleepFade()");
const fnSavedPosition = grab(/function savedMediaPosition\(opts = \{\}\) \{[\s\S]*?\n\}/, "savedMediaPosition()");
const fnStopSleep = grab(/function stopSleepTimer\(silent = true\) \{[\s\S]*?\n\}/, "stopSleepTimer()");
const fnRestoreVolume = grab(/function restoreSleepFadeVolume\(\) \{[\s\S]*?\n\}/, "restoreSleepFadeVolume()");
const fnSetSleep = grab(/(?:async )?function setSleep\(minutes\) \{[\s\S]*?\n\}/, "setSleep()");   /* trk170: setSleep は async（「チャプターの終わり」で await するため）。async 前置ごと抜き出す */
const fnEnded = grab(/function endedMedia\(\) \{[\s\S]*?\n\}/, "endedMedia()");
const fadeConst = grab(/const SLEEP_FADE_SECONDS = [^;]+;/, "SLEEP_FADE_SECONDS");

/* ---------- ⏪ スマート巻き戻し：純関数 ---------- */
function positionSandbox({ saved, duration, rewind, fingerprint = "k1", songKey = null }) {
  const sandbox = {
    core: {
      video: { duration },
      settings: { mediaResumeRewind: rewind },
      fingerprint,
      currentSong: songKey ? { key: songKey } : null,
    },
    mediaPositions: saved,
    window: {},
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext([
    fnPositionKey, fnRewindSeconds, fnRewindPosition, fnPlanFade, fnSavedPosition,
    "window.__saved = savedMediaPosition;",
    "window.__rewindPosition = rewindResumePosition;",
    "window.__rewindSeconds = resumeRewindSeconds;",
    "window.__planFade = planSleepFade;",
  ].join("\n"), sandbox, { filename: "js/media-player-mode.js#resume" });
  return sandbox.window;
}

test("resumeRewindSeconds() floors, clamps to 0–30 and rejects junk", () => {
  const api = positionSandbox({ saved: {}, duration: 100, rewind: 0 });
  assert.equal(api.__rewindSeconds(0), 0);
  assert.equal(api.__rewindSeconds("5"), 5);
  assert.equal(api.__rewindSeconds(2.9), 2);
  assert.equal(api.__rewindSeconds(31), 30);
  assert.equal(api.__rewindSeconds(-2), 0);
  assert.equal(api.__rewindSeconds(NaN), 0);
  assert.equal(api.__rewindSeconds(undefined), 0);
});

test("rewindResumePosition() rewinds only when armed and floors at 0", () => {
  const api = positionSandbox({ saved: {}, duration: 100, rewind: 0 });
  assert.equal(api.__rewindPosition(100, 5), 95);
  assert.equal(api.__rewindPosition(100, 0), 100, "setting 0 keeps the exact position");
  assert.equal(api.__rewindPosition(6, 5), 1);
  assert.equal(api.__rewindPosition(3, 5), 0, "never goes negative");
  assert.equal(api.__rewindPosition(0, 5), 0);
  assert.equal(api.__rewindPosition("abc", 5), 0);
  assert.equal(api.__rewindPosition(100.44, 5), 95.4, "keeps 0.1s rounding");
  assert.equal(api.__rewindPosition(100, -3), 100, "invalid seconds behave as off");
});

test("savedMediaPosition() applies the rewind only for resume and keeps the >5s guards", () => {
  const base = { saved: { k1: 100 }, duration: 400, rewind: 5 };
  const api = positionSandbox(base);
  assert.equal(api.__saved(), 100, "plain read is untouched (pause-resume must not rewind)");
  assert.equal(api.__saved({ resume: true }), 95);
  assert.equal(positionSandbox({ ...base, rewind: 0 }).__saved({ resume: true }), 100);
  assert.equal(positionSandbox({ ...base, saved: { k1: 4 } }).__saved({ resume: true }), 0, "positions ≤5s are dropped as before");
  assert.equal(positionSandbox({ ...base, duration: 104 }).__saved({ resume: true }), 0, "too close to the end is dropped as before");
  assert.equal(positionSandbox({ ...base, saved: { k1: 6 } }).__saved({ resume: true }), 1, "rewind near the start floors at 0… (6-5=1)");
  const bySong = positionSandbox({ saved: { s1: 50 }, duration: 200, rewind: 10, fingerprint: "", songKey: "s1" });
  assert.equal(bySong.__saved({ resume: true }), 40, "falls back to the song key like the plain reader");
});

/* ---------- 💤 スリープ：フェード計画 ---------- */
test("planSleepFade() schedules a fade only when it fits before the stop", () => {
  const api = positionSandbox({ saved: {}, duration: 100, rewind: 0 });
  const plan = api.__planFade(900, 15);   // vm 越しのオブジェクトは別レルム → フィールドごとに見る
  assert.equal(plan.startAfter, 885);
  assert.equal(plan.fade, 15);
  assert.equal(api.__planFade(10, 15), null, "fade longer than the timer is refused");
  assert.equal(api.__planFade(900, 900), null);
  assert.equal(api.__planFade(900, 0), null);
  assert.equal(api.__planFade(0, 15), null);
  assert.equal(api.__planFade(NaN, 15), null);
});

/* ---------- 💤 スリープ：setSleep／stopSleepTimer（偽タイマー） ---------- */
function sleepHarness(opts = {}) {
  const state = {
    videoReady: opts.videoReady !== false,
    volume: opts.volume ?? 0.8,
    musicVolume: opts.musicVolume ?? 0.8,
    paused: 0,
    toasts: [],
    renders: 0,
  };
  const timers = { timeouts: [], intervals: [], nextId: 1 };
  const sandbox = {
    core: {
      get videoReady() { return state.videoReady; },
      video: {
        get volume() { return state.volume; },
        set volume(v) { state.volume = v; },
        pause() { state.paused++; },
      },
      settings: { get musicVolume() { return state.musicVolume; } },
    },
    reverseActive: !!opts.reverseActive,
    reverseGain: null,
    window: { Trk: { play: { showToast: m => state.toasts.push(m) } } },
    showToast: () => {},
    tr: (key, vars) => vars ? `${key}:${JSON.stringify(vars)}` : key,
    renderMedia: () => { state.renders++; },
    Date: { now: () => 1000000 },
    setTimeout: (fn, ms) => {
      const id = timers.nextId++;
      const rec = { id, ms, cleared: false, fired: false, fn: () => { rec.fired = true; fn(); } };
      timers.timeouts.push(rec);
      return id;
    },
    clearTimeout: id => { const t = timers.timeouts.find(x => x.id === id); if (t) t.cleared = true; },
    setInterval: (fn, ms) => { const id = timers.nextId++; timers.intervals.push({ id, fn, ms, cleared: false }); return id; },
    clearInterval: id => { const t = timers.intervals.find(x => x.id === id); if (t) t.cleared = true; },
    Number, Math, console,
  };
  vm.createContext(sandbox);
  vm.runInContext(`
let sleepTimer = 0, sleepUntil = 0, sleepTrackMode = false, sleepChapterEnd = 0, sleepFadeArm = 0, sleepFadeTimer = 0, sleepFadeBase = 1;
${fadeConst}
${fnPlanFade}
${fnRestoreVolume}
${fnStopSleep}
${fnSetSleep}
window.__setSleep = setSleep;
window.__stop = stopSleepTimer;
window.__state = () => ({ sleepTimer, sleepUntil, sleepTrackMode, sleepFadeArm, sleepFadeTimer });
`, sandbox, { filename: "js/media-player-mode.js#sleep" });
  const live = () => timers.timeouts.filter(t => !t.cleared && !t.fired);
  const liveIntervals = () => timers.intervals.filter(t => !t.cleared);
  return { state, timers, live, liveIntervals, setSleep: sandbox.window.__setSleep, stop: sandbox.window.__stop, snap: sandbox.window.__state };
}

test("setSleep(-1) arms “end of this track” without any timer", () => {
  const h = sleepHarness();
  h.setSleep(-1);
  assert.equal(h.snap().sleepTrackMode, true);
  assert.deepEqual(h.state.toasts, ["mediaSleepTrackSet"]);
  assert.equal(h.live().length, 0, "no timeouts: endedMedia() handles the stop");
  h.setSleep("-1");
  assert.equal(h.snap().sleepTrackMode, true, "the select may pass the value as a string");
});

test("setSleep(15) keeps one stop timeout plus a fade that starts 15s before it", () => {
  const h = sleepHarness({ volume: 0.8 });
  h.setSleep(15);
  const st = h.snap();
  assert.equal(st.sleepTrackMode, false);
  assert.equal(st.sleepUntil, 1000000 + 15 * 60000);
  assert.deepEqual(h.state.toasts, ['mediaSleepSet:{"n":15}']);
  const pending = h.live().sort((a, b) => a.ms - b.ms);
  assert.deepEqual(pending.map(t => t.ms), [(15 * 60 - 15) * 1000, 15 * 60 * 1000], "fade-arm then stop");

  pending[0].fn();                       // 14:45 → フェード開始
  assert.equal(h.liveIntervals().length, 1);
  const step = h.liveIntervals()[0];
  assert.equal(step.ms, 1000);
  step.fn();
  assert.ok(h.state.volume < 0.8 && h.state.volume > 0, "volume steps down but never below 0");
  step.fn();
  assert.ok(h.state.volume < 0.75, "keeps fading");

  pending[1].fn();                       // 15:00 → 停止
  assert.equal(h.state.paused, 1);
  assert.equal(h.state.volume, 0.8, "volume is restored so the next playback is not silent");
  assert.equal(h.snap().sleepUntil, 0);
  assert.equal(h.liveIntervals().length, 0, "fade interval is cleared with the stop");
  assert.equal(h.state.toasts.at(-1), "mediaSleepDone");
});

test("stopSleepTimer() cancels the fade, restores volume and clears the track flag", () => {
  const h = sleepHarness({ volume: 0.8 });
  h.setSleep(15);
  h.live().sort((a, b) => a.ms - b.ms)[0].fn();
  h.liveIntervals()[0].fn();
  assert.ok(h.state.volume < 0.8);
  h.stop(true);
  assert.equal(h.state.volume, 0.8, "mid-fade cancel puts the volume back");
  assert.equal(h.liveIntervals().length, 0);
  assert.equal(h.live().length, 0, "the stop timeout is cleared too");
  assert.equal(h.snap().sleepTrackMode, false);
  assert.equal(h.state.paused, 0, "cancelling never pauses");

  h.setSleep(-1);
  h.stop(true);
  assert.equal(h.snap().sleepTrackMode, false, "closing the player disarms “end of track”");
});

test("the fade stays away while reverse playback owns the volume, and short timers skip it", () => {
  const rev = sleepHarness({ reverseActive: true });
  rev.setSleep(15);
  rev.live().sort((a, b) => a.ms - b.ms)[0].fn();
  assert.equal(rev.liveIntervals().length, 0, "reverse playback manages its own gain");

  const short = sleepHarness();
  short.setSleep(0.1);                   // 6秒：15秒フェードは入りきらない
  const pending = short.live();
  assert.equal(pending.length, 1, "stop timeout only");
  pending[0].fn();
  assert.equal(short.state.paused, 1);
  assert.equal(short.state.toasts.at(-1), "mediaSleepDone");
});

/* ---------- 💤 endedMedia()：この曲の終わり ＞ リピート／シャッフル ---------- */
function endedHarness({ track = false, chapter = false, repeat = "off", shuffle = false } = {}) {
  const state = { paused: 0, cleared: 0, steps: 0, plays: 0, stopped: 0, toasts: [] };
  const sandbox = {
    mediaActive: () => true,
    repeatMode: repeat,
    shuffle,
    saveMediaPosition: clear => { if (clear) state.cleared++; },
    stopSleepTimer: () => { state.stopped++; },
    stepMedia: dir => { state.steps += dir; },
    core: { video: { currentTime: 10, pause() { state.paused++; }, play() { state.plays++; return { catch() {} }; } } },
    window: { Trk: { play: { showToast: m => state.toasts.push(m) } } },
    showToast: () => {},
    tr: key => key,
    renderMedia: () => {},
    updateMediaSession: () => {},
    noteMediaPlay: () => { state.noted = (state.noted || 0) + 1; },   /* 🎧 trk172: endedMedia counts a finished listen first */
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(`let sleepTrackMode = ${track}, sleepChapterEnd = ${chapter ? 60 : 0}, mediaPlayNotedKey = "";\n${fnEnded}\nwindow.__ended = endedMedia;`, sandbox,
    { filename: "js/media-player-mode.js#ended" });
  return { state, ended: sandbox.window.__ended };
}

test("sleep “end of track” outranks repeat-one and shuffle, clears the resume position and stops", () => {
  const h = endedHarness({ track: true, repeat: "one", shuffle: true });
  h.ended();
  assert.equal(h.state.cleared, 1, "resume position is cleared so the next open starts fresh");
  assert.equal(h.state.stopped, 1);
  assert.equal(h.state.paused, 1);
  assert.equal(h.state.plays, 0, "repeat-one must not restart");
  assert.equal(h.state.steps, 0, "shuffle must not skip ahead");
  assert.deepEqual(h.state.toasts, ["mediaSleepDone"]);
});

test("without the track flag endedMedia() keeps the classic repeat/shuffle behaviour", () => {
  const one = endedHarness({ repeat: "one" });
  one.ended();
  assert.equal(one.state.plays, 1);
  assert.equal(one.state.paused, 0);

  const all = endedHarness({ repeat: "all" });
  all.ended();
  assert.equal(all.state.steps, 1);

  const off = endedHarness({});
  off.ended();
  assert.equal(off.state.cleared, 1);
  assert.equal(off.state.steps, 0);
  assert.equal(off.state.paused, 0);
});

test("🔖 sleep “end of chapter” (trk170): the guard in endedMedia() outranks repeat/shuffle like the track flag", () => {
  const h = endedHarness({ chapter: true, repeat: "one", shuffle: true });
  h.ended();
  assert.equal(h.state.paused, 1, "stops");
  assert.equal(h.state.cleared, 1, "the resume position is cleared");
  assert.equal(h.state.stopped, 1, "stopSleepTimer() runs");
  assert.equal(h.state.steps, 0, "repeat/shuffle do not advance the queue");
  assert.equal(h.state.plays, 0);
  assert.equal(h.state.noted, 1, "🎧 trk172: the finished listen is counted before the sleep guard");
  assert.deepEqual(h.state.toasts, ["mediaSleepDone"]);
});

/* ---------- 登録もれ防止：TEXT 4言語・core.js・sw.js・配線 ---------- */
test("every new UI string exists in all four languages", () => {
  const keys = ["mediaPip", "mediaPipClose", "mediaPipUnsupported",
    "mediaResumeRewind", "mediaResumeOff", "mediaResumeSet",
    "mediaSleepTrack", "mediaSleepTrackSet",
    "mediaWakeLockTitle", "mediaWakeLockHint", "mediaWakeLockToggle"];
  for (const key of keys) {
    assert.equal(count(src, `${key}:`), 4, `${key} must appear once per language block (ja/en/zh/ko)`);
  }
});

test("the new settings are sanitized and reset in core.js", () => {
  assert.ok(coreSrc.includes("mediaResumeRewind: pick(prefs.mediaResumeRewind, [0, 3, 5, 10, 15, 30], 0)"), "resume rewind is enum-sanitized");
  assert.ok(coreSrc.includes("mediaWakeLock: prefs.mediaWakeLock !== false"), "wake lock defaults to on");
  assert.equal(count(coreSrc, "settings.mediaResumeRewind = 0"), 2, "reset in resetVideoPrefs and resetAllPrefs");
  assert.equal(count(coreSrc, "settings.mediaWakeLock = true"), 2, "reset in resetVideoPrefs and resetAllPrefs");
});

test("player wiring: PiP button in the controls row, resume-aware seeks, exported helpers", () => {
  assert.ok(src.includes("controls.append(prev, playNode, next, reverseNode, maxNode, pipNode, wallNode, restart)"), "📌 sits between full screen and wallpaper");
  assert.equal(count(src, "savedMediaPosition({ resume: true })"), 2, "playSong() and openMedia() rewind on resume");
  assert.ok(src.includes("core.video.paused || core.video.ended"), "openMedia() only seeks while not playing");
  assert.ok(src.includes("resumeRewindSeconds, rewindResumePosition, planSleepFade, pipSupported, wakeLockSupported"), "pure helpers are exported for tests");
  assert.ok(src.includes("updateWakeLock();   /* 🔆 再生状態に合わせて取得／解放"), "the 250ms tick maintains the wake lock");
  /* sw.js の cache 版数はリリースごとに進むので、ここでは固定しない（check-repo.mjs が確認する） */
});
