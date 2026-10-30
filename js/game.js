(() => {
  const core = window.Trk.core;
// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ trk! 統合版：ゲーム進行・判定・時計・プレイ記録 ============
   対応：カウントダウン・MOD・MANUAL／TRUCK／ORBIT／STAGE／CATCH・AUTO（全モードと組み合わせ）
         体力・速度別記録・PERFECT✦・判定の平均とばらつき（extras.js が表示）
   再生速度：1.00x＝通常のハイスコア／1.05x以上＝速度ごとに別記録＋🏁最高クリア速度／1.00x未満＝練習扱い */
"use strict";

let runPaused = false, runLifeMode = "standard", runRadioUsed = false, runAutoUsed = false;

/* ---------- 記録の対象外 ---------- */
const rateKey = () => core.settings.rate !== 1 ? core.settings.rate.toFixed(2) : null;
const rateUnranked = () => core.modsUnranked();                                   // ゆるめ判定・1.00x未満
const runUnranked = () => core.practice || rateUnranked() || !!core.settings.autoPlay || runAutoUsed;  // AUTOも記録・称号の対象外
core.on("options", () => {
  if (core.phase !== "playing") return;
  if (core.settings.autoPlay) runAutoUsed = true;
  if (core.settings.radio) runRadioUsed = true;
});

/* ---------- カウントダウン（3・2・1・GO!） ---------- */
let leadIn = null, goAt = 0, pausedInLeadIn = false, autoplayBlocked = false;
function countIv() {
  const b = (core.chartMeta.bpm || 0) * core.settings.rate;
  return b ? Math.min(1000, Math.max(350, 60000 / b)) : 750;
}
function countTick(k) {
  if (!core.settings.countdownSE) return;
  const ac = window.Trk.media.getAC(); if (!ac) return;
  if (ac.state === "suspended") ac.resume();
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), go = k >= 3;
  o.type = "square"; o.frequency.value = go ? 1320 : 880;
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(.002, core.settings.seVolume * .5), t + .005);
  g.gain.exponentialRampToValueAtTime(.0001, t + (go ? .25 : .09));
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .3);
}
function beginLeadIn(resume) {
  const iv = countIv(), p = performance.now();
  leadIn = { start:p, end:p + 3 * iv, iv, resume, last:-1 };
  core.clock = resume ? { t:core.video.currentTime * 1000, perf:p, lastCt:-1 }
                 : { t:-3 * iv * core.settings.rate, perf:p, lastCt:-1 };
}
function finishLeadIn() {
  const was = leadIn; leadIn = null; goAt = performance.now();
  countTick(3);
  core.clock = { t:was.resume ? core.video.currentTime * 1000 : 0, perf:goAt, lastCt:-1 };
  core.video.playbackRate = core.settings.rate;
  core.video.play().catch(() => { autoplayBlocked = true; pauseGame(); });
}

/* ---------- 🕹️ ショートプレイ（長い曲の後半だけ遊ぶ。クリア判定は通常どおり出す） ---------- */
const SHORT_LENS = { "90": 90, "120": 120, "180": 180 };
let runShort = 0, runNoteTotal = 0, shortAn = null, shortSilenceSince = 0;
function shortLenActive() {   /* AUTOのときはフルプレイ（AUTOはseed探しなので） */
  return !core.settings.autoPlay && SHORT_LENS[core.settings.shortMode] ? SHORT_LENS[core.settings.shortMode] : 0;
}
function shortStart(len) {   /* 後半◯秒の開始位置（曲が短ければ頭から） */
  const d = isFinite(core.video.duration) ? core.video.duration : len;
  return Math.max(0, Math.min(d - len, d));
}
function shortSilenceWatch() {   /* 終盤の無音を検知したらそこで終了（8秒くらい余白のある曲がある） */
  if (!runShort || core.phase !== "playing" || !isFinite(core.video.duration)) return;
  if (core.video.duration - core.video.currentTime > 14) { shortSilenceSince = 0; return; }   /* 見るのは終盤だけ */
  if (!shortAn && window.TrkFX && TrkFX.tap) shortAn = TrkFX.tap(512);   /* 1回だけ作って使い回す（fxが無効なら検知なし） */
  if (!shortAn) return;
  const buf = new Uint8Array(shortAn.frequencyBinCount);
  shortAn.getByteFrequencyData(buf);
  let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i];
  if (sum > buf.length * 4) { shortSilenceSince = 0; return; }   /* 音がある */
  const now = performance.now();
  if (!shortSilenceSince) { shortSilenceSince = now; return; }
  if (now - shortSilenceSince > 2200 && core.video.currentTime > 10) {   /* 2.2秒ずっと無音＝曲の終わり */
    shortSilenceSince = 0;
    endGame(false);
    core.video.pause();
  }
}
function shortCleanup() { if (shortAn) { try { shortAn.disconnect(); } catch (_) {} shortAn = null; } shortSilenceSince = 0; }

/* ---------- 進行 ---------- */
function resetRun() {
  runPaused = false;
  runLifeMode = core.settings.lives || "standard";
  runRadioUsed = !!core.settings.radio;
  runAutoUsed = !!core.settings.autoPlay;
  const rand = core.settings.modRandom ? core.mulberry32(core.hashString(`trkRand|${core.$("seed")?.value || 0}|${core.chartDiff}|${core.chart.length}`)) : null;
  core.chart.forEach(n => {
    n.judged = false; n.result = null;
    if (n.origLane == null) n.origLane = n.lane;
    let l = n.origLane;
    if (core.settings.modMirror) l = 1 - l;
    if (core.settings.modRandom && rand) l = rand() < 0.5 ? 0 : 1;
    n.lane = l;
  });
  core.nextIdx = 0;
  runShort = shortLenActive(); runNoteTotal = core.chart.length; shortCleanup();
  if (runShort) {   /* 🕹️ 窓より前のノーツはスキップ（スコアの分母にも入れない） */
    const st = shortStart(runShort) * 1000 - core.settings.latency;
    while (core.nextIdx < core.chart.length && core.chart[core.nextIdx].time < st) { core.chart[core.nextIdx].judged = true; core.chart[core.nextIdx].result = "skip"; core.nextIdx++; }
    runNoteTotal = core.chart.length - core.nextIdx;
  }
  core.stats = { perfect:0, good:0, miss:0, combo:0, maxCombo:0, star:0, fast:0, slow:0, goodFast:0, goodSlow:0, crash:0, errN:0, errSum:0, errSq:0, blastBonus:0 };
  core.practice = false; core.effects = []; core.errors = []; core.caption = null; core.lastMissT = -1e9;
  leadIn = null; goAt = 0; pausedInLeadIn = false; autoplayBlocked = false;
  resetTruck(); resetLives(); resetOrbit();
  if (core.settings.autoPlay) { lifeState.max = 0; lifeState.hp = 0; }   // AUTOには体力はありません
  if (typeof resetStage === "function") resetStage();
  if (typeof resetCatch === "function") resetCatch();
  updateHud();
}
async function startGame() {
  if (!core.videoReady || !core.chart.length) return;
  core.emit("beforePlay");
  const ac = window.Trk.media.getAC(); if (ac && ac.state === "suspended") ac.resume();
  if (core.phase === "playing" || core.phase === "paused") core.video.pause();
  resetRun();
  core.video.playbackRate = core.settings.rate;
  try { core.video.currentTime = runShort ? shortStart(runShort) : 0; } catch (_) {}
  if (document.activeElement) document.activeElement.blur();
  core.$("endScreen").querySelector("h2").textContent = tr("finished");
  if (core.settings.countdown) {
    core.video.volume = 0;
    try { await core.video.play(); core.video.pause(); } catch (_) {}
    try { core.video.currentTime = runShort ? shortStart(runShort) : 0; } catch (_) {}
    core.video.volume = core.settings.musicVolume;
    core.showScreen(null); core.setPhase("playing");
    beginLeadIn(false);
    if (typeof poke === "function") poke();
    setCaption("capStart", null, 0);
    return;
  }
  core.video.volume = core.settings.musicVolume;
  core.clock = { t:0, perf:performance.now(), lastCt:-1 };
  core.showScreen(null); core.setPhase("playing");
  if (typeof poke === "function") poke();
  try { await core.video.play(); }
  catch (_) { core.setPhase("title"); core.showScreen("selectScreen"); core.setStatus("loadStatus", "playError"); return; }
  setCaption("capStart", null, 0);
}
function pauseGame() {
  if (core.phase !== "playing") return;
  runPaused = true;
  pausedInLeadIn = !!(leadIn && !leadIn.resume);
  leadIn = null;
  core.setPhase("paused"); core.video.pause(); core.setStatus("pauseStatus", null); core.showScreen("pauseScreen");
}
async function resumeGame() {
  if (core.phase !== "paused") return;
  core.showScreen(null); core.setPhase("playing");
  if (typeof poke === "function") poke();
  if (pausedInLeadIn) { pausedInLeadIn = false; beginLeadIn(false); return; }
  if (core.settings.resumeCountdown && !autoplayBlocked) { beginLeadIn(true); return; }
  autoplayBlocked = false;
  core.video.playbackRate = core.settings.rate;
  try { await core.video.play(); } catch (_) { pauseGame(); }
}
function toTitle() {
  leadIn = null; pausedInLeadIn = false;
  core.video.pause();
  core.video.playbackRate = 1;
  try { core.video.currentTime = 0; } catch (_) {}
  core.setPhase("title");
  core.showScreen("selectScreen"); core.renderAllStatuses();
}
function failGame() {
  if (core.phase !== "playing") return;
  leadIn = null;
  failSound();
  endGame(true);
  core.video.pause();
}

/* ---------- スコア ---------- */
function currentScore() { const total = runNoteTotal || core.chart.length || 1, points = core.stats.perfect + core.stats.good * .5, bonus = (core.stats.blastBonus || 0) * .1; return Math.min(1e6, Math.round(1e6 * (points + bonus) / total)); }   /* 🕹️ ショートは窓内のノーツ数で割る */
function currentAcc() { const j = core.stats.perfect + core.stats.good + core.stats.miss; return j ? (core.stats.perfect + core.stats.good * .5) / j * 100 : 100; }
function updateHud() {
  core.$("scoreVal").textContent = currentScore().toLocaleString();
  core.$("comboVal").textContent = core.stats.combo;
  core.$("accVal").textContent = currentAcc().toFixed(2) + "%";
}
const MODE_LABEL = { truck:"truckPlay", orbit:"orbitPlay", stage:"stagePlay", catch:"catchPlay" };
const MODE_ICON = { truck:"🚚", orbit:"🪐", stage:"🎪", catch:"🚛" };
const modeLabel = () => tr(MODE_LABEL[core.settings.playMode] || "manualPlay") + (core.settings.autoPlay || runAutoUsed ? " · " + tr("autoPlay") : "");
const modeIcon = m => MODE_ICON[m] || "";
const runMods = () => [...core.activeMods(), ...window.Trk.modes.lifeTags(),
  ...(core.settings.playMode === "catch" && core.settings.catchNitroBonus && core.stats.blastBonus > 0 ? ["NITRO×1.1"] : []),
  ...(core.settings.playMode === "stage" && core.settings.stageMirror && !core.settings.modMirror ? ["MIRROR"] : []),
  ...(core.settings.playMode === "stage" && core.settings.stageRandom === "random" && !core.settings.modRandom ? ["RANDOM"] : []),
  ...(core.settings.autoPlay || runAutoUsed ? ["AUTO"] : [])];
const showStar = () => core.settings.perfectStar !== false;

/* ---------- リザルト ---------- */
function endGame(failed = false) {
  if (!canEndGame(failed)) return;
  for (const n of core.chart) if (!n.judged) { n.judged = true; n.result = "miss"; core.stats.miss++; }
  shortCleanup();
  core.setPhase("ended");
  core.video.playbackRate = 1;
  core.$("endScreen").querySelector("h2").textContent = tr(failed ? "failed" : "finished");
  const mode = core.settings.playMode, icon = modeIcon(mode);
  const acc = currentAcc(), score = currentScore(), clean = !failed && !(core.stats.crash > 0);   // CATCHでぶつかったらFCなし
  const ap = clean && core.stats.perfect > 0 && core.stats.good === 0 && core.stats.miss === 0;
  const fc = clean && core.stats.miss === 0 && core.stats.perfect + core.stats.good > 0;
  const grade = failed ? "F" : ap ? "SS" : acc >= 95 ? "S" : acc >= 90 ? "A" : acc >= 80 ? "B" : acc >= 70 ? "C" : "D";

  /* 表示の順序（trk96）：
     ① 結果の本体を描く　② 画面を出す（screen の聞き手＝判定の平均・公認・ゴースト等は、描かれた結果へ足す）
     ③ 記録を保存する（失敗しても①②は済んでいる）　④ 記録で決まる行（自己ベスト・クレジットの ⭐）と称号を埋める。
     ②より前に記録すると、画面の聞き手が直前の曲の履歴を見てしまう。 */
  const shTag = runShort ? ` 🕹️${runShort}s` : "";
  const bestHtmlOf = rec => {
    let html = "";
    if (rec.chart) {
      const star = rec.chart.ap ? ` ${icon}⭐` : "";
      const rk = rateKey() ? ` (${rateKey()}x)` : "";
      if (rec.isNew) html = `<div class="best new">${core.esc(tr("newBest"))}${rk}${star}${shTag}</div>`;
      else if (rec.prev) html = `<div class="best">${core.esc(tr("best"))}${rk}${shTag}: ${Number(rec.prev.score).toLocaleString()} · ${Number(rec.prev.acc).toFixed(2)}%${star}</div>`;
      if (rec.newSpeed) html += `<div class="best new">${core.esc(tr("newSpeed", { r:core.settings.rate.toFixed(2) + "x" }))}</div>`;
      html += `<div class="best">${core.esc(tr("recPlayCount", { n:rec.plays }))}</div>`;
    }
    return html;
  };
  const meta = [modeLabel(), tr(core.chartDiff), `${tr("level")}${core.currentLevel} ${tr("estimate")}`];
  if (runShort) meta.push(tr("shortTag", { n: runShort }));   /* 🕹️ 称号はモードを問わずこの絵文字で統一 */
  const mods = runMods();
  if (mods.length) meta.push(`${tr("modsLabel")}: ${mods.join(" ")}`);
  if (failed) meta.push(tr("failedNote"));
  else if (core.settings.autoPlay) {}
  else if (core.practice) meta.push(tr("practice"));
  else if (rateUnranked()) meta.push(tr("unrankedNote"));
  else if (rateKey()) meta.push(tr("rateRecordNote"));
  const apKey = { truck:"truckAllPerfect", orbit:"orbitAllPerfect", stage:"stageAllPerfect", catch:"catchAllPerfect" }[mode] || "allPerfect";
  const fcKey = { truck:"truckFullCombo", orbit:"orbitFullCombo", stage:"stageFullCombo", catch:"catchFullCombo" }[mode] || "fullCombo";
  const badges = failed ? `<span class="badge" style="background:#8a1c2b;color:#fff">${core.esc(tr("failed"))}</span>`
               : core.settings.autoPlay ? `<span class="badge">▶ AUTO</span>`
               : ap ? `<span class="badge">${core.esc(tr(apKey))}</span>`
               : fc ? `<span class="badge">${core.esc(tr(fcKey))}</span>` : "";
  const starHtml = showStar() ? `<small style="display:block;font-size:14px;opacity:.85">${core.esc(tr("starCount", { n:core.stats.star || 0 }))}</small>` : "";
  core.$("result").innerHTML = `
    <div class="gradeRow"><div class="grade" aria-label="${core.esc(tr("grade"))}">${grade}</div>
      <div style="text-align:left"><div class="bigScore">${score.toLocaleString()}</div>
        <div class="hint">${core.esc(meta.join(" · "))}</div><div class="badges">${badges}</div></div></div>
    <div class="statGrid">
      <div><span>${core.esc(tr("accuracy"))}</span><b>${acc.toFixed(2)}%</b></div>
      <div><span>${core.esc(tr("maxCombo"))}</span><b>${core.stats.maxCombo}</b></div>
      <div class="p"><span>${core.esc(tr("perfect"))}</span><b>${core.stats.perfect}</b>${starHtml}</div>
      <div><span>${core.esc(tr("good"))}</span><b>${core.stats.good}</b></div>
      <div class="m"><span>${core.esc(tr("miss"))}</span><b>${core.stats.miss}</b></div>
    </div>
    <div class="fastSlowRow">
      <div class="fsBadge fastBadge"><span class="fsLabel">FAST</span><b class="fsVal">${core.stats.fast || 0}</b>${core.stats.goodFast ? `<small class="fsSub">(${core.esc(tr("good"))} ${core.stats.goodFast})</small>` : ""}</div>
      <div class="fsBadge slowBadge"><span class="fsLabel">SLOW</span><b class="fsVal">${core.stats.slow || 0}</b>${core.stats.goodSlow ? `<small class="fsSub">(${core.esc(tr("good"))} ${core.stats.goodSlow})</small>` : ""}</div>
    </div>`;
  const bestBox = core.el("div", "resultBest");   /* 記録の後で埋める */
  core.$("result").append(bestBox);
  const cr = core.$("credits"); cr.textContent = "";   /* 公認の欄は screen の聞き手が先頭に入れる */
  core.setStatus("endStatus", null);   /* 自動微調整の文言（screen の聞き手が出す）を消さないよう、画面を出す前に */
  core.showScreen("endScreen");

  let rec = {};
  try { rec = recordPlay({ score, acc, grade, ap, fc, failed, short: runShort || 0 }) || {}; }
  catch (e) { console.error("Could not save the play record:", e); }
  bestBox.innerHTML = bestHtmlOf(rec);
  const song = core.currentSong || {};
  cr.append(core.el("div", "", `♪ ${song.title || core.baseName(core.mediaName)}${rec.chart && rec.chart.ap ? ` ${icon}⭐` : ""}`));
  if (song.artist) cr.append(core.el("div", "", `${tr("songBy")}: ${song.artist}`));
  if (song.charter) cr.append(core.el("div", "", `${tr("chartBy")}: ${song.charter}`));
  if (song.license) cr.append(core.el("div", "", `${tr("songLicense")}: ${song.license}`));
  if (song.source !== "pack") cr.append(core.el("div", "", tr("creditNote")));
  core.emit("resultRecorded", rec);   /* 🏅 称号（記録の後の履歴で決める） */
}

/* ---------- セリフ ---------- */
function setCaption(key, vars, speaker) {
  const m = core.activeMascot(), fam = m ? window.Trk.data.MASCOT_FAMILY[m] : null;
  const pc = (typeof packRuntime !== "undefined" && packRuntime.captions) || null;
  const own = (pc && pc[key]) || (fam && window.Trk.data.MASCOT_CAPTIONS[fam] && window.Trk.data.MASCOT_CAPTIONS[fam][key]) || (core.skin().captions && core.skin().captions[key]);
  let text = own ? (own[lang] || own.en || Object.values(own)[0]) : tr(key);
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  core.caption = { text, speaker, t:performance.now() };
}

/* ---------- 判定 ---------- */
let autoJudging = false;   // AUTOの処理から判定しているときだけ true
function showJudge(kind, delta, star) {
  const n = core.$("judge");
  core.$("judgeText").textContent = tr(kind) + (star && showStar() ? "✦" : "");
  const sub = core.$("judgeSub");
  if (kind !== "perfect" && delta != null) {
    const isEarly = delta < 0;
    sub.textContent = tr(isEarly ? "early" : "late");
    sub.className = isEarly ? "early" : "late";
  } else {
    sub.textContent = "";
    sub.className = "";
  }
  n.className = ""; void n.offsetWidth; n.className = `show ${kind}`;
}
function judgeHitPos(n) {
  if (isOrbit()) return orbitHitPos(n);
  if (isStage()) return stageHitPos(n);
  if (typeof isCatch === "function" && isCatch()) return catchHitPos(n);
  return hitPos(layout(), n.lane);
}
function judgeNote(n, kind, delta) {
  if (core.phase !== "playing") return;
  if (core.settings.autoPlay && !autoJudging && kind !== "miss") return;   // AUTO中は、キー・タップでは判定しない
  n.judged = true; n.result = kind;
  const star = kind === "perfect" && delta != null && Math.abs(delta) <= core.windows().perfect * .5;   // PERFECT✦
  if (kind === "miss") {
    core.stats.miss++;
    core.lastMissT = performance.now();
    if (core.stats.combo >= 20) setCaption("capBreak", null, 0);
    core.stats.combo = 0;
  } else {
    core.stats[kind]++; core.stats.combo++; core.stats.maxCombo = Math.max(core.stats.maxCombo, core.stats.combo);
    if (star) core.stats.star++;
    if (delta != null) {
      if (delta < -3) core.stats.fast = (core.stats.fast || 0) + 1;
      else if (delta > 3) core.stats.slow = (core.stats.slow || 0) + 1;
      if (kind === "good") {
        if (delta < 0) core.stats.goodFast = (core.stats.goodFast || 0) + 1;
        else core.stats.goodSlow = (core.stats.goodSlow || 0) + 1;
      }
    }
    const hp = judgeHitPos(n);
    core.effects.push({ x:hp.x, y:hp.y, c:core.laneColor(n.lane), t:performance.now(), kind, seed:Math.random() * window.Trk.data.TAU });
    core.avatarHit[n.lane] = performance.now();
    if (core.stats.combo % 50 === 0) setCaption("capCombo", { n:core.stats.combo }, 1);
    if (delta != null && !core.settings.autoPlay) { core.stats.errN++; core.stats.errSum += delta; core.stats.errSq += delta * delta; }   // 平均とばらつき
  }
  if (delta != null && kind !== "miss" && ["manual", "orbit", "stage"].includes(core.settings.playMode)) {
    core.errors.push({ d:delta, t:performance.now(), kind }); if (core.errors.length > 30) core.errors.shift();
  }
  showJudge(kind, delta, star); updateHud();
  while (core.nextIdx < core.chart.length && core.chart[core.nextIdx].judged) core.nextIdx++;
  if (lifeAfterJudge(kind)) failGame();
}
/* ORBIT：どのキーでも次のノーツ1つだけ（早すぎる連打はMISS） */
function orbitInput(ts) {
  const p = performance.now(), at = (ts > 0 && ts <= p) ? ts : p;
  const now = gameTime(at), w = core.windows(), n = core.chart[core.nextIdx];
  core.pressH = { lane:0, t:p };
  if (!n) return;
  const d = now - n.time;
  if (d < -w.good * 2) return;
  window.Trk.media.playSE(n.lane);
  if (d < -w.good) { judgeNote(n, "miss", d); return; }
  judgeNote(n, Math.abs(d) <= w.perfect ? "perfect" : "good", d);
}
const judgePolicy = () => core.settings.judgeOrdered ? "ordered" : window.Trk.judge.JUDGE_POLICY_DEFAULT;   // MANUALの判定の割り当て方
function handleInput(lane, ts) {
  if (core.phase !== "playing" || core.settings.autoPlay) return;            // AUTO中は見るだけ
  const mode = core.settings.playMode;
  if (mode === "stage" || mode === "catch") return;                 // stage.js・catch.js が受け取る
  if (mode === "orbit") { orbitInput(ts); return; }
  if (mode === "truck") { steerTruck(lane); return; }
  const p = performance.now(), at = (ts > 0 && ts <= p) ? ts : p;
  const now = gameTime(at);
  window.Trk.media.playSE(lane);
  core.pressFlash[core.laneCol(lane)] = p; core.pressH = { lane, t:p };
  /* どのノーツに当てるかは js/judge-match.js（純関数）。既定は "smart"（同じ色を時刻順に探し、前の色違いノーツの
     時刻を過ぎていれば飛ばして叩ける。色違いの打鍵は早すぎなければ太鼓と同じく MISS）。
     ❓謎設定「判定を昔のやり方にする」（judgeOrdered）で旧方式 "ordered" に戻せる（trk99） */
  const m = window.Trk.judge.matchManualInput(core.chart, core.nextIdx, lane, now, core.windows(), judgePolicy());
  if (m) judgeNote(core.chart[m.idx], m.kind, m.delta);
}
/* AUTO：どのモードでも、ちょうどのタイミングでPERFECT。モードに合わせて光らせる */
function autoVisual(n, i, p) {
  if (isStage() && typeof stagePress !== "undefined") {
    ensureStageMap();
    const l = stageMap.lanes[i]; stagePress[l] = p; if (stageMap.wide[i]) stagePress[l + 1] = p;
  } else if (!isOrbit()) core.pressFlash[core.laneCol(n.lane)] = p;
  core.pressH = { lane:n.lane, t:p };
}
function autoPlay(now) {
  autoJudging = true;
  for (let i = core.nextIdx; i < core.chart.length; i++) {
    if (core.phase !== "playing") break;
    const n = core.chart[i]; if (n.time > now) break;
    if (!n.judged) { judgeNote(n, "perfect", 0); window.Trk.media.playSE(n.lane); autoVisual(n, i, performance.now()); }
  }
  autoJudging = false;
  const nx = core.chart[core.nextIdx];                                       // TRUCKは次のノーツのレーンへ先回り
  if (nx && isTruck() && typeof truckState !== "undefined") truckState.lane = nx.lane;
}
function sweepMisses(now) {
  if (core.settings.autoPlay && core.phase === "playing") autoPlay(now);     // AUTOはMISS判定の前に自動で判定
  const w = core.windows();
  for (let i = core.nextIdx; i < core.chart.length; i++) {
    if (core.phase !== "playing") return;
    const n = core.chart[i]; if (n.time > now - w.good) break;
    if (!n.judged) judgeNote(n, "miss", null);
  }
}
function seekTo(sec) {
  core.practice = true;
  if (leadIn) { leadIn = null; if (core.phase === "playing") core.video.play().catch(() => {}); }
  try { core.video.currentTime = sec; } catch (_) { return; }
  core.clock = { t:sec * 1000, perf:performance.now(), lastCt:-1 };
  const t = sec * 1000 - core.settings.latency;
  for (const n of core.chart) {
    if (n.time < t) { if (!n.judged) { n.judged = true; n.result = "skip"; } }
    else { n.judged = false; n.result = null; }
  }
  core.stats.combo = 0; core.nextIdx = 0;
  while (core.nextIdx < core.chart.length && core.chart[core.nextIdx].judged) core.nextIdx++;
  updateHud();
}

/* ---------- 曲終端の扱い ---------- */
function mediaAtEnd() {
  const duration = core.video.duration, time = core.video.currentTime;
  if (core.video.ended) return true;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(time)) return false;
  /* 最後の pause / timeupdate が少し手前で止まる端末向け。短い音源を早く終わらせないよう長さに比例させる */
  return time >= duration - Math.min(.3, duration * .05);
}
function canEndGame(failed = false) {
  if (core.phase === "playing") return true;
  /* 手動一時停止中は、実際にメディアが ended になった場合だけ結果へ進める */
  return !failed && core.phase === "paused" && !leadIn && core.video.ended;
}
function finishIfMediaEnded() {
  if (leadIn || (core.phase !== "playing" && core.phase !== "paused")) return false;
  if (core.video.seeking && !core.video.ended) return false;
  if (core.phase === "paused" ? !core.video.ended : !mediaAtEnd()) return false;
  endGame(false);
  return core.phase === "ended";
}
function handleVideoEnded() { finishIfMediaEnded(); }
function handleVideoPause() {
  if (finishIfMediaEnded()) return;
  if (core.phase === "playing" && !leadIn && core.video.paused && !core.video.seeking) pauseGame();
}

/* ---------- 時計 ---------- */
function tickClock() {
  /* video.paused の早期 return より先に見る。 ended / pause の通知が欠落しても、
     一時停止状態で終端に達していれば MANUAL・AUTO・各モード共通で結果へ進む */
  if (finishIfMediaEnded()) return;
  if (runShort && !leadIn) shortSilenceWatch();   /* 🕹️ 終盤の無音検知 */
  const p = performance.now();
  if (leadIn && core.phase === "playing") {
    if (leadIn.resume) core.clock = { t:core.video.currentTime * 1000, perf:p, lastCt:-1 };
    else { core.clock.t = -(leadIn.end - p) * core.settings.rate; core.clock.perf = p; }
    const k = Math.floor((p - leadIn.start) / leadIn.iv);
    if (k !== leadIn.last && k < 3) { leadIn.last = k; countTick(k); }
    if (p >= leadIn.end) finishLeadIn();
    return;
  }
  const ct = core.video.currentTime * 1000;
  if (core.video.paused || core.video.seeking || core.phase !== "playing") { core.clock = { t:ct, perf:p, lastCt:ct }; return; }
  let t = core.clock.t + (p - core.clock.perf) * (core.video.playbackRate || 1);
  if (ct !== core.clock.lastCt) {
    const diff = ct - t;
    if (Math.abs(diff) > 80) t = ct; else t += diff * .2;
    core.clock.lastCt = ct;
  }
  core.clock.t = t; core.clock.perf = p;
}
function gameTime(at = performance.now()) {
  let base;
  if (core.phase === "playing" && leadIn) base = leadIn.resume ? core.clock.t : core.clock.t + (at - core.clock.perf) * core.settings.rate;
  else base = (core.phase === "playing" && !core.video.paused) ? core.clock.t + (at - core.clock.perf) * (core.video.playbackRate || 1) : core.clock.t;
  return base - core.settings.latency;
}

/* ============ プレイ記録 ============
   MANUAL・TRUCK・ORBIT・STAGE・CATCH は別々。1.05x以上は slot.rates["1.25"] のように速度ごと。
   slot.maxRate＝🏁最高クリア速度。AUTO・練習・練習扱い・FAILEDはハイスコア対象外。 */
const REC_KEY = "shadow_taiko_records_v1", HIST_MAX = 30;
let records = {};
try { records = JSON.parse(localStorage.getItem(REC_KEY)) || {}; } catch (_) { records = {}; }
if (!records || typeof records !== "object" || Array.isArray(records)) records = {};
function saveRecords() { try { localStorage.setItem(REC_KEY, JSON.stringify(records)); } catch (_) {} }
/* 譜面の同一性（記録・ゴーストのキー）は MOD に依存させない。resetRun は MIRROR／RANDOM で n.lane を書き換えるので、
   書き換える前のレーン（origLane。resetRun が最初に見た lane を残す）を使う。MOD 無しの既存の記録はキーが変わらない。
   MOD ごとにベストを分けたくなったら、速度（slot.rates[rateKey()]）と同じように入れ物の側で分ける（trk129）。 */
const chartKeyOf = () => core.hashString(core.chart.map(n => n.time + ":" + (n.origLane ?? n.lane)).join(",")).toString(36);
const MODE_PLAYS = { truck:"truckPlays", orbit:"orbitPlays", stage:"stagePlays", catch:"catchPlays" };
const PLAY_KEYS = ["plays", "truckPlays", "orbitPlays", "stagePlays", "catchPlays"];
function songRec(create) {
  if (!core.fingerprint) return null;
  if (!records[core.fingerprint] && create) {
    records[core.fingerprint] = { title:core.baseName(core.mediaName), size:Number(core.fingerprint.split(":")[0]) || 0,
      plays:0, truckPlays:0, orbitPlays:0, stagePlays:0, catchPlays:0, perfectTotal:0, lastPlayed:0, charts:{}, history:[] };
  }
  return records[core.fingerprint] || null;
}
const newSlot = () => ({ plays:0, best:null, ap:false, fc:false, bestPerfect:0 });
function recordPlay(r) {
  const s = songRec(true); if (!s) return {};
  const mode = core.settings.playMode, auto = !!(core.settings.autoPlay || runAutoUsed);
  const unranked = runUnranked() || !!r.failed;
  const ck = chartKeyOf(), rk = rateKey();
  const c = s.charts[ck] || (s.charts[ck] = { diff:core.chartDiff, level:core.currentLevel, ...(core.chartMode === "generated" ? { gen:String(core.settings.chartGen) } : {}), ...newSlot() });
  c.diff = core.chartDiff; c.level = core.currentLevel;
  const base = MODE_PLAYS[mode] ? (c[mode] ||= newSlot()) : c;
  let slot = rk && core.settings.rate > 1 ? ((base.rates ||= {})[rk] ||= newSlot()) : base;
  if (r.short) slot = ((c.short ||= {})[r.short] ||= newSlot());   /* 🕹️ ショートプレイは独立の記録に */
  const entry = { t:Date.now(), diff:core.chartDiff, score:r.score, acc:+r.acc.toFixed(2), grade:r.grade,
    perfect:core.stats.perfect, star:core.stats.star || 0, good:core.stats.good, miss:core.stats.miss, crash:core.stats.crash || 0, maxCombo:core.stats.maxCombo,
    mode, lifeMode:runLifeMode, radio:runRadioUsed, pauseUsed:runPaused,
    auto, short:r.short || 0, truck:mode === "truck", orbit:mode === "orbit", stage:mode === "stage", catch:mode === "catch",
    failed:!!r.failed, rate:core.settings.rate, practice:core.practice || rateUnranked(), ap:r.ap, fc:r.fc, mods:runMods() };
  s.history.unshift(entry); if (s.history.length > HIST_MAX) s.history.length = HIST_MAX;
  s.lastPlayed = entry.t;
  s.title = core.baseName(core.mediaName) || s.title;
  if (core.currentSong && core.currentSong.title) s.display = typeof songDisplayTitle === "function" ? songDisplayTitle(core.currentSong) : core.currentSong.title;
  let out = {};
  if (!auto) {
    slot.plays = (slot.plays || 0) + 1;
    if (r.short) { /* 🕹️ ショートは曲全体のプレイ回数・フルのベストには混ぜない */ }
    else if (MODE_PLAYS[mode]) s[MODE_PLAYS[mode]] = (s[MODE_PLAYS[mode]] || 0) + 1;
    else { s.plays = (s.plays || 0) + 1; s.perfectTotal = (s.perfectTotal || 0) + core.stats.perfect; }
    let prev = slot.best, isNew = false, newSpeed = false;
    if (!prev && mode === "manual" && slot === c) {
      try { const old = (JSON.parse(localStorage.getItem(core.BEST_KEY)) || {})[`${core.fingerprint}|${ck}`]; if (old) prev = c.best = { score:old.score, acc:old.acc, date:old.date }; } catch (_) {}
    }
    if (!unranked) {
      slot.bestPerfect = Math.max(slot.bestPerfect || 0, core.stats.perfect);
      if (r.ap) slot.ap = true;
      if (r.fc) slot.fc = true;
      if (!prev || r.score > prev.score) {
        slot.best = { score:r.score, acc:entry.acc, grade:r.grade, perfect:core.stats.perfect, star:entry.star, good:core.stats.good, miss:core.stats.miss,
          maxCombo:core.stats.maxCombo, date:entry.t, mods:entry.mods, rate:core.settings.rate };
        isNew = true;
      }
      if (!r.short && core.settings.rate > (base.maxRate || 1)) { base.maxRate = core.settings.rate; newSpeed = true; }
    }
    out = { isNew, prev, plays:slot.plays, chart:slot, mode, newSpeed };
  }
  saveRecords(); renderRecords();
  core.emit("records");
  return out;
}
function slotCell(t, icon) {
  return t && t.best ? `${Number(t.best.score).toLocaleString()}${t.ap ? ` ${icon}⭐` : t.fc ? " FC" : ""}` : "—";
}
const SLOT_COLS = [["truck", "🚚", "recTruck"], ["orbit", "🪐", "recOrbit"], ["stage", "🎪", "recStage"], ["catch", "🚛", "recCatch"]];
function renderRecords() {
  const panel = core.$("recPanel"); if (!panel) return;
  panel.hidden = !core.videoReady;
  const sum = core.$("recSummary"), hist = core.$("recHistory");
  sum.textContent = ""; hist.textContent = "";
  if (!core.videoReady) return;
  const s = songRec(false);
  if (!s || !s.history || !s.history.length) { sum.append(core.el("div", "hint", tr("recNone"))); return; }
  const top = core.el("div", "recTop");
  const extra = SLOT_COLS.map(([m, i]) => s[MODE_PLAYS[m]] ? i + s[MODE_PLAYS[m]] : "").filter(Boolean).join(" ");
  const plays = `${s.plays || 0}${extra ? ` (${extra})` : ""}`;
  [[tr("recPlays"), plays], [tr("recPerfTotal"), (s.perfectTotal || 0).toLocaleString()], [tr("recLast"), s.lastPlayed ? core.fmtDate(s.lastPlayed) : "—"]]
    .forEach(([k, v]) => { const d = core.el("div"); d.append(core.el("span", "", k), core.el("b", "", String(v))); top.append(d); });
  sum.append(top);
  const ck = core.chart.length ? chartKeyOf() : "", tbl = core.el("table", "recTable"), head = core.el("tr");
  [tr("recDiff"), tr("recBest"), tr("recAcc"), tr("recBestP"), tr("recCount"), ...SLOT_COLS.map(([, , k]) => tr(k))].forEach(h => head.append(core.el("th", "", h)));
  tbl.append(head);
  const charts = Object.entries(s.charts || {}).sort(([, a], [, b]) => window.Trk.data.DIFF_IDS.indexOf(a.diff) - window.Trk.data.DIFF_IDS.indexOf(b.diff));
  charts.forEach(([key, c]) => {
    const row = core.el("tr", key === ck ? "cur" : ""), badge = c.ap ? " ⭐" : c.fc ? " FC" : "";
    const genName = String(c.gen) === "1" ? tr("recOldGen1") : String(c.gen) === "2" ? tr("recOldGen2") : String(c.gen) === "3" ? tr("recGen3") : String(c.gen) === "4" ? tr("recGen4") : "";
    const bestMods = c.best && Array.isArray(c.best.mods) && c.best.mods.length ? ` [${c.best.mods.join(" ")}]` : "";
    row.append(
      core.el("td", "", `${tr(c.diff)} Lv.${c.level}${badge}${genName ? " · " + genName : ""}`),
      core.el("td", "", c.best ? Number(c.best.score).toLocaleString() + bestMods : "—"),
      core.el("td", "", c.best ? Number(c.best.acc).toFixed(2) + "%" : "—"),
      core.el("td", "", String(c.bestPerfect || 0)),
      core.el("td", "", String(c.plays || 0)),
      ...SLOT_COLS.map(([m, icon]) => core.el("td", "", slotCell(c[m], icon))));
    tbl.append(row);
  });
  sum.append(tbl);
  const lines = [];
  for (const [, c] of charts) {
    for (const [slot, icon] of [[c, "🥁"], ...SLOT_COLS.map(([m, i]) => [c[m], i]), ...Object.entries(c.short || {}).map(([l, sl]) => [sl, `🕹️${l}s`])]) {
      if (!slot) continue;
      const parts = Object.entries(slot.rates || {}).sort((a, b) => +a[0] - +b[0]).filter(([, x]) => x.best)
        .map(([k, x]) => `${k}x ${Number(x.best.score).toLocaleString()}${x.ap ? " ⭐" : x.fc ? " FC" : ""}`);
      if ((slot.maxRate || 1) > 1) parts.push(`🏁${slot.maxRate.toFixed(2)}x`);
      if (parts.length) lines.push(`${tr(c.diff)} ${icon} ${parts.join(" · ")}`);
    }
  }
  if (lines.length) {
    sum.append(core.el("div", "hint status", tr("rateRecLabel")));
    lines.forEach(l => sum.append(core.el("div", "hint", l)));
  }
  sum.append(core.el("div", "hint", tr("recStarHint")));
  for (const h of s.history) {
    const icon = MODE_ICON[h.mode] || "";
    const savedTitle = h.titleTier && h.lifeMode && h.title && !h.failed && !h.auto && !h.radio && !h.pauseUsed && !h.practice ? h.title : "";
    const mark = (h.short ? `🕹️${h.short}s ` : "") + (h.failed ? tr("recFailed") : savedTitle || (h.auto ? icon : h.ap ? `${icon}⭐` : h.fc ? `${icon} FC`.trim() : icon));
    const oldTitleMark = /^(?:🥁|🚚|🪐|🎪|🚛)(?:⚔|🛡|🐔)$/u;
    const mods = Array.isArray(h.mods) && h.mods.length ? h.mods.filter(m => m !== "AUTO" && !oldTitleMark.test(m)).join(" ") : "";
    const star = h.star ? ` ✦${h.star}` : "", crash = h.crash ? ` 💥${h.crash}` : "";
    const tags = [mark, mods, h.auto ? tr("recAuto") : "", h.practice && !h.failed && !h.auto ? tr("recPractice") : ""].filter(Boolean).join(" · ");
    hist.append(core.el("div", "histRow" + (h.auto || h.failed ? " auto" : ""),
      `${core.fmtDate(h.t)} · ${tr(h.diff)} · ${Number(h.score).toLocaleString()} · ${Number(h.acc).toFixed(2)}% · P${h.perfect}${star}/G${h.good}/M${h.miss}${crash} · ${h.grade}${tags ? " · " + tags : ""}`));
  }
}
core.on("chart", renderRecords);
core.on("language", renderRecords);

/* ---------- 記録のバックアップ・削除 ---------- */
core.$("recExportBtn").addEventListener("click", () => {
  core.downloadJSON({ format:"shadow-taiko-records", version:1, records }, `trk-records-${new Date().toISOString().slice(0, 10)}.json`);
  core.setStatus("recStatus", "recExported");
});
core.$("recImportFile").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  let raw = null; try { raw = JSON.parse(await f.text()); } catch (_) {}
  if (!raw || raw.format !== "shadow-taiko-records" || !raw.records || typeof raw.records !== "object") { core.setStatus("recStatus", "recBad"); return; }
  let n = 0;
  for (const [k, v] of Object.entries(raw.records)) {
    if (!/^\d+:\d+$/.test(k) || !v || typeof v !== "object" || !v.charts || typeof v.charts !== "object" || !Array.isArray(v.history)) continue;
    const total = x => PLAY_KEYS.reduce((a, key) => a + (Number(x[key]) || 0), 0);
    if (!records[k] || total(v) >= total(records[k])) { records[k] = v; n++; }
  }
  saveRecords(); renderRecords(); core.emit("records");
  core.setStatus("recStatus", "recImported", { n });
});
core.$("recResetBtn").addEventListener("click", () => {
  if (!core.fingerprint || !records[core.fingerprint] || !confirm(tr("recConfirmReset"))) return;
  delete records[core.fingerprint]; saveRecords(); renderRecords(); core.emit("records");
  core.setStatus("recStatus", "recCleared");
});
/* メディア終端・外部一時停止は、モード共通のゲーム進行側で一元処理 */
core.video.addEventListener("ended", handleVideoEnded);
core.video.addEventListener("pause", handleVideoPause);

/* ✅ game.js 完了 */

/* 公開名は据え置き（名前空間の移行の途中。window.Trk.* への移動は後の段階で行う） */
window.PLAY_KEYS = PLAY_KEYS;
window.autoPlay = autoPlay;
window.chartKeyOf = chartKeyOf;
window.currentAcc = currentAcc;
window.currentScore = currentScore;
window.endGame = endGame;
/* 後から読み込まれるファイルがこの名前を差し替える（window.gameTime の代入）。内部の呼び出しにも届くよう、アクセサで同じ束縛を指す */
Object.defineProperty(window, "gameTime", { configurable:true, get:() => gameTime, set:v => { gameTime = v; } });
Object.defineProperty(window, "goAt", { configurable:true, get:() => goAt, set:v => { goAt = v; } });
window.handleInput = handleInput;
window.judgeNote = judgeNote;
Object.defineProperty(window, "leadIn", { configurable:true, get:() => leadIn, set:v => { leadIn = v; } });
window.pauseGame = pauseGame;
Object.defineProperty(window, "pausedInLeadIn", { configurable:true, get:() => pausedInLeadIn, set:v => { pausedInLeadIn = v; } });
window.rateKey = rateKey;
Object.defineProperty(window, "records", { configurable:true, get:() => records, set:v => { records = v; } });
window.renderRecords = renderRecords;
window.resumeGame = resumeGame;
Object.defineProperty(window, "runShort", { configurable:true, get:() => runShort, set:v => { runShort = v; } });
window.runUnranked = runUnranked;
window.runWasPaused = () => runPaused;
window.saveRecords = saveRecords;
window.seekTo = seekTo;
/* 後から読み込まれるファイルがこの名前を差し替える（window.showJudge の代入）。内部の呼び出しにも届くよう、アクセサで同じ束縛を指す */
Object.defineProperty(window, "showJudge", { configurable:true, get:() => showJudge, set:v => { showJudge = v; } });
window.songRec = songRec;
window.startGame = startGame;
window.sweepMisses = sweepMisses;
window.tickClock = tickClock;
window.toTitle = toTitle;
})();
