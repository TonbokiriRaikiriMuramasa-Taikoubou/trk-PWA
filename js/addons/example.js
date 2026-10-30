// SPDX-License-Identifier: GPL-3.0-or-later
/* ==========================================================================
   trk! アドオンのサンプル — 🧩 example.js
   設定画面「🧩 アドオン」→「📄 アドオンを入れる」で、このファイルをそのまま選ぶと動きます。
   （index.html に <script src="js/addons/example.js"></script> を足してもOK）

   ここに書いてあることを真似すると、自分のアドオンが作れます。
   くわしくは docs/ADDONS.md を見てください。
   ========================================================================== */

TrkAddons.register({
  id: "example.sample",                   // 英数字と . _ - で2〜40文字（重複すると入れ替えになります）
  name: "サンプルアドオン",                 // 一覧に出る名前
  version: "1.0.0",
  author: "trk!",
  description: "アドオンの書き方の見本です。ボタンを押すと、その場でごあいさつします。",
  apiVersion: 1,

  /* setup(api) は、読み込まれたときに1回だけ呼ばれます */
  setup(api) {
    /* 見た目を足す（<style> が1つ入ります） */
    api.addStyle(`
      .exSample{border:1px dashed var(--ui-border);border-radius:14px;padding:12px 14px;background:var(--ui-soft)}
      .exSample b{color:var(--ui-accent)}
    `);

    /* 置き場所（slot）に、自分のUIを足す
       "settings" … 設定画面のアドオン欄の中
       "libPanel" … 曲リスト（#libPanel）の中
       "tvMore"   … テレビの「くわしい」の中
       "rackMore" … ラックの「くわしい」の中 */
    const box = api.el("div", "exSample");
    const btn = api.el("button", "", "🧩 ごあいさつ");
    btn.type = "button";
    const out = api.el("span", "hint", " ");

    let n = 0;
    btn.addEventListener("click", () => {
      n += 1;
      out.textContent = ` ${n}回目！ 10回押したら、なにか見つかるかも`;
      api.log("greeting", n);                       // コンソールに [addon:example.sample] greeting 3 と出ます
      if (n === 10) {
        /* 文章（4言語）を引く。api.tr は、本体の TEXT から取ります */
        out.textContent = " 10回！ えらい！";
        /* 本体のイベントを流す（他のアドオンや本体が拾えます） */
        api.emit("exampleTen", { n });
      }
    });

    box.append(api.el("b", "", "サンプルアドオン"), btn, out);
    const slot = api.slot("settings");
    if (slot) slot.append(box);

    /* 置き場所が使えないとき（DOMの場所が変わった等）の保険 */
    if (!slot) api.say("置き場所が見つかりませんでした（settings スロット）");

    /* 言語が変わったら、自分のUIの文字も作り直す */
    api.on("language", () => api.log("language:", api.settings.language));

    /* ---- 曲を足す例（使うときはコメントを外してください）----
       api.addSongs([
         { key:"example:1", title:"サンプルの曲", artist:"サンプル",
           file: myBlob }              // Blob/File を渡すと、本体の再生・エフェクターに、そのまま乗ります
       ]);
       file を渡さない曲は、選んだときに "addonSelect" が流れるので、自前のプレイヤーで鳴らします。

    ---- エフェクターに通す例（自前の音を持つアドオン向け）----
       const audio = new Audio("https://example.com/song.mp3");
       if (api.fx.available()) api.fx.tapElement(audio);   // これで本体のEQ・エフェクターがかかります
       audio.play();
       // ブラウザの仕様で、他のサイト（YouTube の iframe など）の音を横取りすることはできません。
       // 「自分の手元にある音」や「配布OKの音」を鳴らすときに使ってください。
    */
  },

  /* 任意：外したときの後片付け（いまは、外したあとリロードする運用です） */
  teardown() { console.log("[addon:example.sample] さようなら"); }
});
