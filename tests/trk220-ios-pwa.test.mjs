// SPDX-License-Identifier: GPL-3.0-or-later
/* trk220: 🍎 iPhone のホーム画面アプリ（standalone PWA）。
   ・manifest は standalone（fullscreen は display_override で先に置く）
   ・Safari が使う apple-touch-icon 180 / apple-mobile-web-app-* をそろえる
   ・アイコンの実寸を PNG のヘッダから確かめる（作り直しても大きさが崩れない）
   ・js/ios-pwa.js は iOS だけで働き、インストール案内と音のセッションだけを扱う
   ・sw.js は install でアプリの殻を先に入れる（未訪問でもオフラインで開ける） */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const html = read("index.html");
const i18nSrc = read("js/i18n.js");
const iosSrc = read("js/ios-pwa.js");
const swSrc = read("sw.js");
const cssSrc = read("css/mobile-shell.css");
const manifest = JSON.parse(read("manifest.webmanifest"));

/* PNG のヘッダ（IHDR）から、実際の大きさを読む */
function pngSize(rel) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  assert.equal(buf.slice(1, 4).toString("ascii"), "PNG", `${rel} は PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bytes: buf.length };
}

describe("trk220 manifest：iPhone・Android のホーム画面アプリ", () => {
  test("display は standalone、fullscreen は display_override の先頭に置く", () => {
    assert.equal(manifest.display, "standalone", "iOS は fullscreen を解さない（standalone へ）");
    assert.deepEqual(manifest.display_override, ["fullscreen", "standalone", "minimal-ui"], "Android は今までどおり全画面");
  });

  test("id と、相対の start_url / scope を持つ（どのパスに置いても動く）", () => {
    assert.equal(manifest.id, "./");
    assert.equal(manifest.start_url, "./");
    assert.equal(manifest.scope, "./");
    assert.equal(/^https?:/.test(manifest.start_url), false, "絶対 URL を焼き込まない");
  });

  test("向きは固定しない（iOS は orientation を無視するため、CSS と案内で対応する）", () => {
    assert.equal(manifest.orientation, "any");
  });

  test("アイコンは 180 / 192 / 512 / maskable / 1024 がそろい、実寸も一致する", () => {
    const bySize = size => manifest.icons.filter(icon => icon.sizes === size);
    assert.equal(bySize("180x180").length, 1, "iOS のホーム画面用");
    assert.equal(bySize("192x192").length, 1);
    assert.equal(bySize("512x512").length, 2, "any と maskable で1枚ずつ");
    assert.equal(bySize("1024x1024").length, 1);
    const maskable = manifest.icons.filter(icon => icon.purpose === "maskable");
    assert.equal(maskable.length, 1, "maskable は「any maskable」ではなく専用の1枚");
    assert.equal(manifest.icons.some(icon => /any maskable/.test(icon.purpose || "")), false, "兼用は Android で余白が切れる");
    for (const icon of manifest.icons) {
      const file = icon.src.replace(/^\.\//, "");
      assert.ok(fs.existsSync(path.join(ROOT, file)), `実体がある: ${file}`);
      if (!file.endsWith(".png")) continue;
      const [w, h] = icon.sizes.split("x").map(Number);
      const real = pngSize(file);
      assert.deepEqual([real.width, real.height], [w, h], `${file} の実寸`);
    }
  });

  test("Chromium 向けの share_target と file_handlers は残す（iOS では使われないだけ）", () => {
    assert.ok(manifest.share_target, "share_target");
    assert.ok(Array.isArray(manifest.file_handlers) && manifest.file_handlers.length, "file_handlers");
  });
});

describe("trk220 index.html：Safari が読む指定", () => {
  test("apple-touch-icon 180 を先に、ほかの大きさも並べる", () => {
    const tags = [...html.matchAll(/<link rel="apple-touch-icon"[^>]*>/g)].map(m => m[0]);
    assert.ok(tags.length >= 2, "180 と予備");
    assert.ok(tags[0].includes('sizes="180x180"'), "iOS が使う 180 を先頭に");
    assert.ok(tags[0].includes('href="icons/icon-180.png"'));
    assert.ok(fs.existsSync(path.join(ROOT, "icons/icon-180.png")), "実体がある");
  });

  test("apple-mobile-web-app-* と application-name を1回ずつ書く", () => {
    for (const [name, value] of [
      ["apple-mobile-web-app-capable", "yes"],
      ["mobile-web-app-capable", "yes"],
      ["apple-mobile-web-app-status-bar-style", "black-translucent"],
      ["apple-mobile-web-app-title", "trk!"],
      ["application-name", "trk!"]
    ]) {
      const found = [...html.matchAll(new RegExp(`<meta name="${name}" content="([^"]*)">`, "g"))];
      assert.equal(found.length, 1, `${name} は1回だけ（重複すると SNS や Safari が先の方だけ読む）`);
      assert.equal(found[0][1], value, `${name} の中身`);
    }
  });

  test("manifest と theme-color はこれまでどおり", () => {
    assert.ok(html.includes('<link rel="manifest" href="manifest.webmanifest">'));
    assert.equal([...html.matchAll(/<meta name="theme-color"/g)].length, 1);
  });
});

describe("trk220 js/ios-pwa.js：iOS のときだけ働く", () => {
  test("iOS 以外では何もしない（早く返す）", () => {
    assert.ok(/const iOS = \/iPad\|iPhone\|iPod\/\.test\(ua\) \|\| iPadOS;/.test(iosSrc), "UA と iPadOS の判定");
    assert.ok(iosSrc.indexOf("if (!iOS) return;") > 0, "iOS でなければ返す");
  });

  test("音のセッションは、タップを起点に設定し、失敗しても止まらない", () => {
    assert.ok(iosSrc.includes('navigator.audioSession.type !== "playback"'), "二度書きしない");
    assert.ok(/for \(const type of \["pointerdown", "touchstart", "keydown"\]\)/.test(iosSrc), "タップ・キーを起点にする");
    assert.ok(iosSrc.includes("capture: true"), "先に受け取る");
    const help = iosSrc.slice(iosSrc.indexOf("function claimPlaybackSession"), iosSrc.indexOf("for (const type of [\"pointerdown\""));
    assert.ok(/try \{[\s\S]*catch/.test(help), "未対応の iOS でも例外を外へ出さない");
  });

  test("インストール案内は、閉じた印だけを保存する（ほかのキーを増やさない）", () => {
    assert.ok(iosSrc.includes('const DISMISS_KEY = "trk_ios_install_v1";'));
    const writes = [...iosSrc.matchAll(/localStorage\.setItem\(([^,]+),/g)].map(m => m[1].trim());
    assert.deepEqual(writes, ["DISMISS_KEY"], "書くのは印だけ");
    assert.ok(iosSrc.includes("core.settings.helpText !== false"), "説明を隠す設定の人には出さない");
  });

  test("「ようこそ」など、ほかの窓が開いている間は案内を出さずに待つ", () => {
    assert.ok(iosSrc.includes("function anotherDialogOpen()"), "ほかのダイアログを数える");
    assert.ok(iosSrc.includes('node === overlay'), "自分自身は数えない");
    const maybe = iosSrc.slice(iosSrc.indexOf("function maybeShowGuide"), iosSrc.indexOf("function retryGuide"));
    assert.ok(maybe.includes("if (anotherDialogOpen()) { retryGuide(); return; }"), "開いていたら待つ");
    assert.ok(iosSrc.includes("attempts > 40"), "待ち続けない（約2分で諦め、設定から開ける）");
  });

  test("説明を隠す設定（helpText = off）の人には出さない", () => {
    assert.ok(iosSrc.includes('document.body.classList.contains("helpTextOff")'));
  });

  test("standalone のときは案内しない（もうアプリとして開いている）", () => {
    assert.ok(/navigator\.standalone === true/.test(iosSrc), "ホーム画面アプリの判定");
    const open = iosSrc.slice(iosSrc.indexOf("function openGuide"), iosSrc.indexOf("function hideGuide"));
    assert.ok(open.includes("if (isStandalone()) return;"), "案内の入口で弾く");
    const auto = iosSrc.slice(iosSrc.lastIndexOf("if (!dismissed()"));
    assert.ok(auto.includes("!isStandalone()"), "自動の案内でも弾く");
  });

  test("案内はフォーカスを閉じ込め、Esc と背景のどちらでも閉じられる", () => {
    assert.ok(iosSrc.includes('overlay.setAttribute("aria-modal", "true")'));
    assert.ok(iosSrc.includes('overlay.setAttribute("role", "dialog")'));
    assert.ok(/event\.key === "Escape"/.test(iosSrc), "Esc（外付けキーボード）で閉じる");
    assert.ok(/event\.key !== "Tab"/.test(iosSrc), "Tab を外へ出さない");
    assert.ok(iosSrc.includes("lastFocus"), "閉じたら元の場所へ戻す");
  });

  test("更新はサービスワーカーに確かめさせ、そのあと開き直す", () => {
    assert.ok(iosSrc.includes("navigator.serviceWorker.getRegistration()"));
    assert.ok(iosSrc.includes("await registration.update()"));
    assert.ok(iosSrc.includes("location.reload()"));
  });

  test("iOS では「共有」ではなく「フォルダを選ぶ」と言い換える", () => {
    assert.ok(/relabel\("libShareBtn", "libPickFolderIos"\)/.test(iosSrc));
    assert.ok(/relabel\("libShareSettingsBtn", "libPickFolderIos"\)/.test(iosSrc));
    assert.ok(iosSrc.includes("[data-i18n='libShareHint']"), "元のヒントを探す（id ではなく data-i18n で）");
    assert.ok(iosSrc.includes('shareHint.textContent = tr("libShareHintIos")'));
  });

  test("設定に「🍎 iPhoneで使う」の欄がある（インストール案内と更新）", () => {
    assert.ok(html.includes('id="iosPanel"'), "欄");
    assert.ok(html.includes('id="iosInstallBtn"'), "案内を開き直す");
    assert.ok(html.includes('id="iosUpdateBtn"'), "更新");
    assert.ok(html.includes('id="iosUpdateStatus"'), "結果の読み上げ");
    const start = html.indexOf('id="iosPanel"');
    const panel = html.slice(start, html.indexOf("</details>", start));
    assert.ok(panel.includes('data-i18n="iosStorageHint"'), "保存の説明");
    assert.ok(panel.includes('data-i18n="iosAudioHint"'), "音の説明");
    assert.ok(html.includes('<details class="panel ios-only" id="iosPanel">'), "iOS 以外では出さない（ios-only）");
  });

  test("iOS のための文言は4言語そろっている", () => {
    for (const key of ["iosInstallTitle", "iosInstallLead", "iosInstallStep1", "iosInstallStep2", "iosInstallStep3",
      "iosInstallNote", "iosInstallClose", "iosInstallLater", "iosInstallBtn", "iosUpdateBtn",
      "iosUpdateChecking", "iosUpdateDone", "iosUpdateFailed", "iosStorageHint", "iosAudioHint",
      "secIos", "libPickFolderIos", "libShareHintIos"]) {
      assert.equal((i18nSrc.match(new RegExp(`\\b${key}:"`, "g")) || []).length, 4, `${key} は4言語`);
    }
  });

  test("iOS 以外では欄も案内も見えない（body.ios のときだけ出す）", () => {
    assert.ok(/\.ios-only \{ display: none !important; \}/.test(cssSrc));
    assert.ok(/body\.ios \.ios-only \{ display: block !important; \}/.test(cssSrc));
  });
});

describe("trk220 sw.js：install で、アプリの殻を先に入れる", () => {
  test("殻の一覧は index.html から読む（ファイルを足しても直さなくてよい）", () => {
    assert.ok(swSrc.includes("async function precacheShell()"));
    assert.ok(/<script\\b\[\^>\]\*\\bsrc=/.test(swSrc), "index.html の script を読む");
    assert.ok(/<link\\b\[\^>\]\*\\bhref=/.test(swSrc), "index.html の link を読む");
    assert.ok(swSrc.includes("new URL(\"index.html\", SCOPE)"), "同じスコープの index.html");
  });

  test("重いもの（3D・同梱デモ音源・docs・tools）は先に入れない", () => {
    const skip = swSrc.slice(swSrc.indexOf("const PRECACHE_SKIP"), swSrc.indexOf("]", swSrc.indexOf("const PRECACHE_SKIP")));
    for (const prefix of ["assets/vendor/", "assets/optional-demo-audio/", "docs/", "tools/"]) {
      assert.ok(skip.includes(`"${prefix}"`), `${prefix} は入れない`);
    }
  });

  test("1つ失敗しても、ほかは入れ、install も止まらない", () => {
    const fn = swSrc.slice(swSrc.indexOf("async function precacheShell"), swSrc.indexOf('self.addEventListener("install"'));
    assert.ok(fn.includes("try {"), "ファイルごとに握る");
    assert.ok(fn.includes("catch {"), "失敗を飲む");
    const install = swSrc.slice(swSrc.indexOf('self.addEventListener("install"'), swSrc.indexOf('self.addEventListener("activate"'));
    assert.ok(install.includes("try { await precacheShell(); } catch"), "殻が入らなくても起動する");
    assert.ok(install.includes("self.skipWaiting()"), "待たせない");
  });

  test("今までの約束は変えない（通信優先・セーフモード・固定 vendor）", () => {
    assert.ok(swSrc.includes('fetch(request, { cache:"no-cache" })'), "通信優先のまま");
    assert.ok(swSrc.includes("Safe mode does not use the cached copy"), "セーフモードの扱い");
    assert.ok(swSrc.includes("BEGIN VENDOR PINS"), "固定 vendor");
    const cache = swSrc.match(/^const CACHE = "trk-v([\d.]+)-trk(\d+)";$/m);
    assert.ok(cache && Number(cache[2]) >= 220, "キャッシュ名を進める（古い殻を消す）");
  });

  test("オフラインの案内は今までどおり返す", () => {
    assert.ok(swSrc.includes("trk! is offline. Reconnect to load this file."));
    assert.ok(swSrc.includes("const offlineHome = new URL(\"index.html\", SCOPE).href;"));
  });
});
