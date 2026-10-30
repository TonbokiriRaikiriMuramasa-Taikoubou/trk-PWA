// SPDX-License-Identifier: GPL-3.0-or-later
/* ==========================================================================
   trk! verified.js — ✔ 公認パック（作曲家さん・譜面作者さんの本人確認済みパック）
   ・パックを入れたとき、ファイル全体の SHA-256（指紋）を計算して保存する
   ・リポジトリの verified.json（オーナーだけが書き換えられる）に指紋があれば ✔公認
   ・曲パックの曲には、作者名とBPMを表示。公認パックだけ「💬 作者のことば」（X無料枠と同じ280まで）を表示
   ・custom.js の installPackFile / sanitizeSong / getPackSongs / renderPackList、
     library.js の renderLib / renderBanner を包んで機能を足す（元のファイルは変更しない）
   読み込み順：library.js の後、main.js の前
   ========================================================================== */
"use strict";
(() => {
  const core = window.Trk.core;

/* ============ 文章 ============ */
Object.assign(TEXT.ja, {
  vfBadge:"✔ 公認", vfBadgeTitle:"作曲家さん・譜面作者さんの本人確認と権利の確認が済んだパックです",
  vfComment:"💬 作者のことば", vfCharter:"譜面：{name}", vfBpm:"BPM {n}",
  vfRoleComposer:"作曲", vfRoleArranger:"編曲", vfRoleLyricist:"作詞", vfRoleVocalist:"歌", vfRoleCharter:"譜面", vfRoleIllustrator:"イラスト",
  vfCommentField:"💬 作者のことば（任意）",
  vfCommentHint:"公認された作者さんのパックでだけ表示されます。長さはXの無料アカウントと同じ、半角280字・全角140字までです（全角・絵文字は2として数えます）。",
  vfCount:"{n} / 280", vfTooLong:"作者のことばが長すぎます（280まで）。", vfNeedCharter:"曲パックには、譜面作者の名前を入れてください。",
  vfHash:"指紋（SHA-256）", vfCopySnippet:"📋 公認リスト用にコピー", vfCopied:"公認リスト（verified.json）用の行をコピーしました。",
  vfNoHash:"指紋なし：このパックを入れ直すと、公認かどうかを確認できます。"
});
Object.assign(TEXT.en, {
  vfBadge:"✔ Verified", vfBadgeTitle:"The composer/charter's identity and rights have been confirmed for this pack",
  vfComment:"💬 A word from the creator", vfCharter:"Chart: {name}", vfBpm:"BPM {n}",
  vfRoleComposer:"Music", vfRoleArranger:"Arrangement", vfRoleLyricist:"Lyrics", vfRoleVocalist:"Vocals", vfRoleCharter:"Chart", vfRoleIllustrator:"Illustration",
  vfCommentField:"💬 A word from the creator (optional)",
  vfCommentHint:"Shown only for packs by verified creators. Same length as a free X post: 280 (full-width characters and emoji count as 2).",
  vfCount:"{n} / 280", vfTooLong:"The message is too long (max 280).", vfNeedCharter:"Please enter the charter's name for song packs.",
  vfHash:"Fingerprint (SHA-256)", vfCopySnippet:"📋 Copy for verified list", vfCopied:"Copied an entry for verified.json.",
  vfNoHash:"No fingerprint: reinstall this pack to check whether it's verified."
});
Object.assign(TEXT.zh, {
  vfBadge:"✔ 认证", vfBadgeTitle:"已确认作曲者·谱面作者本人身份及权利的资源包",
  vfComment:"💬 作者的话", vfCharter:"谱面：{name}", vfBpm:"BPM {n}",
  vfRoleComposer:"作曲", vfRoleArranger:"编曲", vfRoleLyricist:"作词", vfRoleVocalist:"演唱", vfRoleCharter:"谱面", vfRoleIllustrator:"插画",
  vfCommentField:"💬 作者的话（可选）",
  vfCommentHint:"仅在认证作者的资源包中显示。长度与X免费账号相同，最多280（全角字符和表情计为2）。",
  vfCount:"{n} / 280", vfTooLong:"作者的话太长了（最多280）。", vfNeedCharter:"歌曲包请填写谱面作者的名字。",
  vfHash:"指纹（SHA-256）", vfCopySnippet:"📋 复制到认证列表", vfCopied:"已复制 verified.json 用的条目。",
  vfNoHash:"没有指纹：重新安装此资源包即可确认是否认证。"
});
Object.assign(TEXT.ko, {
  vfBadge:"✔ 공인", vfBadgeTitle:"작곡가·채보 제작자 본인 확인과 권리 확인을 마친 팩입니다",
  vfComment:"💬 제작자의 한마디", vfCharter:"채보: {name}", vfBpm:"BPM {n}",
  vfRoleComposer:"작곡", vfRoleArranger:"편곡", vfRoleLyricist:"작사", vfRoleVocalist:"보컬", vfRoleCharter:"채보", vfRoleIllustrator:"일러스트",
  vfCommentField:"💬 제작자의 한마디 (선택)",
  vfCommentHint:"공인된 제작자의 팩에서만 표시됩니다. 길이는 X 무료 계정과 같은 280까지입니다 (전각 문자·이모지는 2로 셉니다).",
  vfCount:"{n} / 280", vfTooLong:"한마디가 너무 깁니다 (최대 280).", vfNeedCharter:"곡 팩에는 채보 제작자 이름을 넣어 주세요.",
  vfHash:"지문 (SHA-256)", vfCopySnippet:"📋 공인 목록용으로 복사", vfCopied:"verified.json용 항목을 복사했습니다.",
  vfNoHash:"지문 없음: 이 팩을 다시 넣으면 공인 여부를 확인할 수 있습니다."
});

const VF_URL = "verified.json", VF_MAX = 280, HEX64 = /^[0-9a-f]{64}$/;
const ROLE_KEY = { composer:"vfRoleComposer", arranger:"vfRoleArranger", lyricist:"vfRoleLyricist",
  vocalist:"vfRoleVocalist", charter:"vfRoleCharter", illustrator:"vfRoleIllustrator" };
const str = (v, n) => typeof v === "string" ? v.trim().slice(0, n) : "";
const tx = (tag, key, cls) => { const n = core.el(tag, cls || "", tr(key)); n.dataset.i18n = key; return n; };

/* ============ Xと同じ数え方（半角1・全角2・絵文字2、上限280） ============ */
const LIGHT = [[0x0000, 0x10FF], [0x2000, 0x200D], [0x2010, 0x201F], [0x2032, 0x2037]];
const EMOJI = /\p{Extended_Pictographic}/u;
const cpW = c => { const p = c.codePointAt(0); return LIGHT.some(([a, b]) => p >= a && p <= b) ? 1 : 2; };
const graphemes = s => (typeof Intl !== "undefined" && Intl.Segmenter)
  ? Array.from(new Intl.Segmenter(undefined, { granularity:"grapheme" }).segment(s), x => x.segment) : Array.from(s);
const gW = g => EMOJI.test(g) ? 2 : Array.from(g).reduce((a, c) => a + cpW(c), 0);
const postLength = s => graphemes(String(s || "")).reduce((a, g) => a + gW(g), 0);
/* ことばを整える：制御文字・文字の向きを変える記号を除き、280を超える分は切る */
function cleanComment(v) {
  if (typeof v !== "string") return "";
  let s = v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\n{3,}/g, "\n\n").trim();
  if (postLength(s) <= VF_MAX) return s;
  let out = "", n = 0;
  for (const g of graphemes(s)) { const w = gW(g); if (n + w > VF_MAX) break; out += g; n += w; }
  return out.trim();
}

/* ============ 公認リスト（verified.json） ============ */
const VF = { creators:{}, packs:{}, loaded:false };
function cleanVerified(raw) {
  if (!raw || typeof raw !== "object" || raw.format !== "trk-verified") return null;
  const creators = {}, packs = {};
  for (const c of Array.isArray(raw.creators) ? raw.creators : []) {
    if (!c || typeof c.id !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(c.id)) continue;
    const handle = typeof c.x === "string" ? c.x.replace(/^@/, "") : "";
    creators[c.id] = {
      name:str(c.name, 40) || c.id,
      x:/^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle : "",
      url:typeof c.url === "string" && /^https:\/\/[^\s"'<>]+$/.test(c.url) ? c.url.slice(0, 200) : "",
      roles:(Array.isArray(c.roles) ? c.roles : []).filter(r => ROLE_KEY[r]).slice(0, 6)
    };
  }
  for (const p of Array.isArray(raw.packs) ? raw.packs : []) {
    const h = p && typeof p.sha256 === "string" ? p.sha256.toLowerCase() : "";
    if (!HEX64.test(h)) continue;
    packs[h] = { creators:(Array.isArray(p.creators) ? p.creators : []).filter(id => creators[id]).slice(0, 8),
      title:str(p.title, 80), comment:cleanComment(p.comment), notice:str(p.notice, 300), addedAt:str(p.addedAt, 20) };
  }
  return { creators, packs };
}
async function loadVerified() {
  try {
    const r = await fetch(VF_URL, { cache:"no-cache" }); if (!r.ok) return;
    const c = cleanVerified(await r.json()); if (!c) return;
    Object.assign(VF, c, { loaded:true });
    refreshAll();
  } catch (_) {}   // file:// で開いたときや、オフラインのときは公認表示なし
}

/* ============ 指紋（SHA-256） ============ */
async function sha256Hex(blob) {
  if (!(window.crypto && crypto.subtle)) return null;   // HTTPS か localhost のときだけ使える
  const buf = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, "0")).join("");
}
const baseInstall = window.Trk.custom.installPackFile;
window.Trk.custom.installPackFile = async function (file) {
  const r = await baseInstall(file);
  if (r) {
    try {
      const h = await sha256Hex(file), rec = await window.Trk.custom.packDB.get(r.id);
      if (rec && h) { rec.sha256 = h; await window.Trk.custom.packDB.put(r.id, rec); }
    } catch (e) { console.error(e); }
    await window.Trk.custom.renderPackList();
    if (r.man.songs && typeof refreshPackSongs === "function") await window.Trk.library.refreshPackSongs();
  }
  return r;
};

/* ============ 曲パックに「作者のことば」を入れる ============ */
let pendingComment = null;   // 曲パックを書き出す瞬間だけ、入力欄のことばを入れる
const baseSong = window.Trk.custom.sanitizeSong;
window.Trk.custom.sanitizeSong = function (r, i) {
  const s = baseSong(r, i); if (!s) return s;
  const raw = r && r.comment != null ? r.comment : (pendingComment != null && i === 0 ? pendingComment : null);
  const c = cleanComment(raw); if (c) s.comment = c;
  return s;
};

/* ============ 曲リストの曲に、指紋と作者の情報を結びつける ============ */
const songInfo = {};   // 曲リストのキー（"pack:…"）→ { sha256, charter, bpm, comment }
const baseGet = window.Trk.custom.getPackSongs;
window.Trk.custom.getPackSongs = async function () {
  const list = await baseGet();
  let recs = []; try { recs = await window.Trk.custom.packDB.all(); } catch (_) {}
  const hashOf = {}; for (const r of recs) hashOf[r.id] = r.sha256 || null;
  for (const k of Object.keys(songInfo)) delete songInfo[k];
  for (const s of list) {
    songInfo["pack:" + s.key] = { sha256:hashOf[s.packId] || null, charter:s.charter || "", bpm:s.bpm || 0, comment:s.comment || "" };
  }
  return list;
};
function verifyOf(item) {
  const inf = item && songInfo[item.key];
  if (!inf || !inf.sha256) return null;
  const v = VF.packs[inf.sha256];
  return v ? { ...v, inf } : null;
}
function badge(big) {
  const b = core.el("span", "vfBadge" + (big ? " big" : ""), big ? tr("vfBadge") : "✔");
  b.title = tr("vfBadgeTitle");
  return b;
}
function creatorRow(id) {
  const c = VF.creators[id], row = core.el("div", "vfCreator");
  row.append(core.el("b", "", c.name));
  if (c.roles.length) row.append(core.el("span", "hint", " " + c.roles.map(r => tr(ROLE_KEY[r])).join("・")));
  const href = c.x ? "https://x.com/" + c.x : c.url;
  if (href && (c.x || core.safeHttpUrl(c.url))) row.append(" ", core.safeLink("", href, c.x ? "@" + c.x : c.url));   /* 🛡 念のため通す */
  return row;
}

/* ============ 曲リスト：曲名の前に ✔ ============ */
const baseLib = window.Trk.library.renderLib;
window.Trk.library.renderLib = function () {
  baseLib();
  const rows = Array.from(core.$("libList").children).filter(n => n.querySelector && n.querySelector(".libRow"));
  window.Trk.library.libView.slice(0, window.Trk.library.LIB_SHOW).forEach((it, i) => {
    if (!rows[i] || !verifyOf(it)) return;
    rows[i].querySelector(".libName").prepend(badge(false), " ");
  });
};

/* ============ 選曲画面：作者・BPM・公認・作者のことば ============ */
const vfBox = core.el("section", "panel vfBox"); vfBox.hidden = true;
core.$("songBanner").after(vfBox);
function renderVfBox() {
  vfBox.textContent = "";
  const s = core.currentSong, inf = s && songInfo[s.key];
  if (!inf) { vfBox.hidden = true; return; }
  const v = verifyOf(s), head = core.el("div", "vfHead");
  if (v) head.append(badge(true));
  const meta = [inf.charter ? tr("vfCharter", { name:inf.charter }) : "", inf.bpm ? tr("vfBpm", { n:inf.bpm }) : ""].filter(Boolean).join(" · ");
  if (meta) head.append(core.el("span", "hint", meta));
  vfBox.append(head);
  if (v) {
    for (const id of v.creators) vfBox.append(creatorRow(id));
    const comment = v.comment || inf.comment;
    if (comment) vfBox.append(core.el("div", "vfLabel", tr("vfComment")), core.el("div", "vfComment", comment));
    if (v.notice) vfBox.append(core.el("div", "hint vfNotice", v.notice));
  }
  vfBox.hidden = !(v || meta);
}
const baseBanner = window.Trk.library.renderBanner;
window.Trk.library.renderBanner = function () { baseBanner(); renderVfBox(); };
core.on("language", renderVfBox);

/* ============ リザルト：公認と作者のことば ============ */
core.on("screen", id => {
  if (id !== "endScreen") return;
  const v = verifyOf(core.currentSong); if (!v) return;
  const box = core.el("div", "vfBox vfResult");
  const head = core.el("div", "vfHead"); head.append(badge(true)); box.append(head);
  for (const cid of v.creators) box.append(creatorRow(cid));
  const comment = v.comment || v.inf.comment;
  if (comment) box.append(core.el("div", "vfComment", comment));
  if (v.notice) box.append(core.el("div", "hint vfNotice", v.notice));
  core.$("credits").prepend(box);
});

/* ============ パック一覧：指紋・✔・公認リスト用のコピー ============ */
const basePL = window.Trk.custom.renderPackList;
window.Trk.custom.renderPackList = async function () {
  await basePL();
  let recs = []; try { recs = await window.Trk.custom.packDB.all(); } catch (_) {}
  recs.sort((a, b) => (b.installedAt || 0) - (a.installedAt || 0));   // custom.js と同じ並び
  const cards = core.$("packList").querySelectorAll(".packCard");
  recs.forEach((r, i) => {
    const card = cards[i]; if (!card) return;
    const line = core.el("div", "hint vfHash");
    if (r.sha256) {
      if (VF.packs[r.sha256]) card.querySelector(".packHead").prepend(badge(true));
      line.append(`${tr("vfHash")}: ${r.sha256.slice(0, 16)}… `);
      const b = core.el("button", "", tr("vfCopySnippet")); b.type = "button";
      b.style.cssText = "padding:4px 10px;font-size:12px";
      b.addEventListener("click", () => {
        const songs = (r.manifest && r.manifest.songs) || [];
        const snippet = JSON.stringify({ sha256:r.sha256, creators:[], title:(songs[0] && songs[0].title) || r.manifest.name,
          comment:(songs[0] && songs[0].comment) || "", notice:"", addedAt:new Date().toISOString().slice(0, 10) }, null, 2);
        (navigator.clipboard ? navigator.clipboard.writeText(snippet) : Promise.reject())
          .then(() => core.setStatus("packStatus", "vfCopied")).catch(() => prompt("verified.json", snippet));
      });
      line.append(b);
    } else line.textContent = tr("vfNoHash");
    card.append(line);
  });
};

/* ============ 曲パックを作る画面：作者のことば・作者名の確認 ============ */
(() => {
  const anchor = core.$("spLicense") && core.$("spLicense").closest("label"); if (!anchor) return;
  const lab = core.el("label", "field"), area = document.createElement("textarea");
  area.id = "spComment"; area.rows = 3; area.maxLength = 600;
  lab.append(tx("span", "vfCommentField"), area);
  const cnt = core.el("div", "hint vfCount");
  anchor.after(lab, cnt, tx("div", "vfCommentHint", "hint"));
  const upd = () => { const n = postLength(area.value); cnt.textContent = tr("vfCount", { n }); cnt.classList.toggle("over", n > VF_MAX); };
  area.addEventListener("input", upd); core.on("language", upd); upd();
  /* 書き出しボタンより先に（キャプチャ段階で）確認する */
  core.$("songPackBuilder").addEventListener("click", e => {
    if (!e.target.closest("#spBuildBtn")) return;
    if (!core.$("spCharter").value.trim()) { e.stopPropagation(); core.setStatus("spStatus", "vfNeedCharter"); return; }
    if (postLength(area.value) > VF_MAX) { e.stopPropagation(); core.setStatus("spStatus", "vfTooLong"); return; }
    pendingComment = area.value;
    setTimeout(() => { pendingComment = null; }, 0);   // buildSongPack は最初の await までに pack.json を作る
  }, true);
})();

/* ============ 起動 ============ */
function refreshAll() {
  window.Trk.library.renderLib(); window.Trk.library.renderBanner();
  window.Trk.custom.renderPackList().catch(() => {});
}
/* ============ 窓口（曲タブの「✔公認」など、他のファイルから公認を調べる用） ============ */
window.TrkVerified = {
  version: 1,
  /* 曲（パックの曲）→ 公認の情報。公認でなければ null */
  verifyOf: it => verifyOf(it),
  /* 曲 → 作者・BPM・ことばの情報（無ければ null） */
  infoOf: it => (it && songInfo[it.key]) || null,
  badge
};

loadVerified();
})();
/* ✅ verified.js 完了 */
