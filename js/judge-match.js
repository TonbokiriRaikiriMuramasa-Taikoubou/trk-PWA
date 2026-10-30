(() => {
// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ trk! 打鍵とノーツの対応づけ（MANUAL）。純関数 ============
   js/game.js の handleInput から「押したレーンと時刻を受け取って、どのノーツをどう判定するか」を決める部分だけを
   切り出した。ブラウザのグローバル（core／settings）には触らないので、node --test（tests/judge-match.test.mjs）から
   同じ関数を検査できる。

   背景（trk99）：上級以降の16分は、BPM 160〜200 で間隔 94〜75ms。GOOD 幅（上級±95・達人±80・RUSH±75ms）とほぼ
   同じか上回るので、判定幅が隣のノーツに重なる。旧方式（"ordered"）は「判定幅内でいちばん早い未判定ノーツ」を
   選び、色が違えば MISS にしていたため、1個落とす・1回早すぎる空振りをするだけで、以降の正しい打鍵が
   前の色違いノーツに吸われて MISS が連鎖した（太鼓さん次郎の仕様メモにある「巻き込み」と同じ）。

   方式（policy）：
     "smart"（既定）… ① 同じ色の未判定ノーツを時刻順に探す（同じ色の中では旧方式と同じく早い順。遅れ気味の
                        打鍵でも次のノーツに飛ばない）。前に別の色の未判定ノーツがあっても、その時刻を過ぎていれば
                        飛ばして叩ける（osu!lazer の StartTimeOrderedHitPolicy：「前のノーツの開始時刻より前の
                        打鍵は弾く。過ぎていれば後ろを叩ける」と同じ考え方）。飛ばした前のノーツは sweepMisses が
                        判定幅を出たときに MISS にする（判定幅内なら、あとから叩いて拾える）。
                      ② 同じ色が無ければ色違いの打鍵。いちばん早い未判定ノーツを MISS にする（太鼓の
                        「音符の種類を間違えると不可」の規則。両ボタン連打の抑止）。ただし、その時刻より PERFECT 幅
                        以上前の打鍵は空振り（null）にして相手を巻き込まない（IIDX の空POOR に近い。遅れた打鍵や
                        両手打ちの2打目が、次のノーツを消費しないようにする）。
     "ordered"       … 旧方式。判定幅内でいちばん早い未判定ノーツを1つ選び、色が違えば MISS。❓謎設定の
                        「判定を昔のやり方にする」（judgeOrdered）で選べる。

   引数：chart＝[{ time, lane, judged }]（時刻順）、nextIdx＝最初の未判定ノーツの添字（それより前は見ない）、
         lane＝押したレーン（0＝ドン・1＝カッ）、now＝ゲーム時刻（ms。遅延補正済み）、
         w＝{ perfect, good }（ms）、policy＝上の方式名（未知の値は "smart"）。
   戻り値：null（空振り。何も判定しない）か { idx, kind:"perfect"|"good"|"miss", delta, wrongLane }。
           delta は now − time（負＝早い）。wrongLane は色違いの打鍵による MISS のとき true。
   ⚠ ORBIT・STAGE・TRUCK・CATCH は別の判定（modes.js／stage.js／truck.js／catch.js）。ここは MANUAL だけ。 */
"use strict";

const JUDGE_POLICIES = ["smart", "ordered"];
const JUDGE_POLICY_DEFAULT = "smart";

function jmHit(i, d, w) {
  return { idx: i, kind: Math.abs(d) <= w.perfect ? "perfect" : "good", delta: d, wrongLane: false };
}

function matchManualInput(chart, nextIdx, lane, now, w, policy) {
  const L = chart.length;
  let i = Math.max(0, nextIdx | 0);
  if (policy === "ordered") {
    for (; i < L; i++) {
      const n = chart[i]; if (n.judged) continue;
      const d = now - n.time;
      if (d < -w.good) break;
      if (Math.abs(d) <= w.good) {
        if (n.lane !== lane) return { idx: i, kind: "miss", delta: d, wrongLane: true };
        return jmHit(i, d, w);
      }
    }
    return null;
  }
  /* smart */
  let prev = null, firstOther = -1, firstOtherD = 0;
  for (; i < L; i++) {
    const n = chart[i]; if (n.judged) continue;
    const d = now - n.time;
    if (d < -w.good) break;          // これより先は全部まだ遠い
    if (d > w.good) continue;        // 判定幅を出たが sweepMisses が未処理のノーツ。無いものとして扱う
    if (n.lane === lane) {
      if (prev === null || now >= prev.time) return jmHit(i, d, w);
      break;                         // 前の色違いノーツの時刻より前。これより後ろの同色も届かない
    }
    if (firstOther < 0) { firstOther = i; firstOtherD = d; }
    prev = n;
  }
  if (firstOther < 0) return null;                 // 判定幅に何も無い＝空振り
  if (firstOtherD < -w.perfect) return null;       // 早すぎる色違いは空振り（相手を巻き込まない）
  return { idx: firstOther, kind: "miss", delta: firstOtherD, wrongLane: true };
}

/* 領域（window.Trk.judge）：公開名の正規の場所。旧名（window.X）は作らない（新規ファイルのため） */
window.Trk = window.Trk || {};
window.Trk.judge = Object.assign(window.Trk.judge || {}, { JUDGE_POLICIES, JUDGE_POLICY_DEFAULT, matchManualInput });
})();
