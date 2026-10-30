// SPDX-License-Identifier: GPL-3.0-or-later
/* ==========================================================================
   trk! fx-presets.js — 🎛 サウンドエフェクトの内蔵プリセット（データだけ）
   ・1行で1プリセット：P("id", "分類", [ja, en, zh, ko], [説明ja, 説明en], [エフェクト…])
   ・分類：basic / genre / scene / space / game / fun / weird
   ・使えるエフェクトと値の範囲は fx.js の cleanFx を参照（範囲外は自動で丸めます）
   ・MOD：自分のファイルで TRK_FX_PRESETS.push({...}) しても追加できます（fx.js より前に読み込む）
   ・内蔵プリセットは 115個で打ち止め（個人の製作者さんが作る余地を残すため）
     基本10・ジャンル16・シーン20・空間17・ゲーム15・おもしろ21・ちょっと変16
   読み込み順：fx.js の直前
   ========================================================================== */
"use strict";
const TRK_FX_PRESETS = [];
(() => {
const P = (id, cat, l, d, chain) => TRK_FX_PRESETS.push({ id, cat,
  label:{ ja:l[0], en:l[1], zh:l[2] || l[1], ko:l[3] || l[1] }, desc:{ ja:d[0], en:d[1] }, chain });
/* ---- 書き方を短くするための関数 ---- */
const EQ = (...b) => ({ type:"eq", bands:b.map(([type, freq, gain = 0, q = .8]) => ({ type, freq, gain, q })) });
const comp = (threshold, ratio, makeup = 0, attack = .01, release = .25) => ({ type:"comp", threshold, ratio, makeup, attack, release });
const verb = (size, decay, mix) => ({ type:"reverb", size, decay, mix });
const wide = amount => ({ type:"width", amount });
const gain = db => ({ type:"gain", db });
const delay = (beats, feedback, mix, tone = 6000) => ({ type:"delay", beats, feedback, mix, tone });   // 拍に合わせる
const delayMs = (ms, feedback, mix, tone = 6000) => ({ type:"delay", ms, feedback, mix, tone });      // ミリ秒で
const drive = (amount, mix = 1) => ({ type:"drive", amount, mix });
const lofi = (bits, cutoff) => ({ type:"lofi", bits, cutoff });
const pump = (depth, beats) => ({ type:"pump", depth, beats });
const trem = (depth, beats) => ({ type:"tremolo", depth, beats });
const pan = (depth, beats) => ({ type:"autopan", depth, beats });
const sweep = (filter, from, to, beats, q = 1) => ({ type:"sweep", filter, from, to, beats, q });
const ring = (freq, mix) => ({ type:"ringmod", freq, mix });
const chorus = (ms, depth, rate, feedback, mix) => ({ type:"chorus", ms, depth, rate, feedback, mix });
const noise = (kind, level) => ({ type:"noise", kind, level });
const xfeed = amount => ({ type:"crossfeed", amount });
const vcut = (amount, keepBass) => ({ type:"vocalCut", amount, keepBass });

/* ================= 基本（10） ================= */
P("flat", "basic", ["フラット", "Flat", "原声", "플랫"], ["そのままの音", "Original sound"], []);
P("vshape", "basic", ["ドンシャリ", "V-shape", "V型", "V자형"], ["低音と高音をはっきり", "Punchy lows, crisp highs"],
  [EQ(["lowshelf", 90, 6], ["peaking", 1000, -3, .7], ["highshelf", 8000, 5]), comp(-18, 2, 1)]);
P("bass", "basic", ["低音ブースト", "Bass boost", "低音增强", "저음 강조"], ["ズンズン響く低音", "Deep, thumping bass"],
  [EQ(["lowshelf", 100, 8], ["peaking", 250, -2, 1])]);
P("night", "basic", ["夜間モード", "Night mode", "夜间模式", "야간 모드"], ["小さな音でも聴きやすく", "Easy to hear at low volume"],
  [comp(-36, 6, 10, .005, .2)]);
P("loudness", "basic", ["ラウドネス", "Loudness", "响度补偿", "라우드니스"], ["小さな音量でも厚みを出す", "Fuller sound at low volume"],
  [EQ(["lowshelf", 100, 5], ["highshelf", 10000, 3]), comp(-30, 2, 3)]);
P("clear", "basic", ["クリア", "Clear", "清晰", "클리어"], ["こもりを取って輪郭くっきり", "Less mud, sharper detail"],
  [EQ(["peaking", 300, -2.5, .9], ["peaking", 3500, 3, .9], ["highshelf", 10000, 2])]);
P("warm", "basic", ["やわらか", "Warm", "柔和", "부드럽게"], ["角の取れた温かい音", "Rounded, warm tone"],
  [EQ(["lowshelf", 200, 2], ["highshelf", 6000, -3])]);
P("mono", "basic", ["モノラル", "Mono", "单声道", "모노"], ["左右をまとめる", "Fold to mono"], [wide(0)]);
P("checkphone", "basic", ["ミックス確認：スマホ", "Mix check: phone", "混音检查：手机", "믹스 확인: 스마트폰"],
  ["小さなスピーカー・モノラルで、どう聞こえるか", "How it sounds on a tiny mono speaker"],
  [EQ(["highpass", 200, 0, .9], ["lowpass", 8000, 0, .7], ["peaking", 3500, 3, 1]), wide(0)]);
P("checkbuds", "basic", ["ミックス確認：付属イヤホン", "Mix check: cheap earbuds", "混音检查：附赠耳机", "믹스 확인: 번들 이어폰"],
  ["2〜5kHzが目立つ、よくあるイヤホン", "Typical earbuds that push 2–5 kHz"],
  [EQ(["lowshelf", 80, -6], ["peaking", 3500, 5, .8], ["highshelf", 10000, -4])]);

/* ================= ジャンル（16） ================= */
P("edm", "genre", ["EDM", "EDM", "EDM", "EDM"], ["低音＋ビートに合わせて音がうねる", "Bass plus beat-synced pumping"],
  [EQ(["lowshelf", 70, 5], ["highshelf", 10000, 3]), pump(.4, 1), wide(1.3), comp(-20, 3, 2)]);
P("rock", "genre", ["ロック", "Rock", "摇滚", "록"], ["ギターの芯と少しの歪み", "Guitar bite with a touch of drive"],
  [EQ(["lowshelf", 100, 3], ["peaking", 800, -2], ["peaking", 3000, 3, .9], ["highshelf", 9000, 2]), drive(.12, .4)]);
P("piano", "genre", ["ピアノ", "Piano", "钢琴", "피아노"], ["粒立ちの良い音とホールの響き", "Clear notes with a hall glow"],
  [EQ(["highpass", 40, 0, .7], ["peaking", 300, -2, 1], ["peaking", 3000, 2.5], ["highshelf", 9000, 1.5]), verb(2.2, 3, .18)]);
P("jazz", "genre", ["ジャズ", "Jazz", "爵士", "재즈"], ["暖かい中域と小さなクラブ", "Warm mids in a small club"],
  [EQ(["lowshelf", 120, 2], ["peaking", 600, 2], ["highshelf", 7000, -2]), drive(.06, .5), verb(1.2, 2.5, .14)]);
P("orchestra", "genre", ["オーケストラ", "Orchestra", "管弦乐", "오케스트라"], ["広がりとコンサートホール", "Wide stage, concert hall"],
  [EQ(["peaking", 250, -1.5], ["highshelf", 6000, 2]), wide(1.35), verb(3.2, 3, .22), comp(-26, 1.8, 2)]);
P("lofi", "genre", ["ローファイ", "Lo-fi", "Lo-fi", "로파이"], ["ざらっとした懐かしい音", "Dusty, nostalgic tone"],
  [EQ(["highshelf", 6000, -4], ["lowshelf", 120, 2]), lofi(10, 7000), drive(.1, .3), wide(.8)]);
P("hiphop", "genre", ["ヒップホップ", "Hip-hop", "嘻哈", "힙합"], ["太いキックとサブベース", "Fat kick and sub bass"],
  [EQ(["lowshelf", 60, 6], ["peaking", 400, -2], ["highshelf", 9000, 1]), comp(-22, 3, 2)]);
P("dnb", "genre", ["ドラムンベース", "Drum & Bass", "鼓打贝斯", "드럼 앤 베이스"], ["速いビートに太い低音", "Rolling sub and crisp breaks"],
  [EQ(["lowshelf", 50, 5], ["highshelf", 8000, 3]), wide(1.3), comp(-20, 3, 2)]);
P("metal", "genre", ["メタル", "Metal", "金属", "메탈"], ["中域を削って重く鋭く", "Scooped mids, heavy and sharp"],
  [EQ(["lowshelf", 80, 3], ["peaking", 600, -4, .7], ["peaking", 3500, 3], ["highshelf", 10000, 2]), drive(.15, .4), comp(-18, 4, 2)]);
P("citypop", "genre", ["シティポップ", "City pop", "城市流行", "시티팝"], ["きらっとした揺れと夜の街の広がり", "Shimmering, wide, late-night glow"],
  [EQ(["lowshelf", 90, 3], ["peaking", 2500, 2]), chorus(18, 3, .6, 0, .25), wide(1.25), verb(1.8, 3, .14)]);
P("anison", "genre", ["アニソン", "Anime song", "动漫歌曲", "애니송"], ["明るく元気に、前に出る音", "Bright, bold and upfront"],
  [EQ(["lowshelf", 90, 3], ["peaking", 3000, 3], ["highshelf", 11000, 3]), wide(1.3), comp(-20, 3, 3)]);
P("vocaloid", "genre", ["ボカロ", "Vocaloid", "V家", "보카로"], ["歌声をきらっと前に", "Sparkly, forward vocals"],
  [EQ(["highpass", 50, 0, .7], ["peaking", 2800, 3, 1], ["highshelf", 12000, 3]), chorus(12, 2, .9, 0, .15), delay(.5, .2, .12, 5000)]);
P("dub", "genre", ["ダブ", "Dub", "Dub", "더브"], ["こだまするエコーと揺れるフィルター", "Echo trails and a moving filter"],
  [EQ(["lowshelf", 80, 4]), delay(.75, .6, .35, 1800), sweep("highpass", 40, 600, 16, .7), verb(1.5, 2.5, .12)]);
P("ambient", "genre", ["アンビエント", "Ambient", "氛围", "앰비언트"], ["ふわっと広がって溶ける", "Floating and dissolving"],
  [EQ(["highshelf", 8000, -3]), verb(5, 3.5, .4), chorus(25, 5, .2, 0, .3), wide(1.4)]);
P("bossa", "genre", ["ボサノバ", "Bossa nova", "波萨诺瓦", "보사노바"], ["やわらかいギターと小さな部屋", "Soft guitar in a small room"],
  [EQ(["lowshelf", 150, 2], ["peaking", 4000, -1], ["highshelf", 9000, -2]), drive(.05, .4), verb(1, 2, .12)]);
P("chamber", "genre", ["室内楽", "Chamber", "室内乐", "실내악"], ["弦の響きが近い小ホール", "Intimate strings in a small hall"],
  [EQ(["peaking", 3000, 1.5]), verb(1.6, 2.5, .18), wide(1.15)]);

/* ================= シーン（20） ================= */
P("sleep", "scene", ["おやすみ", "Sleep", "睡眠", "수면"], ["高音を丸く、静かに包む", "Soft highs, gentle and quiet"],
  [EQ(["lowpass", 4500, 0, .7], ["lowshelf", 150, 1]), comp(-30, 4, 2, .02, .4), wide(.8), verb(2.5, 3.5, .12), gain(-6)]);
P("voice", "scene", ["音声・トーク", "Voice & talk", "人声・讲话", "음성・토크"], ["声を聴き取りやすく（モノラル）", "Clear speech (mono)"],
  [EQ(["highpass", 90, 0, .7], ["peaking", 250, -3, 1], ["peaking", 2500, 4, .9], ["highshelf", 9000, -2]), comp(-24, 4, 4), wide(0)]);
P("study", "scene", ["作業用", "Focus", "专注工作", "작업용"], ["耳に刺さらず、聴き疲れしない", "Smooth and non-fatiguing"],
  [EQ(["peaking", 3000, -2], ["highshelf", 8000, -3]), comp(-28, 2.5, 2), wide(.9)]);
P("live", "scene", ["ライブ会場", "Live venue", "现场", "라이브 공연장"], ["会場の真ん中で聴く", "Like standing in the crowd"],
  [EQ(["lowshelf", 100, 2]), wide(1.2), verb(2.8, 2.5, .3)]);
P("car", "scene", ["🚚 運転席", "🚚 Driver's seat", "🚚 驾驶座", "🚚 운전석"], ["トラックの車内で聴く感じ", "Like listening in the truck"],
  [EQ(["lowshelf", 90, 4], ["peaking", 400, -2, 1], ["highshelf", 7000, 2]), comp(-24, 3, 3), verb(.3, 4, .08), wide(.9)]);
P("commute", "scene", ["通勤・通学", "Commute", "通勤", "출퇴근"], ["電車の音に負けない、聴き取りやすさ", "Cuts through train noise"],
  [EQ(["highpass", 60, 0, .7], ["peaking", 3000, 2]), comp(-30, 4, 6)]);
P("cafe", "scene", ["カフェ", "Café", "咖啡馆", "카페"], ["店内のBGMのように、遠くやわらかく", "Soft, like background music in a café"],
  [EQ(["highshelf", 7000, -3]), verb(1.2, 2.5, .15), wide(.9), noise("crowd", -36)]);
P("rainy", "scene", ["雨の日", "Rainy day", "雨天", "비 오는 날"], ["窓の外で雨が降っている", "Rain outside the window"],
  [EQ(["highshelf", 6000, -3], ["lowshelf", 150, 1]), verb(1.4, 3, .12), noise("rain", -26)]);
P("campfire", "scene", ["焚き火", "Campfire", "篝火", "모닥불"], ["パチパチはぜる火のそばで", "By a crackling fire"],
  [EQ(["lowpass", 7000, 0, .7]), noise("fire", -24), verb(.8, 3, .08)]);
P("morning", "scene", ["朝のめざめ", "Morning", "清晨", "아침"], ["すっきり明るく、軽やかに", "Fresh, bright and light"],
  [EQ(["highpass", 50, 0, .7], ["peaking", 300, -1.5], ["highshelf", 8000, 3]), wide(1.15), gain(-3)]);
P("highway", "scene", ["夜の高速", "Night highway", "夜间高速", "밤의 고속도로"], ["広がる景色と流れる風", "Wide view and rushing wind"],
  [EQ(["lowshelf", 80, 3]), wide(1.4), delay(.5, .3, .12, 4000), noise("wind", -34)]);
P("run", "scene", ["ランニング", "Running", "跑步", "러닝"], ["足を前に出したくなる低音", "Bass that pushes you forward"],
  [EQ(["lowshelf", 70, 5], ["highshelf", 9000, 2]), pump(.15, 1), comp(-24, 4, 4)]);
P("streambgm", "scene", ["実況のBGM", "Stream BGM", "直播背景乐", "방송 BGM"], ["声と被る帯域を空けて、小さめに", "Leaves room for your voice"],
  [EQ(["peaking", 2500, -5, .7], ["highshelf", 9000, -1]), comp(-26, 3, 0), gain(-8)]);
P("meditate", "scene", ["瞑想", "Meditation", "冥想", "명상"], ["ゆっくり呼吸するように揺れる", "Slow, breathing sway"],
  [EQ(["lowpass", 3000, 0, .7]), trem(.2, 8), verb(4, 4, .35), wide(1.3), gain(-4)]);
P("fog", "scene", ["霧の朝", "Foggy morning", "雾中清晨", "안개 낀 아침"],
  ["輪郭がぼやけて、遠くに溶ける", "Edges blur and melt into the distance"],
  [EQ(["lowpass", 2500, 0, .7]), verb(4, 3, .45), wide(1.3), gain(-4)]);
P("snownight", "scene", ["雪の夜", "Snowy night", "雪夜", "눈 내리는 밤"],
  ["雪が音を吸って、しんと静か", "Snow soaks up the sound — hushed and still"],
  [EQ(["peaking", 3000, -2], ["highshelf", 5000, -5]), comp(-30, 2, 1), wide(.8), gain(-3)]);
P("futon", "scene", ["布団をかぶって", "Under the covers", "蒙在被子里", "이불 속에서"],
  ["こっそり夜ふかしの音", "Secretly staying up late"],
  [EQ(["lowpass", 900, 0, .8]), wide(.6), gain(-6)]);
P("neckphones", "scene", ["首にかけたヘッドホン", "Headphones around your neck", "挂在脖子上的耳机", "목에 건 헤드폰"],
  ["外したヘッドホンから、かすかに漏れる", "Faintly leaking from headphones you took off"],
  [EQ(["highpass", 350, 0, .8], ["lowpass", 9000, 0, .7]), wide(.3), verb(.5, 2, .15), gain(-12)]);
P("wakeup", "scene", ["夢から覚める直前", "Almost awake", "快要醒来时", "꿈에서 깨기 직전"],
  ["こもったりはっきりしたりを、ゆっくり繰り返す", "Slowly drifting between muffled and clear"],
  [sweep("lowpass", 400, 14000, 32, .8), chorus(18, 4, .2, 0, .3), verb(3, 3, .25)]);
P("whisper", "scene", ["耳元で", "Right by your ear", "耳边", "귓가에서"],
  ["すぐそばで鳴っているような近さ", "Feels like it's playing right next to you"],
  [EQ(["highpass", 100, 0, .7], ["peaking", 3000, 2], ["highshelf", 8000, 4]), comp(-28, 3, 3), wide(1.5)]);

/* ================= 空間（17） ================= */
P("bath", "space", ["お風呂", "Bathroom", "浴室", "욕실"], ["タイルに響く、明るい残響", "Bright tiled echo"],
  [EQ(["highpass", 120, 0, .7]), verb(.9, 1.6, .4)]);
P("tunnel", "space", ["トンネル", "Tunnel", "隧道", "터널"], ["長いコンクリートの筒", "A long concrete tube"],
  [EQ(["lowpass", 5000, 0, .7]), delayMs(90, .35, .25, 3000), verb(2, 2, .3)]);
P("cathedral", "space", ["大聖堂", "Cathedral", "大教堂", "대성당"], ["天井の高い石造りの響き", "Towering stone reverb"],
  [EQ(["highshelf", 7000, -2]), verb(7, 3, .45), wide(1.3)]);
P("nextroom", "space", ["隣の部屋", "Next room", "隔壁房间", "옆방"], ["壁ごしに聞こえる", "Heard through the wall"],
  [EQ(["lowpass", 350, 0, .9], ["peaking", 120, 3]), verb(.6, 2, .15), wide(.4), gain(-4)]);
P("gym", "space", ["体育館", "Gym", "体育馆", "체육관"], ["広くて硬い壁の響き", "Big room, hard walls"],
  [EQ(["peaking", 1000, 1]), delayMs(140, .15, .1, 3000), verb(2.5, 1.8, .35)]);
P("stadium", "space", ["スタジアム", "Stadium", "体育场", "스타디움"], ["遠くまで跳ね返るやまびこ", "Echoes across the stands"],
  [delayMs(220, .2, .18, 2500), verb(5, 2.5, .35), wide(1.5)]);
P("onebud", "space", ["片耳でも", "One earbud", "单耳", "한쪽 이어폰"], ["片耳イヤホンでも全部の音が聞こえる", "Hear everything with one earbud"],
  [wide(0), EQ(["highpass", 100, 0, .7], ["peaking", 3000, 2])]);
P("crossfeed", "space", ["クロスフィード", "Crossfeed", "交叉馈送", "크로스피드"], ["ヘッドホンの聴き疲れを減らす", "Less headphone fatigue"],
  [xfeed(.35)]);
P("farfest", "space", ["遠くの野外フェス", "Distant festival", "远处的音乐节", "멀리서 들리는 페스티벌"], ["丘の向こうから聞こえてくる", "Drifting over the hill"],
  [EQ(["highpass", 100, 0, .7], ["lowpass", 4000, 0, .7]), delayMs(300, 0, .2, 2000), verb(3, 2, .2), gain(-3)]);
P("elevator", "space", ["エレベーターの中", "In the elevator", "电梯里", "엘리베이터 안"],
  ["狭い金属の箱と、天井の小さなスピーカー", "A small metal box with a ceiling speaker"],
  [EQ(["highpass", 300, 0, .7], ["lowpass", 5000, 0, .7]), wide(0), verb(.4, 1.5, .35), gain(-6)]);
P("supermarket", "space", ["スーパーの店内放送", "Supermarket PA", "超市广播", "마트 매장 방송"],
  ["天井のあちこちから、少しずつずれて鳴る", "Ceiling speakers, slightly out of sync"],
  [EQ(["highpass", 250, 0, .7], ["lowpass", 6000, 0, .7]), wide(0), delayMs(45, .2, .3, 4000), verb(3, 2, .25), noise("crowd", -34)]);
P("schoolyard", "space", ["運動会の校庭スピーカー", "School sports day PA", "运动会操场喇叭", "운동회 운동장 스피커"],
  ["ラッパ型スピーカーと、校舎からのはね返り", "Horn speakers bouncing off the school building"],
  [EQ(["highpass", 500, 0, .8], ["lowpass", 4500, 0, .8], ["peaking", 2000, 4, 1]), drive(.25, .6), wide(0), delayMs(380, .15, .3, 2500), verb(2, 2, .15)]);
P("planetarium", "space", ["プラネタリウム", "Planetarium", "天文馆", "플라네타리움"],
  ["丸い天井で、星空と一緒にゆっくり回る", "A dome that slowly turns with the stars"],
  [EQ(["highshelf", 8000, -2]), verb(4.5, 3, .35), wide(1.6), pan(.35, 16), gain(-2)]);
P("oshiire", "space", ["押し入れの中", "In the closet", "壁橱里", "벽장 속"],
  ["布団に囲まれた、狭くてこもった音", "Tight and muffled among the futons"],
  [EQ(["lowpass", 1200, 0, .8], ["peaking", 250, 3, 1.2]), verb(.25, 3, .3), wide(.5), gain(-5)]);
P("pianoclass", "space", ["隣の家のピアノ教室", "Piano lesson next door", "邻居家的钢琴课", "옆집 피아노 교실"],
  ["夕方、窓の外からかすかに聞こえる", "Drifting in through an open window at dusk"],
  [EQ(["highpass", 100, 0, .7], ["lowpass", 2500, 0, .7]), verb(.8, 2, .25), wide(.2), gain(-9)]);
P("pipe", "space", ["土管の中", "Inside a pipe", "水管里", "토관 속"],
  ["筒が共鳴して、ボワーン", "The tube resonates — bwoooon"],
  [EQ(["peaking", 220, 8, 6]), delayMs(9, .7, .35, 3000), verb(1.5, 2, .25)]);
P("platform", "space", ["駅のホーム", "Train platform", "车站月台", "역 플랫폼"],
  ["構内放送のように、遠くまで響く", "Echoing like a station announcement"],
  [EQ(["highpass", 150, 0, .7]), delayMs(420, .25, .25, 2500), verb(3.5, 2.2, .3), noise("crowd", -32)]);

/* ================= ゲーム（15） ================= */
P("arcade", "game", ["8bit風", "8-bit", "8bit风", "8비트풍"], ["ゲーム機のようなカクカクした音", "Chunky retro console sound"],
  [lofi(5, 9000), EQ(["highpass", 150, 0, .7], ["peaking", 1500, 3, 1]), wide(.5)]);
P("boss", "game", ["ボス戦", "Boss battle", "Boss战", "보스전"], ["重く、広く、迫力満点", "Heavy, wide and intense"],
  [EQ(["lowshelf", 70, 5], ["peaking", 3000, 2]), drive(.12, .35), wide(1.4), comp(-20, 4, 3)]);
P("savepoint", "game", ["セーブポイント", "Save point", "存档点", "세이브 포인트"], ["ほっとひと息つける", "A moment to rest"],
  [EQ(["lowpass", 3500, 0, .7]), trem(.12, 4), verb(3, 3, .3), gain(-3)]);
P("dungeon", "game", ["ダンジョン", "Dungeon", "地下城", "던전"], ["ひんやりした洞窟の奥", "Deep in a chilly cave"],
  [EQ(["highpass", 60, 0, .7], ["lowpass", 5000, 0, .7]), delayMs(180, .3, .15, 2500), verb(4, 2.2, .4)]);
P("flashback", "game", ["回想シーン", "Flashback", "回忆场景", "회상 장면"], ["色あせた記憶の中で", "A faded memory"],
  [EQ(["highpass", 200, 0, .7], ["lowpass", 4000, 0, .7]), lofi(12, 5000), noise("vinyl", -30), wide(.5), verb(1.5, 2, .15)]);
P("transform", "game", ["変身シーン", "Transformation", "变身场景", "변신 장면"], ["光に包まれて盛り上がる", "Rising in a burst of light"],
  [sweep("highpass", 80, 1500, 8, 1.2), chorus(4, 2, .25, .6, .4), wide(1.4)]);
P("phase2", "game", ["ラスボス第二形態", "Final boss, phase 2", "最终Boss第二形态", "최종 보스 2페이즈"], ["不穏なうなりが混ざる", "An ominous growl creeps in"],
  [EQ(["lowshelf", 80, 4]), ring(55, .25), drive(.2, .4), verb(4, 3, .25)]);
P("handheld", "game", ["ゲームボーイ風", "Handheld", "掌机风", "휴대용 게임기풍"], ["小さなスピーカーから鳴る", "Out of a tiny speaker"],
  [lofi(4, 6000), EQ(["highpass", 300, 0, .7], ["lowpass", 4500, 0, .7]), wide(0)]);
P("pausemenu", "game", ["ポーズ画面", "Pause menu", "暂停画面", "일시정지 화면"], ["メニューを開いた時の、こもった音", "Muffled like an open menu"],
  [EQ(["lowpass", 600, 0, .9]), verb(1, 2, .15), gain(-6)]);
P("warp", "game", ["ワープ", "Warp", "传送", "워프"], ["シュワシュワ揺れる時空の穴", "Whooshing through a warp hole"],
  [chorus(3, 2.5, 2, .7, .5), wide(1.3)]);
P("gamecenter", "game", ["ゲーセンの隣の筐体", "Arcade next door", "隔壁街机", "옆 게임기"], ["ざわめきの中、となりから聞こえる", "From the cabinet next to you"],
  [EQ(["highpass", 200, 0, .7], ["lowpass", 6000, 0, .7]), drive(.2, .5), wide(.7), noise("crowd", -30)]);
P("themepark", "game", ["夕暮れの遊園地", "Amusement park at dusk", "黄昏的游乐园", "해 질 녘 놀이공원"],
  ["メリーゴーラウンドがくるくる回る", "The merry-go-round keeps turning"],
  [EQ(["lowpass", 6000, 0, .7]), trem(.12, 2), pan(.4, 8), verb(2, 2.5, .25), noise("crowd", -34)]);
P("coaster", "game", ["ジェットコースター", "Roller coaster", "过山车", "롤러코스터"],
  ["風を切って、右へ左へ", "Wind rushing, swinging left and right"],
  [pan(.7, 4), sweep("highpass", 40, 400, 8, .8), noise("wind", -26), comp(-22, 3, 2)]);
P("theater4d", "game", ["4Dシアター", "4D theater", "4D影院", "4D 극장"],
  ["座席ごと揺れるような迫力", "Feels like the seats are moving"],
  [EQ(["lowshelf", 60, 7]), pump(.25, 2), pan(.5, 4), wide(1.5), verb(2.5, 2, .2)]);
P("ending", "game", ["エンディングロール", "End credits", "片尾字幕", "엔딩 크레딧"],
  ["冒険が終わったあとの余韻", "The afterglow when the adventure ends"],
  [EQ(["highshelf", 8000, -2]), delay(1, .35, .2, 3500), verb(4, 3.5, .4), wide(1.4), gain(-2)]);

/* ================= おもしろ（21） ================= */
P("radio", "fun", ["古いラジオ", "Old radio", "老式收音机", "옛날 라디오"], ["細くて少し歪んだ音", "Thin and slightly crunchy"],
  [EQ(["highpass", 400, 0, .7], ["lowpass", 3500, 0, .9], ["peaking", 1500, 3, 1]), drive(.25), wide(0)]);
P("underwater", "fun", ["水中", "Underwater", "水下", "수중"], ["プールの底で聴く", "From the bottom of a pool"],
  [EQ(["lowpass", 650, 0, 3]), verb(1.6, 2, .3), trem(.15, 2)]);
P("p8d", "fun", ["8D風", "8D", "8D", "8D"], ["音が頭の周りを回る（ヘッドホン推奨）", "Sound circles your head (headphones)"],
  [pan(.8, 8), verb(1.5, 2.5, .15)]);
P("karaoke", "fun", ["カラオケ", "Karaoke", "卡拉OK", "노래방"], ["真ん中のボーカルを小さく（ステレオ曲のみ）", "Reduce center vocals (stereo only)"],
  [vcut(.9, 150)]);
P("space", "fun", ["宇宙", "Space", "太空", "우주"], ["遠くまで響くエコー", "Echoes into the distance"],
  [EQ(["highpass", 60, 0, .7]), delay(.75, .45, .3, 4000), verb(5, 4, .35), wide(1.5)]);
P("gate", "fun", ["ゲート", "Gate", "门限切片", "게이트"], ["ビートに合わせて音が刻まれる", "Chopped in time with the beat"],
  [pump(.9, .25)]);
P("record", "fun", ["レコード", "Vinyl", "黑胶唱片", "레코드"], ["プチプチ鳴る針の音", "Crackling needle"],
  [EQ(["lowshelf", 100, 2], ["highshelf", 9000, -3]), wide(.8), noise("vinyl", -28)]);
P("cassette", "fun", ["ラジカセ", "Cassette deck", "磁带录音机", "카세트"], ["テープのゆらぎとサーッという音", "Tape wobble and hiss"],
  [EQ(["highpass", 80, 0, .7], ["peaking", 1500, 2], ["highshelf", 7000, -4]), chorus(8, 1.2, .4, 0, .35), drive(.08, .4), noise("tape", -34)]);
P("pingpong", "fun", ["ピンポン", "Ping-pong", "乒乓回声", "핑퐁"], ["こだまが左右を行き来する", "Echoes bounce left and right"],
  [delay(.5, .4, .3), pan(.9, 1)]);
P("fast8d", "fun", ["高速8D", "Fast 8D", "高速8D", "고속 8D"], ["1拍で頭の周りを一周", "One lap around your head per beat"],
  [pan(.9, 1)]);
P("halfgate", "fun", ["ハーフゲート", "Half gate", "半拍门限", "하프 게이트"], ["半拍ごとに刻んで左右に振る", "Chopped every half beat, swinging"],
  [pump(.7, .5), pan(.5, 2)]);
P("filterfx", "fun", ["フィルター往復", "Filter sweep", "滤波扫频", "필터 스윕"], ["こもる↔開くを4拍で往復", "Muffled ↔ open every 4 beats"],
  [sweep("lowpass", 250, 12000, 4, 1.5)]);
P("wah", "fun", ["ワウ", "Wah", "哇音", "와우"], ["1拍ごとに「ワウ」と鳴く", "Wah on every beat"],
  [sweep("bandpass", 400, 2500, 1, 3), gain(4)]);
P("goldfish", "fun", ["金魚鉢", "Fishbowl", "金鱼缸", "어항"], ["ガラスの向こうでゆらゆら", "Wobbling behind the glass"],
  [EQ(["lowpass", 900, 0, 2]), chorus(20, 8, .3, .3, .5), verb(1.2, 2, .3)]);
P("itodenwa", "fun", ["糸電話", "Tin-can phone", "传声筒", "실 전화기"],
  ["紙コップと糸がビリビリふるえる", "Paper cups and a buzzing string"],
  [EQ(["highpass", 700, 0, 1], ["lowpass", 2800, 0, 1]), delayMs(4, .55, .4, 3000), drive(.2, .5), wide(0)]);
P("keitai", "fun", ["ガラケーの着うた", "Flip-phone ringtone", "翻盖手机铃声", "폴더폰 벨소리"],
  ["2000年代の着信音", "A ringtone from the 2000s"],
  [lofi(8, 6000), EQ(["highpass", 600, 0, .8], ["peaking", 2500, 4, 1]), drive(.25, .6), comp(-20, 4, 4), wide(0)]);
P("showatv", "fun", ["昭和のテレビ", "Old CRT TV", "老式显像管电视", "옛날 브라운관 TV"],
  ["ブラウン管から流れる歌番組", "A music show on a tube TV"],
  [EQ(["highpass", 150, 0, .7], ["lowpass", 8000, 0, .7], ["peaking", 1200, 2]), lofi(12, 8000), drive(.1, .4), wide(0)]);
P("answering", "fun", ["留守番電話", "Answering machine", "电话留言", "자동응답기"],
  ["「ピーッという音のあとに…」", "“Please leave a message after the beep…”"],
  [EQ(["highpass", 350, 0, .7], ["lowpass", 3400, 0, .7]), lofi(8, 3400), noise("tape", -30), wide(0)]);
P("tuning", "fun", ["チューニング中のラジオ", "Tuning the radio", "调台中的收音机", "주파수 맞추는 라디오"],
  ["局を探してダイヤルを回す", "Turning the dial to find a station"],
  [sweep("bandpass", 500, 3000, 8, 2), ring(1100, .15), drive(.2, .5), noise("tape", -28), wide(0)]);
P("glassroom", "fun", ["ガラスの部屋", "Glass room", "玻璃房间", "유리 방"],
  ["キラキラはね返る透明な響き", "Sparkling, transparent reflections"],
  [EQ(["highshelf", 6000, 4]), chorus(5, 1.5, 1.2, .3, .25), verb(1, 1.2, .35)]);
P("grandpiano", "fun", ["グランドピアノの中", "Inside a grand piano", "三角钢琴里", "그랜드 피아노 속"],
  ["弦がいっしょに共鳴する", "The strings ring along with the music"],
  [EQ(["highshelf", 5000, 3]), chorus(3, .8, .5, .6, .3), verb(.6, 2.5, .35)]);

/* ================= ちょっと変（16） ================= */
P("robot", "weird", ["ロボット", "Robot", "机器人", "로봇"], ["金属っぽいビリビリ声", "Buzzy metallic voice"],
  [ring(35, .6), EQ(["highpass", 150, 0, .7])]);
P("alien", "weird", ["宇宙人の通信", "Alien transmission", "外星人通信", "외계인 통신"], ["どこか遠い星からの電波", "A signal from a distant planet"],
  [EQ(["highpass", 400, 0, .7], ["lowpass", 4000, 0, .7]), ring(700, .5), delay(.25, .4, .2, 3000)]);
P("phone", "weird", ["電話の向こう", "On the phone", "电话那头", "전화 너머"], ["受話器から聞こえる歌", "Singing down the line"],
  [EQ(["highpass", 350, 0, .7], ["lowpass", 3400, 0, .7], ["peaking", 1500, 4]), drive(.3, .6), wide(0)]);
P("broken", "weird", ["壊れたスピーカー", "Busted speaker", "坏掉的音箱", "고장 난 스피커"], ["割れて、ビリつく", "Cracked and rattling"],
  [drive(.7), EQ(["highpass", 500, 0, .7], ["lowpass", 3000, 0, .7]), wide(0), gain(-6)]);
P("dream", "weird", ["夢の中", "Dreaming", "梦中", "꿈속"], ["ぼやけて揺れて、遠のいていく", "Hazy, swaying, drifting away"],
  [chorus(22, 8, .15, 0, .45), sweep("lowpass", 1200, 8000, 16, .7), verb(5, 3, .35)]);
P("livehouse", "weird", ["壁の向こうのライブハウス", "Club through the wall", "墙那边的Livehouse", "벽 너머 라이브하우스"], ["ドンドンという低音だけが届く", "Only the thump gets through"],
  [EQ(["lowpass", 280, 0, 1], ["lowshelf", 80, 5]), verb(1, 2, .2), wide(.3)]);
P("timewarp", "weird", ["時空のゆがみ", "Time warp", "时空扭曲", "시공간 왜곡"], ["ぐにゃっと伸び縮みする", "Bending and stretching"],
  [chorus(6, 5, .08, .5, .5), ring(2, .3), verb(3, 3, .25)]);
P("neighborcar", "weird", ["信号待ちの隣の車", "Car at the red light", "等红灯的隔壁车", "신호 대기 중인 옆 차"], ["窓越しに低音だけズンズン", "Just the bass through the window"],
  [EQ(["lowpass", 180, 0, 1], ["lowshelf", 60, 6]), wide(.2), gain(-3)]);
P("silentdisco", "weird", ["サイレントディスコを外から", "Silent disco from outside", "从外面听静音迪斯科", "밖에서 듣는 사일런트 디스코"],
  ["みんなのヘッドホンから漏れる音だけ", "Only what leaks from everyone's headphones"],
  [EQ(["highpass", 1500, 0, .8], ["lowpass", 9000, 0, .7]), wide(.5), gain(-16), noise("crowd", -26)]);
P("leak", "weird", ["満員電車の音漏れ", "Earbud leak on a packed train", "满员电车的漏音", "만원 전철의 소리 새는 이어폰"],
  ["隣の人のイヤホンから、シャカシャカ", "Tinny chatter from someone's earbuds"],
  [EQ(["highpass", 1200, 0, .8], ["lowpass", 7000, 0, .7]), wide(0), gain(-14), noise("wind", -28)]);
P("womb", "weird", ["おなかの中", "From the womb", "在肚子里", "엄마 뱃속"],
  ["心音と一緒に、遠くから聞こえる", "Far away, with a heartbeat"],
  [EQ(["lowpass", 500, 0, .8], ["lowshelf", 120, 4]), pump(.3, 1), verb(1, 2.5, .25), wide(.6), gain(-3)]);
P("spacesuit", "weird", ["宇宙服の中", "Inside a spacesuit", "宇航服里", "우주복 안"],
  ["無線ごしの声と、自分の呼吸", "Radio chatter and your own breathing"],
  [EQ(["highpass", 300, 0, .8], ["lowpass", 3000, 0, .8]), comp(-26, 4, 4), wide(0), verb(.2, 4, .1), noise("wind", -40)]);
P("blackhole", "weird", ["ブラックホールのそば", "Near a black hole", "黑洞旁边", "블랙홀 근처"],
  ["音ごと引きのばされて、吸いこまれていく", "Stretched out and pulled in"],
  [sweep("lowpass", 200, 4000, 32, 2), delay(1.5, .7, .35, 1500), verb(8, 2, .5), gain(-3)]);
P("matryoshka", "weird", ["入れ子の部屋", "Rooms within rooms", "套娃房间", "방 속의 방"],
  ["部屋の中の、部屋の中の、部屋", "A room inside a room inside a room"],
  [verb(.3, 3, .3), delayMs(60, .3, .2, 4000), verb(1.5, 2.5, .25), delayMs(180, .3, .2, 2500), verb(5, 3, .25)]);
P("howl", "weird", ["ハウリング寸前", "On the edge of feedback", "啸叫边缘", "하울링 직전"],
  ["卒業式のマイクが、キーンとなりかける", "The ceremony mic is about to squeal"],
  [EQ(["peaking", 2200, 9, 14]), delayMs(7, .75, .25, 4000), gain(-6)]);
P("deepsea", "weird", ["深海", "Deep sea", "深海", "심해"],
  ["光の届かない、ゆっくりした世界", "A slow world where no light reaches"],
  [EQ(["lowpass", 400, 0, 4]), chorus(30, 10, .07, .4, .5), trem(.2, 8), verb(6, 3, .4)]);
})();
/* ✅ fx-presets.js 完了 */
