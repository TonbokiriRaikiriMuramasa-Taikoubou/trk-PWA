// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ trk! 統合版：🧍 VRMマスコット（VRM 1.0専用・モーション・パック対応） ============
   3D表示の部品（three.js / three-vrm）は、VRMを初めて使うときだけ index.html の importmap から読み込みます。
   ほかのファイルと名前がぶつからないよう、全体を ( () => { ... } )() で囲んでいます。
   ※ 利用者が読み込むVRMモデルの権利は、それぞれの作者にあります（GPLの対象外）。 */
"use strict";
(() => {
  const core = window.Trk.core;
const MB = 1048576, MAX_VRM = 200 * MB, MAX_VRMA = 30 * MB;

/* ---------- 自分のモデル・モーションをブラウザ内に保存 ---------- */
const vrmDB = core.idbStore("shadow_taiko_vrm", "files");
const saveStored = (key, file) => vrmDB.put(key, { file, name:file.name, savedAt:Date.now() });
const loadStored = key => vrmDB.get(key);
const clearStored = key => vrmDB.del(key);
const asFile = (rec, fb) => rec.file instanceof File ? rec.file : new File([rec.file], rec.name || fb);

/* ---------- ゲーム本体の状態を読むための小さな関数 ---------- */
const status = (k, v) => core.setStatus("vrmStatus", k, v);
const vrmRect = () => window.Trk.data.VRM_RECT[core.settings.layout] || window.Trk.data.VRM_RECT.classic;
const isTalking = () => !!core.caption && performance.now() - core.caption.t < core.CAPTION_MS;
const setLoaded = (onFlag, credit) => { window.Trk.play.vrmState.loaded = onFlag; window.Trk.play.vrmState.credit = credit || ""; };
function selectVrmMascot() { core.settings.mascot = "vrm"; core.saveUserPrefs(); window.Trk.custom.updateMascotUI(); }

/* ---------- ライブラリは必要になったときだけ読み込む ---------- */
let libsP = null, animP = null, L = null, A = null;
function libs() {
  if (!libsP) libsP = Promise.all([import("three"), import("three/addons/loaders/GLTFLoader.js"), import("@pixiv/three-vrm")])
    .then(([THREE, G, V]) => ({ THREE, GLTFLoader:G.GLTFLoader, VRMLoaderPlugin:V.VRMLoaderPlugin, VRMUtils:V.VRMUtils }))
    /* trk190：3D部品を同梱しない軽量配布（slim-min）では「VRMを読み込めませんでした」ではなく理由を出す */
    .catch(e => { libsP = null; if (e && !e.key) { try { e.key = "vrmNoEngine"; } catch (_) {} } throw e; });
  return libsP;
}
function animLibs() {
  if (!animP) animP = import("@pixiv/three-vrm-animation").catch(e => { animP = null; throw e; });
  return animP;
}

/* ---------- 状態 ---------- */
const canvas = core.$("vrmCanvas"), prev = core.$("vrmPreview"), pctx = prev.getContext("2d");
let renderer = null, scene, camera, pivot, vrm = null, frameInfo = null, mixer = null, motionAnim = null;
let currentFile = null, motionFile = null, lastInfo = null, lastT = 0, curKey = "", packOwned = false, packMotion = false;
let chain = Promise.resolve();
const enqueue = fn => (chain = chain.then(fn).catch(e => console.error(e)));
const fail = key => { const e = new Error(key); e.key = key; return e; };

function setupScene() {
  if (renderer) return true;
  const { THREE } = L;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true }); } catch (_) { renderer = null; return false; }
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const light = new THREE.DirectionalLight(0xffffff, Math.PI);
  light.position.set(0.5, 1, 1.5).normalize(); scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  pivot = new THREE.Group(); scene.add(pivot);
  return true;
}
function measure() {
  const { THREE } = L;
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(vrm.scene);
  const head = vrm.humanoid && vrm.humanoid.getNormalizedBoneNode("head"), hp = new THREE.Vector3();
  if (head) head.getWorldPosition(hp); else hp.set(0, box.min.y + (box.max.y - box.min.y) * .9, 0);
  frameInfo = { minY:box.min.y, maxY:box.max.y, headY:hp.y };
}
function frameCamera() {
  if (!frameInfo || !camera) return;
  const h = Math.max(0.3, frameInfo.maxY - frameInfo.minY), mode = core.settings.vrmFrame;
  let cy, fh;
  if (mode === "face") { fh = h * 0.24; cy = frameInfo.headY + h * 0.01; }
  else if (mode === "upper") { fh = h * 0.58; cy = frameInfo.headY - h * 0.18; }
  else { fh = h * 1.1; cy = frameInfo.minY + h * 0.52; }
  const d = (fh / 2) / Math.tan(L.THREE.MathUtils.degToRad(camera.fov) / 2);
  camera.position.set(0, cy, d); camera.lookAt(0, cy, 0);
}
function applyRect() {
  const R = vrmRect(), sc = Math.min(innerWidth / 1920, innerHeight / 1080);
  const pr = Math.min(typeof TrkLite === "object" ? TrkLite.pixelRatio(2) : 2, Math.max(0.5, (devicePixelRatio || 1) * sc));   // 🪶 軽量化は描画解像度の上限
  const key = `${R.x},${R.y},${R.w},${R.h},${pr.toFixed(2)},${core.settings.vrmFrame}`;
  if (key === curKey) return;
  curKey = key;
  Object.assign(canvas.style, { left:R.x + "px", top:R.y + "px", width:R.w + "px", height:R.h + "px" });
  renderer.setPixelRatio(pr); renderer.setSize(R.w, R.h, false);
  camera.aspect = R.w / R.h; camera.updateProjectionMatrix(); frameCamera();
}
function disposeCurrent() {
  if (mixer) { mixer.stopAllAction(); mixer = null; }
  if (!vrm) return;
  pivot.remove(vrm.scene);
  if (L.VRMUtils.deepDispose) L.VRMUtils.deepDispose(vrm.scene);
  vrm = null; frameInfo = null;
}

/* ---------- モデル情報（VRM 1.0のメタ情報。すべて textContent で表示） ---------- */
function describe(meta, file) {
  const m = meta || {};
  return {
    name:String(m.name || file.name.replace(/\.vrm$/i, "")).slice(0, 60),
    authors:String(Array.isArray(m.authors) ? m.authors.join(", ") : "").slice(0, 80),
    perm:{ onlyAuthor:"author", onlySeparatelyLicensedPerson:"licensed", everyone:"everyone" }[m.avatarPermission] || "unknown",
    license:String(m.otherLicenseUrl || m.licenseUrl || "").slice(0, 120),
    redist:m.allowRedistribution === true
  };
}
function showInfo(i) {
  const box = core.$("vrmInfo"); box.textContent = "";
  if (!i) return;
  const add = (txt, cls) => box.append(core.el("div", cls || "", txt));
  add(`${tr("metaName")}: ${i.name}`);
  if (i.authors) add(`${tr("metaAuthor")}: ${i.authors}`);
  add(`${tr("metaAvatar")}: ${tr("perm_" + i.perm)}`);
  add(`${tr("metaRedist")}: ${tr(i.redist ? "redistYes" : "redistNo")}`);
  if (i.license) add(`${tr("metaLicense")}: ${i.license}`);
  if (i.perm === "author") add(tr("warnOnlyAuthor"), "vrmWarn");
  if (i.perm === "licensed") add(tr("warnLicensed"), "vrmWarn");
  add(tr("vrmConvertNote"), "vrmNote");
}

/* ---------- VRMの読み込み（VRM 1.0のみ） ---------- */
const loadVrm = (file, opts = {}) => enqueue(() => doLoadVrm(file, opts));
async function doLoadVrm(file, { fromPack = false, restored = false, select = true } = {}) {
  if (!file) return;
  if (!/\.vrm$/i.test(file.name)) { status("vrmNotVrm"); return; }
  if (file.size > MAX_VRM) { status("vrmTooBig", { n:200 }); return; }
  status("vrmLoading");
  let url = null;
  try {
    try { L = await libs(); } catch (_) { throw fail("vrmNetError"); }
    if (!setupScene()) throw fail("vrmNoWebGL");
    const loader = new L.GLTFLoader();
    loader.register(p => new L.VRMLoaderPlugin(p));
    url = URL.createObjectURL(file);
    const gltf = await loader.loadAsync(url, ev => { if (ev.total) status("vrmLoadingPct", { n:Math.round(ev.loaded / ev.total * 100) }); });
    const next = gltf.userData.vrm;
    if (!next) throw fail("vrmNotVrm");
    if (!next.meta || next.meta.metaVersion !== "1") {
      if (L.VRMUtils.deepDispose) L.VRMUtils.deepDispose(gltf.scene);
      throw fail("vrm0");
    }
    const U = L.VRMUtils;
    if (U.removeUnnecessaryVertices) U.removeUnnecessaryVertices(gltf.scene);
    if (U.combineSkeletons) U.combineSkeletons(gltf.scene);
    if (U.combineMorphs) U.combineMorphs(next);
    next.scene.traverse(o => { o.frustumCulled = false; });
    disposeCurrent();
    vrm = next; pivot.add(vrm.scene);
    if (vrm.lookAt) vrm.lookAt.target = camera;
    measure(); curKey = ""; applyRect();
    if (vrm.springBoneManager && vrm.springBoneManager.reset) vrm.springBoneManager.reset();
    lastInfo = describe(vrm.meta, file); showInfo(lastInfo);
    setLoaded(true, `${tr("vrmCreditPrefix")} ${lastInfo.name}${lastInfo.authors ? " / " + lastInfo.authors : ""}`);
    currentFile = file; packOwned = fromPack;
    bindMotion();
    status(restored ? "vrmRestored" : "vrmLoaded");
    if (select) selectVrmMascot();
    if (!fromPack && !restored && core.settings.vrmRemember) await saveStored("current", file).catch(() => status("vrmSaveFail"));
  } catch (e) {
    console.error(e);
    status(e && e.key ? e.key : "vrmLoadError");
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

/* ---------- モーション（.vrma） ---------- */
function bindMotion() {
  if (mixer) { mixer.stopAllAction(); mixer = null; }
  if (!vrm || !motionAnim || !A) return;
  const clip = A.createVRMAnimationClip(motionAnim, vrm);
  mixer = new L.THREE.AnimationMixer(vrm.scene);
  mixer.clipAction(clip).play();
}
const loadMotion = (file, opts = {}) => enqueue(() => doLoadMotion(file, opts));
async function doLoadMotion(file, { fromPack = false, restored = false } = {}) {
  if (!file) return;
  if (file.size > MAX_VRMA) { status("vrmaBad"); return; }
  let url = null;
  try {
    try { L = await libs(); A = await animLibs(); } catch (_) { throw fail("vrmNetError"); }
    const loader = new L.GLTFLoader();
    loader.register(p => new A.VRMAnimationLoaderPlugin(p));
    url = URL.createObjectURL(file);
    const gltf = await loader.loadAsync(url);
    const anim = gltf.userData.vrmAnimations && gltf.userData.vrmAnimations[0];
    if (!anim) throw fail("vrmaBad");
    motionAnim = anim; motionFile = file; packMotion = fromPack;
    bindMotion();
    if (!restored) status("vrmaLoaded");
    if (!fromPack && !restored && core.settings.vrmRemember) await saveStored("motion", file).catch(() => {});
  } catch (e) {
    console.error(e);
    status(e && e.key ? e.key : "vrmaBad");
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
function clearMotion() {
  if (mixer) { mixer.stopAllAction(); mixer = null; }
  motionAnim = null; motionFile = null; packMotion = false;
}

/* ---------- 保存していた自分のモデル・モーションを戻す（キューの中から呼ぶ） ---------- */
async function restorePersonal() {
  try {
    if (!vrm) {
      const r = await loadStored("current");
      if (r && r.file) { core.$("vrmAgree").checked = true; syncAgree(); await doLoadVrm(asFile(r, "model.vrm"), { restored:true, select:false }); }
    }
    if (!motionAnim) {
      const m = await loadStored("motion");
      if (m && m.file) await doLoadMotion(asFile(m, "motion.vrma"), { restored:true });
    }
  } catch (_) {}
}

/* ---------- 動き（ボーンと表情） ---------- */
const decay = (t0, ms, now) => Math.max(0, 1 - (now - t0) / ms);
function pose(now, dt) {
  const t = now / 1000, Hm = vrm.humanoid, bone = n => Hm && Hm.getNormalizedBoneNode(n);
  const k0 = decay(core.avatarHit[0], 200, now), k1 = decay(core.avatarHit[1], 200, now);
  const sad = decay(core.lastMissT, 800, now);
  const beat = core.phase === "playing" ? window.Trk.play.beatPulse(window.Trk.play.gameTime()) : 0;
  const talking = isTalking(), cel = talking && core.caption.speaker === 1 ? 1 : 0;
  if (mixer) {
    // モーション再生中：曲のBPMに合わせて速度を変え、叩き・うなずき・ミスの動きを上乗せ
    const mb = core.settings.vrmMotionBpm, sb = core.chartMeta.bpm || 0;
    mixer.timeScale = mb && sb ? Math.min(3, Math.max(0.25, sb / mb)) : 1;
    mixer.update(dt);
    const add = (n, x, y, z) => { const b = bone(n); if (b) { b.rotation.x += x; b.rotation.y += y; b.rotation.z += z; } };
    add("spine", 0.06 * sad, 0, 0.05 * (k1 - k0));
    add("neck", 0.06 * beat + 0.3 * sad, 0, 0);
    add("leftUpperArm", 0, 0, 0.35 * k0);
    add("rightUpperArm", 0, 0, -0.35 * k1);
  } else {
    // モーションなし：ドン＝左腕、カッ＝右腕、50コンボでバンザイ
    const set = (n, x, y, z) => { const b = bone(n); if (b) b.rotation.set(x, y, z); };
    const wave = cel ? Math.sin(t * 10) * .25 : 0;
    set("leftUpperArm", 0, 0, -1.25 + 0.95 * k0 + cel * (2.2 + wave));
    set("rightUpperArm", 0, 0, 1.25 - 0.95 * k1 - cel * (2.2 - wave));
    set("leftLowerArm", 0, -(0.35 + 0.7 * k0), 0);
    set("rightLowerArm", 0, 0.35 + 0.7 * k1, 0);
    set("spine", 0.03 * Math.sin(t * 2.1) + 0.05 * sad, 0, 0.02 * Math.sin(t * 1.3));
    set("neck", 0.06 * beat + 0.3 * sad, 0.06 * Math.sin(t * 0.9), 0.04 * (k1 - k0));
  }
  pivot.rotation.y = L.THREE.MathUtils.degToRad(core.settings.vrmTurn);
  pivot.position.y = -0.015 * beat - 0.02 * Math.max(k0, k1) + (cel ? Math.abs(Math.sin(t * 8)) * 0.03 : 0);
  const em = vrm.expressionManager;
  if (em) {
    const ex = (n, v) => { if (em.getExpression(n)) em.setValue(n, v); };
    const happy = Math.max(decay(Math.max(core.avatarHit[0], core.avatarHit[1]), 450, now) * .35, cel);
    ex("blink", (now % 3800) < 130 && happy < .3 && sad < .1 ? 1 : 0);
    ex("happy", Math.min(1, happy));
    ex("sad", sad * .8);
    ex("aa", talking ? .15 + .55 * Math.abs(Math.sin(t * 15)) : 0);
  }
  vrm.update(dt);
}

/* ---------- 描画ループ（必要なときだけ描く） ---------- */
function animate(now) {
  requestAnimationFrame(animate);
  /* 🪶 軽量化：3Dマスコットの描画レートを下げる／「描画しない」ときは何も描かない */
  const mascotOff = typeof TrkLite === "object" && TrkLite.noMascot("vrm");
  const playing = !!vrm && core.phase !== "title" && core.activeMascot() === "vrm" && !mascotOff;
  canvas.hidden = !playing;
  const previewOn = !!vrm && !mascotOff && core.phase === "title" && core.screen === "settings" && core.$("vrmPanel").open;
  if (!playing && !previewOn) { lastT = now; return; }
  if (typeof TrkLite === "object" && !TrkLite.mascotAllow("vrm", now)) return;
  const dt = Math.min(0.1, Math.max(0.001, (now - lastT) / 1000)); lastT = now;
  applyRect(); pose(now, dt);
  renderer.render(scene, camera);
  if (previewOn) {
    pctx.clearRect(0, 0, prev.width, prev.height);
    const a = canvas.width / canvas.height, dh = prev.height, dw = dh * a;
    pctx.drawImage(canvas, (prev.width - dw) / 2, 0, dw, dh);
  }
}
requestAnimationFrame(animate);

/* ---------- 設定欄 ---------- */
function syncAgree() {
  const ok = core.$("vrmAgree").checked;
  core.$("vrmFile").disabled = !ok; core.$("vrmFileLabel").classList.toggle("disabled", !ok);
}
function showTurn() { core.$("vrmTurnVal").textContent = `${core.settings.vrmTurn}°`; }
function syncControls() {
  core.$("vrmFrame").value = core.settings.vrmFrame;
  core.$("vrmTurn").value = core.settings.vrmTurn; showTurn();
  core.$("vrmMotionBpm").value = core.settings.vrmMotionBpm ? core.settings.vrmMotionBpm : "";
  core.$("vrmRemember").checked = core.settings.vrmRemember;
  curKey = "";
}
core.$("vrmAgree").addEventListener("change", syncAgree);
core.$("vrmFile").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) loadVrm(f); });
core.$("vrmFrame").addEventListener("change", e => { core.settings.vrmFrame = e.target.value; core.saveUserPrefs(); curKey = ""; });
core.$("vrmTurn").addEventListener("input", e => { core.settings.vrmTurn = Number(e.target.value); core.saveUserPrefs(); showTurn(); });
core.$("vrmMotionBpm").addEventListener("change", e => {
  const v = Number(e.target.value); core.settings.vrmMotionBpm = v >= 40 && v <= 300 ? v : 0; core.saveUserPrefs(); syncControls();
});
core.$("vrmaFile").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) loadMotion(f); });
core.$("vrmaClearBtn").addEventListener("click", () => enqueue(async () => {
  clearMotion(); try { await clearStored("motion"); } catch (_) {} status("vrmaCleared");
}));
core.$("vrmRemember").addEventListener("change", e => {
  const onFlag = e.target.checked; core.settings.vrmRemember = onFlag; core.saveUserPrefs();
  enqueue(async () => {
    try {
      if (!onFlag) { await clearStored("current"); await clearStored("motion"); }
      else {
        if (currentFile && !packOwned) await saveStored("current", currentFile);
        if (motionFile && !packMotion) await saveStored("motion", motionFile);
      }
    } catch (_) { status("vrmSaveFail"); }
  });
});
core.$("vrmClearBtn").addEventListener("click", () => enqueue(async () => {
  if (renderer) disposeCurrent();
  currentFile = null; lastInfo = null; packOwned = false; showInfo(null);
  setLoaded(false, ""); canvas.hidden = true;
  pctx.clearRect(0, 0, prev.width, prev.height);
  try { await clearStored("current"); } catch (_) {}
  status("vrmCleared");
}));
core.on("language", () => showInfo(lastInfo));

/* .vrm / .vrma のドラッグ＆ドロップ（曲用の処理より先に受け取る） */
addEventListener("drop", e => {
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (!f || !/\.(vrm|vrma)$/i.test(f.name)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (core.phase !== "title") return;
  core.showScreen("settingsScreen"); core.$("vrmPanel").open = true;
  if (/\.vrma$/i.test(f.name)) { loadMotion(f); return; }
  if (!core.$("vrmAgree").checked) { status("vrmNeedAgree"); return; }
  loadVrm(f);
}, true);

/* ---------- パック機能（custom.js）から使う窓口 ---------- */
window.ShadowTaikoVRM = {
  loadFromPack(blob, o = {}) {
    if (o.frame) core.settings.vrmFrame = o.frame;
    if (typeof o.turn === "number") core.settings.vrmTurn = o.turn;
    if (o.motionBpm) core.settings.vrmMotionBpm = o.motionBpm;
    core.saveUserPrefs(); syncControls();
    core.$("vrmAgree").checked = true; syncAgree();
    loadVrm(new File([blob], "pack.vrm", { type:"model/gltf-binary" }), { fromPack:true, restored:!o.select, select:!!o.select });
    if (o.motion) loadMotion(new File([o.motion], "pack.vrma", { type:"model/gltf-binary" }), { fromPack:true, restored:true });
  },
  unloadPack() {
    enqueue(async () => {
      if (packMotion) clearMotion();
      if (packOwned) {
        if (renderer) disposeCurrent();
        currentFile = null; packOwned = false; lastInfo = null; showInfo(null);
        setLoaded(false, ""); canvas.hidden = true; pctx.clearRect(0, 0, prev.width, prev.height);
      }
      await restorePersonal();
    });
  },
  getFiles() { return { vrm:currentFile, motion:motionFile, allowRedistribution:!!(lastInfo && lastInfo.redist) }; }
};
dispatchEvent(new Event("stvrm-ready"));

/* ---------- 起動時：パックの復元を待ってから、自分のモデルを戻す ---------- */
syncAgree(); syncControls();
/* 🪶 軽量化で「起動時に自動で読み込まない」がオンのあいだは、自分のモデルをここでは読みません。
   VRMをマスコットに選んだ／この欄を開いた／軽量化が外れた、のどれかで読みに行きます（enqueueは1列なので多重に読みません） */
function restoreWhenAllowed() {
  if (vrm && motionAnim) return;   // モデルもモーションも既にある（＝読むものがない）
  if (typeof TrkLite === "object" && TrkLite.mascotNoLoad && TrkLite.mascotNoLoad()) return;
  enqueue(async () => { if (!packOwned) await restorePersonal(); });
}
(async () => {
  try { await window.Trk.main.packsReady; } catch (_) {}
  restoreWhenAllowed();
})();
core.on("lite", () => restoreWhenAllowed());
core.on("mascot", () => { if (core.activeMascot() === "vrm") restoreWhenAllowed(); });
if (core.$("vrmPanel")) core.$("vrmPanel").addEventListener("toggle", () => { if (core.$("vrmPanel").open) restoreWhenAllowed(); });
})();
/* ✅ vrm.js 完了 —— 統合版の全ファイルがそろいました 🎉 */
