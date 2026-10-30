// SPDX-License-Identifier: GPL-3.0-or-later
/* ==========================================================================
   trk! mmd.js — 🩷 MMDマスコット（PMX/PMD モデル ＋ VMD モーション）
   ・Lat式ミク・タワシ式CHAN×CO など、MMDのモデルを「自分の端末から」読み込んで動かせます。
     モデルは同梱しません（配布元の規約にしたがって、各自が用意してください）。
   ・3Dの部品（three.js / @yohawing/three-mmd-loader）は、MMDを初めて使うときだけ
     index.html の importmap から読み込みます（assets/vendor/ に同梱。CDNへは接続しません）。
   ・モーションは2つの道：
     ① 自分で用意した .vmd を読み込む（配布元の規約を確認してから）
     ② 内蔵モーション（振付・表情カーブをコード生成し、VMDを実行時に組み立てます。外部VMDは同梱しません）
   ・物理（髪・スカートの揺れ）は、ライブラリの対応範囲ですが、いまはオフ（軽さ優先）。
   読み込み順：… → vrm.js → mmd.js（どちらも遅延読み込みの3D）   ※ vrm.js とは独立しています。
   ========================================================================== */
"use strict";
(() => {
  const core = window.Trk.core;
const MB = 1048576, MAX_PMX = 120 * MB, MAX_VMD = 40 * MB, MAX_FILES = 400;
const MMD_LIB = "@yohawing/three-mmd-loader";
const mmdDB = core.idbStore("shadow_taiko_mmd", "files");     // 🆕 新しい保存先（既存のキーは変えません）

/* ============ 文章（接頭辞 mmd…） ============ */
Object.assign(TEXT.ja, {
  mmdTitle:"🩷 MMDマスコット（ミクモード・モデル追加）",
  mmdHint:"MMDのモデル（.pmx/.pmd）とモーション（.vmd）を読み込んで、ゲーム中に踊らせられます。モデルは「持ち込み」が基本です（下に💠同梱モデルのボタンがあるときは、それだけで始められます）。持ち込むときは配布元の規約（商用不可・再配布不可など）を守って、自分で用意してください。",
  mmdPresetBtn:"💠 {name} をマスコットにする（同梱）",
  mmdPresetHint:"💠 は、この trk! に「れあどめ」（配布元の規約）ごと同梱されているモデルです。規約（PCL＝非営利など）の範囲で楽しんでください。クレジットは自動で入ります。",
  mmdPresetMissing:"同梱モデルのファイルが見つかりませんでした（この配布には入っていないようです）。",
  mmdGuideHint:"💠 この配布にはモデル本体を入れていません（軽量版）。下のリンクから自分で入手し、📦 モデル／📁 フォルダ で読み込んでください。🎬 モーション（.vmd）も同じように追加できます。内蔵モーション65種はコード生成なので、この配布でもそのまま使えます。",
  mmdGuideLink:"⬇ {name} を入手する（外部サイト）",
  mmdGuideTerms:"配布元の規約（PCL＝非営利、再配布の条件など）は自分で確認してください。trk! はモデル本体を再配布しません。",
  mmdNoEngine:"3Dの部品（three.js／MMDローダー）を読み込めません。assets/vendor/ の有無とファイル配置を確認し、ローカルHTTPサーバーから開いてください。",
  mmdAgree:"配布元の規約を確認し、自分で用意したモデルを使います（三次配布・商用利用はしません）",
  mmdChooseModel:"📦 モデル（.pmx/.pmd）", mmdChooseFolder:"📁 モデルのフォルダ（テクスチャも一緒に）",
  mmdChooseMotion:"🎬 モーション（.vmd）", mmdClearModel:"モデルを外す", mmdClearMotion:"モーションを外す",
  mmdRemember:"読み込んだモデル・モーションを、この端末に保存する（IndexedDB）",
  mmdModelHead:"モデル", mmdMotionHead:"モーション", mmdFitHead:"大きさ・向き",
  mmdSize:"大きさ", mmdTurn:"向き（左右）", mmdCreditLabel:"クレジット表示（作者名など）", mmdCreditPlaceholder:"例：Lat式初音 / Lat",
  mmdCheck:"🔎 動作チェック（実機で）", mmdCopy:"📋 結果をコピー", mmdCopied:"📋 コピーしました", mmdCopyNg:"📋 コピーできませんでした（下の行を選んでコピーしてください）",
  mmdCheckHint:"うまく動かないときは、これを押すと WebGL・3Dの部品（three／three-mmd-loader、同梱）・モデル・モーションの状態を調べて1か所に出します。うまくいかない場合は、この結果を貼ってもらえれば原因を切り分けられます。",
  mmdCheckRunning:"チェック中…（初回は3Dの部品を読み込むので、少し待ちます）", mmdCheckOk:"✅ チェックOK（WebGL・3Dの部品・ライブラリ）", mmdCheckNg:"❌ チェックで問題が見つかりました（下の結果を見てください）",
  mmdQuickTitle:"🩷 マスコットのうごき", mmdQuickWatch:"👀 ひとやすみ", mmdQuickAuto:"🎲 おまかせ",
  mmdQuickPick:"🎯 えらぶ", mmdQuickOff:"💤 お留守番",
  mmdQuickUILabel:"🩷 ミクモードをONにする（MMDデスクトップマスコット機能）",
  mmdQuickFavTip:"⭐ お気に入りに入れる／外す（えらぶの一覧で上に来ます）",
  mmdMotionNone:"（モーションなし）",
  mmdMotionAuto:"🎲 おまかせ（曲のBPMにいちばん近い🎵を自動で。設定しなおし不要）",
  mmdMotionWatch:"👀 みてる（こちらをじっと・BPM非依存）", mmdMotionStroll:"👀 たたずむ（見まわす・BPM非依存）",
  mmdMotionWalk:"🚶112 その場で歩く（BPM同期）", mmdMotionRun:"🏃152 その場で走る（BPM同期）",
  mmdMotionSit:"🪑 おすわり（座ってひと息・BPM非依存）", mmdMotionDance:"💃128 ポップダンス（オリジナル・16拍）", mmdMotionLegacy:"旧設定",
  mmdMotionStep:"内蔵① ステップ（120BPM）", mmdMotionSwing:"内蔵② ゆらゆら（100BPM）", mmdMotionTurn:"内蔵③ ターン（120BPM）",
  mmdMotionJump:"内蔵④ ジャンプ（130BPM・はで）", mmdMotionIdol:"内蔵⑤ アイドル（128BPM）",
  mmdMotionDreamy:"🎸128 しっとり（When You Sleepむけ）",
  mmdMotionKneel:"🎸128 かたひざ（しずかに眺める）",
  mmdMotionIevan:"🎵120 ネギスピン（Ievan Polkkaむけ）", mmdMotionKyukura:"🎵165 くらくら（きゅうくらりんむけ）",
  mmdMotionRabbit:"🎵173 うさみみ（ラビットホールむけ・5拍子スキップ）", mmdMotionMesmer:"🎵185 すましシャッフル（メズマライザーむけ）",
  mmdMotionDune:"🎵135 こうしん（砂の惑星むけ）", mmdMotionGreen:"🎵145 ペンライト（グリーンライツむけ）",
  mmdMotionMikumiku:"🎵160 してやんよ（みくみくにしてあげる♪むけ）", mmdMotionTyw:"🎵150 せかいへ（Tell Your Worldむけ）",
  mmdMotionSenbon:"🎵154 キレの和（千本桜むけ）", mmdMotionMelt:"🎵170 きゅん（メルトむけ）",
  mmdMotionUmg:"🎵170 つたえる（アンノウン・マザーグースむけ）", mmdMotionWedh:"🎵174 ダンスホール（ワールズエンドむけ）",
  mmdMotionRolling:"🎵194 ぐるぐる（ローリンガールむけ）", mmdMotionUraomote:"🎵196 うらおもて（裏表ラバーズむけ）",
  mmdMotionVanish:"🎵240 こうそく（消失むけ）",
  mmdGroupDaily:"👀 日常・ひとやすみ", mmdGroupDance:"💃 ダンス・ステージ", mmdGroupSongs:"🎵 ミク曲テンポのオリジナル", mmdGroupMiku:"🌟 ミク定番ネタ・ポーズ", mmdGroupFaces:"🎭 表情・しぐさ", mmdGroupVoice:"🎤 歌・口パク",
  mmdMotionFaceSmile:"😊 にっこり＆小さな手ふり（表情）", mmdMotionFaceWink:"😉 ウィンク＆決めポーズ", mmdMotionFaceShy:"🫣 てれおじぎ", mmdMotionFaceAngry:"😤 ぷんぷんポーズ", mmdMotionFaceConfused:"💭 こまり首かしげ", mmdMotionFaceSurprise:"😲 びっくりポーズ", mmdMotionFaceSleepy:"😴 ねむねむゆらゆら", mmdMotionFacePout:"😗 ぷくっと口をとがらせる", mmdMotionFaceLaugh:"😆 くすくす笑い", mmdMotionFaceSing:"🎤 あいうお口パク（音声同期なし）",
  mmdMotionSongMic:"🎤 マイク風に歌う（胸の前で・BPM非依存）", mmdMotionSongLong:"🎤 しっとり長めに歌う（ゆったり）",
  mmdMotionSongUp:"🎤 ノリノリで歌う（速い口パク・左右に揺れ）", mmdMotionSongHum:"🎤 鼻歌（口は小さく・首でリズム）",
  mmdMotionSongWhisper:"🎤 ひそひそ歌（前のめりで小声）", mmdMotionSongCall:"🎤 サビで腕を広げて歌い上げる",
  mmdMotionPrincess:"🎵152 👑 お姫さまポーズ（ワールドイズマイン風）", mmdMotionLeekShake:"🎵120 🧅 ネギふり手ぶり（小物なし）", mmdMotionPopipo:"🎵150 🥬 野菜バウンス（ぽっぴっぽー風）", mmdMotionTriple:"🎵140 😜 おちゃめな交互ポーズ（トリプルバカ風）", mmdMotionNyan:"🎵160 🐾 ねこ手ステップ（衣装・耳なし）", mmdMotionSalute:"🎵128 🫡 ミクサルート", mmdMotionDoubleHeart:"🎵128 🫶 両手ハート風ポーズ", mmdMotionPoint:"🎵160 👉 左右交互の指さし風", mmdMotionEncore:"🎵128 👏 アンコールのお手ふり", mmdMotionDramatic:"🎵170 🎭 胸から届けるバラード風", mmdMotionVictory:"🎵128 ✌️ ピース＆勝利ポーズ", mmdMotionPenlight:"🎵145 ✨ ペンライト風の腕ふり（小物なし）", mmdMotionChibi:"🎵128 🍬 ミニバウンス（ちいさく跳ねる）", mmdMotionSpin:"🎵128 🌀 くるりターン（半回転風）",
  mmdMotionGroove:"🕺 ゆるいグルーヴ（112）", mmdMotionStepTouch:"👟 ステップタッチ（128）", mmdMotionShoulderPop:"🎵 肩でポップ（128）", mmdMotionArmWave:"🌊 なめらかアームウェーブ（120）", mmdMotionCrossStep:"👣 クロスステップ（128）", mmdMotionSoftBow:"🙇 おじぎして、もどる（BPM非依存）", mmdMotionMarionette:"🧵 マリオネット風アーム（120）",
  mmdBuiltinNote:"内蔵モーション65種は trk! のコードからVMDを実行時生成します（第三者VMDや振付ファイルは同梱しません）。表情はLat式ミクPMDで確認したモーフ名を使うため、同名モーフがあるモデルだけ反映されます。🎵や「〜風」はテンポ・雰囲気の着想を示すだけで、原曲の振付再現ではありません。🎤口パクは母音ループで、音声とは同期しません。基準BPMが0のとき、内蔵モーションは曲に自動シンクします。",
  mmdBpm:"モーションの基準BPM（0＝内蔵は自動シンク・持ち込みVMDは固定）",
  mmdLoading:"モデルを読み込んでいます…", mmdLoadingPct:"モデルを読み込んでいます… {n}%",
  mmdLoaded:"モデル「{name}」を読み込みました。", mmdRestored:"前回のモデルを戻しました。",
  mmdNotMmd:"MMDのモデル（.pmx/.pmd）ではありません。", mmdTooBig:"大きすぎます（モデルは{n}MB、モーションは{m}MBまで）。",
  mmdNoModel:"先にモデルを読み込んでください。", mmdNetError:"3Dの部品を読み込めませんでした。ページを再読み込みして、もう一度試してください。",
  mmdNoWebGL:"WebGLを使えない環境です。", mmdLoadError:"モデルを読み込めませんでした。",
  mmdNoAgree:"先に、うえの「規約を確認しました」にチェックを入れてください。",
  mmdFilesEmpty:"モデルのファイルが入っていません。", mmdTooManyFiles:"ファイルが多すぎます（{n}個まで）。",
  mmdVmdLoaded:"モーション「{name}」を読み込みました。", mmdVmdBad:"VMD（モーション）ではありません／読み込めませんでした。",
  mmdSelected:"MMDのマスコットに切り替えました。", mmdSafe:"🛟 セーフモード中は、MMDの読み込み・復元をしません。",
  mmdSaveFail:"この端末に保存できませんでした（大きすぎる可能性があります）。",
  mmdCreditPrefix:"MMD:"
});
Object.assign(TEXT.en, {
  mmdTitle:"🩷 MMD Mascot (Miku mode / Add model)",
  mmdHint:"Load an MMD model (.pmx/.pmd) and motion (.vmd) and let it dance in-game. Bringing your own model is the default (when a 💠 bundled-model button appears below, that alone gets you started). If you bring one, follow the distributor's terms (usually non-commercial, no redistribution).",
  mmdPresetBtn:"💠 Use {name} as the mascot (bundled)",
  mmdPresetHint:"💠 is a model bundled with this trk! together with its original readme (the distributor's terms). Enjoy it within those terms (PCL: non-commercial etc.). The credit line is filled in automatically.",
  mmdPresetMissing:"Could not find the bundled model files (this copy may not include them).",
  mmdGuideHint:"💠 This build does not include the model itself (lightweight build). Get it from the link below, then load it with 📦 Model / 📁 Folder. You can add motions (.vmd) the same way. The 65 built-in motions are generated by code, so they still work here.",
  mmdGuideLink:"⬇ Get {name} (external site)",
  mmdGuideTerms:"Check the distributor's terms yourself (PCL: non-commercial, redistribution conditions, and so on). trk! does not redistribute the model.",
  mmdNoEngine:"Cannot load the 3D parts (three.js / the MMD loader). Check that assets/vendor/ is present and open the app over a local HTTP server.",
  mmdAgree:"I'll use a model I obtained myself, following its terms (no re-distribution, no commercial use)",
  mmdChooseModel:"📦 Model (.pmx/.pmd)", mmdChooseFolder:"📁 Model folder (with textures)",
  mmdChooseMotion:"🎬 Motion (.vmd)", mmdClearModel:"Remove model", mmdClearMotion:"Remove motion",
  mmdRemember:"Keep the loaded model and motion on this device (IndexedDB)",
  mmdModelHead:"Model", mmdMotionHead:"Motion", mmdFitHead:"Size and angle",
  mmdSize:"Size", mmdTurn:"Facing", mmdCreditLabel:"Credit line (author etc.)", mmdCreditPlaceholder:"e.g. Lat-style Miku / Lat",
  mmdCheck:"🔎 Check (on your device)", mmdCopy:"📋 Copy the result", mmdCopied:"📋 Copied", mmdCopyNg:"📋 Could not copy (select the lines below)",
  mmdCheckHint:"If something does not work, press this: it checks WebGL, the bundled 3D parts (three / three-mmd-loader), your model and your motion, and prints one block. Paste that block and we can find the cause.",
  mmdCheckRunning:"Checking… (the first run loads the 3D parts, so give it a moment)", mmdCheckOk:"✅ Check OK (WebGL, 3D parts, libraries)", mmdCheckNg:"❌ Something is wrong (see the lines below)",
  mmdQuickTitle:"🩷 Mascot moves", mmdQuickWatch:"👀 Chill", mmdQuickAuto:"🎲 Auto",
  mmdQuickPick:"🎯 Pick", mmdQuickOff:"💤 Away",
  mmdQuickUILabel:"🩷 Enable Miku mode (MMD desktop mascot feature)",
  mmdQuickFavTip:"⭐ Add to / remove from favorites (they come first in the Pick list)",
  mmdMotionNone:"(no motion)",
  mmdMotionAuto:"🎲 Auto (pick the 🎵 nearest to the song's BPM — set once, works everywhere)",
  mmdMotionWatch:"👀 Watching you (BPM-free)", mmdMotionStroll:"👀 Standing by (looking around, BPM-free)",
  mmdMotionWalk:"🚶112 Walk in place (BPM sync)", mmdMotionRun:"🏃152 Run in place (BPM sync)",
  mmdMotionSit:"🪑 Sit and rest (no BPM)", mmdMotionDance:"💃128 Pop dance (original · 16 beats)", mmdMotionLegacy:"saved motion",
  mmdMotionStep:"Built-in 1: Step (120 BPM)", mmdMotionSwing:"Built-in 2: Sway (100 BPM)", mmdMotionTurn:"Built-in 3: Turn (120 BPM)",
  mmdMotionJump:"Built-in 4: Jump (130 BPM, flashy)", mmdMotionIdol:"Built-in 5: Idol pump (128 BPM)",
  mmdMotionDreamy:"🎸128 Dreamy drift (for When You Sleep)",
  mmdMotionKneel:"🎸128 One-knee gaze (quiet)",
  mmdMotionIevan:"🎵120 Leek spin (for Ievan Polkka)", mmdMotionKyukura:"🎵165 Dizzy puppet (for Kyu-kurarin)",
  mmdMotionRabbit:"🎵173 Bunny-ear hop (for Rabbit Hole, 5-beat skip)", mmdMotionMesmer:"🎵185 Cartoon shuffle (for Mesmerizer)",
  mmdMotionDune:"🎵135 March (for Sand Planet)", mmdMotionGreen:"🎵145 Penlight (for Greenlights Serenade)",
  mmdMotionMikumiku:"🎵160 Shite-yan-yo! (for Miku Miku ni Shite Ageru)", mmdMotionTyw:"🎵150 To the world (for Tell Your World)",
  mmdMotionSenbon:"🎵154 Sharp wa-style (for Senbonzakura)", mmdMotionMelt:"🎵170 Heart-flutter (for Melt)",
  mmdMotionUmg:"🎵170 Reaching out (for Unknown Mother Goose)", mmdMotionWedh:"🎵174 Dancehall (for World's End Dancehall)",
  mmdMotionRolling:"🎵194 Rolling (for Rolling Girl)", mmdMotionUraomote:"🎵196 Flip-flop (for Ura-Omote Lovers)",
  mmdMotionVanish:"🎵240 Hyper rush (for The Disappearance)",
  mmdGroupDaily:"👀 Daily & idle", mmdGroupDance:"💃 Dance & stage", mmdGroupSongs:"🎵 Original dances at Miku-song tempos", mmdGroupMiku:"🌟 Miku-inspired gestures", mmdGroupFaces:"🎭 Expressions & acting", mmdGroupVoice:"🎤 Singing & lip-sync",
  mmdMotionFaceSmile:"😊 Smile and small wave", mmdMotionFaceWink:"😉 Wink and pose", mmdMotionFaceShy:"🫣 Shy bow", mmdMotionFaceAngry:"😤 Grumpy pose", mmdMotionFaceConfused:"💭 Confused head tilt", mmdMotionFaceSurprise:"😲 Surprised pose", mmdMotionFaceSleepy:"😴 Sleepy sway", mmdMotionFacePout:"😗 Pout", mmdMotionFaceLaugh:"😆 Laughing bounce", mmdMotionFaceSing:"🎤 A-I-U-O mouth cycle (not audio-synced)",
  mmdMotionSongMic:"🎤 Sing into an invisible mic (at chest, no BPM)", mmdMotionSongLong:"🎤 Soft, long ballad line (slow mouth)",
  mmdMotionSongUp:"🎤 Upbeat sing-along (fast mouth, side sway)", mmdMotionSongHum:"🎤 Humming (small mouth, head groove)",
  mmdMotionSongWhisper:"🎤 Whisper-sing (leaning in, tiny mouth)", mmdMotionSongCall:"🎤 Chorus spread-arms belt-out",
  mmdMotionPrincess:"🎵152 👑 Princess pose (World is Mine-inspired)", mmdMotionLeekShake:"🎵120 🧅 Leek-wave gesture (no prop)", mmdMotionPopipo:"🎵150 🥬 Veggie bounce (PoPiPo-inspired)", mmdMotionTriple:"🎵140 😜 Playful alternating pose (Triple Baka-inspired)", mmdMotionNyan:"🎵160 🐾 Cat-paw steps (no costume or ears)", mmdMotionSalute:"🎵128 🫡 Miku salute", mmdMotionDoubleHeart:"🎵128 🫶 Double-heart pose", mmdMotionPoint:"🎵160 👉 Alternating point-out gesture", mmdMotionEncore:"🎵128 👏 Encore wave", mmdMotionDramatic:"🎵170 🎭 Dramatic ballad reach", mmdMotionVictory:"🎵128 ✌️ Victory pose", mmdMotionPenlight:"🎵145 ✨ Penlight-style arm wave (no prop)", mmdMotionChibi:"🎵128 🍬 Tiny bouncy steps", mmdMotionSpin:"🎵128 🌀 Gentle turn-in-place",
  mmdMotionGroove:"🕺 Easy groove (112 BPM)", mmdMotionStepTouch:"👟 Step-touch (128 BPM)", mmdMotionShoulderPop:"🎵 Shoulder pop (128 BPM)", mmdMotionArmWave:"🌊 Smooth arm wave (120 BPM)", mmdMotionCrossStep:"👣 Cross-step (128 BPM)", mmdMotionSoftBow:"🙇 Soft bow and return (no BPM)", mmdMotionMarionette:"🧵 Marionette-style arms (120 BPM)",
  mmdBuiltinNote:"All 65 built-in motions are generated at runtime from trk!'s original code; no third-party VMD or choreography files are bundled. Facial tracks target morph names verified in the Lat-style PMD and only work on models with matching morphs. Song names and “-inspired” labels are tempo or mood references, not recreated official choreography. The A-I-U-O mouth loop is not audio-synced. At base BPM 0, built-ins follow the song BPM.",
  mmdBpm:"Motion base BPM (0 = built-ins auto-sync; your own VMD stays fixed)",
  mmdLoading:"Loading the model…", mmdLoadingPct:"Loading the model… {n}%",
  mmdLoaded:"Loaded the model “{name}”.", mmdRestored:"Restored your previous model.",
  mmdNotMmd:"That is not an MMD model (.pmx/.pmd).", mmdTooBig:"Too big (models up to {n}MB, motions up to {m}MB).",
  mmdNoModel:"Load a model first.", mmdNetError:"Could not load the 3D parts. Reload the page and try again.",
  mmdNoWebGL:"WebGL is not available here.", mmdLoadError:"Could not load the model.",
  mmdNoAgree:"Tick “I'll use a model I obtained myself” above first.",
  mmdFilesEmpty:"No files in that folder.", mmdTooManyFiles:"Too many files (up to {n}).",
  mmdVmdLoaded:"Loaded the motion “{name}”.", mmdVmdBad:"That is not a VMD motion, or it could not be read.",
  mmdSelected:"Switched to the MMD mascot.", mmdSafe:"🛟 Safe mode: MMD loading and restore are off.",
  mmdSaveFail:"Could not save on this device (it may be too big).",
  mmdCreditPrefix:"MMD:"
});
Object.assign(TEXT.zh, {
  mmdTitle:"🩷 MMD吉祥物（初音模式·添加模型）",
  mmdHint:"可以读取MMD模型（.pmx/.pmd）和动作（.vmd），让其在游戏中跳舞。基本做法是自带模型（如果下面出现💠内置模型按钮，仅用它即可开始）。自带模型时请遵守发布方的规约（多为禁止商用、禁止再分发）。",
  mmdPresetBtn:"💠 使用 {name} 作为吉祥物（内置）",
  mmdPresetHint:"💠 是与原版「readme」（发布方规约）一同内置在本 trk! 中的模型。请在规约（PCL：非商用等）范围内使用。署名会自动填写。",
  mmdPresetMissing:"找不到内置模型的文件（此版本可能未附带）。",
  mmdGuideHint:"💠 此版本未附带模型本体（轻量版）。请从下面的链接自行获取，然后用 📦 模型／📁 文件夹 读取。🎬 动作（.vmd）也可以同样添加。内置的65种动作由代码生成，因此此版本也能直接使用。",
  mmdGuideLink:"⬇ 获取 {name}（外部网站）",
  mmdGuideTerms:"请自行确认发布方的规约（PCL：非商用、再分发条件等）。trk! 不再分发模型本体。",
  mmdNoEngine:"无法读取3D部件（three.js／MMD 加载器）。请确认 assets/vendor/ 文件夹和文件完整，并通过本机 HTTP 服务打开。",
  mmdAgree:"我会遵守发布方的规约，使用自己准备的模型（不再分发、不商用）",
  mmdChooseModel:"📦 模型（.pmx/.pmd）", mmdChooseFolder:"📁 模型文件夹（含贴图）",
  mmdChooseMotion:"🎬 动作（.vmd）", mmdClearModel:"移除模型", mmdClearMotion:"移除动作",
  mmdRemember:"把读取的模型和动作保存在本机（IndexedDB）",
  mmdModelHead:"模型", mmdMotionHead:"动作", mmdFitHead:"大小与朝向",
  mmdSize:"大小", mmdTurn:"朝向", mmdCreditLabel:"署名显示（作者等）", mmdCreditPlaceholder:"例：Lat式初音 / Lat",
  mmdCheck:"🔎 运行检查（在实机上）", mmdCopy:"📋 复制结果", mmdCopied:"📋 已复制", mmdCopyNg:"📋 无法复制（请选中下面的行）",
  mmdCheckHint:"如果无法运行，按这里会检查 WebGL、3D部件（three／three-mmd-loader，已内置）、模型和动作，并把结果汇总成一段。把这结果贴出来就能定位原因。",
  mmdCheckRunning:"检查中…（初次会读取3D部件，请稍等）", mmdCheckOk:"✅ 检查通过（WebGL·3D部件·库）", mmdCheckNg:"❌ 检查发现问题（请看下面的结果）",
  mmdQuickTitle:"🩷 吉祥物动作", mmdQuickWatch:"👀 休息", mmdQuickAuto:"🎲 自动",
  mmdQuickPick:"🎯 挑选", mmdQuickOff:"💤 不在家",
  mmdQuickUILabel:"🩷 开启初音模式（MMD桌面吉祥物功能）",
  mmdQuickFavTip:"⭐ 加入／移出收藏（在挑选列表中会排在前面）",
  mmdMotionNone:"（无动作）",
  mmdMotionAuto:"🎲 自动（选择最接近歌曲BPM的🎵·设置一次即可）",
  mmdMotionWatch:"👀 看着你（与BPM无关）", mmdMotionStroll:"👀 伫立（四处张望·与BPM无关）",
  mmdMotionWalk:"🚶112 原地漫步（BPM同步）", mmdMotionRun:"🏃152 原地跑步（BPM同步）",
  mmdMotionSit:"🪑 坐下休息再起身（与BPM无关）", mmdMotionDance:"💃128 流行舞（原创·16拍）", mmdMotionLegacy:"旧设置",
  mmdMotionStep:"内置① 踏步（120BPM）", mmdMotionSwing:"内置② 摇摆（100BPM）", mmdMotionTurn:"内置③ 转身（120BPM）",
  mmdMotionJump:"内置④ 跳跃（130BPM·华丽）", mmdMotionIdol:"内置⑤ 偶像应援（128BPM）",
  mmdMotionDreamy:"🎸128 沉静漂浮（When You Sleep风）",
  mmdMotionKneel:"🎸128 单膝远眺（安静）",
  mmdMotionIevan:"🎵120 甩葱旋转（Ievan Polkka风）", mmdMotionKyukura:"🎵165 晕乎乎（Kyu-kurarin风）",
  mmdMotionRabbit:"🎵173 兔耳蹦跳（Rabbit Hole风·5拍子）", mmdMotionMesmer:"🎵185 卡通摇摆（Mesmerizer风）",
  mmdMotionDune:"🎵135 行进（砂之惑星风）", mmdMotionGreen:"🎵145 荧光棒（Greenlights风）",
  mmdMotionMikumiku:"🎵160 做给你看！（把你MikuMiku掉♪风）", mmdMotionTyw:"🎵150 向世界（Tell Your World风）",
  mmdMotionSenbon:"🎵154 和风利落（千本樱风）", mmdMotionMelt:"🎵170 心动（Melt风）",
  mmdMotionUmg:"🎵170 倾诉（Unknown Mother Goose风）", mmdMotionWedh:"🎵174 舞厅（World's End Dancehall风）",
  mmdMotionRolling:"🎵194 转圈（Rolling Girl风）", mmdMotionUraomote:"🎵196 里表翻转（里表Lovers风）",
  mmdMotionVanish:"🎵240 高速（消失风）",
  mmdGroupDaily:"👀 日常与休息", mmdGroupDance:"💃 舞蹈与舞台", mmdGroupSongs:"🎵 初音歌曲节奏的原创动作", mmdGroupMiku:"🌟 初音风格手势与姿势", mmdGroupFaces:"🎭 表情与演技", mmdGroupVoice:"🎤 唱歌与口型",
  mmdMotionFaceSmile:"😊 微笑挥手", mmdMotionFaceWink:"😉 眨眼＆摆姿势", mmdMotionFaceShy:"🫣 害羞鞠躬", mmdMotionFaceAngry:"😤 生气姿势", mmdMotionFaceConfused:"💭 困惑歪头", mmdMotionFaceSurprise:"😲 惊讶姿势", mmdMotionFaceSleepy:"😴 困倦摇摆", mmdMotionFacePout:"😗 嘟嘴", mmdMotionFaceLaugh:"😆 开心笑跳", mmdMotionFaceSing:"🎤 啊·伊·乌·欧口型循环（不同步音频）",
  mmdMotionSongMic:"🎤 像拿麦克风一样唱（胸前·不随BPM）", mmdMotionSongLong:"🎤 温柔长音演唱（慢速）",
  mmdMotionSongUp:"🎤 欢快跟唱（快速口型·左右摇摆）", mmdMotionSongHum:"🎤 哼歌（小口型·晃头打拍）",
  mmdMotionSongWhisper:"🎤 悄悄唱（前倾小声）", mmdMotionSongCall:"🎤 副歌张开手臂唱出来",
  mmdMotionPrincess:"🎵152 👑 公主姿势（World is Mine风格）", mmdMotionLeekShake:"🎵120 🧅 挥葱手势（无道具）", mmdMotionPopipo:"🎵150 🥬 蔬菜弹跳（PoPiPo风格）", mmdMotionTriple:"🎵140 😜 俏皮交替姿势（Triple Baka风格）", mmdMotionNyan:"🎵160 🐾 猫爪步（无服饰或猫耳）", mmdMotionSalute:"🎵128 🫡 初音敬礼", mmdMotionDoubleHeart:"🎵128 🫶 双手爱心姿势", mmdMotionPoint:"🎵160 👉 左右交替指向", mmdMotionEncore:"🎵128 👏 返场挥手", mmdMotionDramatic:"🎵170 🎭 抒情戏剧伸手", mmdMotionVictory:"🎵128 ✌️ 胜利姿势", mmdMotionPenlight:"🎵145 ✨ 应援灯式手臂摇摆（无道具）", mmdMotionChibi:"🎵128 🍬 轻快小跳", mmdMotionSpin:"🎵128 🌀 原地轻转",
  mmdMotionGroove:"🕺 轻松律动（112 BPM）", mmdMotionStepTouch:"👟 左右点步（128 BPM）", mmdMotionShoulderPop:"🎵 肩部律动（128 BPM）", mmdMotionArmWave:"🌊 流畅手臂波浪（120 BPM）", mmdMotionCrossStep:"👣 交叉步（128 BPM）", mmdMotionSoftBow:"🙇 轻轻鞠躬再起身（无 BPM）", mmdMotionMarionette:"🧵 木偶风手臂（120 BPM）",
  mmdBuiltinNote:"65种内置动作由 trk! 代码在运行时生成，不附带第三方VMD或编舞文件。表情轨道使用已在Lat式PMD中确认的变形名称，仅在模型含有同名变形时生效。歌曲名与“风格”只表示节奏或气氛参考，并非复刻原曲编舞。🎤口型为“啊·伊·乌·欧”循环，不与音频同步。基准BPM为0时，内置动作跟随歌曲BPM。",
  mmdBpm:"动作基准BPM（0＝内置自动同步·自带VMD保持固定）",
  mmdLoading:"正在读取模型…", mmdLoadingPct:"正在读取模型… {n}%",
  mmdLoaded:"已读取模型「{name}」。", mmdRestored:"已恢复上次的模型。",
  mmdNotMmd:"这不是MMD模型（.pmx/.pmd）。", mmdTooBig:"太大（模型上限 {n}MB，动作上限 {m}MB）。",
  mmdNoModel:"请先读取模型。", mmdNetError:"无法读取3D部件。请重新加载页面后重试。",
  mmdNoWebGL:"此环境无法使用 WebGL。", mmdLoadError:"无法读取模型。",
  mmdNoAgree:"请先勾选上面的「已确认规约」。",
  mmdFilesEmpty:"文件夹里没有文件。", mmdTooManyFiles:"文件太多（最多 {n} 个）。",
  mmdVmdLoaded:"已读取动作「{name}」。", mmdVmdBad:"不是VMD动作，或无法读取。",
  mmdSelected:"已切换到MMD吉祥物。", mmdSafe:"🛟 安全模式下不会读取·恢复MMD。",
  mmdSaveFail:"无法保存到本机（可能太大）。",
  mmdCreditPrefix:"MMD:"
});
Object.assign(TEXT.ko, {
  mmdTitle:"🩷 MMD 마스코트 (미쿠 모드 / 모델 추가)",
  mmdHint:"MMD 모델(.pmx/.pmd)과 모션(.vmd)을 불러와 게임 중에 춤추게 할 수 있습니다. 기본은 모델을 직접 준비하는 것입니다(아래에 💠 동봉 모델 버튼이 있으면 그것만으로 시작할 수 있습니다). 직접 준비할 때는 배포처의 규약(비상업·재배포 금지 등)을 지켜 주세요.",
  mmdPresetBtn:"💠 {name} 을(를) 마스코트로 (동봉)",
  mmdPresetHint:"💠 는 원본 'readme'(배포처 규약)와 함께 이 trk!에 동봉된 모델입니다. 규약(PCL: 비상업 등) 범위에서 즐겨 주세요. 크레딧은 자동으로 들어갑니다.",
  mmdPresetMissing:"동봉 모델 파일을 찾지 못했습니다(이 배포판에는 없는 것 같습니다).",
  mmdGuideHint:"💠 이 배포판에는 모델 본체가 들어 있지 않습니다(경량판). 아래 링크에서 직접 내려받은 뒤 📦 모델／📁 폴더 로 불러오세요. 🎬 모션(.vmd)도 같은 방법으로 추가할 수 있습니다. 내장 모션 65종은 코드 생성이므로 이 배포판에서도 그대로 쓸 수 있습니다.",
  mmdGuideLink:"⬇ {name} 내려받기 (외부 사이트)",
  mmdGuideTerms:"배포처의 규약(PCL: 비상업, 재배포 조건 등)은 직접 확인해 주세요. trk!는 모델 본체를 재배포하지 않습니다.",
  mmdNoEngine:"3D 부품(three.js／MMD 로더)을 불러올 수 없습니다. assets/vendor/ 폴더와 파일을 확인하고 로컬 HTTP 서버에서 열어 주세요.",
  mmdAgree:"배포처의 규약을 확인하고, 직접 준비한 모델을 사용합니다 (재배포·상업 이용 안 함)",
  mmdChooseModel:"📦 모델 (.pmx/.pmd)", mmdChooseFolder:"📁 모델 폴더 (텍스처 포함)",
  mmdChooseMotion:"🎬 모션 (.vmd)", mmdClearModel:"모델 빼기", mmdClearMotion:"모션 빼기",
  mmdRemember:"불러온 모델·모션을 이 기기에 저장 (IndexedDB)",
  mmdModelHead:"모델", mmdMotionHead:"모션", mmdFitHead:"크기·방향",
  mmdSize:"크기", mmdTurn:"방향", mmdCreditLabel:"크레딧 표시 (제작자 등)", mmdCreditPlaceholder:"예: Lat 모델 미쿠 / Lat",
  mmdCheck:"🔎 동작 확인 (실기에서)", mmdCopy:"📋 결과 복사", mmdCopied:"📋 복사했습니다", mmdCopyNg:"📋 복사할 수 없습니다(아래 줄을 선택해 주세요)",
  mmdCheckHint:"잘 안 될 때 이걸 누르면 WebGL·3D 부품(three／three-mmd-loader, 내장)·모델·모션 상태를 한곳에 모아 보여 줍니다. 안 되는 경우 이 결과를 붙여 주시면 원인을 좁힐 수 있습니다.",
  mmdCheckRunning:"확인 중… (처음에는 3D 부품을 읽어 오므로 조금 기다려 주세요)", mmdCheckOk:"✅ 확인 OK (WebGL·3D 부품·라이브러리)", mmdCheckNg:"❌ 확인에서 문제를 찾았습니다(아래 결과를 봐 주세요)",
  mmdQuickTitle:"🩷 마스코트 움직임", mmdQuickWatch:"👀 휴식", mmdQuickAuto:"🎲 자동",
  mmdQuickPick:"🎯 고르기", mmdQuickOff:"💤 자리비움",
  mmdQuickUILabel:"🩷 미쿠 모드 켜기 (MMD 데스크톱 마스코트 기능)",
  mmdQuickFavTip:"⭐ 즐겨찾기에 넣기／빼기 (고르기 목록에서 위에 옵니다)",
  mmdMotionNone:"(모션 없음)",
  mmdMotionAuto:"🎲 자동 (곡 BPM에 가장 가까운 🎵 선택·한 번만 설정하면 끝)",
  mmdMotionWatch:"👀 바라보기 (BPM 무관)", mmdMotionStroll:"👀 서성이기 (두리번·BPM 무관)",
  mmdMotionWalk:"🚶112 제자리 걷기 (BPM 동기화)", mmdMotionRun:"🏃152 제자리 달리기 (BPM 동기화)",
  mmdMotionSit:"🪑 앉아 쉬었다 일어나기 (BPM 무관)", mmdMotionDance:"💃128 팝 댄스 (자작·16박)", mmdMotionLegacy:"이전 설정",
  mmdMotionStep:"내장① 스텝 (120BPM)", mmdMotionSwing:"내장② 흔들흔들 (100BPM)", mmdMotionTurn:"내장③ 턴 (120BPM)",
  mmdMotionJump:"내장④ 점프 (130BPM·화려)", mmdMotionIdol:"내장⑤ 아이돌 (128BPM)",
  mmdMotionDreamy:"🎸128 차분히 (When You Sleep풍)",
  mmdMotionKneel:"🎸128 한쪽 무릎 (조용히 바라보기)",
  mmdMotionIevan:"🎵120 파 돌리기 (Ievan Polkka풍)", mmdMotionKyukura:"🎵165 어질어질 (큐쿠라린풍)",
  mmdMotionRabbit:"🎵173 토끼귀 폴짝 (Rabbit Hole풍·5박자)", mmdMotionMesmer:"🎵185 카툰 셔플 (메즈머라이저풍)",
  mmdMotionDune:"🎵135 행진 (모래의 행성풍)", mmdMotionGreen:"🎵145 펜라이트 (Greenlights풍)",
  mmdMotionMikumiku:"🎵160 시테얀요! (미쿠미쿠하게 해줄게♪풍)", mmdMotionTyw:"🎵150 세계로 (Tell Your World풍)",
  mmdMotionSenbon:"🎵154 와풍 절도 (센본자쿠라풍)", mmdMotionMelt:"🎵170 두근 (Melt풍)",
  mmdMotionUmg:"🎵170 전하기 (Unknown Mother Goose풍)", mmdMotionWedh:"🎵174 댄스홀 (World's End Dancehall풍)",
  mmdMotionRolling:"🎵194 빙글빙글 (Rolling Girl풍)", mmdMotionUraomote:"🎵196 안팎 뒤집기 (우라오모테 Lovers풍)",
  mmdMotionVanish:"🎵240 고속 (소실풍)",
  mmdGroupDaily:"👀 일상·휴식", mmdGroupDance:"💃 댄스·무대", mmdGroupSongs:"🎵 미쿠 곡 템포의 오리지널", mmdGroupMiku:"🌟 미쿠풍 제스처·포즈", mmdGroupFaces:"🎭 표정·연기", mmdGroupVoice:"🎤 노래·입모양",
  mmdMotionFaceSmile:"😊 미소와 가벼운 손 흔들기", mmdMotionFaceWink:"😉 윙크 포즈", mmdMotionFaceShy:"🫣 수줍은 인사", mmdMotionFaceAngry:"😤 토라진 포즈", mmdMotionFaceConfused:"💭 갸우뚱", mmdMotionFaceSurprise:"😲 깜짝 포즈", mmdMotionFaceSleepy:"😴 졸린 흔들림", mmdMotionFacePout:"😗 삐죽 입", mmdMotionFaceLaugh:"😆 웃음 바운스", mmdMotionFaceSing:"🎤 아·이·우·오 입 모양 (음성 동기화 아님)",
  mmdMotionSongMic:"🎤 마이크처럼 노래 (가슴 앞·BPM 무관)", mmdMotionSongLong:"🎤 부드럽게 길게 노래 (느리게)",
  mmdMotionSongUp:"🎤 신나게 따라 부르기 (빠른 입모양·좌우 흔들)", mmdMotionSongHum:"🎤 콧노래 (작은 입모양·고개 리듬)",
  mmdMotionSongWhisper:"🎤 속삭임 노래 (앞으로 기울여)", mmdMotionSongCall:"🎤 후렴에서 팔 펼치고 부르기",
  mmdMotionPrincess:"🎵152 👑 공주 포즈 (World is Mine풍)", mmdMotionLeekShake:"🎵120 🧅 파 흔들기 제스처 (소품 없음)", mmdMotionPopipo:"🎵150 🥬 채소 바운스 (PoPiPo풍)", mmdMotionTriple:"🎵140 😜 장난스러운 교대 포즈 (Triple Baka풍)", mmdMotionNyan:"🎵160 🐾 고양이 손 스텝 (의상·귀 없음)", mmdMotionSalute:"🎵128 🫡 미쿠 경례", mmdMotionDoubleHeart:"🎵128 🫶 양손 하트 포즈", mmdMotionPoint:"🎵160 👉 좌우 번갈아 가리키기", mmdMotionEncore:"🎵128 👏 앙코르 손 흔들기", mmdMotionDramatic:"🎵170 🎭 발라드풍 드라마틱 리치", mmdMotionVictory:"🎵128 ✌️ 승리 포즈", mmdMotionPenlight:"🎵145 ✨ 펜라이트풍 팔 흔들기 (소품 없음)", mmdMotionChibi:"🎵128 🍬 작고 경쾌한 바운스", mmdMotionSpin:"🎵128 🌀 제자리에서 부드럽게 회전",
  mmdMotionGroove:"🕺 느긋한 그루브 (112 BPM)", mmdMotionStepTouch:"👟 스텝 터치 (128 BPM)", mmdMotionShoulderPop:"🎵 어깨 팝 (128 BPM)", mmdMotionArmWave:"🌊 부드러운 암 웨이브 (120 BPM)", mmdMotionCrossStep:"👣 크로스 스텝 (128 BPM)", mmdMotionSoftBow:"🙇 가볍게 인사하고 돌아오기 (BPM 무관)", mmdMotionMarionette:"🧵 마리오네트풍 팔 동작 (120 BPM)",
  mmdBuiltinNote:"내장 모션 65종은 trk!의 오리지널 코드로 실행 시 VMD를 생성하며, 제3자 VMD나 안무 파일은 포함하지 않습니다. 표정 트랙은 Lat식 PMD에서 확인한 모프 이름을 사용하므로 같은 이름의 모프가 있는 모델에서만 적용됩니다. 곡명과 ‘풍’ 표기는 템포·분위기 참고일 뿐 원곡 안무 재현이 아닙니다. 🎤 입 모양은 아·이·우·오 반복으로 실제 음성과 동기화되지 않습니다. 기준 BPM이 0이면 내장 모션이 곡 BPM을 따릅니다.",
  mmdBpm:"모션 기준 BPM (0＝내장은 자동 동기화·직접 가져온 VMD는 고정)",
  mmdLoading:"모델을 불러오는 중…", mmdLoadingPct:"모델을 불러오는 중… {n}%",
  mmdLoaded:"모델 '{name}'을(를) 불러왔습니다.", mmdRestored:"지난번 모델을 되돌렸습니다.",
  mmdNotMmd:"MMD 모델(.pmx/.pmd)이 아닙니다.", mmdTooBig:"너무 큽니다 (모델 {n}MB, 모션 {m}MB까지).",
  mmdNoModel:"먼저 모델을 불러와 주세요.", mmdNetError:"3D 부품을 불러오지 못했습니다. 페이지를 새로 고침한 뒤 다시 시도해 주세요.",
  mmdNoWebGL:"WebGL을 쓸 수 없는 환경입니다.", mmdLoadError:"모델을 불러오지 못했습니다.",
  mmdNoAgree:"위의 '규약을 확인했습니다'를 먼저 체크해 주세요.",
  mmdFilesEmpty:"폴더에 파일이 없습니다.", mmdTooManyFiles:"파일이 너무 많습니다 ({n}개까지).",
  mmdVmdLoaded:"모션 '{name}'을(를) 불러왔습니다.", mmdVmdBad:"VMD 모션이 아니거나 읽을 수 없습니다.",
  mmdSelected:"MMD 마스코트로 바꿨습니다.", mmdSafe:"🛟 안전 모드에서는 MMD 읽기·복원을 하지 않습니다.",
  mmdSaveFail:"이 기기에 저장하지 못했습니다 (너무 클 수 있습니다).",
  mmdCreditPrefix:"MMD:"
});

/* ============ 小さな道具 ============ */
const status = (k, v) => core.setStatus("mmdStatus", k, v);
const mmdRect = () => window.Trk.data.VRM_RECT[core.settings.layout] || window.Trk.data.VRM_RECT.classic;
const safeNow = () => { try { return typeof window.TrkSafeMode === "function" && window.TrkSafeMode(); } catch (_) { return false; } };
const isMmdFile = n => /\.(pmx|pmd)$/i.test(String(n || ""));
const isVmdFile = n => /\.vmd$/i.test(String(n || ""));
let chain = Promise.resolve();
const enqueue = fn => (chain = chain.then(fn).catch(e => console.error(e)));
const fail = key => { const e = new Error(key); e.key = key; return e; };

/* ============ 📼 内蔵モーション：VMD（Shift-JIS）を自分で組み立てる ============
   VMDは、ボーン名／モーフ名をShift-JISで15バイトに詰めたバイナリです。
   Lat式ミクの実在名に必要な文字だけを表に持ち、VMD本体は使うときに生成します。 */
const SJIS = {
  "セ":[0x83,0x5a], "ン":[0x83,0x93], "タ":[0x83,0x5e], "ー":[0x81,0x5b],
  "上":[0x8f,0xe3], "下":[0x89,0xba], "全":[0x91,0x53], "半":[0x94,0xbc], "身":[0x90,0x67],
  "左":[0x8d,0xb6], "右":[0x89,0x45], "手":[0x8e,0xe8], "首":[0x8e,0xf1], "肩":[0x8c,0xa8],
  "腕":[0x98,0x72], "足":[0x91,0xab], "頭":[0x93,0xaa], "親":[0x90,0x65], "前":[0x91,0x4f], "後":[0x8c,0xe3],
  "ｽ":[0xbd], "ｶ":[0xb6], "ｰ":[0xb0], "ﾄ":[0xc4], "ｼ":[0xbc], "ｬ":[0xac], "ｷ":[0xb7], "ﾝ":[0xdd],
  "ひ":[0x82,0xd0], "じ":[0x82,0xb6], "ざ":[0x82,0xb4], "真":[0x90,0x5e], "面":[0x96,0xca], "目":[0x96,0xda],
  "怒":[0x93,0x7b], "り":[0x82,0xe8], "か":[0x82,0xa9], "な":[0x82,0xc8], "困":[0x8d,0xa2], "る":[0x82,0xe9],
  "笑":[0x8f,0xce], "い":[0x82,0xa2], "ウ":[0x83,0x45], "ィ":[0x83,0x42], "ク":[0x83,0x4e], "と":[0x82,0xc6],
  "ぺ":[0x82,0xd8], "ろ":[0x82,0xeb], "っ":[0x82,0xc1], "ぽ":[0x82,0xdb], "け":[0x82,0xaf], "に":[0x82,0xc9],
  "こ":[0x82,0xb1], "や":[0x82,0xe2], "ワ":[0x83,0x8f], "ω":[0x83,0xd6], "あ":[0x82,0xa0], "う":[0x82,0xa4],
  "お":[0x82,0xa8], "照":[0x8f,0xc6], "れ":[0x82,0xea], "青":[0x90,0xc2], "筋":[0x8b,0xd8], "眼":[0x8a,0xe1],
  "鏡":[0x8b,0xbe], "瞳":[0x93,0xb5], "小":[0x8f,0xac], "ご":[0x82,0xb2], "み":[0x82,0xdd], "は":[0x82,0xcd],
  "ぅ":[0x82,0xa3], "ま":[0x82,0xdc], "ば":[0x82,0xce], "た":[0x82,0xbd], "き":[0x82,0xab],
  "Ｉ":[0x82,0x68], "Ｋ":[0x82,0x6a]   // 足ＩＫ（つま先／足のIKターゲット）を動かすため
};
function sjisFix(str, len) {
  const out = new Uint8Array(len);
  let i = 0;
  for (const ch of String(str)) {
    const code = ch.charCodeAt(0);
    const bytes = code < 0x80 ? [code] : SJIS[ch];
    if (!bytes || i + bytes.length > len) continue;
    for (const b of bytes) out[i++] = b;
  }
  return out;
}
const VMD_LINEAR = [0, 0, 127, 127];      // 補間なし＝直線（64バイトを同じ模様で埋めて、どの読み方でも直線になるように）
function buildVmd(frames, modelName = "trk", morphFrames = []) {
  const n = frames.length, morphCount = morphFrames.length;
  const size = 30 + 20 + 4 + n * 111 + 4 + morphCount * 23 + 16;
  const buf = new ArrayBuffer(size), u8 = new Uint8Array(buf), dv = new DataView(buf);
  const header = "Vocaloid Motion Data 0002";
  for (let i = 0; i < header.length; i++) u8[i] = header.charCodeAt(i);
  u8.set(sjisFix(modelName, 20), 30);
  dv.setUint32(50, n, true);
  frames.forEach((f, i) => {
    const at = 54 + i * 111;
    u8.set(sjisFix(f.bone, 15), at);
    dv.setUint32(at + 15, f.frame, true);
    dv.setFloat32(at + 19, f.pos[0], true); dv.setFloat32(at + 23, f.pos[1], true); dv.setFloat32(at + 27, f.pos[2], true);
    dv.setFloat32(at + 31, f.rot[0], true); dv.setFloat32(at + 35, f.rot[1], true);
    dv.setFloat32(at + 39, f.rot[2], true); dv.setFloat32(at + 43, f.rot[3], true);
    for (let k = 0; k < 64; k++) u8[at + 47 + k] = VMD_LINEAR[k % 4];
  });
  let at = 54 + n * 111;
  dv.setUint32(at, morphCount, true); at += 4;
  for (const morph of morphFrames) {
    u8.set(sjisFix(morph.name, 15), at);
    dv.setUint32(at + 15, morph.frame, true);
    dv.setFloat32(at + 19, morph.weight, true);
    at += 23;
  }
  for (let k = 0; k < 4; k++) { dv.setUint32(at, 0, true); at += 4; } // camera・照明・セルフシャドウ・IK/表示
  return new Uint8Array(buf);
}
/* 回転（ラジアン）→ クォータニオン。かけ算は Y → Z → X の順で統一します */
const DEG = Math.PI / 180;
function qAxis(x, y, z, deg) {
  const h = deg * DEG / 2, s = Math.sin(h);
  return [x * s, y * s, z * s, Math.cos(h)];
}
function qMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];
}
const qEuler = (rx, ry, rz) => qMul(qMul(qAxis(0, 1, 0, ry), qAxis(0, 0, 1, rz)), qAxis(1, 0, 0, rx));
const FPS = 30, STEP = 3;                 // MMDのモーションは 30fps。3フレームごとに置く
const FACE_MORPHS = [
  "まばたき", "笑い", "にっこり", "にやり", "ウィンク", "照れ", "怒り", "青筋", "困る", "かなり困る",
  "下", "上", "じと目", "はぅ", "ぺろっ", "ぽけー", "ω", "あ", "い", "う", "お", "ワ", "瞳小",
  "真面目", "なごみ", "ｼｬｷｰﾝ"
];
const FACE_POSES = {
  neutral:{}, calm:{"なごみ":0.28}, soft:{"にっこり":0.35,"なごみ":0.2},
  smile:{"にっこり":0.55,"笑い":0.22}, joy:{"笑い":0.68,"にっこり":0.48},
  grin:{"にやり":0.65,"にっこり":0.18}, proud:{"にやり":0.45,"ｼｬｷｰﾝ":0.2},
  shy:{"照れ":0.85,"はぅ":0.24,"下":0.22}, love:{"照れ":0.48,"にっこり":0.62},
  angry:{"怒り":0.78,"青筋":0.64,"真面目":0.2},
  confused:{"困る":0.7,"かなり困る":0.18,"じと目":0.2},
  surprise:{"あ":0.6,"ワ":0.5,"上":0.2,"瞳小":0.16},
  sleepy:{"じと目":0.62,"下":0.24,"ぽけー":0.28},
  pout:{"ω":0.7,"ぽけー":0.18}, laugh:{"笑い":0.84,"にっこり":0.66},
  serious:{"真面目":0.52}, sparkle:{"ｼｬｷｰﾝ":0.72,"にっこり":0.24},
  /* 🎤 歌もののベース表情（この上に母音の重みを足す） */
  singUp:{"にっこり":0.34,"上":0.12}, singSoft:{"なごみ":0.38,"にっこり":0.16},
  hum:{"なごみ":0.42,"にっこり":0.28}, whisper:{"照れ":0.26,"下":0.16,"なごみ":0.2},
  call:{"にっこり":0.36,"上":0.18}
};
const wrap01 = n => ((n % 1) + 1) % 1;
function facePulse(phase, center, width) {
  const delta = Math.abs(wrap01(phase - center + 0.5) - 0.5);
  return delta >= width ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * delta / width);
}
function faceMorphs(kind, t, seconds) {
  const q = wrap01(t / seconds), out = Object.fromEntries(FACE_MORPHS.map(name => [name, 0]));
  for (const [name, weight] of Object.entries(FACE_POSES[kind] || FACE_POSES.neutral)) out[name] = weight;
  out["まばたき"] = seconds >= 6
    ? Math.max(facePulse(q, 0.31, 0.024), facePulse(q, 0.76, 0.024))
    : facePulse(q, 0.69, 0.024);
  if (kind === "wink") out["ウィンク"] = Math.max(facePulse(q, 0.28, 0.09), facePulse(q, 0.77, 0.09));
  /* 🎤 口パク：母音モーフを順にクロスフェード（Lat式に「え」が無いので あ・い・う・お と ワ を使う） */
  const vowelTrack = (list, speed, weight) => {
    const phase = q * list.length * speed;
    const current = Math.floor(phase) % list.length, next = (current + 1) % list.length;
    const fade = 0.5 - 0.5 * Math.cos(Math.PI * (phase % 1));
    out[list[current]] = weight * (1 - fade);
    out[list[next]] = weight * fade;
  };
  if (kind === "sing") vowelTrack(["あ", "い", "う", "お"], 1, 0.9);
  else if (kind === "singUp") vowelTrack(["あ", "い", "う", "お"], 2, 0.92);      // 🎤 速めの4母音（ノリノリ）
  else if (kind === "singSoft") vowelTrack(["あ", "お"], 1, 0.86);                 // 🎤 ゆったり2母音（しっとり）
  else if (kind === "call") vowelTrack(["あ", "ワ"], 1, 0.88);                     // 🎤 大きく開く2母音（サビ）
  else if (kind === "hum") {                                                     // 🎤 鼻歌（口はほぼ閉じたまま）
    const beat = 0.5 + 0.5 * Math.sin(2 * Math.PI * q * 4);
    out["ω"] = 0.5 + 0.14 * beat;
    out["あ"] = 0.1 + 0.12 * beat;
  } else if (kind === "whisper") {                                                 // 🎤 ひそひそ（小さい い・う）
    const beat = 0.5 + 0.5 * Math.sin(2 * Math.PI * q * 8);
    out["い"] = 0.3 * beat;
    out["う"] = 0.26 * (1 - beat);
  }
  return out;
}
const poseBone = (rot, pos) => ({ rot, ...(pos ? { pos } : {}) });
function gesturePose(style, t, bpm, beats, seconds, phase = 0) {
  const b = (bpm ? t * bpm / 60 : t / seconds * beats) + phase;
  const cycle = 2 * Math.PI * b / beats;
  const sway = Math.sin(cycle), alt = Math.sin(2 * Math.PI * b / 4 + phase);
  const fast = Math.sin(2 * Math.PI * b + phase);
  const hop = Math.pow(Math.max(0, Math.sin(Math.PI * b)), 2);
  const step = Math.sin(Math.PI * b), pulse = 0.5 - 0.5 * Math.cos(cycle);
  const L = Math.max(0, Math.sin(2 * Math.PI * b / 8 + phase));
  const R = Math.max(0, -Math.sin(2 * Math.PI * b / 8 + phase));
  const center = (pos, rot = [0, 0, 0]) => poseBone(rot, pos);
  const arms = (left, right, leftElbow, rightElbow, wrists = [0, 0]) => ({
    "左腕":poseBone(left), "右腕":poseBone(right),
    "左ひじ":poseBone(leftElbow), "右ひじ":poseBone(rightElbow),
    "左手首":poseBone([0, 0, wrists[0]]), "右手首":poseBone([0, 0, wrists[1]])
  });
  const base = {
    "センター":center([0, -0.04 + 0.035 * hop, 0], [0, 0, 3 * sway]),
    "上半身":poseBone([2 * hop, 7 * sway, 2 * sway]),
    "首":poseBone([-2 * hop, -5 * sway, -3 * sway]),
    "頭":poseBone([3 * hop, 0, -5 * sway])
  };
  const feet = (left, right, knee = 0) => ({
    "左足":poseBone([left, 0, 0]), "右足":poseBone([right, 0, 0]),
    "左ひざ":poseBone([Math.max(0, knee), 0, 0]), "右ひざ":poseBone([Math.max(0, knee), 0, 0])
  });
  switch (style) {
    case "groove": return {
      ...base, "センター":center([0.12 * sway, -0.04 + 0.03 * hop, 0], [0, 0, 4 * sway]),
      "上半身":poseBone([2 * alt, 9 * sway, 2 * sway]),
      "首":poseBone([-2 * alt, -6 * sway, -3 * sway]),
      ...arms([0, 8 * alt, -48 + 8 * fast], [0, -8 * alt, 48 - 8 * fast], [0, -42, 0], [0, 42, 0]),
      ...feet(-7 * alt, 7 * alt, 3 * hop)
    };
    case "stepTouch": return {
      ...base, "センター":center([0.11 * alt, -0.04 + 0.025 * hop, 0], [0, -5 * alt, 2 * alt]),
      ...arms([3 * fast, 8 * alt, -44 + 12 * alt], [-3 * fast, -8 * alt, 44 - 12 * alt], [0, -38, 0], [0, 38, 0]),
      ...feet(-10 * step, 10 * step, 6 * hop)
    };
    case "shoulder": return {
      ...base, "センター":center([0.04 * sway, -0.025 + 0.025 * hop, 0], [0, 0, 2 * sway]),
      "上半身":poseBone([4 * fast, 4 * sway, 5 * fast]),
      "頭":poseBone([2 * fast, 0, -6 * fast]),
      ...arms([8 * fast, 0, -48], [-8 * fast, 0, 48], [0, -42 - 8 * fast, 0], [0, 42 + 8 * fast, 0])
    };
    case "armWave": return {
      ...base, "センター":center([0.06 * sway, -0.04 + 0.025 * hop, 0], [0, -4 * sway, 2 * sway]),
      ...arms([0, 8 * L, -54 + 88 * L], [0, -8 * R, 54 - 88 * R], [0, -32 - 12 * L, 0], [0, 32 + 12 * R, 0], [-12 * L, 12 * R])
    };
    case "crossStep": return {
      ...base, "センター":center([0.08 * alt, -0.04 + 0.025 * hop, 0], [0, -8 * alt, 3 * alt]),
      "上半身":poseBone([2 * step, 9 * alt, 2 * alt]),
      ...arms([8 * alt, 8 * alt, -34], [-8 * alt, -8 * alt, 34], [0, -54, 0], [0, 54, 0]),
      ...feet(-12 * step, 12 * step, 8 * hop)
    };
    case "bow": return {
      ...base, "センター":center([0, -0.025, 0], [0, 0, 1.5 * sway]),
      "上半身":poseBone([17 * pulse, 2 * sway, 0]),
      "首":poseBone([-8 * pulse, -3 * sway, 0]),
      "頭":poseBone([-7 * pulse, 0, -2 * sway]),
      ...arms([4, 0, -42 + 8 * pulse], [-4, 0, 42 - 8 * pulse], [0, -32, 0], [0, 32, 0]),
      ...feet(-2 * hop, -2 * hop, 10 * pulse)
    };
    case "marionette": return {
      ...base, "センター":center([0.05 * sway, -0.04 + 0.02 * hop, 0], [0, 5 * sway, 2 * sway]),
      "上半身":poseBone([3 * fast, 8 * sway, 3 * fast]),
      ...arms([30 * fast, 12 * L, -28 + 44 * L], [-30 * fast, -12 * R, 28 - 44 * R], [0, -72 + 18 * fast, 0], [0, 72 - 18 * fast, 0])
    };
    case "princess": return {
      ...base, "センター":center([0.055 * sway, -0.04 + 0.02 * hop, 0], [0, -12 * sway, 3 * sway]),
      "上半身":poseBone([1, 9 * sway, 2 * sway]),
      "頭":poseBone([-2, 0, -8 * sway]),
      ...arms([2, 18 * L, -48 + 72 * L], [-2, -18 * R, 48 - 72 * R], [0, -38, 0], [0, 38, 0], [-8 * L, 8 * R])
    };
    case "leek": return {
      ...base, "センター":center([0.07 * sway, -0.035 + 0.02 * hop, 0], [0, 12 * fast, 3 * sway]),
      "上半身":poseBone([2 * fast, -7 * fast, 3 * sway]),
      "首":poseBone([-2 * fast, 5 * fast, -4 * sway]),
      ...arms([8 * fast, 0, -40], [-18 * fast, 15 * fast, 38 - 14 * fast], [0, -42, 0], [0, 72 - 10 * fast, 0], [0, 28 * fast])
    };
    case "popipo": return {
      ...base, "センター":center([0.07 * sway, 0.11 * hop - 0.055, 0], [0, 0, 3 * sway]),
      "上半身":poseBone([3 * hop, 8 * sway, 2 * sway]),
      ...arms([0, 10 * L, -42 + 72 * L], [0, -10 * R, 42 - 72 * R], [0, -42 - 10 * L, 0], [0, 42 + 10 * R, 0]),
      ...feet(-8 * step, 8 * step, 8 * hop)
    };
    case "triple": return {
      ...base, "センター":center([0.08 * alt, -0.04 + 0.02 * hop, 0], [0, -10 * alt, 2 * alt]),
      "頭":poseBone([3 * fast, 0, -8 * alt]),
      ...arms([8, 10 * alt, -48 + 48 * L], [-8, -10 * alt, 48 - 48 * R], [0, -48, 0], [0, 48, 0], [-10 * L, 10 * R])
    };
    case "cat": return {
      ...base, "センター":center([0.05 * sway, -0.04 + 0.035 * hop, 0], [0, 0, 3 * sway]),
      "頭":poseBone([2 * hop, 0, -8 * sway]),
      ...arms([12 * fast, 0, -42 + 8 * fast], [-12 * fast, 0, 42 - 8 * fast], [0, -86 - 12 * fast, 0], [0, 86 + 12 * fast, 0], [-16 * fast, 16 * fast]),
      ...feet(-6 * step, 6 * step, 4 * hop)
    };
    case "salute": return {
      ...base, "センター":center([0.02 * sway, -0.035, 0], [0, -5 * pulse, 2 * sway]),
      "上半身":poseBone([1 - 3 * pulse, 4 * sway, 1 * sway]),
      ...arms([4, 0, -45], [-6 * pulse, -10 * pulse, 52 - 104 * pulse], [0, -34, 0], [0, 64 - 30 * pulse, 0], [0, 18 * pulse])
    };
    case "heart": return {
      ...base, "センター":center([0.04 * sway, -0.035 + 0.018 * hop, 0], [0, -4 * sway, 2 * sway]),
      "上半身":poseBone([2, 5 * sway, 2 * sway]),
      "頭":poseBone([-4 + 2 * pulse, 0, -7 * sway]),
      ...arms([15 * pulse, 10 * pulse, -58 + 28 * pulse], [15 * pulse, -10 * pulse, 58 - 28 * pulse], [0, -78 + 16 * pulse, 0], [0, 78 - 16 * pulse, 0], [-10 * pulse, 10 * pulse])
    };
    case "point": return {
      ...base, "センター":center([0.08 * alt, -0.04 + 0.02 * hop, 0], [0, -12 * alt, 2 * alt]),
      ...arms([0, 18 * L, -30 - 35 * L], [0, -18 * R, 30 + 35 * R], [0, -18, 0], [0, 18, 0], [-6 * L, 6 * R])
    };
    case "encore": return {
      ...base, "センター":center([0, -0.04 + 0.02 * hop, 0], [0, 0, 2 * sway]),
      "上半身":poseBone([-2 * pulse, 3 * sway, 2 * sway]),
      ...arms([0, 8 * sway, -54 + 100 * pulse], [0, -8 * sway, 54 - 100 * pulse], [0, -32, 0], [0, 32, 0], [-8 * pulse, 8 * pulse])
    };
    case "dramatic": return {
      ...base, "センター":center([0.045 * sway, -0.035, 0], [0, -10 * pulse, 2 * sway]),
      "上半身":poseBone([-5 * pulse, -7 * pulse, 2 * sway]),
      "頭":poseBone([-4 * pulse, 4 * pulse, -3 * sway]),
      ...arms([10 * pulse, 0, -42 - 18 * pulse], [-12 * pulse, 14 * pulse, 52 - 68 * pulse], [0, -28, 0], [0, 62, 0], [0, 16 * pulse])
    };
    case "victory": return {
      ...base, "センター":center([0.03 * sway, -0.035 + 0.03 * hop, 0], [0, 0, 3 * sway]),
      ...arms([0, 0, -50 + 72 * L], [0, 0, 50 - 72 * R], [0, -32 - 16 * L, 0], [0, 32 + 16 * R, 0], [-12 * L, 12 * R])
    };
    case "penlight": return {
      ...base, "センター":center([0.06 * sway, -0.035 + 0.025 * hop, 0], [0, 3 * sway, 3 * sway]),
      ...arms([0, 12 * L, -48 + 96 * L], [0, -12 * R, 48 - 96 * R], [0, -36, 0], [0, 36, 0], [-10 * L, 10 * R]),
      ...feet(-6 * step, 6 * step, 5 * hop)
    };
    case "chibi": return {
      ...base, "センター":center([0.035 * sway, 0.08 * hop - 0.045, 0], [0, 0, 3 * sway]),
      "上半身":poseBone([4 * hop, 7 * sway, 2 * sway]),
      ...arms([12 * fast, 0, -42 + 12 * fast], [-12 * fast, 0, 42 - 12 * fast], [0, -62, 0], [0, 62, 0]),
      ...feet(-5 * step, 5 * step, 5 * hop)
    };
    case "spin": return {
      ...base, "センター":center([0.05 * sway, -0.04 + 0.02 * hop, 0], [0, 58 * sway, 3 * sway]),
      "上半身":poseBone([0, 9 * sway, 2 * sway]),
      "首":poseBone([-2, -8 * sway, -3 * sway]),
      ...arms([10 * sway, 0, -52], [-10 * sway, 0, 52], [0, -26, 0], [0, 26, 0])
    };
    case "actSmile": return { ...base, "センター":center([0.045 * sway, -0.035, 0], [0, 0, 2 * sway]), ...arms([3, 0, -42], [-3, 0, 42], [0, -28, 0], [0, 28, 0]) };
    case "actWink": return { ...base, "頭":poseBone([-2, 0, -12 * sway]), ...arms([12, 0, -46], [4, -8, 52], [0, -62, 0], [0, 52, 0]) };
    case "actShy": return { ...base, "センター":center([0, -0.025, 0], [6, 0, 2 * sway]), "上半身":poseBone([9, 4 * sway, 1]), "頭":poseBone([-8, 0, -7 * sway]), ...arms([10, 0, -42], [10, 0, 42], [0, -58, 0], [0, 58, 0]) };
    case "actAngry": return { ...base, "センター":center([0, -0.04, 0], [0, 0, 2 * sway]), "上半身":poseBone([-2, 2 * sway, 0]), ...arms([0, 0, -62], [0, 0, 62], [0, -66, 0], [0, 66, 0]) };
    case "actConfused": return { ...base, "頭":poseBone([0, 0, -18 * sway]), ...arms([2, 10 * L, -42 + 44 * L], [0, 0, 42], [0, -56, 0], [0, 42, 0]) };
    case "actSurprise": return { ...base, "センター":center([0, -0.035, 0], [0, -5 * pulse, 0]), "上半身":poseBone([-4 * pulse, 2 * sway, 0]), ...arms([0, 0, -52 + 28 * pulse], [0, 0, 52 - 28 * pulse], [0, -34, 0], [0, 34, 0]) };
    case "actSleepy": return { ...base, "センター":center([0, -0.035, 0], [0, 0, 1.5 * sway]), "首":poseBone([-4, 0, -10 * sway]), "頭":poseBone([-5, 0, -13 * sway]), ...arms([0, 0, -45], [0, 0, 45], [0, -38, 0], [0, 38, 0]) };
    case "actPout": return { ...base, "センター":center([0, -0.035, 0], [0, 0, 2 * sway]), "上半身":poseBone([0, -5, 0]), "頭":poseBone([0, 0, -5 * sway]), ...arms([2, 0, -58], [-2, 0, 58], [0, -44, 0], [0, 44, 0]) };
    case "actLaugh": return { ...base, "センター":center([0, 0.05 * hop - 0.04, 0], [0, 0, 2 * sway]), "上半身":poseBone([-4 * hop, 4 * sway, 0]), ...arms([12 * hop, 0, -38], [4, 6, 48], [0, -58, 0], [0, 46, 0]) };
    case "actSing": return { ...base, "センター":center([0.035 * sway, -0.035, 0], [0, -5 * sway, 2 * sway]), ...arms([0, 0, -48], [-8, 10, 46], [0, -34, 0], [0, 52, 0]) };
    /* 🎤 歌もの。肘は「前に折る」向き（左＝+Y／右＝-Y）で、手が体の前へ来るようにする */
    case "actSongMic": return {                                // 右手＝マイクを胸の前に持って歌う（小物なし）
      ...base, "センター":center([0.03 * sway, -0.035 + 0.022 * hop, 0], [0, 3 * sway, 2 * sway]),
      "上半身":poseBone([2, 3 * sway, 1 * sway]), "首":poseBone([-3, -2 * sway, -2 * sway]),
      "頭":poseBone([2 + 2 * hop, 0, -4 * sway]),
      ...arms([6, 4, -46], [30, -6, 30], [0, 22, 0], [0, -120, 0], [-6, 10])
    };
    case "actSongSoft": return {                               // 両手を胸の前にそっと構えて、しっとり歌う
      ...base, "センター":center([0.035 * sway, -0.04, 0], [0, 2 * sway, 2.5 * sway]),
      "上半身":poseBone([3, 3 * sway, 2 * sway]), "首":poseBone([-2, -3 * sway, -3 * sway]),
      "頭":poseBone([3, 0, -6 * sway]),
      ...arms([14, 2, -34 + 4 * sway], [16, -2, 36 - 4 * sway], [0, 74 + 6 * sway, 0], [0, -70 - 6 * sway, 0], [-8, 8])
    };
    case "actSongUp": return {                                 // 弾みながら、左右交互に手を上げて歌う
      ...base, "センター":center([0.06 * alt, -0.05 + 0.05 * hop, 0], [0, 4 * alt, 3 * alt]),
      "上半身":poseBone([3 - 3 * hop, 5 * alt, 3 * alt]), "首":poseBone([-3, -4 * alt, -2 * alt]),
      "頭":poseBone([5 * hop, 0, -4 * alt]),
      ...arms([-14 - 8 * alt, 10 * alt, -26 + 32 * L], [14 - 8 * alt, -10 * alt, 26 - 32 * R],
             [0, 34 + 26 * L, 0], [0, -34 - 26 * R, 0], [-10 * L, 10 * R]),
      ...feet(-8 * alt, 8 * alt, 5 * hop)
    };
    case "actSongHum": return {                                // 鼻歌：力まずゆらゆら、首でリズムを取る
      ...base, "センター":center([0.05 * alt, -0.03 + 0.02 * hop, 0], [0, 2 * alt, 3 * sway]),
      "上半身":poseBone([1, 3 * alt, 2 * sway]), "首":poseBone([-4 - 3 * alt, -3 * sway, -2 * sway]),
      "頭":poseBone([5 + 4 * alt, 0, -4 * sway]),
      ...arms([8 * alt, 4, -42 + 4 * fast], [-8 * alt, -4, 42 - 4 * fast],
             [0, 30 + 6 * alt, 0], [0, -30 + 6 * alt, 0], [-5, 5]),
      ...feet(-3 * alt, 3 * alt, 2 * hop)
    };
    case "actSongWhisper": return {                            // ひそひそ：前のめりで小さく歌う
      ...base, "センター":center([0.02 * sway, -0.05, 0], [3, -3, 1.5 * sway]),
      "上半身":poseBone([6, -2 + 2 * sway, 1]), "首":poseBone([-5, 3 * sway, -2]),
      "頭":poseBone([-2, 2 * sway, -4 * sway]),
      ...arms([10, 8, -34 + 5 * sway], [26, -8, 34 - 5 * sway], [0, 92 + 7 * sway, 0], [0, -104 - 7 * sway, 0], [4, 6]),
      ...feet(3, -3, 1)
    };
    case "actSongCall": return {                               // サビ：片手を大きく広げて歌い上げる
      ...base, "センター":center([0.05 * sway, -0.02 + 0.05 * hop, 0], [0, -4, 2 * sway]),
      "上半身":poseBone([-4 * hop, 6 * sway, 2 * sway]), "首":poseBone([-6 - 3 * hop, -4 * sway, 0]),
      "頭":poseBone([-7 - 4 * hop, 0, -3 * sway]),
      /* 左＝大きく外へ上げる（+Z＝体側から上へ）／右＝体の横で手を胸に添える */
      ...arms([10 + 6 * L, 0, 26 + 20 * L], [4, -6, 34 + 14 * R], [14, 10, 0], [18, -40, 0], [-12 * L, 10 * R]),
      ...feet(-3 * alt, 3 * alt, 3 * hop)
    };
    default: return base;
  }
}
function makeGesture(label, bpm, beats, style, expression, { phase = 0, auto = false, fixed = false, seconds = 0 } = {}) {
  const duration = seconds || (bpm ? beats * 60 / bpm : 6);
  return {
    label, bpm, seconds:duration, ...(fixed ? { fixed:true } : {}), ...(auto ? {} : { auto:false }),
    pose:t => gesturePose(style, t, bpm, beats, duration, phase),
    morphs:t => faceMorphs(expression, t, duration)
  };
}
/* モーションの台本：t（秒）→ 各ボーンの回転・位置と顔モーフ。振り付けもVMDも実行時に生成 */
const BUILTIN = Object.assign(Object.create(null), {
  step: { label:"mmdMotionStep", bpm:120, seconds:4, pose:t => {
    const w = 2 * Math.PI * t * 2, slow = 2 * Math.PI * t;
    return {
      "センター": { pos:[0, -0.5 * Math.max(0, Math.sin(w)), 0], rot:[0, 0, 0] },
      "上半身": { rot:[0, 4 * Math.sin(slow), 0] },
      "首":    { rot:[2 * Math.sin(w), -3 * Math.sin(slow), 0] },
      "左腕":  { rot:[0, 0, -55 + 32 * Math.sin(w)] },
      "右腕":  { rot:[0, 0, 55 - 32 * Math.sin(w)] },
      "左ひじ":{ rot:[0, -18 - 10 * Math.sin(w), 0] },
      "右ひじ":{ rot:[0, 18 + 10 * Math.sin(w), 0] }
    };
  } },
  swing: { label:"mmdMotionSwing", bpm:100, seconds:6, pose:t => {
    const w = 2 * Math.PI * t / 1.5, slow = 2 * Math.PI * t / 3;
    return {
      "センター": { pos:[0.25 * Math.sin(w), -0.12 * Math.max(0, Math.sin(w * 2)), 0], rot:[0, 0, 3 * Math.sin(w)] },
      "上半身": { rot:[0, 7 * Math.sin(slow), 2 * Math.sin(w)] },
      "上半身2":{ rot:[0, 4 * Math.sin(slow + 1), 0] },
      "首":    { rot:[3 * Math.sin(w + 1), -5 * Math.sin(slow), 0] },
      "左腕":  { rot:[0, 0, -28 + 16 * Math.sin(w + 0.6)] },
      "右腕":  { rot:[0, 0, 28 - 16 * Math.sin(w - 0.6)] },
      "左ひじ":{ rot:[0, -22, 0] }, "右ひじ":{ rot:[0, 22, 0] }
    };
  } },
  turn: { label:"mmdMotionTurn", bpm:120, seconds:4, pose:t => {
    const w = 2 * Math.PI * t / 2, spin = 360 * (t / 4), rise = Math.sin(Math.PI * Math.min(1, t / 4));
    return {
      "センター": { pos:[0, 0.5 * rise, 0], rot:[0, spin, 0] },
      "上半身": { rot:[-6 * rise, 0, 0] },
      "首":    { rot:[-4 * rise, 6 * Math.sin(w), 0] },
      "左腕":  { rot:[0, 0, -78 * rise - 10] },
      "右腕":  { rot:[0, 0, 78 * rise + 10] },
      "左ひじ":{ rot:[0, -10, 0] }, "右ひじ":{ rot:[0, 10, 0] }
    };
  } },
  /* ④ ジャンプ：バンザイしながら跳ぶ。Lat式でかわいく、デフォルメ系（タワシ式など）だと派手に見える */
  jump: { label:"mmdMotionJump", bpm:130, seconds:4, pose:t => {
    const w = 2 * Math.PI * t, up = Math.max(0, Math.sin(w)), dip = Math.max(0, -Math.sin(w));
    const alt = Math.sin(Math.PI * t / 2);           // 4秒かけて重心がゆっくり左右へ
    return {
      "センター": { pos:[0.12 * alt, 0.85 * up * up - 0.22 * dip, 0], rot:[0, 0, 2 * alt] },
      "上半身": { rot:[-7 * up + 3 * dip, 0, -2 * alt] },
      "首":    { rot:[-6 * up, 0, 0] },
      "頭":    { rot:[-5 * up + 3 * Math.sin(w * 2), 0, 0] },
      "左腕":  { rot:[0, 0, -72 + 117 * up] },
      "右腕":  { rot:[0, 0, 72 - 117 * up] },
      "左ひじ":{ rot:[0, -24 + 14 * up, 0] },
      "右ひじ":{ rot:[0, 24 - 14 * up, 0] }
    };
  } },
  /* ⑤ アイドル：サイドステップしながら右手でこぶしを突き上げる */
  idol: { label:"mmdMotionIdol", bpm:128, seconds:6, pose:t => {
    const w = 2 * Math.PI * t / 1.5, sway = Math.sin(w), hop = Math.max(0, Math.sin(2 * w));
    const pump = Math.max(0, Math.sin(2 * w - 0.4));
    return {
      "センター": { pos:[0.4 * sway, 0.12 * hop - 0.1, 0], rot:[0, 0, 3 * sway] },
      "上半身": { rot:[0, 10 * Math.sin(w / 2), 4 * sway] },
      "上半身2":{ rot:[0, 5 * sway, 0] },
      "首":    { rot:[2 * hop, -7 * sway, 0] },
      "頭":    { rot:[-4 * pump, 5 * sway, 0] },
      "左腕":  { rot:[0, 0, -58 - 10 * sway] },
      "右腕":  { rot:[0, 0, 62 - 147 * pump] },
      "左ひじ":{ rot:[0, -28, 0] },
      "右ひじ":{ rot:[0, 30 + 25 * pump, 0] }
    };
  } },
  /* ---- 🚶 その場の歩行／🏃走行（左右交互・移動せず足踏み）
     腕は脚と逆相（左足が後ろ＝左腕は前）。前後は「腕のX」、ひねりは「腕のY」、下ろし具合は「腕のZ」で作る。
     歩行の目安（歩行分析の一般値）：肩の前後 ±20〜25°／肘は常時20°以上曲げ、前へ振るとき最大45°前後 ---- */
  walk112: { label:"mmdMotionWalk", bpm:112, auto:false, seconds:8 * 60 / 112, pose:t => {
    const beat = t * 112 / 60, stride = Math.sin(Math.PI * beat), bounce = Math.abs(Math.cos(Math.PI * beat));
    /* 足踏みの位相：脚を振り出している（浮いている）間だけ 1。足ＩＫを動かして、その場で足を上げる */
    const liftL = Math.max(0, -Math.cos(Math.PI * beat)), liftR = Math.max(0, Math.cos(Math.PI * beat));
    const swing = 34 * stride, elbowL = 22 + 20 * liftL, elbowR = 22 + 20 * liftR;
    return {
      "センター": { pos:[0.04 * stride, -0.06 + 0.02 * (liftL + liftR), 0], rot:[0.5, -2.4 * stride, 1.2 * stride] },
      "上半身": { rot:[1, 3.4 * stride, 1.4 * stride] },
      "首":    { rot:[-1.5 * (liftL + liftR), -0.6 * stride, 0] },
      "頭":    { rot:[1.5 * bounce, 0, -1.2 * stride] },
      "左足":  { rot:[-19 * stride, 0, 0] }, "右足":  { rot:[19 * stride, 0, 0] },
      "左ひざ":{ rot:[26 * liftL, 0, 0] }, "右ひざ":{ rot:[26 * liftR, 0, 0] },
      "左足首":{ rot:[-7 * liftL, 0, 0] }, "右足首":{ rot:[-7 * liftR, 0, 0] },
      /* 足ＩＫ＝足のIKターゲット。Y＝持ち上げ、Z（-で手前）＝ひざを前へ */
      "左足ＩＫ":{ rot:[0, 0, 0], pos:[0, 0.7 * liftL, -0.5 * liftL] },
      "右足ＩＫ":{ rot:[0, 0, 0], pos:[0, 0.7 * liftR, -0.5 * liftR] },
      "左腕":  { rot:[swing, 0, -50 + 4 * liftR] }, "右腕":  { rot:[-swing, 0, 50 - 4 * liftL] },
      "左ひじ":{ rot:[elbowL, 0, 0] }, "右ひじ":{ rot:[elbowR, 0, 0] },
      "左手首":{ rot:[0, 0, -6] }, "右手首":{ rot:[0, 0, 6] },
      "左ｽｶｰﾄ前":{ rot:[-2 * liftL, 0, -2 * stride] }, "右ｽｶｰﾄ前":{ rot:[-2 * liftR, 0, 2 * stride] },
      "左ｽｶｰﾄ後":{ rot:[2 * liftL, 0, -stride] }, "右ｽｶｰﾄ後":{ rot:[2 * liftR, 0, stride] }
    };
  } },
  run152: { label:"mmdMotionRun", bpm:152, auto:false, seconds:8 * 60 / 152, pose:t => {
    const beat = t * 152 / 60, stride = Math.sin(Math.PI * beat);
    const liftL = Math.max(0, -Math.cos(Math.PI * beat)), liftR = Math.max(0, Math.cos(Math.PI * beat));
    const bounce = Math.max(0, Math.sin(Math.PI * beat)), land = Math.abs(Math.cos(Math.PI * beat));
    const swing = 54 * stride, elbowL = 64 + 16 * liftL, elbowR = 64 + 16 * liftR;
    return {
      "センター": { pos:[0.05 * stride, -0.11 + 0.16 * bounce - 0.02 * land, 0], rot:[4, -3 * stride, 2 * stride] },
      "上半身": { rot:[4 - 2 * bounce, 4 * stride, 2 * stride] },
      "首":    { rot:[-3 * bounce, -2 * stride, 0] },
      "頭":    { rot:[3 * bounce, 0, -1.5 * stride] },
      "左足":  { rot:[-30 * stride, 0, 0] }, "右足":  { rot:[30 * stride, 0, 0] },
      "左ひざ":{ rot:[42 * liftL, 0, 0] }, "右ひざ":{ rot:[42 * liftR, 0, 0] },
      "左足首":{ rot:[-10 * liftL, 0, 0] }, "右足首":{ rot:[-10 * liftR, 0, 0] },
      /* 足ＩＫ＝足のIKターゲット。走りなので、歩きより大きく上げて前へ */
      "左足ＩＫ":{ rot:[0, 0, 0], pos:[0, 1.1 * liftL, -0.7 * liftL] },
      "右足ＩＫ":{ rot:[0, 0, 0], pos:[0, 1.1 * liftR, -0.7 * liftR] },
      "左腕":  { rot:[6 + swing, 0, -50 + 5 * liftR] }, "右腕":  { rot:[6 - swing, 0, 50 - 5 * liftL] },
      /* ひじは「前へ折る」＝rot[0]（前後）。rot[1] は手を体の前へ寄せる向き（左右で逆符号） */
      "左ひじ":{ rot:[elbowL, 10, 0] }, "右ひじ":{ rot:[elbowR, -10, 0] },
      "左手首":{ rot:[0, 0, -8] }, "右手首":{ rot:[0, 0, 8] },
      "左ｽｶｰﾄ前":{ rot:[-4 * liftL, 0, -3 * stride] }, "右ｽｶｰﾄ前":{ rot:[-4 * liftR, 0, 3 * stride] },
      "左ｽｶｰﾄ後":{ rot:[3 * liftL, 0, -1.5 * stride] }, "右ｽｶｰﾄ後":{ rot:[3 * liftR, 0, 1.5 * stride] }
    };
  } },
  sit10: { label:"mmdMotionSit", bpm:0, fixed:true, seconds:10, pose:t => {
    const ease = x => { const v = Math.max(0, Math.min(1, x)); return v * v * (3 - 2 * v); };
    const lower = ease((t - 0.3) / 1.25), rise = ease((t - 8.1) / 1.15), seated = lower * (1 - rise);
    const breathe = Math.sin(2 * Math.PI * t / 3.6), glance = Math.sin(2 * Math.PI * t / 5.8);
    return {
      "センター": { pos:[0.035 * glance * seated, -3.65 * seated + 0.025 * breathe * seated, 0], rot:[0, 2 * glance * seated, 0] },
      "上半身": { rot:[5 * seated - 1.5 * breathe * seated, 2 * glance * seated, 0] },
      "上半身2":{ rot:[2 * seated, 0, 0] },
      "首":    { rot:[-3 * seated, 5 * glance * seated, 0] },
      "頭":    { rot:[-5 * seated, 7 * glance * seated, 2 * glance * seated] },
      "左足":  { rot:[-70 * seated, 0, -3 * seated] }, "右足":  { rot:[-70 * seated, 0, 3 * seated] },
      "左ひざ":{ rot:[94 * seated, 0, 0] }, "右ひざ":{ rot:[94 * seated, 0, 0] },
      "左足首":{ rot:[-18 * seated, 0, 0] }, "右足首":{ rot:[-18 * seated, 0, 0] },
      "左腕":  { rot:[-8 * seated, 0, -48] }, "右腕":  { rot:[-8 * seated, 0, 48] },
      "左ひじ":{ rot:[0, -42 * seated, 0] }, "右ひじ":{ rot:[0, 42 * seated, 0] },
      "左手首":{ rot:[0, 0, -7 * seated] }, "右手首":{ rot:[0, 0, 7 * seated] },
      "左ｽｶｰﾄ前":{ rot:[-6 * seated, 0, -1.5 * glance * seated] }, "右ｽｶｰﾄ前":{ rot:[-6 * seated, 0, 1.5 * glance * seated] },
      "左ｽｶｰﾄ後":{ rot:[5 * seated, 0, 0] }, "右ｽｶｰﾄ後":{ rot:[5 * seated, 0, 0] }
    };
  } },
  dance128: { label:"mmdMotionDance", bpm:128, seconds:16 * 60 / 128, pose:t => {
    const beat = t * 128 / 60;
    const phrase = [
      { x:0, yaw:-8, roll:2, leftZ:-46, rightZ:46, leftElbow:-62, rightElbow:62, head:5 },
      { x:0.12, yaw:12, roll:-3, leftZ:38, rightZ:45, leftElbow:-36, rightElbow:48, head:-3 },
      { x:-0.10, yaw:-12, roll:2, leftZ:-88, rightZ:88, leftElbow:-50, rightElbow:50, head:3 },
      { x:0.08, yaw:10, roll:-2, leftZ:-45, rightZ:-38, leftElbow:-48, rightElbow:36, head:-4 }
    ];
    const slot = (beat % 16) / 4, index = Math.floor(slot), u0 = slot - index;
    const u = 0.5 - 0.5 * Math.cos(Math.PI * u0), a = phrase[index], b = phrase[(index + 1) % phrase.length];
    const mix = key => a[key] + (b[key] - a[key]) * u;
    const step = Math.sin(Math.PI * beat), lift = Math.max(0, step), x = mix("x");
    return {
      "センター": { pos:[x + 0.025 * step, -0.06 + 0.035 * lift, 0], rot:[0, mix("yaw") + 2 * step, mix("roll")] },
      "上半身": { rot:[2 - lift, 0.4 * mix("yaw"), 1.4 * mix("roll")] },
      "首":    { rot:[-2 * lift, -0.35 * mix("yaw"), 0] },
      "頭":    { rot:[-3 * lift, -0.25 * mix("yaw"), mix("head")] },
      "左足":  { rot:[12 * step, 0, 0] }, "右足":  { rot:[-12 * step, 0, 0] },
      "左ひざ":{ rot:[14 * lift, 0, 0] }, "右ひざ":{ rot:[14 * Math.max(0, -step), 0, 0] },
      "左腕":  { rot:[5 * step, 0, mix("leftZ")] }, "右腕":  { rot:[-5 * step, 0, mix("rightZ")] },
      "左ひじ":{ rot:[0, mix("leftElbow"), 0] }, "右ひじ":{ rot:[0, mix("rightElbow"), 0] },
      "左手首":{ rot:[0, 0, -5 + 3 * step] }, "右手首":{ rot:[0, 0, 5 - 3 * step] },
      "左ｽｶｰﾄ前":{ rot:[-2 * lift, 0, -step] }, "右ｽｶｰﾄ前":{ rot:[-2 * lift, 0, step] },
      "左ｽｶｰﾄ後":{ rot:[lift, 0, 0] }, "右ｽｶｰﾄ後":{ rot:[lift, 0, 0] }
    };
  } },
  /* ---- 🎵 BPMシリーズ：人気ミク曲のテンポに合わせた振り付け（曲名は目安。モーション自体は trk! の自作VMD） ----
     基準BPM（mmdBpm）が 0 のとき、内蔵モーションはそれぞれの bpm を基準に曲へ自動シンクします。 */
  ievan120: { label:"mmdMotionIevan", bpm:120, seconds:4, pose:t => {   // ネギスピン（8拍・はちゅね風にゆれながら回すだけ）
    const b = t * 2, spin = 2 * Math.PI * b, sway = Math.sin(Math.PI * b / 4);
    return {
      "センター": { pos:[0.06 * sway, -0.03 * Math.abs(Math.sin(Math.PI * b)), 0], rot:[0, 0, 4 * sway] },
      "上半身": { rot:[2, 5 * sway, 3 * sway] },
      "首":    { rot:[2, -4 * sway, -8 * sway] },
      "頭":    { rot:[-3, 0, -12 * sway] },
      "左腕":  { rot:[0, 0, -66 + 3 * sway] },
      "左ひじ":{ rot:[0, -14, 0] },
      "右腕":  { rot:[22 * Math.sin(spin), 0, 24 + 12 * Math.cos(spin)] },
      "右ひじ":{ rot:[0, 52 + 18 * Math.sin(spin + 1.2), 0] }
    };
  } },
  /* ---- 👀 汎用（BPM非依存。fixed:true＝曲のテンポに関係なく、いつも同じ速さ） ---- */
  watch: { label:"mmdMotionWatch", bpm:0, fixed:true, seconds:12, pose:t => { // みてる（こちらをじっと・呼吸と小さな首かしげだけ）
    const breathe = Math.sin(Math.PI * t / 2);                        // 4秒でひと呼吸
    const tilt = Math.sin(Math.PI * t / 6), shift = Math.sin(Math.PI * t / 12);
    return {
      "センター": { pos:[0.04 * shift, 0.02 * breathe, 0], rot:[0, 3 * shift, 0.6 * shift] },
      "上半身": { rot:[1 - 0.8 * breathe, -2 * shift, 0.6 * tilt] },
      "上半身2":{ rot:[0.6 * breathe, 0, 0] },
      "首":    { rot:[-2, -2 * shift, -2 * tilt] },
      "頭":    { rot:[-3 + 0.6 * breathe, -1.5 * shift, 5 * tilt] },  // ちょっと首をかしげてこちらを見る
      "左腕":  { rot:[1.5 * breathe, 0, -66] },
      "右腕":  { rot:[1.5 * breathe, 0, 66] },
      "左ひじ":{ rot:[0, -10, 0] }, "右ひじ":{ rot:[0, 10, 0] }
    };
  } },
  stroll: { label:"mmdMotionStroll", bpm:0, fixed:true, seconds:16, pose:t => { // たたずむ（手をうしろに・あたりを見まわす）
    const breathe = Math.sin(Math.PI * t / 2), look = Math.sin(Math.PI * t / 8), lean = Math.sin(Math.PI * t / 16);
    return {
      "センター": { pos:[0.08 * lean, 0.02 * breathe, 0], rot:[0, 10 * lean, 1.2 * lean] },
      "上半身": { rot:[2 - breathe, 5 * lean, 1.5 * lean] },
      "首":    { rot:[-3, 8 * look, -2 * lean] },
      "頭":    { rot:[-5 + 0.8 * breathe, 10 * look, 2 * look] },     // きょろきょろと見まわす
      "左腕":  { rot:[-22, -16, -58] },                               // 手をうしろで組む
      "右腕":  { rot:[-22, 16, 58] },
      "左ひじ":{ rot:[0, -52, 0] }, "右ひじ":{ rot:[0, 52, 0] }
    };
  } },
  /* ---- 🎸 128BPM しっとり（Sometimes / When You Sleep あたりむけ）
     2026-10 に一度エアギター（旧 airgtr128）を外しました：腕・肘が弦の位置に乗らず破綻しやすかったためです。
     復活させたいときは git の履歴（147720e 時点）から pose を戻してください。 ---- */
  dreamy128: { label:"mmdMotionDreamy", bpm:128, seconds:7.5, pose:t => { // しっとり（16拍・ゆったりただよう）
    const b = t * 128 / 60, w = Math.PI * b / 8, s = Math.sin(w), drift = Math.sin(Math.PI * b / 4);
    return {
      "センター": { pos:[0.16 * s, -0.04 + 0.03 * Math.sin(Math.PI * b / 2), 0], rot:[0, 15 * s, 2 * drift] },
      "上半身": { rot:[2, 8 * s, 4 * drift] },
      "上半身2":{ rot:[1, 4 * s, 0] },
      "首":    { rot:[-6, -6 * s, -4 * drift] },
      "頭":    { rot:[-9, -4 * s, 6 * drift] },                         // すこし上をむいて夢見ごこち
      "左腕":  { rot:[4 * drift, 0, -62 + 4 * s] },
      "右腕":  { rot:[-4 * drift, 0, 62 + 4 * s] },
      "左ひじ":{ rot:[0, -12 - 5 * drift, 0] },
      "右ひじ":{ rot:[0, 12 - 5 * drift, 0] }
    };
  } },
  kneel128: { label:"mmdMotionKneel", bpm:128, seconds:7.5, pose:t => {  // かたひざ（16拍・しずかに眺める）
    const b = t * 128 / 60, breathe = Math.sin(Math.PI * b / 2), look = Math.sin(Math.PI * b / 8);
    return {
      "センター": { pos:[0, -3.8 + 0.06 * breathe, 0.2], rot:[0, 8 * look, 0] },
      "上半身": { rot:[10 - 2 * breathe, 4 * look, 0] },
      "上半身2":{ rot:[4, 0, 0] },
      "首":    { rot:[-10, 10 * look, 0] },
      "頭":    { rot:[-14 + breathe, 12 * look, 2 * look] },            // とおくを眺める
      "左足":  { rot:[-95, 0, 6] }, "左ひざ":{ rot:[115, 0, 0] },        // 立てひざ側
      "右足":  { rot:[-25, 0, -8] }, "右ひざ":{ rot:[120, 0, 0] },       // 地面につく側
      "左腕":  { rot:[32, 0, -48] },                                    // ひざにうでを乗せる
      "左ひじ":{ rot:[0, -58, 0] },
      "右腕":  { rot:[6, 0, 64] },                                      // だらんと支える
      "右ひじ":{ rot:[0, 14 + 3 * breathe, 0] }
    };
  } },
  dune135: { label:"mmdMotionDune", bpm:135, seconds:3.56, pose:t => {   // こうしん（8拍）
    const b = t * 2.25, arm = Math.sin(Math.PI * b), bob = Math.abs(Math.sin(Math.PI * b));
    return {
      "センター": { pos:[0, -0.22 + 0.16 * bob, 0], rot:[0, 6 * Math.sin(Math.PI * b / 4), 0] },
      "上半身": { rot:[3, 4 * arm, 0] },
      "首":    { rot:[-3 * bob, -4 * arm, 0] },
      "頭":    { rot:[4 * bob, 0, 0] },
      "左腕":  { rot:[30 * arm, 0, -62] },
      "右腕":  { rot:[-30 * arm, 0, 62] },
      "左ひじ":{ rot:[0, -45 - 15 * arm, 0] },
      "右ひじ":{ rot:[0, 45 - 15 * arm, 0] }
    };
  } },
  green145: { label:"mmdMotionGreen", bpm:145, seconds:3.31, pose:t => { // ペンライト（8拍）
    const b = t * 145 / 60, w = Math.PI * b / 2, s = Math.sin(w);
    return {
      "センター": { pos:[0.22 * s, -0.08 * Math.abs(Math.cos(w)), 0], rot:[0, 0, 3 * s] },
      "上半身": { rot:[0, 5 * s, 4 * s] },
      "首":    { rot:[-4, -5 * s, -3 * s] },
      "頭":    { rot:[-5, 0, 4 * s] },
      "左腕":  { rot:[0, 0, 38 + 20 * s] },
      "右腕":  { rot:[0, 0, -38 + 20 * s] },
      "左ひじ":{ rot:[0, -12, 0] }, "右ひじ":{ rot:[0, 12, 0] }
    };
  } },
  tyw150: { label:"mmdMotionTyw", bpm:150, seconds:3.2, pose:t => {      // せかいへ（8拍：むね→ひろげる）
    const b = t * 2.5, u = (Math.sin(Math.PI * b / 2 - Math.PI / 2) + 1) / 2, sway = Math.sin(Math.PI * b / 4);
    return {
      "センター": { pos:[0, -0.05 + 0.08 * u, 0], rot:[0, 10 * sway, 0] },
      "上半身": { rot:[-5 * u, 6 * sway, 0] },
      "上半身2":{ rot:[-3 * u, 0, 0] },
      "首":    { rot:[-6 * u, -5 * sway, 0] },
      "頭":    { rot:[-6 * u, 0, 0] },
      "左腕":  { rot:[12 * (1 - u), 0, -58 + 78 * u] },
      "右腕":  { rot:[12 * (1 - u), 0, 58 - 78 * u] },
      "左ひじ":{ rot:[0, -82 * (1 - u) - 6, 0] },
      "右ひじ":{ rot:[0, 82 * (1 - u) + 6, 0] }
    };
  } },
  senbon154: { label:"mmdMotionSenbon", bpm:154, seconds:3.12, pose:t => { // キレの和（8拍・ジグザグでキビキビ）
    const b = t * 154 / 60, zig = Math.asin(Math.sin(Math.PI * b / 2)) * 2 / Math.PI, snap = Math.asin(Math.sin(Math.PI * b)) * 2 / Math.PI;
    return {
      "センター": { pos:[0.1 * zig, -0.1 + 0.05 * Math.abs(snap), 0], rot:[0, 0, 2 * zig] },
      "上半身": { rot:[0, 18 * zig, 3 * zig] },
      "首":    { rot:[0, -16 * zig, 0] },
      "頭":    { rot:[3 * Math.abs(snap), -6 * zig, 0] },
      "左腕":  { rot:[0, 0, -15 - 40 * Math.max(0, zig)] },
      "右腕":  { rot:[0, 0, 15 + 40 * Math.max(0, -zig)] },
      "左ひじ":{ rot:[0, -95 * Math.max(0, -zig) - 10, 0] },
      "右ひじ":{ rot:[0, 95 * Math.max(0, zig) + 10, 0] }
    };
  } },
  mikumiku160: { label:"mmdMotionMikumiku", bpm:160, seconds:3.0, pose:t => { // してやんよ（8拍：右で びしっ→左で びしっ）
    const b = t * 160 / 60;
    const half = (b % 8) < 4;                                 // 前半＝右手の番・後半＝左手の番
    const u = Math.sin(Math.PI * ((b % 4) / 4));              // 0→1→0 で腕を出して戻す
    const hop = Math.abs(Math.sin(Math.PI * b));              // 拍ごとのはずみ
    const nod = Math.sin(2 * Math.PI * b);
    const R = half ? u : 0, L = half ? 0 : u;                 // R/L＝その手を出す量
    return {
      "センター": { pos:[0.12 * (R - L), 0.12 * hop * hop - 0.05, 0], rot:[0, -14 * R + 14 * L, 0] },
      "上半身": { rot:[-3 * (R + L), -8 * R + 8 * L, 2 * (R - L)] },
      "首":    { rot:[2 * nod, 5 * R - 5 * L, -4 * (R - L)] },
      "頭":    { rot:[-5 * (R + L), 6 * R - 6 * L, 7 * (R - L)] },  // 「してやんよ！」のドヤ首かしげ
      "左腕":  { rot:[0, 20 * L, 42 - 100 * L] },                   // 出すときは横へ びしっ
      "右腕":  { rot:[0, -20 * R, -42 + 100 * R] },
      "左ひじ":{ rot:[0, -65 + 55 * L, 0] },                        // 出し切ると ほぼ伸びる
      "右ひじ":{ rot:[0, 65 - 55 * R, 0] }
    };
  } },
  kyukura165: { label:"mmdMotionKyukura", bpm:165, seconds:2.91, pose:t => { // くらくら（8拍・マリオネットみたいにゆれる）
    const b = t * 2.75, w = Math.PI * b / 2, fast = 2 * Math.PI * b;
    return {
      "センター": { pos:[0.12 * Math.sin(w), 0.05 * Math.cos(w) - 0.08, 0], rot:[0, 0, 4 * Math.sin(w)] },
      "上半身": { rot:[3 * Math.cos(w), 6 * Math.sin(w), 5 * Math.sin(w + 0.4)] },
      "首":    { rot:[-3 * Math.cos(w + 0.5), 0, 8 * Math.sin(w + 0.5)] },
      "頭":    { rot:[6 * Math.cos(w), 0, 12 * Math.sin(w)] },
      "左腕":  { rot:[8 * Math.sin(fast), 0, -30 + 14 * Math.sin(fast) ] },
      "右腕":  { rot:[-8 * Math.sin(fast + 1.2), 0, 30 - 14 * Math.sin(fast + 1.2)] },
      "左ひじ":{ rot:[0, -42 - 26 * Math.sin(fast + 0.6), 0] },
      "右ひじ":{ rot:[0, 42 + 26 * Math.sin(fast + 1.8), 0] }
    };
  } },
  melt170: { label:"mmdMotionMelt", bpm:170, seconds:16 * 60 / 170, pose:t => { // きゅん（16拍・手を胸元から頬へ、左右に小さく揺れる）
    const b = t * 170 / 60, sway = Math.sin(2 * Math.PI * b / 8), heart = 0.5 - 0.5 * Math.cos(2 * Math.PI * b / 4);
    const beat = Math.max(0, Math.sin(Math.PI * b));
    return {
      "センター": { pos:[0.075 * sway, -0.025 * beat, 0], rot:[0, 0, 3.5 * sway] },
      "上半身": { rot:[2, 6 * sway, 2.5 * sway] },
      "首":    { rot:[2, -5 * sway, -5 * sway] },
      "頭":    { rot:[-4 + 1.5 * beat, 0, 7 * sway] },
      "左足":  { rot:[-4 * sway, 0, 0] }, "右足":  { rot:[4 * sway, 0, 0] },
      "左ひざ":{ rot:[4 * beat, 0, 0] }, "右ひざ":{ rot:[4 * beat, 0, 0] },
      "左腕":  { rot:[16 + 3 * heart, 0, -48 + 9 * heart] },
      "右腕":  { rot:[16 + 3 * heart, 0, 48 - 9 * heart] },
      "左ひじ":{ rot:[0, -72 - 10 * heart, 0] },
      "右ひじ":{ rot:[0, 72 + 10 * heart, 0] },
      "左手首":{ rot:[0, 0, -10 * heart] }, "右手首":{ rot:[0, 0, 10 * heart] },
      "左ｽｶｰﾄ前":{ rot:[-1.5 * beat, 0, -sway] }, "右ｽｶｰﾄ前":{ rot:[-1.5 * beat, 0, sway] }
    };
  } },
  umg170: { label:"mmdMotionUmg", bpm:170, seconds:5.65, pose:t => {     // つたえる（16拍・かた手をのばして→むねへ）
    const b = t * 170 / 60, u = (Math.sin(Math.PI * b / 8 - Math.PI / 2) + 1) / 2, s = Math.sin(Math.PI * b / 4);
    return {
      "センター": { pos:[0.08 * s, -0.03, 0], rot:[0, -8 * u, 0] },
      "上半身": { rot:[-3 * u, -6 * u, 2 * s] },
      "首":    { rot:[-4 * u, 5 * u, -3 * s] },
      "頭":    { rot:[-5 * u, 4 * u, 0] },
      "左腕":  { rot:[0, 0, -55 + 5 * s] },
      "右腕":  { rot:[-35 * u, 20 * u, 30 - 55 * u] },
      "左ひじ":{ rot:[0, -20, 0] },
      "右ひじ":{ rot:[0, 15 + 75 * (1 - u), 0] }
    };
  } },
  rabbit173: { label:"mmdMotionRabbit", bpm:173, seconds:3.47, pose:t => { // うさみみ（10拍＝5拍子×2・4ホップ＋1スキップ）
    const b = t * 173 / 60, b5 = b % 5, skip = b5 >= 4;                  // 5拍目だけ2倍速のスキップ＝変拍子感
    const hop = Math.max(0, Math.sin(Math.PI * b5 * (skip ? 2 : 1)));
    const sway = Math.sin(Math.PI * b / 5), wig = Math.sin(2 * Math.PI * b);
    return {
      "センター": { pos:[0.14 * sway, 0.1 * hop * hop - 0.05, 0], rot:[0, 0, 3 * sway] },
      "上半身": { rot:[2 * hop, 6 * sway, 2 * sway] },
      "首":    { rot:[-3 * hop, -5 * sway, 4 * wig * (skip ? 1 : 0.3)] },
      "頭":    { rot:[-4 * hop, 0, 6 * sway] },
      "左腕":  { rot:[0, 0, 52 + 4 * wig] },
      "右腕":  { rot:[0, 0, -52 - 4 * wig] },
      "左ひじ":{ rot:[0, -112 - 8 * wig, 0] },
      "右ひじ":{ rot:[0, 112 + 8 * wig, 0] }
    };
  } },
  wedh174: { label:"mmdMotionWedh", bpm:174, seconds:16 * 60 / 174, pose:t => { // ダンスホール（16拍・左右交互の腕上げ＋控えめなステップ）
    const b = t * 174 / 60, s = Math.sin(Math.PI * b / 2), nod = Math.max(0, Math.sin(Math.PI * b));
    const L = Math.max(0, s), R = Math.max(0, -s), step = Math.sin(Math.PI * b);
    return {
      "センター": { pos:[0.16 * s, 0.035 * nod - 0.055, 0], rot:[0, 2 * s, 3 * s] },
      "上半身": { rot:[1 - nod, 7 * s, 3 * s] },
      "首":    { rot:[2 * nod, -5 * s, -3 * s] },
      "頭":    { rot:[4 * nod, 0, 0] },
      "左足":  { rot:[10 * step, 0, 0] }, "右足":  { rot:[-10 * step, 0, 0] },
      "左ひざ":{ rot:[12 * nod, 0, 0] }, "右ひざ":{ rot:[12 * Math.max(0, -step), 0, 0] },
      "左腕":  { rot:[0, 0, -54 + 98 * L] },
      "右腕":  { rot:[0, 0, 54 - 98 * R] },
      "左ひじ":{ rot:[0, -34 + 16 * L, 0] },
      "右ひじ":{ rot:[0, 34 - 16 * R, 0] },
      "左手首":{ rot:[0, 0, -5 * L] }, "右手首":{ rot:[0, 0, 5 * R] },
      "左ｽｶｰﾄ前":{ rot:[-2 * nod, 0, -step] }, "右ｽｶｰﾄ前":{ rot:[-2 * nod, 0, step] },
      "左ｽｶｰﾄ後":{ rot:[nod, 0, 0] }, "右ｽｶｰﾄ後":{ rot:[nod, 0, 0] }
    };
  } },
  mesmer185: { label:"mmdMotionMesmer", bpm:185, seconds:2.59, pose:t => { // すましシャッフル（8拍・レトロカートゥーンのびよんびよん）
    const b = t * 185 / 60, beat = Math.abs(Math.sin(Math.PI * b)), alt = Math.sin(Math.PI * b / 2);
    const pend = Math.sin(Math.PI * b);                                  // 1拍で腕がふりこ
    return {
      "センター": { pos:[0.22 * alt, 0.08 * beat - 0.12 + 0.06 * beat * beat, 0], rot:[0, 0, 5 * alt] },
      "上半身": { rot:[2 * beat, 12 * alt, -4 * alt] },
      "上半身2":{ rot:[0, 6 * alt, 0] },
      "首":    { rot:[4 * beat, -8 * alt, 10 * alt] },
      "頭":    { rot:[5 * beat, 0, -13 * alt] },
      "左腕":  { rot:[38 * pend, 0, -52] },
      "右腕":  { rot:[-38 * pend, 0, 52] },
      "左ひじ":{ rot:[0, -22 - 14 * pend, 0] },
      "右ひじ":{ rot:[0, 22 - 14 * pend, 0] }
    };
  } },
  rolling194: { label:"mmdMotionRolling", bpm:194, seconds:2.47, pose:t => { // ぐるぐる（8拍・からだで円をえがく）
    const b = t * 194 / 60, w = Math.PI * b / 2;
    return {
      "センター": { pos:[0.25 * Math.sin(w), 0.1 * Math.cos(w) - 0.12, 0], rot:[0, 0, 7 * Math.sin(w)] },
      "上半身": { rot:[5 * Math.cos(w), 0, 8 * Math.sin(w)] },
      "首":    { rot:[-4 * Math.cos(w), 0, 9 * Math.sin(w + 0.7)] },
      "頭":    { rot:[-5 * Math.cos(w + 0.5), 0, 10 * Math.sin(w + 1)] },
      "左腕":  { rot:[14 * Math.sin(w), 0, -68] },
      "右腕":  { rot:[-14 * Math.sin(w), 0, 68] },
      "左ひじ":{ rot:[0, -14, 0] }, "右ひじ":{ rot:[0, 14, 0] }
    };
  } },
  uraomote196: { label:"mmdMotionUraomote", bpm:196, seconds:2.45, pose:t => { // うらおもて（8拍・くるっと左右へ向きかえ）
    const b = t * 196 / 60, flip = Math.sin(Math.PI * b / 2), nod = Math.max(0, Math.sin(2 * Math.PI * b));
    const x = Math.abs(flip);
    return {
      "センター": { pos:[0, -0.06 * nod, 0], rot:[0, 70 * flip, 0] },
      "上半身": { rot:[0, 14 * flip, 0] },
      "首":    { rot:[5 * nod, -10 * flip, 0] },
      "頭":    { rot:[7 * nod, -8 * flip, 0] },
      "左腕":  { rot:[20 * x, 0, -42 - 14 * x] },
      "右腕":  { rot:[20 * x, 0, 42 + 14 * x] },
      "左ひじ":{ rot:[0, -70 - 20 * flip, 0] },
      "右ひじ":{ rot:[0, 70 - 20 * flip, 0] }
    };
  } },
  vanish240: { label:"mmdMotionVanish", bpm:240, seconds:4, pose:t => {  // こうそく（16拍・いそがしく跳ねる）
    const b = t * 4, up = Math.pow(Math.max(0, Math.sin(Math.PI * b)), 2), fast = Math.sin(2 * Math.PI * b);
    const alt = Math.sin(Math.PI * b / 8);
    return {
      "センター": { pos:[0.08 * alt, 0.22 * up - 0.08, 0], rot:[0, 0, 2 * alt] },
      "上半身": { rot:[7, 5 * fast, -2 * alt] },
      "首":    { rot:[-4 * up, 3 * fast, 0] },
      "頭":    { rot:[-3 * up, 4 * fast, 0] },
      "左腕":  { rot:[0, 0, -55 + 26 * up] },
      "右腕":  { rot:[0, 0, 55 - 26 * up] },
      "左ひじ":{ rot:[0, -55 - 16 * fast, 0] },
      "右ひじ":{ rot:[0, 55 - 16 * fast, 0] }
    };
  } },

  // 表情・短い演技（Lat式PMDの実在モーフ名に合わせたコード生成）
  faceSmile: makeGesture("mmdMotionFaceSmile", 0, 8, "actSmile", "smile", { fixed:true }),
  faceWink: makeGesture("mmdMotionFaceWink", 0, 8, "actWink", "wink", { fixed:true }),
  faceShy: makeGesture("mmdMotionFaceShy", 0, 8, "actShy", "shy", { fixed:true }),
  faceAngry: makeGesture("mmdMotionFaceAngry", 0, 8, "actAngry", "angry", { fixed:true }),
  faceConfused: makeGesture("mmdMotionFaceConfused", 0, 8, "actConfused", "confused", { fixed:true }),
  faceSurprise: makeGesture("mmdMotionFaceSurprise", 0, 8, "actSurprise", "surprise", { fixed:true }),
  faceSleepy: makeGesture("mmdMotionFaceSleepy", 0, 8, "actSleepy", "sleepy", { fixed:true }),
  facePout: makeGesture("mmdMotionFacePout", 0, 8, "actPout", "pout", { fixed:true }),
  faceLaugh: makeGesture("mmdMotionFaceLaugh", 0, 8, "actLaugh", "laugh", { fixed:true }),
  faceSing: makeGesture("mmdMotionFaceSing", 0, 8, "actSing", "sing", { fixed:true }),

  // 🎤 歌・口パク（すべてBPM非依存の6秒ループ。音声とは同期しません。肘は前に折る向き＝左+Y／右-Y）
  songMic: makeGesture("mmdMotionSongMic", 0, 8, "actSongMic", "sing", { fixed:true }),
  songLong: makeGesture("mmdMotionSongLong", 0, 8, "actSongSoft", "singSoft", { fixed:true }),
  songUp: makeGesture("mmdMotionSongUp", 0, 8, "actSongUp", "singUp", { fixed:true }),
  songHum: makeGesture("mmdMotionSongHum", 0, 8, "actSongHum", "hum", { fixed:true }),
  songWhisper: makeGesture("mmdMotionSongWhisper", 0, 8, "actSongWhisper", "whisper", { fixed:true }),
  songCall: makeGesture("mmdMotionSongCall", 0, 8, "actSongCall", "call", { fixed:true }),

  // ミクらしい記号的な手ぶり・ポーズ。既存曲の振付データや小物は含めない
  mikuPrincess152: makeGesture("mmdMotionPrincess", 152, 8, "princess", "proud", { auto:true }),
  mikuLeek120: makeGesture("mmdMotionLeekShake", 120, 8, "leek", "joy", { auto:true }),
  mikuPopipo150: makeGesture("mmdMotionPopipo", 150, 8, "popipo", "joy", { auto:true }),
  mikuTripleBaka140: makeGesture("mmdMotionTriple", 140, 8, "triple", "grin", { auto:true }),
  mikuNyan160: makeGesture("mmdMotionNyan", 160, 8, "cat", "smile", { auto:true }),
  mikuSalute128: makeGesture("mmdMotionSalute", 128, 8, "salute", "smile", { auto:true }),
  mikuDoubleHeart128: makeGesture("mmdMotionDoubleHeart", 128, 8, "heart", "love", { auto:true }),
  mikuPoint160: makeGesture("mmdMotionPoint", 160, 8, "point", "proud", { auto:true }),
  mikuEncore128: makeGesture("mmdMotionEncore", 128, 8, "encore", "joy", { auto:true }),
  mikuDramatic170: makeGesture("mmdMotionDramatic", 170, 16, "dramatic", "serious", { auto:true }),
  mikuVictory128: makeGesture("mmdMotionVictory", 128, 8, "victory", "smile", { auto:true }),
  mikuPenlight145: makeGesture("mmdMotionPenlight", 145, 8, "penlight", "sparkle", { auto:true }),
  mikuChibi128: makeGesture("mmdMotionChibi", 128, 8, "chibi", "joy", { auto:true }),
  mikuSpin128: makeGesture("mmdMotionSpin", 128, 8, "spin", "grin", { auto:true }),

  // 軽いオリジナルの踊り・日常動作
  groove112: makeGesture("mmdMotionGroove", 112, 8, "groove", "soft"),
  stepTouch128: makeGesture("mmdMotionStepTouch", 128, 8, "stepTouch", "smile"),
  shoulderPop128: makeGesture("mmdMotionShoulderPop", 128, 8, "shoulder", "grin"),
  armWave120: makeGesture("mmdMotionArmWave", 120, 8, "armWave", "soft"),
  crossStep128: makeGesture("mmdMotionCrossStep", 128, 8, "crossStep", "proud"),
  softBow: makeGesture("mmdMotionSoftBow", 0, 8, "bow", "soft", { fixed:true, seconds:8 }),
  marionette120: makeGesture("mmdMotionMarionette", 120, 8, "marionette", "confused")
});
const EXISTING_EXPRESSIONS = {
  step:"smile", swing:"calm", turn:"proud", jump:"joy", idol:"joy",
  walk112:"soft", run152:"joy", sit10:"calm", dance128:"joy", dreamy128:"soft",
  kneel128:"calm", ievan120:"joy", watch:"calm", stroll:"soft",
  dune135:"serious", green145:"joy", tyw150:"smile", senbon154:"serious", mikumiku160:"proud",
  kyukura165:"confused", melt170:"love", umg170:"soft", rabbit173:"wink", wedh174:"joy",
  mesmer185:"surprise", rolling194:"confused", uraomote196:"grin", vanish240:"serious"
};
for (const [id, expression] of Object.entries(EXISTING_EXPRESSIONS)) {
  const motion = BUILTIN[id];
  motion.expression = expression;
  motion.morphs = t => faceMorphs(expression, t, motion.seconds);
}

const builtinBytes = id => {
  const m = BUILTIN[id];
  if (!m) return null;
  const frames = [], morphFrames = [], endFrame = Math.ceil(m.seconds * FPS);
  const addFrame = f => {
    const t = f / FPS, pose = m.pose(t);
    for (const bone of Object.keys(pose)) {
      const b = pose[bone], rot = qEuler(b.rot[0], b.rot[1], b.rot[2]);
      frames.push({ bone, frame:f, pos:b.pos || [0, 0, 0], rot });
    }
    if (typeof m.morphs === "function") {
      for (const [name, weight] of Object.entries(m.morphs(t))) morphFrames.push({ name, frame:f, weight });
    }
  };
  for (let f = 0; f < endFrame; f += STEP) addFrame(f);
  addFrame(endFrame);  // include a key at/just after the loop boundary when 30fps cannot land on it exactly
  morphFrames.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.frame - b.frame);
  return buildVmd(frames, "trk-builtin-" + id, morphFrames);
};
const MOTION_GROUPS = [
  { label:"mmdGroupDaily", ids:[
    "watch", "stroll", "walk112", "run152", "sit10", "dreamy128", "kneel128", "softBow", "swing", "groove112"
  ] },
  { label:"mmdGroupDance", ids:[
    "step", "turn", "jump", "idol", "dance128", "stepTouch128", "shoulderPop128", "armWave120", "crossStep128", "marionette120"
  ] },
  { label:"mmdGroupSongs", ids:[
    "ievan120", "kyukura165", "dune135", "green145", "tyw150", "senbon154", "mikumiku160", "melt170", "umg170", "rabbit173", "wedh174", "mesmer185", "rolling194", "uraomote196", "vanish240"
  ] },
  { label:"mmdGroupMiku", ids:[
    "mikuPrincess152", "mikuLeek120", "mikuPopipo150", "mikuTripleBaka140", "mikuNyan160", "mikuSalute128", "mikuDoubleHeart128",
    "mikuPoint160", "mikuEncore128", "mikuDramatic170", "mikuVictory128", "mikuPenlight145", "mikuChibi128", "mikuSpin128"
  ] },
  { label:"mmdGroupFaces", ids:[
    "faceSmile", "faceWink", "faceShy", "faceAngry", "faceConfused", "faceSurprise", "faceSleepy", "facePout", "faceLaugh"
  ] },
  { label:"mmdGroupVoice", ids:[
    "faceSing", "songMic", "songLong", "songUp", "songHum", "songWhisper", "songCall"
  ] }
];
const MOTION_MENU_IDS = MOTION_GROUPS.flatMap(group => group.ids);
const MOTION_MENU_SET = new Set(MOTION_MENU_IDS);

/* ============ 💠 同梱プリセットモデル（assets/mmd/<dir>/preset.json があるときだけ出る） ============
   モデル本体はふだんリポジトリに入れません。**再配布OKを「れあどめ」原文で確認できたモデルだけ**、
   れあどめ原文ごと assets/mmd/<dir>/ に置き、preset.json を書くと、設定にワンクリックのボタンが出ます。
   （例：Lat式ミク＝「版権元ガイドラインの範囲内であれば改変・流用を含む利用・再配布等オールOK」）
   preset.json の形：
     { "label":"Lat式ミク", "files":["LatMiku.pmd","tex/body.bmp", …],
       "credit":"Lat式ミク / Lat様", "motion":"faceSing", "bpm":0, "readme":"readme_lat.txt" }
   ・files は dir からの相対パス。テクスチャも全部列挙する（GitHub Pages は大文字小文字を区別）
   ・readme は規約の原文ファイル（必ず同じフォルダに置く）
   ・**軽量配布（trk190・tools/prepare-slim-web.mjs が生成）**ではモデル本体を同梱せず、同じ
     preset.json に `files:[]` ＋ `guide:[{name,url}]` を書いて **入手先のURL案内** に切り替わる。
     `engine:false` を足すと「この配布に3D部品が無い」案内も出す（slim-min）。
     案内のリンクは core.safeLink 経由＝https 以外はやたらにリンクにしない。 */
const PRESET_BASE = "assets/mmd/", PRESET_DIRS = ["lat-miku"];
let presets = [];                                    // 読めた preset.json の一覧 [{dir, man}]
let guides = [];                                     // 💠 同梱しない配布の入手案内 [{dir, man}]（trk190）
async function findPresets() {
  presets = [];                                      // 何度呼ばれても重複しない
  guides = [];
  for (const dir of PRESET_DIRS) {
    try {
      const res = await fetch(PRESET_BASE + dir + "/preset.json", { cache:"no-cache" });
      if (!res || !res.ok) continue;
      const man = await res.json();
      if (!man || !man.label) continue;
      if (Array.isArray(man.files) && man.files.length) presets.push({ dir, man });
      else if (Array.isArray(man.guide) && man.guide.length) guides.push({ dir, man });   /* trk190: 軽量配布 */
    } catch (_) { /* 無ければ出さないだけ（持ち込み式のまま） */ }
  }
  renderPresetRow();
}
function renderPresetRow() {
  const row = core.$("mmdPresetRow"), hint = core.$("mmdPresetHint");
  if (!row) return;
  row.textContent = "";
  for (const p of presets) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = tr("mmdPresetBtn", { name:p.man.label });
    b.addEventListener("click", () => {
      if (safeNow()) { status("mmdSafe"); return; }
      enqueue(() => doLoadPreset(p));
    });
    row.append(b);
  }
  /* 💠 trk190：モデル本体を同梱しない軽量配布では、入手先のURLを案内する（ボタンは出さない） */
  const showGuides = !presets.length && guides.length > 0;
  const noEngine = showGuides && guides.some(g => g.man.engine === false);
  if (showGuides) {
    for (const g of guides) {
      for (const item of (Array.isArray(g.man.guide) ? g.man.guide : [])) {
        const url = item && typeof item.url === "string" ? item.url : "";
        if (!url) continue;
        const name = String((item && item.name) || g.man.label || url).slice(0, 80);
        row.append(core.safeLink("", url, tr("mmdGuideLink", { name })));
      }
    }
  }
  row.hidden = !presets.length && !showGuides;
  if (hint) {
    hint.hidden = row.hidden;
    if (showGuides) {
      /* 案内の文章は辞書キー1つでは足りないので、data-i18n を外して自分で書く。
         言語切替では on("language") → renderPresetRow() が再度ここを通る。
         文の区切りは <br> にする（空白で連結すると日本語では不自然、英語では詰まる）。 */
      hint.removeAttribute("data-i18n");
      const lines = [noEngine ? tr("mmdNoEngine") : "", tr("mmdGuideHint"), tr("mmdGuideTerms")].filter(Boolean);
      hint.textContent = "";
      lines.forEach((line, i) => {
        if (i) hint.append(document.createElement("br"));
        hint.append(document.createTextNode(line));
      });
    } else {
      hint.dataset.i18n = "mmdPresetHint";
      hint.textContent = tr("mmdPresetHint");
    }
  }
}
async function doLoadPreset(p) {
  status("mmdLoading");
  try {
    const files = [];
    for (const name of p.man.files) {
      const path = PRESET_BASE + p.dir + "/" + String(name).split("/").map(encodeURIComponent).join("/");
      const res = await fetch(path);
      if (!res || !res.ok) throw fail("mmdPresetMissing");
      const blob = await res.blob();
      files.push(new File([blob], String(name).split("/").pop()));
    }
    if (p.man.credit) core.settings.mmdCredit = String(p.man.credit).slice(0, 120);
    await doLoadModel(files, { save:true, select:true });
    if (!model) return;                              // 失敗なら doLoadModel が理由を出している
    if (p.man.motion && BUILTIN[p.man.motion]) await applyMotion(p.man.motion, { silent:true });
    if (typeof p.man.bpm === "number") core.settings.mmdMotionBpm = Math.max(0, Math.min(300, p.man.bpm));
    core.settings.mascot = "mmd";
    core.settings.mmdQuickUI = true;
    core.saveUserPrefs(); syncUI(); renderQuick(); window.Trk.custom.updateMascotUI();
  } catch (e) {
    console.error(e);
    status(e && e.key ? e.key : "mmdLoadError");
  }
}

/* ============ 状態 ============ */
const canvas = core.$("mmdCanvas"), prev = core.$("mmdPreview"), pctx = prev && prev.getContext("2d");
let renderer = null, scene = null, camera = null, pivot = null;
let L = null, injected = null;                     // L = { THREE, ThreeMmdLoader, createMmdFileIndex }
let model = null, modelFiles = [], modelName = "", modelKey = "";
const initialMotionKind = core.settings.mmdMotionKind === "auto" || core.settings.mmdMotionKind === "none" || BUILTIN[core.settings.mmdMotionKind]
  ? core.settings.mmdMotionKind : "faceSing";
let anim = null, motionKind = initialMotionKind, motionName = "", motionDur = 0;
let frameInfo = null, fitScale = 1, lastT = 0, curKey = "", playing = false, clock = 0;

/* ---------- 3Dの部品は、必要になったときだけ（テストでは差し替えできます） ---------- */
function libs() {
  if (injected) return Promise.resolve(injected);
  if (!L) {
    L = Promise.all([import("three"), import(MMD_LIB)])
      .then(([THREE, M]) => ({ THREE, ThreeMmdLoader:M.ThreeMmdLoader, createMmdFileIndex:M.createMmdFileIndex }))
      /* trk190：3D部品が入っていない配布（slim-min）や読み込み失敗では、汎用の「モデルを読み込めません」
         ではなく理由が分かる文言にする。既に key を持つエラー（検査側が作ったもの）は上書きしない。 */
      .catch(e => { L = null; if (e && !e.key) { try { e.key = "mmdNoEngine"; } catch (_) {} } throw e; });
  }
  return L;
}

/* ---------- 画面まわり（vrm.js と同じ考え方） ---------- */
function ensureScene() {
  if (renderer && scene && camera && pivot) return true;
  const { THREE } = L;
  /* 途中で失敗した半端な状態を残さない（つぎの読み込みが壊れないように） */
  try {
    const r = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true });
    r.setClearColor(0x000000, 0);
    const sc = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
    const light = new THREE.DirectionalLight(0xffffff, 1.7);
    light.position.set(0.4, 1, 1.6).normalize(); sc.add(light);
    sc.add(new THREE.AmbientLight(0xffffff, 0.85));
    const back = new THREE.DirectionalLight(0xbfd4ff, 0.5);
    back.position.set(-0.6, 0.5, -1).normalize(); sc.add(back);
    const pv = new THREE.Group(); sc.add(pv);
    renderer = r; scene = sc; camera = cam; pivot = pv;
    return true;
  } catch (e) { console.error(e); renderer = null; scene = null; camera = null; pivot = null; return false; }
}
function measure() {
  const { THREE } = L;
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model.root);
  const h = Math.max(0.01, box.max.y - box.min.y);
  fitScale = 1.6 / h;                              // 画面のなかで 1.6 の高さに合わせる
  frameInfo = { minY:box.min.y, maxY:box.max.y, headY:box.min.y + h * 0.92 };
  applyModelTransform();
}
function applyModelTransform() {
  if (!model || !frameInfo) return;
  const sc = fitScale * (core.settings.mmdScale || 1);
  model.root.scale.setScalar(sc);
  model.root.position.y = -frameInfo.minY * sc;
  pivot.rotation.y = (core.settings.mmdTurn || 0) * DEG;
  frameCamera();
}
function frameCamera() {
  if (!frameInfo || !camera || !L) return;
  const h = Math.max(0.3, frameInfo.maxY - frameInfo.minY) * (core.settings.mmdScale || 1);
  const fh = 1.6 * (core.settings.mmdScale || 1) * 1.15, cy = fh * 0.52;
  const d = (fh / 2) / Math.tan(L.THREE.MathUtils.degToRad(camera.fov) / 2);
  camera.position.set(0, cy, d); camera.lookAt(0, cy, 0);
}
function applyRect() {
  if (!renderer || !camera) return;
  const R = mmdRect(), sc = Math.min(innerWidth / 1920, innerHeight / 1080);
  const pr = Math.min(typeof TrkLite === "object" ? TrkLite.pixelRatio(2) : 2, Math.max(0.5, (devicePixelRatio || 1) * sc));   // 🪶 軽量化は描画解像度の上限
  const key = `${R.x},${R.y},${R.w},${R.h},${pr.toFixed(2)}`;
  if (key === curKey) return;
  curKey = key;
  Object.assign(canvas.style, { left:R.x + "px", top:R.y + "px", width:R.w + "px", height:R.h + "px" });
  renderer.setPixelRatio(pr); renderer.setSize(R.w, R.h, false);
  camera.aspect = R.w / R.h; camera.updateProjectionMatrix(); frameCamera();
}
function disposeModel() {
  if (!model) return;
  try {
    pivot.remove(model.root);
    const { THREE } = L;
    model.root.traverse(o => {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of mats) { for (const k of ["map", "alphaMap", "toonMap", "gradientMap"]) if (m[k] && m[k].dispose) m[k].dispose(); if (m.dispose) m.dispose(); }
    });
    if (THREE && THREE.Cache) { /* テクスチャは上の traverse で破棄済み */ }
  } catch (e) { console.error(e); }
  model = null; frameInfo = null; modelKey = "";
}

/* ============ モデルの読み込み ============ */
function pickMain(files) {
  const models = files.filter(f => isMmdFile(f.name));
  if (!models.length) return null;
  const shaped = models.find(f => /\.pmx$/i.test(f.name)) || models[0];
  const root = shaped.webkitRelativePath ? shaped.webkitRelativePath.split("/").slice(0, -1).join("/") : "";
  /* いちばん浅い場所にある .pmx を本命にする（フォルダ直下のモデル） */
  return models.slice().sort((a, b) => {
    const da = (a.webkitRelativePath || a.name).split("/").length, db = (b.webkitRelativePath || b.name).split("/").length;
    return da - db;
  })[0] || shaped;
}
async function doLoadModel(files, { restored = false, select = true, save = true } = {}) {
  if (!files || !files.length) { status("mmdFilesEmpty"); return; }
  if (files.length > MAX_FILES) { status("mmdTooManyFiles", { n:MAX_FILES }); return; }
  const main = pickMain(files);
  if (!main) { status("mmdNotMmd"); return; }
  if (main.size > MAX_PMX) { status("mmdTooBig", { n:120, m:40 }); return; }
  status("mmdLoading");
  try {
    try { L = await libs(); } catch (_) { throw fail("mmdNetError"); }
    if (!ensureScene()) throw fail("mmdNoWebGL");
    const idx = L.createMmdFileIndex ? L.createMmdFileIndex(files) : null;
    const textureResolver = idx ? { resolve: async path => {
      const p = String(path || "").replace(/\\/g, "/");
      return idx.resolve(p) || idx.resolve(p.replace(/^\.\//, "")) || idx.resolve(p.split("/").pop()) || undefined;
    } } : undefined;
    const loader = new L.ThreeMmdLoader(textureResolver ? { textureResolver } : undefined);
    const next = await loader.loadModel(main, { outline:true });
    if (!next || !next.root) throw fail("mmdLoadError");
    if (!pivot) throw fail("mmdNoWebGL");
    disposeModel();
    model = next; modelFiles = files; modelName = String(main.name).replace(/\.(pmx|pmd)$/i, "").slice(0, 60);
    pivot.add(model.root);
    model.root.traverse(o => { o.frustumCulled = false; });
    measure();
    await applyMotion(motionKind, { silent:true, fromRestore:true });
    status(restored ? "mmdRestored" : "mmdLoaded", { name:modelName });
    if (select) selectMmdMascot();
    if (save && !restored && core.settings.mmdRemember) {
      const keep = files.filter(f => f.size < 60 * MB).slice(0, MAX_FILES);
      await mmdDB.put("model", { files:keep, main:main.name, name:modelName, savedAt:Date.now() })
        .catch(() => status("mmdSaveFail"));
    }
  } catch (e) {
    console.error(e);
    status(e && e.key ? e.key : "mmdLoadError");
  }
}
const loadModelFiles = (files, opts) => enqueue(() => doLoadModel(files, opts));

/* ============ モーション ============ */
async function applyMotion(kind, { silent = false, fromRestore = false } = {}) {
  motionKind = kind || "none";
  if (!model) return;
  try {
    if (motionKind === "none") { anim = null; motionDur = 0; motionName = ""; }
    else if (motionKind === "auto") {                 // 🎲 曲のBPMにいちばん近い🎵を選ぶ（曲がなければ👀みてる）
      autoBpmUsed = songBpm();
      autoId = pickAuto(autoBpmUsed);
      const bytes = builtinBytes(autoId);
      anim = await newAnimLoader().loadAnimation(bytes);
      motionDur = BUILTIN[autoId].seconds; motionName = "🎲 " + tr(BUILTIN[autoId].label);
    }
    else if (BUILTIN[motionKind]) {
      const bytes = builtinBytes(motionKind);
      anim = await newAnimLoader().loadAnimation(bytes);
      motionDur = BUILTIN[motionKind].seconds; motionName = tr(BUILTIN[motionKind].label);
    } else if (motionKind === "file") {
      const rec = await mmdDB.get("motion");
      const file = (motionFiles && motionFiles[0]) || (rec && rec.file);
      if (!file) { motionKind = "none"; anim = null; motionDur = 0; return; }
      if (file.size > MAX_VMD) { status("mmdTooBig", { n:120, m:40 }); return; }
      anim = await newAnimLoader().loadAnimation(file);
      const frames = (anim && anim.animation && anim.animation.metadata && anim.animation.metadata.maxFrame) || 0;
      motionDur = Math.max(0.5, frames / FPS); motionName = String(file.name).replace(/\.vmd$/i, "").slice(0, 60);
    }
    if (anim && model.setAnimation) model.setAnimation(anim);
    if (!fromRestore && motionKind !== "file") { core.settings.mmdMotionKind = motionKind; core.saveUserPrefs(); }  // 選択を記憶（次回も同じモーション）
    if (!fromRestore && !silent && motionKind === "file") status("mmdVmdLoaded", { name:motionName });
  } catch (e) {
    console.error(e);
    anim = null; motionDur = 0;
    if (motionKind === "file") { motionKind = "none"; status("mmdVmdBad"); }
  }
  renderMotionList();
}
function newAnimLoader() { return new L.ThreeMmdLoader(); }
let motionFiles = null;
async function doLoadMotion(file, { restored = false } = {}) {
  if (!file) return;
  if (!isVmdFile(file.name)) { status("mmdVmdBad"); return; }
  if (file.size > MAX_VMD) { status("mmdTooBig", { n:120, m:40 }); return; }
  if (!model) { status("mmdNoModel"); return; }
  try { L = await libs(); } catch (_) { status("mmdNetError"); return; }
  motionFiles = [file];
  await applyMotion("file", { fromRestore:restored });
  if (!restored && core.settings.mmdRemember) await mmdDB.put("motion", { file, name:file.name, savedAt:Date.now() }).catch(() => {});
  renderMotionList();
}
const loadMotionFile = (file, opts) => enqueue(() => doLoadMotion(file, opts));

/* ============ 姿勢とBPM（毎フレーム） ============ */
/* モーションの速さ：曲のBPM ÷ モーションの基準BPM。
   基準BPM（mmdBpm）が 0 のときは、内蔵モーションは自分の bpm で曲に自動シンク（持ち込みVMDは固定のまま）。
   👀 fixed:true のモーションと、🎲おまかせで選ばれた fixed は、いつも等速 */
const songBpm = () => (core.chartMeta && core.chartMeta.bpm) || 0;
function motionRate() {
  const cur = BUILTIN[motionKind === "auto" ? autoId : motionKind];
  if (cur && cur.fixed) return 1;
  const own = (cur && cur.bpm) || 0;
  const mb = core.settings.mmdMotionBpm || own, sb = songBpm();
  return (mb && sb) ? Math.min(3, Math.max(0.25, sb / mb)) : 1;
}
/* 🎲 おまかせ：曲のBPMにいちばん近い🎵（bpm持ちの内蔵）を選ぶ。曲のBPMが不明なら 👀みてる */
let autoId = "watch", autoBpmUsed = -1;
function pickAuto(bpm) {
  if (!bpm) return "watch";
  let best = MOTION_MENU_IDS.find(id => BUILTIN[id].bpm && !BUILTIN[id].fixed && BUILTIN[id].auto !== false) || "faceSing", d = Infinity;
  for (const id of MOTION_MENU_IDS) {
    const m = BUILTIN[id];
    if (!m.bpm || m.fixed || m.auto === false) continue;
    const dd = Math.abs(bpm - m.bpm);
    if (dd < d) { d = dd; best = id; }
  }
  return best;
}
function pose(time) {
  if (!model) return;
  const rate = motionRate();
  const t = motionDur ? (time * rate) % motionDur : (time * rate);
  try { model.update(t); } catch (e) { console.error(e); }
}

/* ============ 描画ループ（必要なときだけ描く） ============ */
function animate(now) {
  requestAnimationFrame(animate);
  if (model && motionKind === "auto" && songBpm() !== autoBpmUsed) {  // 🎲 曲が変わったら選びなおす（画面に出ていなくても）
    autoBpmUsed = songBpm();
    enqueue(() => applyMotion("auto", { silent:true, fromRestore:true }));
  }
  /* 🪶 軽量化：3Dマスコットの描画レートを下げる／「描画しない」ときは何も描かない */
  const mascotOff = typeof TrkLite === "object" && TrkLite.noMascot("mmd");
  playing = !!model && core.phase !== "title" && core.activeMascot() === "mmd" && !mascotOff;
  canvas.hidden = !playing;
  const panel = core.$("mmdPanel");
  const previewOn = !!model && !mascotOff && core.phase === "title" && core.screen === "settings" && !!panel && panel.open && !!prev;
  const quickOn = !!model && !mascotOff && core.phase === "title" && core.screen === "select" && core.settings.mmdQuickUI !== false && core.activeMascot() === "mmd" && !!quickPreview && !safeNow();
  if (!playing && !previewOn && !quickOn) { lastT = now; return; }
  if (typeof TrkLite === "object" && !TrkLite.mascotAllow("mmd", now)) return;
  const dt = Math.min(0.1, Math.max(0.001, (now - lastT) / 1000)); lastT = now;
  try {
    applyRect(); applyModelTransform();
    clock += dt;
    pose(clock);
    if (renderer && scene && camera) renderer.render(scene, camera);
    if (previewOn && pctx) {
      pctx.clearRect(0, 0, prev.width, prev.height);
      const a = canvas.width / canvas.height, dh = prev.height, dw = dh * a;
      pctx.drawImage(canvas, (prev.width - dw) / 2, 0, dw, dh);
    }
    if (quickOn && qpctx) {
      qpctx.clearRect(0, 0, quickPreview.width, quickPreview.height);
      const a = canvas.width / canvas.height, dh = quickPreview.height, dw = dh * a;
      qpctx.drawImage(canvas, (quickPreview.width - dw) / 2, 0, dw, dh);
    }
  } catch (e) { console.error(e); }
}
requestAnimationFrame(animate);

/* ============ 🩷 選曲画面のミニ操作（⏩速度パネルの下。裏＝設定はモデル読み込み用のまま） ============
   表のUIは4つだけ：👀ひとやすみ（BPM非依存）／🎲おまかせ／🎯えらぶ（⭐お気に入りが上に来る）／💤お留守番。
   モデルが読み込まれているときだけ出ます（設定の mmdQuickUI チェックで隠せる・?safe=1 では出ない） */
let quickPanel = null, quickSeg = null, quickPickRow = null, quickSelect = null, quickFavBtn = null, quickName = null;
let quickPreview = null, qpctx = null;
let quickPickOpen = false;                           // 🎯タップでセレクトを開いたままにする
const quickMode = () =>
  core.settings.mascot === "none" ? "off" :
  motionKind === "auto" ? "auto" :
  motionKind === "watch" ? "watch" : "pick";
function buildQuickPanel() {
  if (quickPanel || !core.$("playBtn")) return;
  quickPanel = core.el("section", "panel"); quickPanel.id = "mmdQuickPanel"; quickPanel.hidden = true;
  const head = core.el("div", "libHead"), title = core.el("h3");
  title.id = "mmdQuickTitle"; title.style.margin = "0";
  quickName = core.el("b", "mono"); head.append(title, quickName);

  const body = core.el("div", "mmdQuickBody");
  const cWrap = core.el("div", "mmdQuickCanvasWrap");
  quickPreview = document.createElement("canvas");
  quickPreview.id = "mmdQuickPreview";
  quickPreview.width = 240; quickPreview.height = 240;
  quickPreview.title = tr("mmdQuickWatch");
  quickPreview.addEventListener("click", () => {
    quickTap(motionKind === "watch" ? "auto" : "watch");
  });
  qpctx = quickPreview.getContext("2d");
  cWrap.append(quickPreview);

  const ctrl = core.el("div", "mmdQuickControls");
  quickSeg = core.el("div", "seg"); quickSeg.id = "mmdQuickSeg";
  for (const [mode, key] of [["watch", "mmdQuickWatch"], ["auto", "mmdQuickAuto"], ["pick", "mmdQuickPick"], ["off", "mmdQuickOff"]]) {
    const b = core.el("button"); b.type = "button"; b.dataset.quick = mode; b.dataset.i18n = key;
    b.addEventListener("click", () => quickTap(mode));
    quickSeg.append(b);
  }
  quickPickRow = core.el("div", "inline tight"); quickPickRow.style.marginTop = "8px";
  quickSelect = document.createElement("select"); quickSelect.id = "mmdQuickSelect"; quickSelect.style.flex = "1";
  quickSelect.addEventListener("change", () => { loadMotionKind(quickSelect.value); });
  quickFavBtn = core.el("button"); quickFavBtn.type = "button"; quickFavBtn.id = "mmdQuickFav";
  quickFavBtn.addEventListener("click", () => {
    const id = (motionKind === "auto" ? "" : motionKind);
    if (!id || !BUILTIN[id]) return;
    const favs = core.settings.mmdMotionFavs || [];
    core.settings.mmdMotionFavs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id].slice(0, 50);
    core.saveUserPrefs(); renderQuick();
  });
  quickPickRow.append(quickSelect, quickFavBtn);
  ctrl.append(quickSeg, quickPickRow);
  body.append(cWrap, ctrl);
  quickPanel.append(head, body);
  (core.$("speedPanel") || core.$("playBtn")).after(quickPanel);
}
function quickTap(mode) {
  quickPickOpen = (mode === "pick");
  if (mode === "off") { core.settings.mascot = "none"; core.saveUserPrefs(); window.Trk.custom.updateMascotUI(); syncUI(); renderQuick(); return; }
  if (core.settings.mascot !== "mmd" && model) { core.settings.mascot = "mmd"; core.saveUserPrefs(); window.Trk.custom.updateMascotUI(); syncUI(); }
  if (mode === "watch") {                           // 👀 ひとやすみ
    loadMotionKind("watch");
  } else if (mode === "auto") loadMotionKind("auto");
  /* 🎯えらぶ はセレクトを出すだけ（いまのモーションはそのまま） */
  renderQuick();
}
function renderQuick() {
  if (!quickPanel) return;
  const show = !!model && core.settings.mmdQuickUI !== false && !safeNow();
  quickPanel.hidden = !show;
  if (!show) return;
  const t = quickPanel.querySelector("#mmdQuickTitle"); if (t) t.textContent = tr("mmdQuickTitle");
  const mode = quickPickOpen ? "pick" : quickMode();
  quickSeg.querySelectorAll("button").forEach(b => {
    b.textContent = tr(b.dataset.i18n);
    const on = b.dataset.quick === mode;
    b.classList.toggle("selected", on); b.setAttribute("aria-pressed", on);
  });
  quickName.textContent = mode === "off" ? "💤" : (motionName || tr("mmdMotionNone"));
  if (quickPreview) {
    quickPreview.style.opacity = mode === "off" ? "0.35" : "1";
    if (mode === "off" && qpctx) {
      qpctx.clearRect(0, 0, quickPreview.width, quickPreview.height);
      qpctx.save();
      qpctx.fillStyle = "rgba(127,127,127,0.7)";
      qpctx.font = "bold 32px sans-serif";
      qpctx.textAlign = "center";
      qpctx.textBaseline = "middle";
      qpctx.fillText("💤", quickPreview.width / 2, quickPreview.height / 2);
      qpctx.restore();
    }
  }
  quickPickRow.hidden = mode !== "pick";
  if (mode === "pick") {
    const favs = (core.settings.mmdMotionFavs || []).filter(id => MOTION_MENU_SET.has(id) || !!BUILTIN[id]);
    quickSelect.textContent = "";
    const add = (val, text, group) => { const o = document.createElement("option"); o.value = val; o.textContent = text; (group || quickSelect).append(o); };
    if (favs.length) {
      const g = document.createElement("optgroup"); g.label = "⭐";
      for (const id of favs) {
        const label = tr(BUILTIN[id].label) + (MOTION_MENU_SET.has(id) ? "" : ` · ${tr("mmdMotionLegacy")}`);
        add(id, label, g);
      }
      quickSelect.append(g);
    }
    add("none", tr("mmdMotionNone"));
    if (BUILTIN[motionKind] && !MOTION_MENU_SET.has(motionKind) && !favs.includes(motionKind)) {
      add(motionKind, `${tr(BUILTIN[motionKind].label)} · ${tr("mmdMotionLegacy")}`);
    }
    for (const group of MOTION_GROUPS) {
      const g = document.createElement("optgroup"); g.label = tr(group.label);
      for (const id of group.ids) if (!favs.includes(id)) add(id, tr(BUILTIN[id].label), g);
      if (g.children.length) quickSelect.append(g);
    }
    if (motionKind === "file" || (anim && motionKind === "file")) add("file", "🎬 " + (motionName || "VMD"));
    quickSelect.value = (motionKind === "auto" || motionKind === "file") ? (quickSelect.querySelector(`option[value="${motionKind}"]`) ? motionKind : "none") : motionKind;
    const fav = (core.settings.mmdMotionFavs || []).includes(motionKind);
    quickFavBtn.textContent = fav ? "⭐" : "☆";
    quickFavBtn.title = tr("mmdQuickFavTip");
    quickFavBtn.disabled = !MOTION_MENU_SET.has(motionKind) && !(core.settings.mmdMotionFavs || []).includes(motionKind);
  }
}

/* ============ 画面の組み立て ============ */
/* ---------- 🔎 動作チェック（実機で「どこまで動くか」を1か所に出す） ----------
   実機で確かめるときは、設定 → 🩷 MMDマスコット → 🔎 動作チェック を押して、
   出てきた行をコピーして貼ってもらえれば、こちらで原因を切り分けられます。 */
let lastCheck = "", lastCheckObj = null;
async function diagnose() {
  const r = {
    at:new Date().toISOString().slice(0, 19).replace("T", " "),
    secure:(typeof location !== "undefined" && location.protocol === "https:"),
    online:(typeof navigator !== "undefined" ? navigator.onLine : null),
    webgl:null, gpu:"", three:"", loader:false, fileIndex:false, libError:"",
    safe:safeNow(), model:modelName || null, files:modelFiles.length,
    motion:motionKind, motionName:motionName || null, rate:motionRate(),
    canvas:(canvas ? `${canvas.width}x${canvas.height}` : "none"),
    ua:(typeof navigator !== "undefined" ? String(navigator.userAgent || "").slice(0, 96) : "")
  };
  /* ① WebGL（3Dを描けるか。ここが NG なら、モデルより先に環境の問題） */
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    r.webgl = !!gl;
    if (gl) {
      const d = gl.getExtension("WEBGL_debug_renderer_info");
      r.gpu = String(d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "(hidden)").slice(0, 72);
    }
  } catch (e) { r.webgl = false; r.libError = String((e && e.message) || e).slice(0, 120); }
  /* ② 同梱の three と three-mmd-loader を読めるか（assets/vendor） */
  try {
    const lib = await libs();
    r.three = (lib && lib.THREE && lib.THREE.REVISION) ? String(lib.THREE.REVISION) : "?";
    r.loader = !!(lib && lib.ThreeMmdLoader);
    r.fileIndex = typeof lib.createMmdFileIndex === "function";
  } catch (e) { r.libError = String((e && (e.message || e)) || "error").slice(0, 160); }
  return r;
}
function checkText(r) {
  r = r || {};
  return [
    `trk! MMD check  ${r.at || ""}`,
    `webgl=${r.webgl}${r.gpu ? " (" + r.gpu + ")" : ""}  secure=${r.secure}  online=${r.online}  safe=${r.safe}`,
    `three=${r.three || "NG"}  loader=${!!r.loader}  fileIndex=${!!r.fileIndex}`,
    r.libError ? `libError=${r.libError}` : "",
    `model=${r.model || "(none)"}  files=${r.files == null ? "-" : r.files}`,
    `motion=${r.motion || "none"}${r.motionName ? " (" + r.motionName + ")" : ""}  rate=${r.rate}`,
    `canvas=${r.canvas}`,
    `ua=${r.ua || ""}`
  ].filter(Boolean).join("\n");
}
function copyText(t) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(() => status("mmdCopied"), () => status("mmdCopyNg")); return true; }
  } catch (_) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = t; ta.style.position = "fixed"; ta.style.left = "-9999px";
    document.body.append(ta); ta.select();
    const ok = document.execCommand && document.execCommand("copy");
    ta.remove();
    status(ok ? "mmdCopied" : "mmdCopyNg");
  } catch (_) { status("mmdCopyNg"); }
  return false;
}
async function runCheck() {
  const out = core.$("mmdCheckOut");
  status("mmdCheckRunning");
  if (out) { out.hidden = false; out.textContent = tr("mmdCheckRunning"); }
  let r;
  try { r = await diagnose(); } catch (e) { r = { at:"", webgl:false, libError:String((e && e.message) || e) }; }
  lastCheckObj = r;
  lastCheck = checkText(r);
  if (out) { out.textContent = lastCheck; out.hidden = false; }
  const ok = !!(r.webgl && r.three && r.loader);
  status(ok ? "mmdCheckOk" : "mmdCheckNg");
  try { console.log("[trk! MMD check]\n" + lastCheck); } catch (_) {}
  return r;
}

function setAgreeUI() {
  const on = !!core.settings.mmdAgreed;
  for (const id of ["mmdModelFile", "mmdFolderFile", "mmdMotionFile"]) {
    const inp = core.$(id); if (inp) inp.disabled = !on;
    const lab = inp && inp.closest("label"); if (lab) lab.classList.toggle("disabled", !on);
  }
}
function selectMmdMascot() { core.settings.mascot = "mmd"; core.saveUserPrefs(); window.Trk.custom.updateMascotUI(); status("mmdSelected"); }
function renderMotionList() {
  const sel = core.$("mmdMotionSelect");
  if (!sel) return;
  const keep = motionKind;
  sel.textContent = "";
  const opt = document.createElement("option"); opt.value = "none"; opt.textContent = tr("mmdMotionNone"); sel.append(opt);
  const oa = document.createElement("option"); oa.value = "auto"; oa.textContent = tr("mmdMotionAuto"); sel.append(oa);
  if (BUILTIN[keep] && !MOTION_MENU_SET.has(keep)) {
    const old = document.createElement("option"); old.value = keep;
    old.textContent = `${tr(BUILTIN[keep].label)} · ${tr("mmdMotionLegacy")}`; old.dataset.builtin = "1"; sel.append(old);
  }
  for (const group of MOTION_GROUPS) {
    const g = document.createElement("optgroup"); g.label = tr(group.label);
    for (const id of group.ids) {
      const o = document.createElement("option"); o.value = id; o.textContent = tr(BUILTIN[id].label); o.dataset.builtin = "1"; g.append(o);
    }
    sel.append(g);
  }
  if (anim && keep === "file") { const o = document.createElement("option"); o.value = "file"; o.textContent = "🎬 " + (motionName || "VMD"); sel.append(o); }
  sel.value = (keep === "file" && !anim) ? "none" : keep;
  renderQuick();                                     // 🩷 選曲画面のミニ操作も同じタイミングで更新
}
function syncUI() {
  const box = core.$("mmdInfo");
  if (box) {
    box.textContent = "";
    const add = (k, v) => { const d = core.el("div", "", `${tr(k)}: ${v}`); box.append(d); };
    if (modelName) add("mmdModelHead", modelName);
    if (motionName) add("mmdMotionHead", motionName);
    if (!modelName && !motionName) box.append(core.el("div", "hint", tr("mmdHint")));
  }
  const size = core.$("mmdSize"), sizeVal = core.$("mmdSizeVal");
  if (size) { size.value = core.settings.mmdScale; if (sizeVal) sizeVal.textContent = Math.round(core.settings.mmdScale * 100) + "%"; }
  const turn = core.$("mmdTurn"), turnVal = core.$("mmdTurnVal");
  if (turn) { turn.value = core.settings.mmdTurn; if (turnVal) turnVal.textContent = core.settings.mmdTurn + "°"; }
  const mb = core.$("mmdBpm"); if (mb) mb.value = core.settings.mmdMotionBpm;
  const cr = core.$("mmdCredit"); if (cr && document.activeElement !== cr) cr.value = core.settings.mmdCredit || "";
  const rem = core.$("mmdRemember"); if (rem) rem.checked = core.settings.mmdRemember !== false;
  const qui = core.$("mmdQuickUI"); if (qui) qui.checked = core.settings.mmdQuickUI !== false && core.settings.mascot === "mmd";
  const ag = core.$("mmdAgree"); if (ag) ag.checked = !!core.settings.mmdAgreed;
  setAgreeUI(); renderMotionList();
}

addEventListener("DOMContentLoaded", () => {
  if (!canvas || !core.$("mmdPanel")) return;
  buildQuickPanel();                                 // 🩷 選曲画面のミニ操作（モデルが来るまで hidden）

  core.$("mmdAgree").addEventListener("change", e => {
    core.settings.mmdAgreed = !!e.target.checked; core.saveUserPrefs(); setAgreeUI();
    if (core.settings.mmdAgreed) status("mmdHint"); else status("mmdNoAgree");
  });
  core.$("mmdModelFile").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (!core.settings.mmdAgreed) { status("mmdNoAgree"); return; }
    if (!isMmdFile(f.name)) { status("mmdNotMmd"); return; }
    motionFiles = null;
    loadModelFiles([f]);
  });
  core.$("mmdFolderFile").addEventListener("change", e => {
    const files = [...(e.target.files || [])]; e.target.value = "";
    if (!core.settings.mmdAgreed) { status("mmdNoAgree"); return; }
    if (!files.length) { status("mmdFilesEmpty"); return; }
    motionFiles = null;
    loadModelFiles(files);
  });
  core.$("mmdMotionFile").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (!core.settings.mmdAgreed) { status("mmdNoAgree"); return; }
    loadMotionFile(f);
  });
  core.$("mmdMotionSelect").addEventListener("change", e => loadMotionKind(e.target.value));
  core.$("mmdClearModel").addEventListener("click", () => {
    disposeModel(); motionKind = "none"; anim = null; motionDur = 0; motionName = "";
    canvas.hidden = true; motionFiles = null;
    mmdDB.del("model").catch(() => {}); mmdDB.del("motion").catch(() => {});
    syncUI(); status("mmdClearModel");
  });
  core.$("mmdClearMotion").addEventListener("click", () => {
    motionFiles = null; motionKind = "none"; anim = null; motionDur = 0; motionName = "";
    mmdDB.del("motion").catch(() => {});
    syncUI(); status("mmdClearMotion");
  });
  core.$("mmdSize").addEventListener("input", e => { core.settings.mmdScale = Number(e.target.value) || 1; core.$("mmdSizeVal").textContent = Math.round(core.settings.mmdScale * 100) + "%"; });
  core.$("mmdSize").addEventListener("change", () => core.saveUserPrefs());
  core.$("mmdTurn").addEventListener("input", e => { core.settings.mmdTurn = Number(e.target.value) || 0; core.$("mmdTurnVal").textContent = core.settings.mmdTurn + "°"; });
  core.$("mmdTurn").addEventListener("change", () => core.saveUserPrefs());
  core.$("mmdBpm").addEventListener("change", e => { core.settings.mmdMotionBpm = Math.max(0, Math.min(300, Number(e.target.value) || 0)); core.saveUserPrefs(); });
  core.$("mmdCredit").addEventListener("input", e => { core.settings.mmdCredit = String(e.target.value).slice(0, 120); });
  core.$("mmdCredit").addEventListener("change", () => core.saveUserPrefs());
  core.$("mmdRemember").addEventListener("change", e => {
    core.settings.mmdRemember = !!e.target.checked; core.saveUserPrefs();
    if (!core.settings.mmdRemember) { mmdDB.del("model").catch(() => {}); mmdDB.del("motion").catch(() => {}); }
  });

  const qui = core.$("mmdQuickUI");
  if (qui) qui.addEventListener("change", async e => {
    const on = !!e.target.checked;
    core.settings.mmdQuickUI = on;
    if (on) {
      if (!model && presets.length) {
        await doLoadPreset(presets[0]);
        return;
      }
      if (model) {
        core.settings.mascot = "mmd";
        window.Trk.custom.updateMascotUI();
      }
    } else {
      if (core.settings.mascot === "mmd") {
        core.settings.mascot = "none";
        window.Trk.custom.updateMascotUI();
      }
    }
    core.saveUserPrefs();
    syncUI();
    renderQuick();
  });

  core.$("mmdCheckBtn").addEventListener("click", () => { enqueue(runCheck); });
  core.$("mmdCopyBtn").addEventListener("click", () => {
    if (!lastCheck) { enqueue(async () => { await runCheck(); copyText(lastCheck); }); return; }
    copyText(lastCheck);
  });

  on("language", () => { syncUI(); renderPresetRow(); renderQuick(); });

  /* 前回のモデルを戻す（覚える設定のときだけ・セーフモードでは何もしない）。
     🪶 軽量化で「起動時に自動で読み込まない」がオンのあいだは、ここでは読みません。
     そのかわり、下の3つのどれかで読みに行きます＝①MMDをマスコットに選んだ ②この欄を開いた
     ③端末の判定し直しなどで軽量化が外れた。ファイルで直接選んだ読み込みはいつもどおりです */
  function restoreRemembered() {
    if (model || !core.settings.mmdRemember || safeNow()) return;
    if (typeof TrkLite === "object" && TrkLite.mascotNoLoad && TrkLite.mascotNoLoad()) return;
    enqueue(async () => {
      if (model) return;
      try {
        const rec = await mmdDB.get("model");
        if (rec && rec.files && rec.files.length) {
          core.settings.mmdAgreed = true; syncUI();
          const keep = core.settings.mmdMotionKind;                           // 記憶したモーション（none/auto/内蔵）
          if (keep && (keep === "auto" || BUILTIN[keep])) motionKind = keep;
          await doLoadModel(rec.files, { restored:true, select:false, save:false });
          const m = await mmdDB.get("motion");
          if (m && m.file) await doLoadMotion(m.file, { restored:true });
        }
      } catch (_) {}
    });
  }
  syncUI();
  if (safeNow()) { status("mmdSafe"); return; }
  enqueue(findPresets);                              // 💠 同梱モデルがあればボタンを出す（無ければ何もしない）
  restoreRemembered();
  on("lite", () => restoreRemembered());            // 🪶 軽量化の設定を変えたら、その場で読み直す
  on("mascot", () => { if (core.activeMascot() === "mmd") restoreRemembered(); });
  core.$("mmdPanel").addEventListener("toggle", () => { if (core.$("mmdPanel").open) restoreRemembered(); });
});

function loadMotionKind(kind) {
  if (kind === "file" && !motionFiles) {
    const rec = mmdDB.get("motion").catch(() => null);
    enqueue(async () => { const r = await rec; if (r && r.file) { motionFiles = [r.file]; await applyMotion("file"); } else { renderMotionList(); } });
    return;
  }
  enqueue(() => applyMotion(kind));
}

/* ============ 窓口（テスト・コンソールから） ============ */
window.TrkMMD = {
  version: 1,
  lib: MMD_LIB,
  key: "shadow_taiko_mmd",
  /* テスト用：3Dの部品を差し替える（本番では使いません） */
  _injectLibs(fake) { injected = fake; L = fake; },
  _builtin: id => builtinBytes(id),
  _sjis: (s, n) => Array.from(sjisFix(s, n)),
  builtins: () => Object.keys(BUILTIN),
  visibleMotions: () => MOTION_MENU_IDS.slice(),
  motionGroups: () => MOTION_GROUPS.map(group => ({ label:group.label, ids:group.ids.slice() })),
  motions: () => Object.entries(BUILTIN).map(([id, m]) => ({ id, bpm:m.bpm, seconds:m.seconds, visible:MOTION_MENU_SET.has(id), hasMorphs:typeof m.morphs === "function" })),
  presets: () => presets.map(p => ({ dir:p.dir, label:p.man.label })),
  findPresets: () => enqueue(findPresets),
  loadPreset: dir => { const p = presets.find(x => x.dir === dir); if (p) enqueue(() => doLoadPreset(p)); },
  model: () => model ? { name:modelName, files:modelFiles.length } : null,
  motion: () => ({ kind:motionKind, name:motionName, duration:motionDur, anim:!!anim }),
  setMotion: kind => loadMotionKind(kind),
  loadModel: files => loadModelFiles(Array.isArray(files) ? files : [files]),
  loadMotion: file => loadMotionFile(file),
  clear: () => { disposeModel(); anim = null; motionKind = "none"; motionDur = 0; motionName = ""; canvas.hidden = true; },
  select: selectMmdMascot,
  diagnose: () => diagnose(),
  check: () => runCheck(),
  checkText: r => checkText(r || lastCheckObj),
  lastCheck: () => lastCheck,
  quickMode: () => quickMode(),
  isPlaying: () => playing,
  clock: () => clock,
  rate: motionRate,
  info: () => ({ model:modelName, motion:motionName, kind:motionKind, dur:motionDur, scale:core.settings.mmdScale, turn:core.settings.mmdTurn, agreed:!!core.settings.mmdAgreed })
};
})();
/* ✅ mmd.js 完了 */
