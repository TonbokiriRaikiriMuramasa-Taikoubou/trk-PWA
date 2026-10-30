// SPDX-License-Identifier: GPL-3.0-or-later  ※プログラム部分のみ。下の注意を必ずお読みください。
/* ============ trk!：初音ミク マスコット（このファイルだけで完結しています） ============

  【このファイルの扱い】
  ・ここで描いている「初音ミク」の権利は、クリプトン・フューチャー・メディア株式会社にあります。
    GPL ではこの権利を許諾できません。ピアプロ・キャラクター・ライセンス（PCL）の範囲でのみ使えます。
      https://piapro.jp/license/pcl
  ・非営利・無償のみ：販売、広告、有料機能、投げ銭・寄付など、あらゆる名目の対価を受け取る形では使えません。
  ・商用の派生版を作るときや、ミクを入れたくないときは、
      1) このファイルを削除し、
      2) index.html の <script src="js/characters/miku.js"></script> を1行消してください。
    ほかのファイルは直さなくても、そのまま動きます。
  ・「冬服ミク」「春ミク」「ちびミク」「黒衣装ミク」「アイドル服ミク」はオリジナルのアレンジです。雪ミク・桜ミク・ミクダヨーではありません。
  ・Canvas で一から描いた二次創作です。公式画像は使っていません。

  【MOD作者の方へ】
  自分のキャラクターを追加したいときは、このファイルを見本にして registerMascot() を呼んでください。 */
"use strict";
(() => {
  /* ---------- 文章（PCLクレジットはこのファイルが持ちます） ---------- */
  Object.assign(TEXT.ja, {
    mascotMiku:"初音ミク", mascotMikuNT:"初音ミク NT風アレンジ", mascotMikuWinter:"冬服ミク（オリジナル衣装・雪）",
    mascotMikuSakura:"春ミク（桜かんざし）", mascotMikuChibi:"ちびミク（デフォルメ）",
    mascotMikuNoir:"黒衣装ミク（オリジナル衣装）", mascotMikuIdol:"アイドル服ミク（オリジナル衣装・星）",
    mascotHint:"マスコットはプレイ中に画面の隅で応援してくれます。初音ミクのマスコットは、ピアプロ・キャラクター・ライセンス（PCL）に基づく非公式の二次創作です。非営利・無償の範囲でお楽しみください（収益化している配信ではオフにしてください）。",
    pclCredit:"この作品はピアプロ・キャラクター・ライセンスに基づいてクリプトン・フューチャー・メディア株式会社のキャラクター「初音ミク」を描いたものです。",
    pclShort:"初音ミク：PCLに基づく二次創作（非公式）"
  });
  Object.assign(TEXT.en, {
    mascotMiku:"Hatsune Miku", mascotMikuNT:"Hatsune Miku (NT-inspired)", mascotMikuWinter:"Winter Miku (original outfit, snow)",
    mascotMikuSakura:"Spring Miku (sakura hairpin)", mascotMikuChibi:"Chibi Miku",
    mascotMikuNoir:"Miku in black (original outfit)", mascotMikuIdol:"Idol Miku (original outfit, stars)",
    mascotHint:"Mascots cheer you on from the corner during play. The Hatsune Miku mascots are unofficial fan art under the Piapro Character License (PCL): non-commercial, free use only (please turn them off on monetized streams).",
    pclCredit:"This work depicts the character “Hatsune Miku” of Crypton Future Media, INC. under the Piapro Character License.",
    pclShort:"Hatsune Miku: fan art under PCL (unofficial)"
  });
  Object.assign(TEXT.zh, {
    mascotMiku:"初音未来", mascotMikuNT:"初音未来 NT风改编", mascotMikuWinter:"冬装初音（原创服装・雪）",
    mascotMikuSakura:"春日初音（樱花发簪）", mascotMikuChibi:"Q版初音",
    mascotMikuNoir:"黑衣初音（原创服装）", mascotMikuIdol:"偶像服初音（原创服装・星星）",
    mascotHint:"吉祥物会在游戏中于画面角落为你加油。初音未来吉祥物是基于Piapro角色许可（PCL）的非官方二次创作，仅限非营利、免费使用（营利直播请关闭）。",
    pclCredit:"本作品依据Piapro角色许可，描绘了Crypton Future Media株式会社的角色「初音未来」。",
    pclShort:"初音未来：基于PCL的二次创作（非官方）"
  });
  Object.assign(TEXT.ko, {
    mascotMiku:"하츠네 미쿠", mascotMikuNT:"하츠네 미쿠 NT풍 어레인지", mascotMikuWinter:"겨울옷 미쿠 (오리지널 의상・눈)",
    mascotMikuSakura:"봄 미쿠 (벚꽃 비녀)", mascotMikuChibi:"꼬마 미쿠",
    mascotMikuNoir:"검은 옷 미쿠 (오리지널 의상)", mascotMikuIdol:"아이돌 옷 미쿠 (오리지널 의상・별)",
    mascotHint:"마스코트가 플레이 중 화면 구석에서 응원해 줍니다. 하츠네 미쿠 마스코트는 피아프로 캐릭터 라이선스(PCL)에 따른 비공식 2차 창작이며, 비영리・무상으로만 사용할 수 있습니다 (수익화 방송에서는 꺼 주세요).",
    pclCredit:"이 작품은 피아프로 캐릭터 라이선스에 따라 크립톤 퓨처 미디어 주식회사의 캐릭터 '하츠네 미쿠'를 그린 것입니다.",
    pclShort:"하츠네 미쿠: PCL에 따른 2차 창작 (비공식)"
  });

  /* ---------- 衣装の色 ---------- */
  const BASE = { hair:"#39c5bb", hairDark:"#1e8c85", eye:"#159c93", skin:"#ffe6d5", shirt:"#c9cdd2", sleeves:"#2b2f36",
    tie:"#39c5bb", skirt:"#2b2f36", legs:"#2b2f36", tie2:"#e8457c", headset:"#3a3f48", headScale:1 };
  const VARIANTS = {
    miku:       { ...BASE },
    mikuNT:     { ...BASE, shirt:"#f3f5f6", sleeves:"#f3f5f6", skirt:"#22303a", legs:"#22303a", tie:"#22303a", tie2:"#39c5bb" },
    mikuWinter: { ...BASE, shirt:"#f6f9ff", sleeves:"#dde8f6", skirt:"#8fb0d6", legs:"#e6edf6", scarf:"#4f9fe0", extra:"snow" },
    mikuSakura: { ...BASE, tie:"#f28fb0", tie2:"#f7a8c4", extra:"sakura" },
    mikuNoir:   { ...BASE, shirt:"#16161c", sleeves:"#101014", skirt:"#0c0c10", legs:"#101014", tie:"#39c5bb", tie2:"#ff5d8f", headset:"#23232c" },
    mikuIdol:   { ...BASE, shirt:"#ffffff", sleeves:"#ffb9d2", skirt:"#ff8abf", legs:"#ffe1ec", tie:"#ff5d9e", tie2:"#ffe08a", extra:"star" },
    mikuChibi:  { ...BASE, headScale:1.35 }
  };
  const LABEL_KEYS = { miku:"mascotMiku", mikuNT:"mascotMikuNT", mikuWinter:"mascotMikuWinter", mikuSakura:"mascotMikuSakura", mikuNoir:"mascotMikuNoir", mikuIdol:"mascotMikuIdol", mikuChibi:"mascotMikuChibi" };

  /* ---------- 描画（rr・ctx・TAU はゲーム本体の関数・変数。プレイ中にだけ呼ばれます） ---------- */
  function drawMiku(x, y, v, st) {
    const p = st.p, hs = v.headScale || 1, sway = Math.sin(p / 380) * 6;
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (v.extra) {
      for (let i = 0; i < 12; i++) {
        const sp = 1 + (i % 4) * .35;
        const px = ((i * 53 + p * .018 * sp) % 240) - 120 + Math.sin(p / 600 + i) * 8;
        const py = ((p * .035 * sp + i * 41) % 230) - 150;
        ctx.globalAlpha = .85;
        if (v.extra === "snow") {
          ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "rgba(80,130,180,.5)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(px, py, 2 + (i % 3), 0, window.Trk.data.TAU); ctx.fill(); ctx.stroke();
        } else if (v.extra === "star") {
          ctx.save(); ctx.translate(px, py); ctx.rotate(p / 700 + i);
          ctx.globalAlpha = .55 + .4 * Math.sin(p / 260 + i * 1.7);      // きらきら
          ctx.fillStyle = i % 2 ? "#ffe08a" : "#ffffff";
          ctx.beginPath();
          for (let k = 0; k < 4; k++) {
            const a = k * Math.PI / 2;
            ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6);
            ctx.lineTo(Math.cos(a + Math.PI / 4) * 2.2, Math.sin(a + Math.PI / 4) * 2.2);
          }
          ctx.closePath(); ctx.fill(); ctx.restore();
        } else {
          ctx.save(); ctx.translate(px, py); ctx.rotate(p / 500 + i);
          ctx.fillStyle = "#f7a8c4"; ctx.beginPath(); ctx.ellipse(0, 0, 5, 3, 0, 0, window.Trk.data.TAU); ctx.fill(); ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    }
    const ay = -44 - 26 * hs;
    for (const s of [-1, 1]) {
      const ax = s * 36 * hs;
      ctx.beginPath(); ctx.moveTo(ax, ay);
      ctx.bezierCurveTo(s * 92, ay + 10, s * 82 + sway, 30, s * 60 + sway, 78);
      ctx.bezierCurveTo(s * 50 + sway, 40, s * 46, 0, ax - s * 8, ay + 18);
      ctx.closePath(); ctx.fillStyle = v.hair; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = v.hairDark; ctx.stroke();
    }
    ctx.fillStyle = v.legs; rr(-16, 46, 12, 28, 5); ctx.fill(); rr(4, 46, 12, 28, 5); ctx.fill();
    ctx.fillStyle = v.skirt; ctx.beginPath();
    ctx.moveTo(-20, 24); ctx.lineTo(20, 24); ctx.lineTo(30, 52); ctx.lineTo(-30, 52); ctx.closePath(); ctx.fill();
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * 19, -2);
      ctx.rotate(-s * (st.happy ? 2.4 : st.sad ? 0.1 : 0.3));
      rr(-5, 0, 10, 30, 5); ctx.fillStyle = v.sleeves; ctx.fill();
      ctx.fillStyle = v.skin; ctx.beginPath(); ctx.arc(0, 32, 5, 0, window.Trk.data.TAU); ctx.fill();
      ctx.restore();
    }
    rr(-20, -8, 40, 36, 10); ctx.fillStyle = v.shirt; ctx.fill();
    ctx.fillStyle = v.tie; ctx.beginPath();
    ctx.moveTo(-5, -6); ctx.lineTo(5, -6); ctx.lineTo(3, 14); ctx.lineTo(0, 19); ctx.lineTo(-3, 14); ctx.closePath(); ctx.fill();
    if (v.scarf) { ctx.fillStyle = v.scarf; rr(-24, -12, 48, 11, 5); ctx.fill(); rr(8, -6, 10, 22, 4); ctx.fill(); }
    ctx.save(); ctx.translate(0, -44); ctx.scale(hs, hs);
    ctx.fillStyle = v.hair; ctx.beginPath(); ctx.arc(0, -2, 44, Math.PI * .85, Math.PI * 2.15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = v.skin; ctx.beginPath(); ctx.ellipse(0, 6, 35, 32, 0, 0, window.Trk.data.TAU); ctx.fill();
    ctx.fillStyle = v.hair; ctx.beginPath();
    ctx.moveTo(-44, 0); ctx.arc(0, -2, 44, Math.PI, Math.PI * 2);
    ctx.lineTo(40, -2); ctx.lineTo(30, -12); ctx.lineTo(20, 2); ctx.lineTo(8, -14); ctx.lineTo(-4, 0);
    ctx.lineTo(-16, -14); ctx.lineTo(-26, 2); ctx.lineTo(-36, -10); ctx.closePath(); ctx.fill();
    rr(-44, -4, 11, 44, 5); ctx.fill(); rr(33, -4, 11, 44, 5); ctx.fill();
    ctx.fillStyle = v.headset; rr(-49, -2, 10, 20, 4); ctx.fill(); rr(39, -2, 10, 20, 4); ctx.fill();
    ctx.strokeStyle = v.headset; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(44, 16); ctx.quadraticCurveTo(40, 30, 24, 30); ctx.stroke();
    ctx.beginPath(); ctx.arc(22, 30, 3, 0, window.Trk.data.TAU); ctx.fill();
    if (v.extra === "sakura") {
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * window.Trk.data.TAU + p / 2000;
        ctx.fillStyle = "#f7a8c4"; ctx.beginPath(); ctx.ellipse(26 + Math.cos(a) * 6, -26 + Math.sin(a) * 6, 5, 3.5, a, 0, window.Trk.data.TAU); ctx.fill();
      }
      ctx.fillStyle = "#fff2a8"; ctx.beginPath(); ctx.arc(26, -26, 2.5, 0, window.Trk.data.TAU); ctx.fill();
    }
    ctx.lineWidth = 3.5; ctx.strokeStyle = "#2a2a35";
    if (st.sad) {
      for (const s of [-1, 1]) {
        const ex = s * 14, ey = 8;
        ctx.beginPath(); ctx.moveTo(ex + 6 * s, ey - 5); ctx.lineTo(ex - 5 * s, ey); ctx.lineTo(ex + 6 * s, ey + 5); ctx.stroke();
      }
    } else {
      const eh = (p % 3600) < 120 ? 1.5 : st.happy ? 5 : 9;
      for (const s of [-1, 1]) {
        ctx.fillStyle = v.eye; ctx.beginPath(); ctx.ellipse(s * 14, 8, 6.5, eh, 0, 0, window.Trk.data.TAU); ctx.fill();
        if (eh > 4) { ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(s * 14 - 2, 5, 2.2, 0, window.Trk.data.TAU); ctx.fill(); }
      }
    }
    ctx.globalAlpha = .35; ctx.fillStyle = "#ff7a9a";
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 22, 18, 6, 3.5, 0, 0, window.Trk.data.TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#c0395a"; ctx.strokeStyle = "#a83250"; ctx.lineWidth = 2.5;
    if (st.talking) { ctx.beginPath(); ctx.ellipse(0, 24, 5, 2 + Math.abs(Math.sin(p / 70)) * 5, 0, 0, window.Trk.data.TAU); ctx.fill(); }
    else if (st.sad) { ctx.beginPath(); ctx.arc(0, 30, 6, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(0, 20, st.happy ? 7 : 5, .15 * Math.PI, .85 * Math.PI); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = v.tie2;
    for (const s of [-1, 1]) { rr(s * 36 * hs - 7, ay - 7, 14, 14, 3); ctx.fill(); }
    ctx.restore();
  }

  /* ---------- マスコットとして登録 ---------- */
  for (const [id, v] of Object.entries(VARIANTS)) {
    window.Trk.data.registerMascot(id, {
      family:"miku",
      draw:(x, y, st) => drawMiku(x, y, v, st),
      top:-44 - 46 * (v.headScale || 1) - 6,   // 吹き出しを出す高さ
      shadowY:80,
      border:"#39c5bb",
      credit:() => tr("pclShort")              // プレイ中、右下にPCLクレジットを表示
    });
  }
  window.Trk.data.MASCOT_CAPTIONS.miku = {
    capStart:{ja:"いっくよー！一緒に叩こう♪",en:"Here we go! Let's drum together♪",zh:"要开始啦！一起敲吧♪",ko:"간다~! 같이 두드리자♪"},
    capCombo:{ja:"{n}コンボ！すごいすごい！",en:"{n} combo! Amazing!",zh:"{n}连击！好厉害！",ko:"{n} 콤보! 굉장해!"},
    capBreak:{ja:"どんまい！次いこっ！",en:"Don't worry! On to the next one!",zh:"没关系！继续加油！",ko:"괜찮아! 다음 가자!"}
  };

  /* ---------- スキン：ミク・ティール／ノワール／クラシック／アイドル（＋スノーフィールドの標準マスコット） ---------- */
  window.Trk.data.SKINS.miku39 = {
    cat:["basic","miku"],
    label:{ja:"ミク・ティール",en:"Miku Teal",zh:"初音青",ko:"미쿠 틸"},
    desc:{ja:"初音ミク二次創作（PCL・非公式）",en:"Hatsune Miku fan art (PCL, unofficial)",zh:"初音未来二次创作（PCL・非官方）",ko:"하츠네 미쿠 2차 창작 (PCL・비공식)"},
    ui:{"--ui-bg":"#071a1a","--ui-panel":"rgba(10,32,33,.96)","--ui-soft":"rgba(57,197,187,.07)","--ui-text":"#e9fffd",
      "--ui-muted":"#9fc9c5","--ui-border":"rgba(57,197,187,.30)","--ui-button":"#0e2a2a","--ui-button-hover":"#143a3a",
      "--ui-field":"#061514","--ui-accent":"#39c5bb","--ui-on-accent":"#04201e","--ui-gold":"#ff9ec4",
      "--ui-shadow":"0 0 60px rgba(57,197,187,.18)","--ui-glow":"rgba(57,197,187,.18)"},
    game:{don:"#ff5d8f",ka:"#39c5bb",stage:"#061414",lane:"rgba(4,24,24,.62)",track:"rgba(57,197,187,.30)",ink:"#e9fffd",
      inkShadow:"rgba(0,0,0,.85)",noteBorder:"#ffffff",panel:"rgba(6,26,26,.95)",perfect:"#ff9ec4",good:"#e9fffd",miss:"#6f8f8c",glow:true},
    shapes:["circle","circle"], video:"grayscale(1) contrast(1.4) sepia(1) hue-rotate(130deg) saturate(1.6) brightness(.7)",
    font:'"Trebuchet MS","Avenir Next",system-ui,sans-serif', mascot:"miku"
  };
  if (window.Trk.data.SKINS.snowfield) window.Trk.data.SKINS.snowfield.mascot = "mikuWinter";

  window.Trk.data.SKINS.mikuNoir = {
    cat:["miku","dark"],
    label:{ja:"ミク・ノワール",en:"Miku Noir",zh:"初音・黑",ko:"미쿠 누아르"},
    desc:{ja:"黒い衣装のミク（二次創作・PCL・非公式）",en:"Miku in black (fan art, PCL, unofficial)",zh:"黑衣初音（二次创作・PCL・非官方）",ko:"검은 옷 미쿠 (2차 창작・PCL・비공식)"},
    ui:{"--ui-bg":"#06070c","--ui-panel":"rgba(12,14,22,.96)","--ui-soft":"rgba(57,197,187,.07)","--ui-text":"#f2f6ff",
      "--ui-muted":"#a3adc4","--ui-border":"rgba(57,197,187,.28)","--ui-button":"#131726","--ui-button-hover":"#1b2136",
      "--ui-field":"#0a0d16","--ui-accent":"#39c5bb","--ui-on-accent":"#04201e","--ui-gold":"#ff5d8f",
      "--ui-shadow":"0 0 60px rgba(57,197,187,.16)","--ui-glow":"rgba(57,197,187,.16)"},
    game:{don:"#ff5d8f",ka:"#39c5bb",stage:"#05070b",lane:"rgba(4,8,16,.66)",track:"rgba(57,197,187,.30)",ink:"#f2f6ff",
      inkShadow:"rgba(0,0,0,.85)",noteBorder:"#ffffff",panel:"rgba(9,11,19,.95)",perfect:"#ff9ec4",good:"#f2f6ff",miss:"#5d6a85",glow:true},
    shapes:["circle","circle"], video:"grayscale(1) contrast(1.5) brightness(.65)",
    font:'"Trebuchet MS","Avenir Next",system-ui,sans-serif', mascot:"mikuNoir"
  };
  window.Trk.data.SKINS.mikuClassic = {
    cat:["miku","light"],
    label:{ja:"ミク・クラシック",en:"Miku Classic",zh:"初音・经典",ko:"미쿠 클래식"},
    desc:{ja:"初期配色を思わせるミク（二次創作・PCL・非公式）",en:"Early-coloring Miku (fan art, PCL, unofficial)",zh:"令人想起初期配色的初音（二次创作・PCL・非官方）",ko:"초기 배색을 떠올리게 하는 미쿠 (2차 창작・PCL・비공식)"},
    ui:{"--ui-bg":"#eef3f3","--ui-panel":"rgba(255,255,255,.97)","--ui-soft":"rgba(31,158,148,.06)","--ui-text":"#23343a",
      "--ui-muted":"#526770","--ui-border":"rgba(35,90,100,.20)","--ui-button":"#e5eeee","--ui-button-hover":"#d7e5e6",
      "--ui-field":"#ffffff","--ui-accent":"#1f9e94","--ui-on-accent":"#000000","--ui-gold":"#e8457c",
      "--ui-shadow":"0 24px 70px rgba(40,90,95,.14)","--ui-glow":"rgba(31,158,148,.12)"},
    game:{don:"#e8457c",ka:"#1f9e94",stage:"#ecf3f3",lane:"rgba(255,255,255,.84)",track:"rgba(31,158,148,.26)",ink:"#23343a",
      inkShadow:"rgba(255,255,255,.9)",noteBorder:"#ffffff",panel:"rgba(248,253,253,.96)",perfect:"#d9782a",good:"#23343a",miss:"#93a5ab",glow:false},
    shapes:["circle","circle"], video:"grayscale(.25) brightness(1.08) contrast(1.05)",
    font:'"Trebuchet MS","Avenir Next",system-ui,sans-serif', mascot:"miku"
  };
  window.Trk.data.SKINS.mikuIdol = {
    cat:["miku","dark","grad"],
    label:{ja:"ミク・アイドル",en:"Miku Idol",zh:"初音・偶像",ko:"미쿠 아이돌"},
    desc:{ja:"星降る夜のアイドル服ミク（二次創作・PCL・非公式）",en:"Idol-outfit Miku under falling stars (fan art, PCL, unofficial)",zh:"星夜偶像服初音（二次创作・PCL・非官方）",ko:"별이 쏟아지는 밤의 아이돌 옷 미쿠 (2차 창작・PCL・비공식)"},
    ui:{"--ui-bg":"linear-gradient(180deg,#170a24,#33133f)","--ui-panel":"rgba(26,12,38,.96)","--ui-soft":"rgba(255,138,190,.07)","--ui-text":"#fff0fa",
      "--ui-muted":"#c9a8cf","--ui-border":"rgba(255,138,190,.32)","--ui-button":"#241031","--ui-button-hover":"#321944",
      "--ui-field":"#170a24","--ui-accent":"#ff8abf","--ui-on-accent":"#2a0a1c","--ui-gold":"#ffe08a",
      "--ui-shadow":"0 0 60px rgba(255,138,190,.18)","--ui-glow":"rgba(255,138,190,.15)"},
    game:{don:"#ff8abf",ka:"#8fd0ff",stage:"linear-gradient(180deg,#120818,#241030)",lane:"rgba(18,8,26,.62)",track:"rgba(255,138,190,.30)",ink:"#fff0fa",
      inkShadow:"rgba(0,0,0,.85)",noteBorder:"#ffffff",panel:"rgba(22,10,32,.95)",perfect:"#ffe08a",good:"#fff0fa",miss:"#8f719c",glow:true},
    shapes:["circle","circle"], video:"grayscale(1) contrast(1.35) sepia(1) hue-rotate(280deg) saturate(1.5) brightness(.7)",
    font:'"Trebuchet MS","Avenir Next",system-ui,sans-serif', mascot:"mikuIdol"
  };

  /* ---------- 設定画面の選択肢を追加（index.html に書かなくてよいように） ---------- */
  for (const selId of ["mascotSelect", "makerMascot"]) {
    const sel = document.getElementById(selId); if (!sel) continue;
    const before = sel.querySelector('option[value="vrm"]');
    for (const [v, key] of Object.entries(LABEL_KEYS)) {
      if (sel.querySelector(`option[value="${v}"]`)) continue;      // 古い index.html にあっても二重にしない
      const o = document.createElement("option");
      o.value = v; o.dataset.i18n = key; o.textContent = key;
      sel.insertBefore(o, before);
    }
  }
})();
/* ✅ characters/miku.js 完了 */
