// SPDX-License-Identifier: GPL-3.0-or-later
/* ==========================================================================
   trk! tv-presets.js — 📺 映像フィルターのプリセット（70種類）
   ・定番45種＋人物／アニメ・セル／質感／スタジオ・品質の新作20種＋効果の新作5種（70種）
   ・各プリセットは CSS filter 文字列と、任意の overlay タイプを持つ
   ・overlay は tv-dock.js が render で描画する（scanlines, letterbox, vhs など）
   ・形式は fx-presets と似せるが、独立（映像は記録に影響しない）
   読み込み順：data.js → tv-presets.js → core.js の後で tv-dock が包む
   ========================================================================== */
"use strict";

const TRK_TV_PRESETS = [
  // basic
  {
    id:"skin",
    cat:"basic",
    label:{ja:"スキン標準", en:"Skin default", zh:"皮肤默认", ko:"스킨 기본"},
    desc:{ja:"スキンが決めた色味", en:"Uses the skin's color", zh:"使用皮肤配色", ko:"스킨 색감 사용"},
    filter:null
  },
  {
    id:"color",
    cat:"basic",
    label:{ja:"オリジナル（カラー）", en:"Original color", zh:"原色", ko:"원본 컬러"},
    desc:{ja:"そのままの色", en:"No filter", zh:"无滤镜", ko:"필터 없음"},
    filter:"none"
  },
  {
    id:"mono",
    cat:"basic",
    label:{ja:"モノクロ", en:"Monochrome", zh:"黑白", ko:"흑백"},
    desc:{ja:"白黒", en:"Black & white", zh:"黑白", ko:"흑백"},
    filter:"grayscale(1) contrast(1.6)"
  },
  {
    id:"dim",
    cat:"basic",
    label:{ja:"暗め", en:"Dimmed", zh:"调暗", ko:"어둡게"},
    desc:{ja:"少し暗く", en:"Slightly dim", zh:"稍暗", ko:"조금 어둡게"},
    filter:"brightness(.42) saturate(.85)"
  },
  {
    id:"off",
    cat:"basic",
    label:{ja:"非表示", en:"Off", zh:"隐藏", ko:"숨기기"},
    desc:{ja:"映像を消す", en:"Hide video", zh:"隐藏视频", ko:"영상 숨기기"},
    filter:"none",
    off:true
  },
  // vivid / pop
  {
    id:"vivid",
    cat:"vivid",
    label:{ja:"ビビッド", en:"Vivid", zh:"鲜艳", ko:"비비드"},
    desc:{ja:"色鮮やか", en:"High saturation", zh:"高饱和", ko:"선명한 색"},
    filter:"saturate(1.9) brightness(1.08) contrast(1.18)"
  },
  {
    id:"pop",
    cat:"vivid",
    label:{ja:"ポップ", en:"Pop", zh:"波普", ko:"팝"},
    desc:{ja:"はじける色", en:"Pop colors", zh:"跳跃色彩", ko:"톡톡 튀는 색"},
    filter:"saturate(2.2) contrast(1.15) brightness(1.06) hue-rotate(-4deg)"
  },
  {
    id:"pastel",
    cat:"vivid",
    label:{ja:"パステル", en:"Pastel", zh:"粉彩", ko:"파스텔"},
    desc:{ja:"やわらかく淡い", en:"Soft pastel", zh:"柔和粉彩", ko:"부드러운 파스텔"},
    filter:"saturate(.88) brightness(1.14) contrast(.92) sepia(.12) hue-rotate(-6deg)"
  },
  // retro
  {
    id:"warm",
    cat:"retro",
    label:{ja:"暖色", en:"Warm", zh:"暖色", ko:"따뜻한 톤"},
    desc:{ja:"夕日のような暖かさ", en:"Sunset warmth", zh:"夕阳暖调", ko:"노을처럼 따뜻하게"},
    filter:"sepia(.45) saturate(1.35) brightness(.92) hue-rotate(-12deg) contrast(1.05)"
  },
  {
    id:"cool",
    cat:"retro",
    label:{ja:"寒色", en:"Cool", zh:"冷色", ko:"차가운 톤"},
    desc:{ja:"ひんやりクール", en:"Cool blue", zh:"冷调", ko:"차가운 블루"},
    filter:"grayscale(.35) hue-rotate(180deg) saturate(1.5) brightness(.9) contrast(1.1)"
  },
  {
    id:"vintage",
    cat:"retro",
    label:{ja:"ビンテージ", en:"Vintage", zh:"复古", ko:"빈티지"},
    desc:{ja:"古い写真のように", en:"Old photo", zh:"旧照片", ko:"오래된 사진처럼"},
    filter:"sepia(.85) contrast(1.18) brightness(.88) saturate(.72) hue-rotate(-8deg)",
    overlay:"vignette"
  },
  {
    id:"film",
    cat:"retro",
    label:{ja:"フィルム", en:"Film", zh:"胶片", ko:"필름"},
    desc:{ja:"映画フィルム風", en:"Film stock", zh:"胶片质感", ko:"영화 필름 느낌"},
    filter:"sepia(.32) contrast(1.28) brightness(.9) saturate(.82) hue-rotate(-4deg)",
    overlay:"grain"
  },
  {
    id:"crt",
    cat:"retro",
    label:{ja:"ブラウン管", en:"CRT", zh:"显像管", ko:"브라운관"},
    desc:{ja:"レトロなブラウン管テレビ", en:"Retro CRT TV", zh:"复古显像管", ko:"레트로 CRT"},
    filter:"contrast(1.38) brightness(.92) saturate(1.12) sepia(.14) hue-rotate(-2deg)",
    overlay:"crt"
  },
  {
    id:"vhs",
    cat:"retro",
    label:{ja:"VHS", en:"VHS", zh:"录像带", ko:"VHS"},
    desc:{ja:"VHSのノイズとにじみ", en:"VHS tracking noise", zh:"录像带噪点", ko:"VHS 노이즈"},
    filter:"contrast(1.12) saturate(1.38) hue-rotate(-7deg) brightness(1.04) sepia(.08)",
    overlay:"vhs"
  },
  // cinema
  {
    id:"cinema",
    cat:"cinema",
    label:{ja:"シネマ", en:"Cinema", zh:"影院", ko:"시네마"},
    desc:{ja:"映画館のようなコントラスト", en:"Cinematic contrast", zh:"电影感对比", ko:"영화관 같은 대비"},
    filter:"contrast(1.35) brightness(.92) sepia(.22) saturate(1.22) hue-rotate(-3deg)",
    overlay:"letterbox"
  },
  {
    id:"cinemascope",
    cat:"cinema",
    label:{ja:"シネスコ", en:"Cinemascope", zh:"宽银幕", ko:"시네마스코프"},
    desc:{ja:"上下に黒帯・横長映画", en:"Letterbox scope", zh:"宽银幕黑边", ko:"상하 레터박스"},
    filter:"contrast(1.3) brightness(.9) saturate(1.15)",
    overlay:"scope"
  },
  {
    id:"noir",
    cat:"cinema",
    label:{ja:"ノワール", en:"Noir", zh:"黑色电影", ko:"누아르"},
    desc:{ja:"ハイコントラスト白黒", en:"High contrast B&W", zh:"高对比黑白", ko:"하이 콘트라스트 흑백"},
    filter:"grayscale(1) contrast(1.75) brightness(.86)",
    overlay:"vignette"
  },
  {
    id:"news",
    cat:"cinema",
    label:{ja:"ニュース", en:"News", zh:"新闻", ko:"뉴스"},
    desc:{ja:"TVニュース風・くっきり", en:"Broadcast news", zh:"电视新闻风", ko:"TV 뉴스 느낌"},
    filter:"contrast(1.22) saturate(1.12) brightness(1.06) sepia(.04)"
  },
  {
    id:"commercial",
    cat:"cinema",
    label:{ja:"CM", en:"Commercial", zh:"广告", ko:"CF"},
    desc:{ja:"CMのような高彩度・明るめ", en:"Bright commercial", zh:"广告般明亮高饱和", ko:"광고처럼 밝고 선명하게"},
    filter:"saturate(1.65) contrast(1.08) brightness(1.12) hue-rotate(2deg)"
  },
  // effect（追加：生活の場面。CSS filter だけで作る）
  {
    id:"watercolor_bleed",
    cat:"effect",
    label:{ja:"💧 水彩のにじみ", en:"💧 Watercolor bleed", zh:"💧 水彩晕染", ko:"💧 수채 번짐"},
    desc:{ja:"水彩紙に広がるような、やわらかいにじみ", en:"Soft bleeding edges, like paint spreading on wet paper", zh:"像颜料在湿纸上晕开的柔和边缘", ko:"젖은 종이에 번지는 듯한 부드러운 번짐"},
    filter:"contrast(.9) saturate(1.2) brightness(1.06) blur(.7px)"
  },
  {
    id:"sumi_ink",
    cat:"effect",
    label:{ja:"🖌 墨の滲み", en:"🖌 Sumi ink wash", zh:"🖌 墨色晕染", ko:"🖌 먹 번짐"},
    desc:{ja:"墨の濃淡と、紙にしみる柔らかい輪郭", en:"Ink tones and soft edges that sink into paper", zh:"墨色浓淡与渗入纸面的柔和轮廓", ko:"먹의 농담과 종이에 스미는 부드러운 윤곽"},
    filter:"grayscale(1) contrast(1.7) brightness(1.02) blur(.5px) sepia(.08)"
  },
  {
    id:"rain_glass",
    cat:"effect",
    label:{ja:"🌧 雨の窓ガラス", en:"🌧 Rainy window", zh:"🌧 雨窗玻璃", ko:"🌧 빗물 창문"},
    desc:{ja:"雨粒の向こうに見える、少しぼやけた青み", en:"A slightly blurred, bluish view through rain-streaked glass", zh:"透过雨水的玻璃所见，略微模糊的蓝调", ko:"빗물 너머로 보이는 살짝 흐릿한 푸른 기운"},
    filter:"blur(.8px) saturate(.8) brightness(.96) contrast(1.05) hue-rotate(-8deg)"
  },
  {
    id:"steam_bath",
    cat:"effect",
    label:{ja:"♨ 銭湯の湯気", en:"♨ Bathhouse steam", zh:"♨ 澡堂蒸汽", ko:"♨ 목욕탕 김"},
    desc:{ja:"湯気で少し白くかすむ、やわらかい明るさ", en:"Soft light with a faint haze, as if in warm steam", zh:"被蒸汽轻轻染白的柔和亮度", ko:"김으로 살짝 뿌옇게 번진 부드러운 밝기"},
    filter:"blur(1.2px) brightness(1.1) contrast(.88) saturate(.85)"
  },
  {
    id:"shoji_glow",
    cat:"effect",
    label:{ja:"🪟 障子越しの光", en:"🪟 Light through shoji", zh:"🪟 透过障子的光", ko:"🪟 장지문 너머 빛"},
    desc:{ja:"和紙を通した、温かく拡散する光", en:"Warm, diffused light filtered through washi paper", zh:"透过和纸扩散的温暖光线", ko:"한지를 통과해 따뜻하게 퍼지는 빛"},
    filter:"brightness(1.1) contrast(.9) sepia(.14) saturate(.92)"
  },
  // effect
  {
    id:"night",
    cat:"effect",
    label:{ja:"ナイト", en:"Night", zh:"夜景", ko:"나이트"},
    desc:{ja:"夜・ネオン街", en:"Night city", zh:"夜景霓虹", ko:"밤 거리"},
    filter:"brightness(.56) contrast(1.32) saturate(.78) hue-rotate(210deg) sepia(.18)",
    overlay:"vignette"
  },
  {
    id:"security",
    cat:"effect",
    label:{ja:"監視カメラ", en:"Security cam", zh:"监控", ko:"보안 카메라"},
    desc:{ja:"監視カメラ風・緑がかった", en:"CCTV greenish", zh:"监控摄像头风", ko:"CCTV 느낌"},
    filter:"sepia(.18) hue-rotate(75deg) saturate(1.25) contrast(1.25) brightness(.88) grayscale(.18)",
    overlay:"scan"
  },
  {
    id:"dream",
    cat:"effect",
    label:{ja:"ドリーム", en:"Dream", zh:"梦幻", ko:"드림"},
    desc:{ja:"ふわっと明るい夢の中", en:"Soft dreamy glow", zh:"柔和梦幻", ko:"몽환적인 꿈속"},
    filter:"brightness(1.18) saturate(1.18) contrast(.92) sepia(.08) hue-rotate(-4deg)",
    overlay:"bloom"
  },
  {
    id:"faded",
    cat:"effect",
    label:{ja:"フェード", en:"Faded", zh:"褪色", ko:"페이디드"},
    desc:{ja:"色あせた記憶", en:"Faded memory", zh:"褪色记忆", ko:"바랜 기억"},
    filter:"saturate(.55) brightness(1.08) contrast(.92) sepia(.18)"
  },
  {
    id:"poster",
    cat:"effect",
    label:{ja:"ポスター", en:"Poster", zh:"海报", ko:"포스터"},
    desc:{ja:"コントラスト強め・ポスター風", en:"Posterized high contrast", zh:"海报风高对比", ko:"포스터 같은 강한 대비"},
    filter:"contrast(1.55) saturate(1.9) brightness(1.02)"
  },
  {
    id:"soft",
    cat:"effect",
    label:{ja:"ソフト", en:"Soft", zh:"柔焦", ko:"소프트"},
    desc:{ja:"やわらかくぼかしたような", en:"Soft focus", zh:"柔焦", ko:"부드러운 포커스"},
    filter:"brightness(1.06) contrast(.94) saturate(.92) sepia(.06)",
    overlay:"soft"
  },
  // ===== 追加：人が思いつかなそうな面白いフィルター20種 =====
  {
    id:"underwater",
    cat:"weird",
    label:{ja:"🌊 水中", en:"🌊 Underwater", zh:"🌊 水下", ko:"🌊 수중"},
    desc:{ja:"水の中から見たような青く揺らぐ", en:"Blue wobble as if underwater", zh:"水下摇晃的蓝色", ko:"물속에서 보는 듯한 푸른 흔들림"},
    filter:"hue-rotate(190deg) saturate(1.4) brightness(.85) contrast(1.2) sepia(.2)",
    overlay:"bloom"
  },
  {
    id:"thermal",
    cat:"weird",
    label:{ja:"🌡️ サーモグラフィ", en:"🌡️ Thermal", zh:"🌡️ 热成像", ko:"🌡️ 열화상"},
    desc:{ja:"温度で色が変わるサーモカメラ", en:"Thermal camera heat map", zh:"热成像仪", ko:"온도에 따라 색이 변하는 열화상"},
    filter:"hue-rotate(280deg) saturate(3) contrast(1.6) brightness(.9) invert(.1)",
    overlay:"scan"
  },
  {
    id:"xray",
    cat:"weird",
    label:{ja:"🦴 レントゲン", en:"🦴 X-Ray", zh:"🦴 X光", ko:"🦴 엑스레이"},
    desc:{ja:"骨が透けるレントゲン風", en:"X-ray see-through", zh:"X光透视", ko:"뼈가 비치는 엑스레이"},
    filter:"grayscale(1) invert(1) contrast(1.8) brightness(1.1)",
    overlay:"vignette"
  },
  {
    id:"nightvision",
    cat:"weird",
    label:{ja:"🔭 暗視ゴーグル", en:"🔭 Night vision", zh:"🔭 夜视仪", ko:"🔭 야간 투시경"},
    desc:{ja:"緑一色の暗視ゴーグル", en:"Green night vision goggles", zh:"绿色夜视仪", ko:"녹색 야간 투시경"},
    filter:"sepia(1) hue-rotate(60deg) saturate(2.5) contrast(1.4) brightness(.9)",
    overlay:"scan"
  },
  {
    id:"gameboy",
    cat:"weird",
    label:{ja:"👾 ゲームボーイ", en:"👾 GameBoy", zh:"👾 掌机", ko:"👾 게임보이"},
    desc:{ja:"4階調の緑・ドット感", en:"4-shade green dot matrix", zh:"四阶绿点阵", ko:"4계조 녹색 도트"},
    filter:"sepia(.8) hue-rotate(60deg) saturate(1.8) contrast(1.5) brightness(.9) grayscale(.2)",
    overlay:"crt"
  },
  {
    id:"dot",
    cat:"weird",
    label:{ja:"🔳 ドット絵", en:"🔳 Dot matrix", zh:"🔳 点阵", ko:"🔳 도트"},
    desc:{ja:"粗いドット絵・8bit風", en:"Coarse 8-bit pixels", zh:"粗糙8位像素", ko:"거친 8비트 도트"},
    filter:"contrast(1.6) saturate(1.8) brightness(1.05)",
    overlay:"scan"
  },
  {
    id:"newspaper",
    cat:"weird",
    label:{ja:"📰 新聞", en:"📰 Newspaper", zh:"📰 报纸", ko:"📰 신문"},
    desc:{ja:"白黒の新聞ハーフトーン", en:"B&W halftone newspaper", zh:"黑白报纸半调", ko:"흑백 신문 하프톤"},
    filter:"grayscale(1) contrast(1.9) brightness(1.15)",
    overlay:"grain"
  },
  {
    id:"blueprint",
    cat:"weird",
    label:{ja:"📐 青焼き", en:"📐 Blueprint", zh:"📐 蓝图", ko:"📐 청사진"},
    desc:{ja:"青い設計図のような反転", en:"Inverted blueprint cyan", zh:"蓝色蓝图反转", ko:"파란 설계도 반전"},
    filter:"invert(1) sepia(1) hue-rotate(180deg) saturate(2) contrast(1.3) brightness(.9)",
    overlay:"grid"
  },
  {
    id:"comic",
    cat:"weird",
    label:{ja:"💥 アメコミ", en:"💥 Comic", zh:"💥 美漫", ko:"💥 코믹"},
    desc:{ja:"はっきりした線とベタ塗り・漫画", en:"Bold lines flat colors comic", zh:"粗线平涂漫画", ko:"굵은 선과 단색 만화"},
    filter:"contrast(1.9) saturate(2.2) brightness(1.08) sepia(.08)",
    overlay:"bloom"
  },
  {
    id:"invert",
    cat:"weird",
    label:{ja:"🎞 ネガフィルム", en:"🎞 Negative", zh:"🎞 负片", ko:"🎞 네거티브"},
    desc:{ja:"色が反転したネガ", en:"Inverted negative film", zh:"反色负片", ko:"색이 반전된 네거"},
    filter:"invert(1) hue-rotate(180deg)",
    overlay:"vignette"
  },
  {
    id:"acid",
    cat:"weird",
    label:{ja:"🌈 アシッド", en:"🌈 Acid", zh:"🌈 迷幻", ko:"🌈 애시드"},
    desc:{ja:"色がぐるぐる変わるサイケ", en:"Psychedelic hue swirl", zh:"迷幻色相旋转", ko:"색이 빙빙 도는 사이키"},
    filter:"hue-rotate(90deg) saturate(3) contrast(1.4) brightness(1.1)",
    overlay:"bloom"
  },
  {
    id:"vaporwave",
    cat:"weird",
    label:{ja:"🌸 ヴェイパーウェイブ", en:"🌸 Vaporwave", zh:"🌸 蒸汽波", ko:"🌸 베이퍼웨이브"},
    desc:{ja:"ピンクと水色の80s夢", en:"Pink cyan 80s dream", zh:"粉蓝80年代梦", ko:"핑크와 하늘색 80년대 꿈"},
    filter:"hue-rotate(300deg) saturate(1.6) brightness(1.12) contrast(1.05) sepia(.15)",
    overlay:"soft"
  },
  {
    id:"cyberpunk",
    cat:"weird",
    label:{ja:"🌃 サイバーパンク", en:"🌃 Cyberpunk", zh:"🌃 赛博朋克", ko:"🌃 사이버펑크"},
    desc:{ja:"ネオン街・紫と青の夜", en:"Neon street purple blue night", zh:"霓虹街紫蓝夜", ko:"네온 거리 보라 파랑 밤"},
    filter:"hue-rotate(260deg) saturate(1.9) contrast(1.35) brightness(.88)",
    overlay:"vignette"
  },
  {
    id:"matrix",
    cat:"weird",
    label:{ja:"💻 マトリックス", en:"💻 Matrix", zh:"💻 黑客帝国", ko:"💻 매트릭스"},
    desc:{ja:"緑のコードが流れる", en:"Green code rain", zh:"绿色代码雨", ko:"녹색 코드가 흐르는"},
    filter:"sepia(1) hue-rotate(70deg) saturate(2.8) contrast(1.3) brightness(.85)",
    overlay:"scan"
  },
  {
    id:"sunset",
    cat:"nature",
    label:{ja:"🌅 夕焼け", en:"🌅 Sunset", zh:"🌅 日落", ko:"🌅 노을"},
    desc:{ja:"オレンジに染まる夕日", en:"Orange dyed sunset", zh:"橙色夕阳", ko:"주황으로 물든 석양"},
    filter:"sepia(.6) saturate(1.6) hue-rotate(-20deg) brightness(.95) contrast(1.15)",
    overlay:"bloom"
  },
  {
    id:"moonlight",
    cat:"nature",
    label:{ja:"🌙 月光", en:"🌙 Moonlight", zh:"🌙 月光", ko:"🌙 달빛"},
    desc:{ja:"青白い月明かり", en:"Bluish moonlight", zh:"青白月光", ko:"푸르스름한 달빛"},
    filter:"grayscale(.5) hue-rotate(200deg) saturate(.6) brightness(.8) contrast(1.2) sepia(.2)",
    overlay:"vignette"
  },
  {
    id:"aurora",
    cat:"nature",
    label:{ja:"✨ オーロラ", en:"✨ Aurora", zh:"✨ 极光", ko:"✨ 오로라"},
    desc:{ja:"緑と紫が揺らめく空", en:"Green purple shimmering sky", zh:"绿紫闪烁天空", ko:"초록 보라가 아른거리는 하늘"},
    filter:"hue-rotate(120deg) saturate(1.7) brightness(1.05) contrast(1.1) sepia(.1)",
    overlay:"bloom"
  },
  {
    id:"lava",
    cat:"nature",
    label:{ja:"🌋 溶岩", en:"🌋 Lava", zh:"🌋 熔岩", ko:"🌋 용암"},
    desc:{ja:"赤く燃える溶岩", en:"Red burning lava", zh:"红色燃烧熔岩", ko:"붉게 타오르는 용암"},
    filter:"sepia(.8) hue-rotate(-30deg) saturate(2.2) contrast(1.4) brightness(.9)",
    overlay:"vignette"
  },
  {
    id:"ice",
    cat:"nature",
    label:{ja:"🧊 氷", en:"🧊 Ice", zh:"🧊 冰", ko:"🧊 얼음"},
    desc:{ja:"キンと冷えた氷の世界", en:"Freezing ice world", zh:"冰冻世界", ko:"꽁꽁 언 얼음 세계"},
    filter:"hue-rotate(180deg) saturate(.7) brightness(1.15) contrast(1.1) sepia(.1)",
    overlay:"soft"
  },
  {
    id:"kaleido",
    cat:"weird",
    label:{ja:"🔮 万華鏡", en:"🔮 Kaleidoscope", zh:"🔮 万花筒", ko:"🔮 만화경"},
    desc:{ja:"色がくるくる変わる万華鏡", en:"Color swirling kaleidoscope", zh:"色彩旋转万花筒", ko:"색이 빙글빙글 만화경"},
    filter:"hue-rotate(90deg) saturate(2.5) contrast(1.3) brightness(1.1)",
    overlay:"bloom"
  },

  // 人物・肌色を含む映像向けの穏やかなグレード（顔や肌の自動検出は行わない）
  {
    id:"portrait_natural",
    cat:"portrait",
    label:{ja:"👤 ナチュラルポートレート", en:"👤 Natural portrait", zh:"👤 自然人像", ko:"👤 내추럴 인물"},
    desc:{ja:"彩度を控えめにし、肌を含む中間色を自然に見せる全体調整", en:"A restrained global grade for natural-looking midtones and skin-inclusive scenes", zh:"整体轻柔调整，让中间调与肤色更自然", ko:"피부를 포함한 중간톤을 자연스럽게 보이는 절제된 전체 보정"},
    filter:"brightness(1.02) contrast(1.02) saturate(.97) sepia(.025)"
  },
  {
    id:"portrait_soft",
    cat:"portrait",
    label:{ja:"🫧 やわらかポートレート", en:"🫧 Soft portrait", zh:"🫧 柔和人像", ko:"🫧 소프트 인물"},
    desc:{ja:"少し明るく、コントラストを抑えた柔らかな全体トーン", en:"A slightly brighter, gentler global contrast", zh:"稍微提亮并柔和整体对比", ko:"조금 밝고 전체 대비를 부드럽게"},
    filter:"brightness(1.04) contrast(.94) saturate(.95) sepia(.025)",
    overlay:"portraitGlow"
  },
  {
    id:"portrait_warm",
    cat:"portrait",
    label:{ja:"🌤 あたたかい肌色", en:"🌤 Warm portrait", zh:"🌤 暖调人像", ko:"🌤 따뜻한 인물"},
    desc:{ja:"赤みを強くしすぎない、控えめな暖色寄りの全体調整", en:"A restrained warm global tint without pushing reds too hard", zh:"克制地偏暖，不会过度增强红色", ko:"붉은색을 과하게 밀지 않는 은은한 웜톤 전체 보정"},
    filter:"brightness(1.03) contrast(1.03) saturate(1.02) sepia(.08) hue-rotate(-2deg)"
  },
  {
    id:"portrait_matte",
    cat:"portrait",
    label:{ja:"🎞 マットポートレート", en:"🎞 Matte portrait", zh:"🎞 柔哑人像", ko:"🎞 매트 인물"},
    desc:{ja:"強い黒つぶれを避ける、低コントラストの落ち着いた色", en:"A calm, lower-contrast look that avoids crushing dark areas", zh:"低对比的沉静色调，减少暗部压黑", ko:"암부를 지나치게 뭉개지 않는 차분한 저대비 톤"},
    filter:"brightness(1.04) contrast(.92) saturate(.92) sepia(.045)",
    overlay:"soft"
  },
  {
    id:"portrait_studio",
    cat:"portrait",
    label:{ja:"💡 ソフトボックス", en:"💡 Softbox light", zh:"💡 柔光箱", ko:"💡 소프트박스"},
    desc:{ja:"白い柔らかな光をうっすら重ねるスタジオ風", en:"A subtle studio-like wash of soft, neutral light", zh:"叠加轻柔的中性柔光，营造棚拍感", ko:"중성적인 부드러운 빛을 은은하게 더하는 스튜디오 느낌"},
    filter:"brightness(1.035) contrast(1.01) saturate(.98)",
    overlay:"softbox"
  },

  // アニメ・セル塗り向け：輪郭と色面をグローバルなコントラストで見やすくする
  {
    id:"anime_clear",
    cat:"anime",
    label:{ja:"🎨 アニメ・クリア", en:"🎨 Anime clear", zh:"🎨 动画清晰", ko:"🎨 애니 클리어"},
    desc:{ja:"彩度とコントラストを画面全体で調整。線の抽出や描き足しはしない", en:"A mild global saturation and contrast grade; it does not extract or invent outlines", zh:"整体轻微调整饱和度与对比度；不会提取或绘制轮廓线", ko:"채도와 대비를 화면 전체에 은은하게 적용하며 윤곽선을 추출하거나 그려 넣지 않음"},
    filter:"contrast(1.08) saturate(1.12) brightness(1.02)"
  },
  {
    id:"anime_cel",
    cat:"anime",
    label:{ja:"🖌 セルカラー", en:"🖌 Cel color", zh:"🖌 赛璐珞色块", ko:"🖌 셀 컬러"},
    desc:{ja:"色の面を少し引き締める、くっきりした配色", en:"A crisp global grade for flat-color animation", zh:"让平涂动画色块更利落的整体调色", ko:"평면 채색 애니메이션의 색면을 또렷하게 하는 전체 보정"},
    filter:"contrast(1.16) saturate(1.08) brightness(1.01)"
  },
  {
    id:"anime_pastel",
    cat:"anime",
    label:{ja:"🌸 パステルセル", en:"🌸 Pastel cel", zh:"🌸 粉彩赛璐珞", ko:"🌸 파스텔 셀"},
    desc:{ja:"明るく淡い、やさしいアニメカラー", en:"A light, gentle pastel animation grade", zh:"明亮柔和的粉彩动画色调", ko:"밝고 부드러운 파스텔 애니메이션 톤"},
    filter:"contrast(1.03) saturate(.91) brightness(1.07) sepia(.025)"
  },
  {
    id:"anime_night",
    cat:"anime",
    label:{ja:"🌙 アニメ夜景", en:"🌙 Anime night", zh:"🌙 动画夜景", ko:"🌙 애니 나이트"},
    desc:{ja:"明るさを抑え、青紫寄りの夜の色へ", en:"A darker, gently blue-violet night palette", zh:"压低亮度并转为柔和的蓝紫夜色", ko:"밝기를 낮추고 은은한 청보라 야간 색감으로"},
    filter:"contrast(1.1) saturate(1.05) brightness(.94) hue-rotate(7deg)"
  },
  {
    id:"anime_print",
    cat:"anime",
    label:{ja:"📰 アニメ印刷", en:"📰 Anime print", zh:"📰 动画印刷网点", ko:"📰 애니 인쇄"},
    desc:{ja:"低密度の網点を重ねた印刷物風", en:"An original, light halftone-print texture", zh:"叠加原创的轻微网点印刷质感", ko:"직접 그리는 은은한 하프톤 인쇄 질감"},
    filter:"contrast(1.09) saturate(1.04) brightness(1.02)",
    overlay:"halftone"
  },

  // 外部のテクスチャ画像を使わず、Canvasで描くオリジナル質感
  {
    id:"texture_finegrain",
    cat:"texture",
    label:{ja:"🎞 きめ細かいフィルム粒子", en:"🎞 Fine film grain", zh:"🎞 细腻胶片颗粒", ko:"🎞 고운 필름 그레인"},
    desc:{ja:"控えめな粒子を重ねて映像に微細な質感を足す", en:"A subtle, locally generated grain texture", zh:"叠加轻微颗粒，为画面增加细腻质感", ko:"은은하게 직접 생성한 입자로 미세한 질감을 더함"},
    filter:"contrast(1.03) saturate(.96) brightness(1.005)",
    overlay:"finegrain"
  },
  {
    id:"texture_paper",
    cat:"texture",
    label:{ja:"📜 紙焼き", en:"📜 Paper print", zh:"📜 纸面印刷", ko:"📜 종이 인화"},
    desc:{ja:"淡い紙色と手描きの繊維を重ねる", en:"A faint paper tint with locally drawn fibers", zh:"叠加淡淡纸色与本地绘制的纤维", ko:"옅은 종이빛과 직접 그린 섬유 결을 더함"},
    filter:"contrast(1.04) saturate(.88) brightness(1.025) sepia(.07)",
    overlay:"paper"
  },
  {
    id:"texture_halftone",
    cat:"texture",
    label:{ja:"🔘 ハーフトーン", en:"🔘 Halftone", zh:"🔘 半调网点", ko:"🔘 하프톤"},
    desc:{ja:"小さな規則的ドットを重ねるレトロ印刷風", en:"A fine, regular dot-screen print texture", zh:"叠加细密规则网点的复古印刷感", ko:"작고 규칙적인 도트를 겹치는 레트로 인쇄 느낌"},
    filter:"contrast(1.07) saturate(.96) brightness(1.01)",
    overlay:"halftone"
  },
  {
    id:"texture_softglow",
    cat:"texture",
    label:{ja:"✨ ソフトグロウ", en:"✨ Soft glow", zh:"✨ 柔光", ko:"✨ 소프트 글로우"},
    desc:{ja:"画面の端から柔らかな光を重ねる（解像度補完ではありません）", en:"A soft edge-light overlay (not resolution enhancement)", zh:"从画面边缘叠加柔光（不会提升分辨率）", ko:"화면 가장자리에 부드러운 빛을 더함 (해상도 보정은 아님)"},
    filter:"brightness(1.035) contrast(.97) saturate(1.01)",
    overlay:"softbox"
  },
  {
    id:"texture_velvet",
    cat:"texture",
    label:{ja:"🪻 ベルベット", en:"🪻 Velvet", zh:"🪻 天鹅绒", ko:"🪻 벨벳"},
    desc:{ja:"彩度と周辺光量を落ち着かせた深い色", en:"Deep color with restrained saturation and a gentle vignette", zh:"降低饱和度并柔和压暗边缘的深色调", ko:"채도를 절제하고 가장자리를 부드럽게 눌러주는 깊은 색감"},
    filter:"contrast(1.1) saturate(.91) brightness(.97) sepia(.025)",
    overlay:"vignette"
  },

  // 品質重視の穏やかな調整。強い加工より階調・色の見やすさを優先
  {
    id:"quality_balanced",
    cat:"quality",
    label:{ja:"✨ スタジオ・バランス", en:"✨ Studio balance", zh:"✨ 影棚均衡", ko:"✨ 스튜디오 밸런스"},
    desc:{ja:"彩度・明るさを控えめに整える自然な全体グレード", en:"A restrained, balanced global color grade", zh:"克制地平衡亮度与饱和度", ko:"밝기와 채도를 절제해 균형을 잡는 전체 색 보정"},
    filter:"contrast(1.04) saturate(1.02) brightness(1.015)"
  },
  {
    id:"quality_clean",
    cat:"quality",
    label:{ja:"📡 放送クリーン", en:"📡 Clean broadcast", zh:"📡 清爽播出", ko:"📡 클린 방송"},
    desc:{ja:"やや明るく、色と輪郭の見分けやすさを整える", en:"A slightly brighter grade with modest global separation", zh:"略微提亮并适度拉开整体层次", ko:"조금 밝게 하고 전체적인 색과 윤곽의 구분을 정돈"},
    filter:"contrast(1.08) saturate(1.06) brightness(1.03)"
  },
  {
    id:"quality_highlight",
    cat:"quality",
    label:{ja:"☀ ソフト全体トーン", en:"☀ Soft global tone", zh:"☀ 柔和整体色调", ko:"☀ 부드러운 전체 톤"},
    desc:{ja:"画面全体を穏やかに調整（ハイライトだけの保護・白飛びの復元はしません）", en:"A gentle global tone; it cannot selectively protect or recover clipped highlights", zh:"柔和的整体色调；无法单独保护或恢复原片中已过曝的高光", ko:"화면 전체를 부드럽게 조정하며 하이라이트만 선택해 보호하거나 날아간 부분을 복구하지 않음"},
    filter:"brightness(1.035) contrast(.97) saturate(.98)",
    overlay:"portraitGlow"
  },
  {
    id:"quality_open",
    cat:"quality",
    label:{ja:"🌤 シャドウ・オープン", en:"🌤 Open shadows", zh:"🌤 打开暗部", ko:"🌤 섀도 오픈"},
    desc:{ja:"画面全体を少し持ち上げ、暗い映像を見やすくする", en:"Lifts the whole frame slightly for darker footage; not a shadow-only recovery", zh:"整体稍微提亮，帮助观看较暗的素材（并非只提暗部）", ko:"어두운 영상을 보기 쉽게 전체 화면을 조금 밝힘 (암부만 복구하지는 않음)"},
    filter:"brightness(1.08) contrast(.94) saturate(1.02)"
  },
  {
    id:"quality_cinema",
    cat:"quality",
    label:{ja:"🎬 シネマ・フォーカス", en:"🎬 Cinema focus", zh:"🎬 电影焦点", ko:"🎬 시네마 포커스"},
    desc:{ja:"落ち着いた彩度と穏やかな周辺減光で視線を中央へ", en:"Restrained color and a gentle vignette draw the eye inward", zh:"克制色彩并轻柔压暗边缘，让视线回到画面中央", ko:"절제된 색감과 은은한 주변광 감소로 시선을 중앙에 모음"},
    filter:"contrast(1.1) brightness(.99) saturate(1.03) sepia(.025)",
    overlay:"vignette"
  }
];
/* ✅ tv-presets.js 完了 */
