// SPDX-License-Identifier: GPL-3.0-or-later
/* ============================================================================
   trk! media-player-mode.js — ▶ メディアプレーヤーモード
   TVの電源ボタンを長押しして、ゲームを始めずに曲を聴くための画面を開く。
   音源は既存の video 要素を使い、曲ファイルは端末内から出ない。
   ============================================================================ */
"use strict";
(() => {
  const core = window.Trk.core;

Object.assign(TEXT.ja, {
  mediaOpenBtn:"🎥 基地", mediaOpenBtnHint:"メディアプレーヤーを開きます（音楽・動画の再生）",
  tvMediaHoldHint:"電源長押しでメディアプレーヤー",
  dockCastPolicy:"キャストアンテナ", dockCastOff:"キャストしない（キャストアンテナを隠す）", dockCastAntenna:"キャストアンテナを表示", dockCastHint:"キャストアンテナはバックグラウンド再生のアンテナと別々に表示/非表示できます。ここで消しても、曲の再生用のアンテナは消えません。自動接続はせず、クリックしたときだけ対応ブラウザーの選択画面を開きます。", dockCastUnsupported:"このブラウザは外部出力選択に対応していません。", dockCastOn:"📡 キャスト先の選択を開きました", dockCastOffDone:"📡 キャストを切断しました", dockCastFailed:"外部出力を開始できませんでした。", dockCastButton:"キャスト", dockBackgroundPolicy:"バックグラウンド再生アンテナ", dockBackgroundOff:"表示しない（バックグラウンド再生なし）", dockBackgroundAntenna:"ドックにアンテナを表示", dockBackgroundCorner:"右上に置く（言語の左・コンパクト）", dockBackgroundHint:"キャストとは別に、バックグラウンド再生だけを許可します。「ドックにアンテナを表示」か「右上に置く」のときONにすると、裏にしても再生を続けます。",
  mediaTitle:"▶ メディアプレーヤー",
  mediaSubtitle:"ゲームを始めずに、曲を聴くための再生画面です。曲送り・リピート・シャッフル・速度・スリープタイマーを使えます。",
  mediaClose:"← 曲リストに戻る", mediaNoTrack:"曲を選ぶと、ここでフル再生できます。",
  mediaNow:"再生中", mediaPaused:"一時停止", mediaEnded:"再生終了",
  mediaPrev:"前の曲", mediaNext:"次の曲", mediaPlay:"再生", mediaPause:"一時停止", mediaRestart:"最初から",
  mediaVolume:"音量", mediaMute:"ミュート", mediaUnmute:"ミュート解除", mediaSeek:"再生位置",
  mediaShuffle:"シャッフル", mediaRepeat:"リピート", mediaRepeatOff:"なし", mediaRepeatOne:"1曲", mediaRepeatAll:"全曲",
  mediaRate:"再生速度", mediaSleep:"スリープタイマー", mediaSleepOff:"なし", mediaSleep15:"15分", mediaSleep30:"30分", mediaSleep60:"60分",
  mediaQueue:"再生キュー", mediaQueueHint:"曲を選ぶと、この画面を閉じずに再生します。曲リストに追加した音源・共有フォルダ・曲パックをまとめて扱えます。",
  mediaSearch:"キューを検索…", mediaNoSongs:"まだ曲がありません。選曲画面から音源を追加してください。", mediaNoMatch:"一致する曲がありません。",
  mediaSleepSet:"{n}分後に再生を止めます。", mediaSleepDone:"スリープタイマーで停止しました。", mediaLoaded:"読み込み中…", mediaLoadFailed:"この曲を読み込めませんでした。",
  mediaKeyboard:"Space：再生／一時停止　←→：10秒　N：次の曲　P：前の曲　Esc：閉じる　逆再生・区間ループ・壁紙は設定で割り当て",
  mediaVideoKeysTitle:"🎬 動画プレーヤーのキー", mediaWallKey:"壁紙／スクリーンセーバー", mediaReverse:"逆再生", mediaReverseStart:"逆再生を開始", mediaForward:"順再生に戻す", mediaReverseLoading:"逆再生を準備中…", mediaReverseUnavailable:"この曲の逆再生用音声を準備できませんでした。映像のみで試します。", mediaReverseDone:"曲の先頭まで逆再生しました。",
  mediaLoop:"区間ループ", mediaLoopSetA:"A点を設定", mediaLoopSetB:"B点を設定", mediaLoopClear:"解除", mediaLoopMode:"区間ループの操作", mediaLoopToggle:"トグル", mediaLoopHold:"長押し中だけ", mediaLoopHint:"A点・B点を設定すると、範囲をくり返します。割り当てキーはA点 → B点／開始 → 解除を順に操作できます。", mediaLoopNone:"区間ループ：なし", mediaLoopOnlyA:"A点 {a} — B点を設定してください", mediaLoopRange:"{a} – {b} をくり返し中", mediaLoopNeedRange:"先にA点とB点を設定してください。", mediaLoopLabTitle:"🎛 ループ・ラボ", mediaLoopQuickHint:"5秒・10秒・20秒の区間をすぐ作れます。保存した区間は曲ごとに端末内へ記録します。", mediaLoopQuick5:"5秒", mediaLoopQuick10:"10秒", mediaLoopQuick20:"20秒", mediaLoopRandom:"🎲 ランダム区間", mediaLoopSave:"この区間を保存", mediaLoopPresets:"保存した区間", mediaLoopNoPresets:"保存した区間はまだありません。", mediaLoopDelete:"この区間を削除", mediaLoopClearPresets:"保存を消去", mediaLoopSaved:"区間を保存しました",
  mediaClipExport:"🎬 映像で書き出す", mediaClipBusy:"🎬 書き出し中…（区間の長さのぶん待ちます）", mediaClipDone:"🎬 書き出しました", mediaClipFailed:"書き出せませんでした", mediaClipNoVideo:"映像のない曲は書き出せません（音声だけの曲）", mediaClipUnsupported:"このブラウザでは映像の書き出しに対応していません", mediaClipNeedMedia:"先に曲を読み込んでください",
  mediaWall:"壁紙／スクリーンセーバー", mediaWallShow:"壁紙を表示", mediaWallHide:"壁紙を閉じる", mediaWallHint:"人目を避けたいときに動画を壁紙で隠します。ESCまたは同じキーで戻れます。", mediaWallStyle:"壁紙", mediaWallMidnight:"ミッドナイト", mediaWallAurora:"オーロラ", mediaWallPaper:"紙", mediaWallCustom:"アップロード画像", mediaWallUpload:"画像を選ぶ", mediaWallUploadHint:"画像はこのセッションの端末内だけで使います。外部へ送信しません。", mediaWallResetImage:"アップロード画像を外す", mediaWallNoImage:"画像を選ぶとここに表示します。", mediaWallClock:"時計を表示", mediaWallPlayback:"壁紙中の動画", mediaWallStopVideo:"動画を止める", mediaWallContinueVideo:"動画を続ける", mediaWallTrigger:"壁紙キーの操作", mediaWallToggle:"トグル", mediaWallHold:"長押し中だけ",
  mediaVideoMax:"全画面で表示", mediaVideoMaxClose:"全画面を閉じる",
  mediaVideoZoomIn:"動画を拡大", mediaVideoZoomOut:"動画を縮小", mediaVideoFaster:"再生速度を上げる", mediaVideoSlower:"再生速度を下げる", mediaVideoPause:"再生／一時停止",
  mediaVideoKeysHint:"メディアプレーヤー中の動画操作、逆再生、区間ループと、ゲーム中の背景動画の拡大・縮小をキーに割り当てます。ゲームの判定や記録は変わりません。",
  mediaVideoKeysReset:"↺ 動画キーを初期値に戻す", mediaVideoCapture0:"「動画を拡大」に割り当てるキーを押してください。ESCでキャンセル。", mediaVideoCapture1:"「動画を縮小」に割り当てるキーを押してください。ESCでキャンセル。", mediaVideoCapture2:"「再生速度を上げる」に割り当てるキーを押してください。ESCでキャンセル。", mediaVideoCapture3:"「再生速度を下げる」に割り当てるキーを押してください。ESCでキャンセル。", mediaVideoCapture4:"「再生／一時停止」に割り当てるキーを押してください。ESCでキャンセル。", mediaVideoCapture5:"「逆再生」に割り当てるキーを押してください。ESCでキャンセル。", mediaVideoCapture6:"「区間ループ」に割り当てるキーを押してください。ESCでキャンセル。", mediaVideoCapture7:"「壁紙／スクリーンセーバー」に割り当てるキーを押してください。ESCでキャンセル。",
  mediaVideoToastZoom:"動画ズーム {n}x", mediaVideoToastRate:"再生速度 {n}x",
  mediaPip:"📌 画中画", mediaPipClose:"📌 画中画を終了", mediaPipUnsupported:"このブラウザは画中画に対応していません",
  mediaResumeRewind:"⏪ 再開時の巻き戻し", mediaResumeOff:"オフ", mediaResumeSet:"再開時に{s}秒巻き戻します",
  mediaSleepTrack:"💤 この曲の終わり", mediaSleepTrackSet:"この曲の終わりで再生を止めます",
  mediaWakeLockTitle:"🔆 画面を消灯させない", mediaWakeLockHint:"動画の再生中に画面が暗くなるのを防ぎます（音声だけの再生では防ぎません）。対応していないブラウザでは何もしません。", mediaWakeLockToggle:"動画の再生中は画面をつけたままにする",
  mediaWaveTitle:"🌊 波形シークバー", mediaWaveHint:"シークバーに音量の包絡（波形）を描きます。ポインターを乗せると、その位置の時刻が出ます。材料は端末内の解析結果（trk_analysis_cache_v1）だけ＝解析が無い曲（長い曲・軽量化設定など）ではふつうのバーのままです。", mediaWaveToggle:"シークバーに波形を表示する",
  mediaLyricsTitle:"🎤 歌詞", mediaLyricsHint:"埋め込み歌詞（ID3 USLT/SYLT・MP4 ©lyr・FLAC/Ogg LYRICS）・フォルダの同名 .lrc・選んだ歌詞ファイルを、再生位置に合わせて表示します。同期歌詞は行をクリックするとその位置へ移動します。選んだ歌詞は曲ごとに端末内へ保存され、外へは送信しません。", mediaLyricsNone:"この曲の歌詞は見つかりませんでした。", mediaLyricsLoading:"歌詞を読み込み中…", mediaLyricsSourceEmbedded:"出典：埋め込みタグ", mediaLyricsSourceFile:"出典：フォルダの .lrc（{name}）", mediaLyricsSourceManual:"出典：選んだファイル（{name}）", mediaLyricsPlain:"※ 時刻のない歌詞なので、そのまま表示します", mediaLyricsChoose:"📄 歌詞ファイルを選ぶ", mediaLyricsClear:"✖ 選んだ歌詞を消す", mediaLyricsSaved:"歌詞をこの曲に保存しました（{n}行）", mediaLyricsTooBig:"この歌詞ファイルは大きすぎます（256KBまで）。", mediaLyricsReadFailed:"この歌詞ファイルは読めませんでした。", mediaLyricsNeedSong:"先に曲を再生してください。",
  mediaSubsTitle:"💬 字幕", mediaSubsHint:"選んだ SRT/VTT ファイルか、フォルダの同名 .srt/.vtt を動画の上に表示します。表示の遅れ・早すぎは「遅延」で調整できます。選んだ字幕と遅延は曲ごとに端末内へ保存され、外へは送信しません。📌 画中画でも字幕が付きます。", mediaSubsNone:"この動画の字幕は見つかりませんでした。", mediaSubsLoading:"字幕を読み込み中…", mediaSubsSourceFile:"出典：フォルダの字幕（{name}）", mediaSubsSourceManual:"出典：選んだファイル（{name}）", mediaSubsChoose:"📄 字幕ファイルを選ぶ", mediaSubsClear:"✖ 選んだ字幕を消す", mediaSubsSaved:"字幕をこの曲に保存しました（{n}件）", mediaSubsTooBig:"この字幕ファイルは大きすぎます（512KBまで）。", mediaSubsReadFailed:"この字幕ファイルは読めませんでした。", mediaSubsNeedSong:"先に動画を再生してください。", mediaSubsOn:"字幕を表示する", mediaSubsOffset:"遅延", mediaSubsEarlier:"− 早く", mediaSubsLater:"＋ 遅く", mediaSubsReset:"↺ 0", mediaSubsOffsetNow:"いま：{s}秒",
  mediaChapTitle:"🔖 チャプター", mediaChapHint:"M4B/MP4 等に埋め込まれたチャプター（chpl）の一覧です。クリックでその位置へ移動します。チャプターは読むだけで、ファイルへの書き戻しや外部への送信はしません。iTunes方式のチャプタートラックは対応していません。", mediaChapNone:"チャプターは見つかりませんでした。", mediaChapLoading:"チャプターを読み込み中…", mediaChapCount:"チャプター {n} 件", mediaChapNow:"▶ {name}", mediaChapPrev:"⏮ 前のチャプター", mediaChapNext:"次のチャプター ⏭", mediaSleepChapter:"チャプターの終わりで止める", mediaSleepChapterSet:"チャプターの終わりで止めます（{m}）", mediaSleepChapterNone:"この曲にチャプターがありません。",
  mediaModeStatus:"メディアプレーヤー中（ゲームの記録には影響しません）"
});
Object.assign(TEXT.en, {
  mediaOpenBtn:"🎥 Base", mediaOpenBtnHint:"Open the media player for music and video",
  tvMediaHoldHint:"Long-press power for media player",
  dockCastPolicy:"Cast antenna", dockCastOff:"Don't cast (hide the cast antenna)", dockCastAntenna:"Show the cast antenna", dockCastHint:"The cast antenna is toggled separately from the background playback antenna — hiding it never hides the playback one. It never auto-connects; clicking it opens the picker on supported browsers only.", dockCastUnsupported:"This browser doesn't support the external playback picker.", dockCastOn:"📡 Opened the cast picker", dockCastOffDone:"📡 Cast disconnected", dockCastFailed:"Couldn't start external playback.", dockCastButton:"Cast", dockBackgroundPolicy:"Background playback antenna", dockBackgroundOff:"Hide (no background playback)", dockBackgroundAntenna:"Show on the dock", dockBackgroundCorner:"Top-right (left of Language, compact)", dockBackgroundHint:"Background playback can be allowed separately from casting. With \"Show on the dock\" or \"Top-right\", turning it on keeps playing in the background.",
  mediaTitle:"▶ Media player",
  mediaSubtitle:"Listen without starting a game. Use track controls, repeat, shuffle, playback speed, and a sleep timer.",
  mediaClose:"← Back to song list", mediaNoTrack:"Choose a song to play it here in full.",
  mediaNow:"Playing", mediaPaused:"Paused", mediaEnded:"Finished",
  mediaPrev:"Previous", mediaNext:"Next", mediaPlay:"Play", mediaPause:"Pause", mediaRestart:"Restart",
  mediaVolume:"Volume", mediaMute:"Mute", mediaUnmute:"Unmute", mediaSeek:"Position",
  mediaShuffle:"Shuffle", mediaRepeat:"Repeat", mediaRepeatOff:"Off", mediaRepeatOne:"One", mediaRepeatAll:"All",
  mediaRate:"Playback speed", mediaSleep:"Sleep timer", mediaSleepOff:"Off", mediaSleep15:"15 min", mediaSleep30:"30 min", mediaSleep60:"60 min",
  mediaQueue:"Queue", mediaQueueHint:"Choose a track to play it without closing this screen. Added files, shared folders, and song packs appear together.",
  mediaSearch:"Search queue…", mediaNoSongs:"No songs yet. Add audio from song select.", mediaNoMatch:"No matching songs.",
  mediaSleepSet:"Playback will stop in {n} minutes.", mediaSleepDone:"Sleep timer stopped playback.", mediaLoaded:"Loading…", mediaLoadFailed:"This track could not be loaded.",
  mediaKeyboard:"Space: play/pause   ←→: 10 seconds   N: next   P: previous   Esc: close   Assign reverse / A-B loop / wallpaper in Settings",
  mediaVideoKeysTitle:"🎬 Video player keys", mediaWallKey:"Wallpaper / screen saver", mediaReverse:"Reverse", mediaReverseStart:"Start reverse", mediaForward:"Return to forward", mediaReverseLoading:"Preparing reverse playback…", mediaReverseUnavailable:"Could not prepare reverse audio for this track. Trying video frames only.", mediaReverseDone:"Reverse playback reached the beginning.",
  mediaLoop:"A-B loop", mediaLoopSetA:"Set A", mediaLoopSetB:"Set B", mediaLoopClear:"Clear", mediaLoopMode:"A-B loop control", mediaLoopToggle:"Toggle", mediaLoopHold:"While held", mediaLoopHint:"Set A and B to repeat a range. The assigned key cycles A → B / start → clear.", mediaLoopNone:"A-B loop: off", mediaLoopOnlyA:"A at {a} — set B", mediaLoopRange:"Repeating {a} – {b}", mediaLoopNeedRange:"Set both A and B first.", mediaLoopLabTitle:"🎛 Loop lab", mediaLoopQuickHint:"Make a 5, 10, or 20 second loop instantly. Saved ranges stay on this device per song.", mediaLoopQuick5:"5 sec", mediaLoopQuick10:"10 sec", mediaLoopQuick20:"20 sec", mediaLoopRandom:"🎲 Random range", mediaLoopSave:"Save this range", mediaLoopPresets:"Saved ranges", mediaLoopNoPresets:"No saved ranges yet.", mediaLoopDelete:"Delete this range", mediaLoopClearPresets:"Clear saved", mediaLoopSaved:"Range saved",
  mediaClipExport:"🎬 Export as video", mediaClipBusy:"🎬 Exporting… (takes as long as the section)", mediaClipDone:"🎬 Exported", mediaClipFailed:"Could not export", mediaClipNoVideo:"Audio-only songs can't be exported as video", mediaClipUnsupported:"This browser can't export video", mediaClipNeedMedia:"Load a song first",
  mediaWall:"Wallpaper / screen saver", mediaWallShow:"Show wallpaper", mediaWallHide:"Close wallpaper", mediaWallHint:"Hide the video behind a wallpaper when you need privacy. Press ESC or the same key to return.", mediaWallStyle:"Wallpaper", mediaWallMidnight:"Midnight", mediaWallAurora:"Aurora", mediaWallPaper:"Paper", mediaWallCustom:"Uploaded image", mediaWallUpload:"Choose image", mediaWallUploadHint:"The image stays on this device for this session and is never uploaded.", mediaWallResetImage:"Remove uploaded image", mediaWallNoImage:"Choose an image to show it here.", mediaWallClock:"Show clock", mediaWallPlayback:"Video while wallpaper is shown", mediaWallStopVideo:"Stop video", mediaWallContinueVideo:"Keep video playing", mediaWallTrigger:"Wallpaper key behavior", mediaWallToggle:"Toggle", mediaWallHold:"While held",
  mediaVideoMax:"Full screen", mediaVideoMaxClose:"Close full screen",
  mediaVideoZoomIn:"Zoom in", mediaVideoZoomOut:"Zoom out", mediaVideoFaster:"Speed up", mediaVideoSlower:"Slow down", mediaVideoPause:"Play / pause",
  mediaVideoKeysHint:"Assign keys for video zoom, reverse playback, A-B looping, and media-player controls. Game judgment and records are not changed.",
  mediaVideoKeysReset:"↺ Reset video keys", mediaVideoCapture0:"Press a key for “Zoom in”. ESC cancels.", mediaVideoCapture1:"Press a key for “Zoom out”. ESC cancels.", mediaVideoCapture2:"Press a key for “Speed up”. ESC cancels.", mediaVideoCapture3:"Press a key for “Slow down”. ESC cancels.", mediaVideoCapture4:"Press a key for “Play / pause”. ESC cancels.", mediaVideoCapture5:"Press a key for “Reverse”. ESC cancels.", mediaVideoCapture6:"Press a key for “A-B loop”. ESC cancels.", mediaVideoCapture7:"Press a key for “Wallpaper / screen saver”. ESC cancels.",
  mediaVideoToastZoom:"Video zoom {n}x", mediaVideoToastRate:"Playback speed {n}x",
  mediaPip:"📌 Picture-in-picture", mediaPipClose:"📌 Exit picture-in-picture", mediaPipUnsupported:"This browser doesn't support picture-in-picture",
  mediaResumeRewind:"⏪ Resume rewind", mediaResumeOff:"Off", mediaResumeSet:"Resume rewind: {s}s",
  mediaSleepTrack:"💤 End of this track", mediaSleepTrackSet:"Playback will stop when this track ends",
  mediaWakeLockTitle:"🔆 Keep screen on", mediaWakeLockHint:"Prevents the screen from dimming while a video plays (audio-only playback won't). Does nothing on browsers without support.", mediaWakeLockToggle:"Keep the screen on while a video plays",
  mediaWaveTitle:"🌊 Waveform seek bar", mediaWaveHint:"Draws the loudness envelope (waveform) on the seek bar and shows the time at the pointer. The material is the on-device analysis cache only — songs without analysis (long tracks, lite settings) keep the plain bar.", mediaWaveToggle:"Show the waveform on the seek bar",
  mediaLyricsTitle:"🎤 Lyrics", mediaLyricsHint:"Shows embedded lyrics (ID3 USLT/SYLT, MP4 ©lyr, FLAC/Ogg LYRICS), a same-named .lrc from the folder, or a file you choose, in sync with playback. With synced lyrics, click a line to jump there. Chosen lyrics are saved on this device per song and never uploaded.", mediaLyricsNone:"No lyrics found for this song.", mediaLyricsLoading:"Loading lyrics…", mediaLyricsSourceEmbedded:"Source: embedded tags", mediaLyricsSourceFile:"Source: folder .lrc ({name})", mediaLyricsSourceManual:"Source: chosen file ({name})", mediaLyricsPlain:"· not time-synced (shown as-is)", mediaLyricsChoose:"📄 Choose lyrics file", mediaLyricsClear:"✖ Remove chosen lyrics", mediaLyricsSaved:"Lyrics saved for this song ({n} lines)", mediaLyricsTooBig:"That lyrics file is too big (up to 256 KB).", mediaLyricsReadFailed:"Could not read that lyrics file.", mediaLyricsNeedSong:"Load a song first.",
  mediaSubsTitle:"💬 Subtitles", mediaSubsHint:"Shows an SRT/VTT file you choose, or a same-named .srt/.vtt from the folder, over the video. Adjust timing with “Delay”. Chosen subtitles and the delay are saved on this device per song and never uploaded. Subtitles also appear in picture-in-picture.", mediaSubsNone:"No subtitles found for this video.", mediaSubsLoading:"Loading subtitles…", mediaSubsSourceFile:"Source: folder subtitle ({name})", mediaSubsSourceManual:"Source: chosen file ({name})", mediaSubsChoose:"📄 Choose subtitle file", mediaSubsClear:"✖ Remove chosen subtitles", mediaSubsSaved:"Subtitles saved for this song ({n} cues)", mediaSubsTooBig:"That subtitle file is too big (up to 512 KB).", mediaSubsReadFailed:"Could not read that subtitle file.", mediaSubsNeedSong:"Load a video first.", mediaSubsOn:"Show subtitles", mediaSubsOffset:"Delay", mediaSubsEarlier:"− Earlier", mediaSubsLater:"＋ Later", mediaSubsReset:"↺ 0", mediaSubsOffsetNow:"Now: {s}s",
  mediaChapTitle:"🔖 Chapters", mediaChapHint:"Lists the chapters (chpl) embedded in M4B/MP4 files; click one to jump there. Chapters are read-only — no write-back, no upload. iTunes-style chapter tracks are not supported.", mediaChapNone:"No chapters found.", mediaChapLoading:"Loading chapters…", mediaChapCount:"{n} chapters", mediaChapNow:"▶ {name}", mediaChapPrev:"⏮ Previous chapter", mediaChapNext:"Next chapter ⏭", mediaSleepChapter:"Stop at the end of the chapter", mediaSleepChapterSet:"Will stop at the end of the chapter ({m})", mediaSleepChapterNone:"This song has no chapters.",
  mediaModeStatus:"Media player (does not affect game records)"
});
Object.assign(TEXT.zh, {
  mediaOpenBtn:"🎥 基地", mediaOpenBtnHint:"打开媒体播放器（音乐和视频）",
  tvMediaHoldHint:"长按电源打开媒体播放器",
  dockCastPolicy:"投放天线", dockCastOff:"不投放（隐藏投放天线）", dockCastAntenna:"显示投放天线", dockCastHint:"投放天线与后台播放的天线分别开关，在这里隐藏也不会隐藏播放用的天线。不会自动连接，只在点击时于支持的浏览器打开选择画面。", dockCastUnsupported:"此浏览器不支持外部输出选择。", dockCastOn:"📡 已打开投放选择", dockCastOffDone:"📡 已断开投放", dockCastFailed:"无法开始外部输出。", dockCastButton:"投放", dockBackgroundPolicy:"后台播放天线", dockBackgroundOff:"不显示（无后台播放）", dockBackgroundAntenna:"在机台上显示天线", dockBackgroundCorner:"放到右上角（语言左侧·紧凑）", dockBackgroundHint:"可以与投放分开，只允许后台播放。选择「在机台上显示」或「放到右上角」并开启后，切到后台也会继续播放。",
  mediaTitle:"▶ 媒体播放器", mediaSubtitle:"不开始游戏也能听歌。支持切歌、循环、随机、播放速度和睡眠定时器。",
  mediaClose:"← 返回歌曲列表", mediaNoTrack:"选择歌曲后，就能在这里完整播放。", mediaNow:"正在播放", mediaPaused:"已暂停", mediaEnded:"播放结束",
  mediaPrev:"上一首", mediaNext:"下一首", mediaPlay:"播放", mediaPause:"暂停", mediaRestart:"从头播放",
  mediaVolume:"音量", mediaMute:"静音", mediaUnmute:"取消静音", mediaSeek:"播放位置",
  mediaShuffle:"随机", mediaRepeat:"循环", mediaRepeatOff:"关闭", mediaRepeatOne:"单曲", mediaRepeatAll:"全部",
  mediaRate:"播放速度", mediaSleep:"睡眠定时", mediaSleepOff:"关闭", mediaSleep15:"15分钟", mediaSleep30:"30分钟", mediaSleep60:"60分钟",
  mediaQueue:"播放队列", mediaQueueHint:"选择歌曲后会在此画面中播放。添加的文件、共享文件夹和歌曲包会合并显示。",
  mediaSearch:"搜索队列…", mediaNoSongs:"还没有歌曲。请先在选曲画面添加音频。", mediaNoMatch:"没有匹配的歌曲。",
  mediaSleepSet:"将在{n}分钟后停止播放。", mediaSleepDone:"睡眠定时器已停止播放。", mediaLoaded:"正在读取…", mediaLoadFailed:"无法读取这首歌。",
  mediaKeyboard:"空格：播放／暂停　←→：10秒　N：下一首　P：上一首　Esc：关闭　倒放／区间循环／壁纸可在设置中分配",
  mediaVideoKeysTitle:"🎬 视频播放器按键", mediaWallKey:"壁纸／屏幕保护", mediaReverse:"倒放", mediaReverseStart:"开始倒放", mediaForward:"恢复正放", mediaReverseLoading:"正在准备倒放…", mediaReverseUnavailable:"无法准备这首歌的倒放音频，将尝试仅倒放画面。", mediaReverseDone:"倒放已到达开头。",
  mediaLoop:"区间循环", mediaLoopSetA:"设为A点", mediaLoopSetB:"设为B点", mediaLoopClear:"解除", mediaLoopMode:"区间循环操作", mediaLoopToggle:"切换", mediaLoopHold:"按住时循环", mediaLoopHint:"设置A点和B点后重复区间。分配的按键会依次执行A点 → B点／开始 → 解除。", mediaLoopNone:"区间循环：关闭", mediaLoopOnlyA:"A点 {a} — 请设置B点", mediaLoopRange:"重复 {a} – {b}", mediaLoopNeedRange:"请先设置A点和B点。", mediaLoopLabTitle:"🎛 循环实验室", mediaLoopQuickHint:"可立即创建5秒、10秒或20秒区间。保存的区间会按歌曲保存在设备中。", mediaLoopQuick5:"5秒", mediaLoopQuick10:"10秒", mediaLoopQuick20:"20秒", mediaLoopRandom:"🎲 随机区间", mediaLoopSave:"保存此区间", mediaLoopPresets:"已保存区间", mediaLoopNoPresets:"还没有保存的区间。", mediaLoopDelete:"删除此区间", mediaLoopClearPresets:"清除保存", mediaLoopSaved:"区间已保存",
  mediaClipExport:"🎬 导出为视频", mediaClipBusy:"🎬 导出中…（需要等待区间的时长）", mediaClipDone:"🎬 已导出", mediaClipFailed:"无法导出", mediaClipNoVideo:"纯音频曲目无法导出为视频", mediaClipUnsupported:"此浏览器不支持导出视频", mediaClipNeedMedia:"请先载入曲目",
  mediaWall:"壁纸／屏幕保护", mediaWallShow:"显示壁纸", mediaWallHide:"关闭壁纸", mediaWallHint:"需要隐私时，用壁纸遮住视频。按ESC或同一个按键返回。", mediaWallStyle:"壁纸", mediaWallMidnight:"午夜", mediaWallAurora:"极光", mediaWallPaper:"纸张", mediaWallCustom:"上传的图片", mediaWallUpload:"选择图片", mediaWallUploadHint:"图片仅在本次会话中保留在设备上，不会上传到外部。", mediaWallResetImage:"移除上传图片", mediaWallNoImage:"选择图片后会显示在这里。", mediaWallClock:"显示时钟", mediaWallPlayback:"显示壁纸时的视频", mediaWallStopVideo:"停止视频", mediaWallContinueVideo:"继续播放视频", mediaWallTrigger:"壁纸按键操作", mediaWallToggle:"切换", mediaWallHold:"按住时显示",
  mediaVideoMax:"全屏显示", mediaVideoMaxClose:"关闭全屏",
  mediaVideoZoomIn:"放大视频", mediaVideoZoomOut:"缩小视频", mediaVideoFaster:"提高速度", mediaVideoSlower:"降低速度", mediaVideoPause:"播放／暂停",
  mediaVideoKeysHint:"为视频缩放、倒放、区间循环和媒体播放器操作分配按键。不会改变游戏判定或记录。",
  mediaVideoKeysReset:"↺ 恢复视频按键", mediaVideoCapture0:"请按下“放大视频”的按键。ESC取消。", mediaVideoCapture1:"请按下“缩小视频”的按键。ESC取消。", mediaVideoCapture2:"请按下“提高速度”的按键。ESC取消。", mediaVideoCapture3:"请按下“降低速度”的按键。ESC取消。", mediaVideoCapture4:"请按下“播放／暂停”的按键。ESC取消。", mediaVideoCapture5:"请按下“倒放”的按键。ESC取消。", mediaVideoCapture6:"请按下“区间循环”的按键。ESC取消。", mediaVideoCapture7:"请按下“壁纸／屏幕保护”的按键。ESC取消。",
  mediaVideoToastZoom:"视频缩放 {n}x", mediaVideoToastRate:"播放速度 {n}x",
  mediaPip:"📌 画中画", mediaPipClose:"📌 退出画中画", mediaPipUnsupported:"此浏览器不支持画中画",
  mediaResumeRewind:"⏪ 继续播放时倒回", mediaResumeOff:"关闭", mediaResumeSet:"继续播放时倒回{s}秒",
  mediaSleepTrack:"💤 本曲结束时", mediaSleepTrackSet:"将在本曲结束时停止播放",
  mediaWakeLockTitle:"🔆 保持屏幕常亮", mediaWakeLockHint:"播放视频时防止屏幕变暗（纯音频播放不会阻止熄屏）。浏览器不支持时无效果。", mediaWakeLockToggle:"播放视频时保持屏幕常亮",
  mediaWaveTitle:"🌊 波形进度条", mediaWaveHint:"在进度条上绘制音量包络（波形），指针悬停时显示该位置的时间。材料仅来自设备内的解析缓存——没有解析结果的歌曲（长曲、轻量化设置等）保持普通进度条。", mediaWaveToggle:"在进度条上显示波形",
  mediaLyricsTitle:"🎤 歌词", mediaLyricsHint:"跟随播放位置显示内嵌歌词（ID3 USLT/SYLT、MP4 ©lyr、FLAC/Ogg LYRICS）、文件夹中同名的 .lrc 或你选择的歌词文件。同步歌词可点击某行跳转到该位置。选择的歌词按歌曲保存在本机，不会上传。", mediaLyricsNone:"没有找到这首歌的歌词。", mediaLyricsLoading:"正在读取歌词…", mediaLyricsSourceEmbedded:"来源：内嵌标签", mediaLyricsSourceFile:"来源：文件夹中的 .lrc（{name}）", mediaLyricsSourceManual:"来源：选择的文件（{name}）", mediaLyricsPlain:"※ 非同步歌词，原样显示", mediaLyricsChoose:"📄 选择歌词文件", mediaLyricsClear:"✖ 清除选择的歌词", mediaLyricsSaved:"已为这首歌保存歌词（{n} 行）", mediaLyricsTooBig:"这个歌词文件太大（上限 256KB）。", mediaLyricsReadFailed:"无法读取这个歌词文件。", mediaLyricsNeedSong:"请先播放歌曲。",
  mediaSubsTitle:"💬 字幕", mediaSubsHint:"在视频上显示你选择的 SRT/VTT 字幕文件，或文件夹中同名的 .srt/.vtt。可用“延迟”调整字幕的快慢。选择的字幕和延迟按歌曲保存在本机，不会上传。画中画时也会显示字幕。", mediaSubsNone:"没有找到这个视频的字幕。", mediaSubsLoading:"正在读取字幕…", mediaSubsSourceFile:"来源：文件夹中的字幕（{name}）", mediaSubsSourceManual:"来源：选择的文件（{name}）", mediaSubsChoose:"📄 选择字幕文件", mediaSubsClear:"✖ 清除选择的字幕", mediaSubsSaved:"已为这首歌保存字幕（{n} 条）", mediaSubsTooBig:"这个字幕文件太大（上限 512KB）。", mediaSubsReadFailed:"无法读取这个字幕文件。", mediaSubsNeedSong:"请先播放视频。", mediaSubsOn:"显示字幕", mediaSubsOffset:"延迟", mediaSubsEarlier:"− 提前", mediaSubsLater:"＋ 延后", mediaSubsReset:"↺ 0", mediaSubsOffsetNow:"当前：{s} 秒",
  mediaChapTitle:"🔖 章节", mediaChapHint:"列出 M4B/MP4 等文件内嵌的章节（chpl），点击即可跳到该位置。章节仅读取，不会写回文件或上传。不支持 iTunes 式章节轨道。", mediaChapNone:"没有找到章节。", mediaChapLoading:"正在读取章节…", mediaChapCount:"{n} 个章节", mediaChapNow:"▶ {name}", mediaChapPrev:"⏮ 上一章", mediaChapNext:"下一章 ⏭", mediaSleepChapter:"在本章结束时停止", mediaSleepChapterSet:"将在本章结束时停止（{m}）", mediaSleepChapterNone:"这首歌没有章节。",
  mediaModeStatus:"媒体播放器中（不影响游戏记录）"
});
Object.assign(TEXT.ko, {
  mediaOpenBtn:"🎥 기지", mediaOpenBtnHint:"미디어 플레이어 열기 (음악·동영상 재생)",
  tvMediaHoldHint:"전원 길게 눌러 미디어 플레이어",
  dockCastPolicy:"캐스트 안테나", dockCastOff:"캐스트 안 함 (캐스트 안테나 숨기기)", dockCastAntenna:"캐스트 안테나 표시", dockCastHint:"캐스트 안테나는 백그라운드 재생 안테나와 별도로 켜고 끌 수 있으며, 여기서 숨겨도 재생용 안테나는 사라지지 않습니다. 자동 연결 없이 클릭할 때만 지원 브라우저의 선택기를 엽니다.", dockCastUnsupported:"이 브라우저는 외부 출력 선택을 지원하지 않습니다.", dockCastOn:"📡 캐스트 선택을 열었습니다", dockCastOffDone:"📡 캐스트 연결을 끊었습니다", dockCastFailed:"외부 출력을 시작하지 못했습니다.", dockCastButton:"캐스트", dockBackgroundPolicy:"백그라운드 재생 안테나", dockBackgroundOff:"표시하지 않기 (백그라운드 재생 없음)", dockBackgroundAntenna:"독에 안테나 표시", dockBackgroundCorner:"오른쪽 상단에 두기 (언어 왼쪽·컴팩트)", dockBackgroundHint:"캐스트와 별도로 백그라운드 재생만 허용할 수 있습니다. 독에 안테나 표시 또는 오른쪽 상단에 두기를 켜면 백그라운드에서도 계속 재생합니다.",
  mediaTitle:"▶ 미디어 플레이어", mediaSubtitle:"게임을 시작하지 않고 음악을 듣습니다. 곡 넘기기·반복·셔플·재생 속도·취침 타이머를 지원합니다.",
  mediaClose:"← 곡 목록으로 돌아가기", mediaNoTrack:"곡을 고르면 여기서 전체 재생할 수 있습니다.", mediaNow:"재생 중", mediaPaused:"일시정지", mediaEnded:"재생 완료",
  mediaPrev:"이전 곡", mediaNext:"다음 곡", mediaPlay:"재생", mediaPause:"일시정지", mediaRestart:"처음부터",
  mediaVolume:"볼륨", mediaMute:"음소거", mediaUnmute:"음소거 해제", mediaSeek:"재생 위치",
  mediaShuffle:"셔플", mediaRepeat:"반복", mediaRepeatOff:"끔", mediaRepeatOne:"한 곡", mediaRepeatAll:"전체",
  mediaRate:"재생 속도", mediaSleep:"취침 타이머", mediaSleepOff:"끔", mediaSleep15:"15분", mediaSleep30:"30분", mediaSleep60:"60분",
  mediaQueue:"재생 큐", mediaQueueHint:"곡을 고르면 이 화면을 닫지 않고 재생합니다. 추가한 파일·공유 폴더·곡 팩을 함께 표시합니다.",
  mediaSearch:"큐 검색…", mediaNoSongs:"아직 곡이 없습니다. 곡 선택 화면에서 음원을 추가하세요.", mediaNoMatch:"일치하는 곡이 없습니다.",
  mediaSleepSet:"{n}분 후 재생을 멈춥니다.", mediaSleepDone:"취침 타이머로 재생을 멈췄습니다.", mediaLoaded:"불러오는 중…", mediaLoadFailed:"이 곡을 불러오지 못했습니다.",
  mediaKeyboard:"Space: 재생／일시정지   ←→: 10초   N: 다음   P: 이전   Esc: 닫기   역재생／구간 반복／배경은 설정에서 지정",
  mediaVideoKeysTitle:"🎬 동영상 플레이어 키", mediaWallKey:"배경／스크린세이버", mediaReverse:"역재생", mediaReverseStart:"역재생 시작", mediaForward:"정재생으로", mediaReverseLoading:"역재생 준비 중…", mediaReverseUnavailable:"이 곡의 역재생 오디오를 준비하지 못했습니다. 영상 프레임만 시도합니다.", mediaReverseDone:"역재생이 처음에 도달했습니다.",
  mediaLoop:"구간 반복", mediaLoopSetA:"A점 설정", mediaLoopSetB:"B점 설정", mediaLoopClear:"해제", mediaLoopMode:"구간 반복 조작", mediaLoopToggle:"토글", mediaLoopHold:"누르는 동안", mediaLoopHint:"A점과 B점을 설정하면 구간을 반복합니다. 지정한 키는 A점 → B점／시작 → 해제를 차례로 실행합니다.", mediaLoopNone:"구간 반복: 없음", mediaLoopOnlyA:"A점 {a} — B점을 정해 주세요", mediaLoopRange:"{a} – {b} 반복 중", mediaLoopNeedRange:"먼저 A점과 B점을 설정하세요.", mediaLoopLabTitle:"🎛 반복 실험실", mediaLoopQuickHint:"5초·10초·20초 구간을 바로 만들 수 있습니다. 저장한 구간은 곡별로 이 기기에 기록됩니다.", mediaLoopQuick5:"5초", mediaLoopQuick10:"10초", mediaLoopQuick20:"20초", mediaLoopRandom:"🎲 랜덤 구간", mediaLoopSave:"이 구간 저장", mediaLoopPresets:"저장한 구간", mediaLoopNoPresets:"저장한 구간이 없습니다.", mediaLoopDelete:"이 구간 삭제", mediaLoopClearPresets:"저장 지우기", mediaLoopSaved:"구간을 저장했습니다",
  mediaClipExport:"🎬 영상으로 내보내기", mediaClipBusy:"🎬 내보내는 중…（구간 길이만큼 걸려요）", mediaClipDone:"🎬 내보냈습니다", mediaClipFailed:"내보내지 못했습니다", mediaClipNoVideo:"영상이 없는 곡은 영상으로 내보낼 수 없습니다", mediaClipUnsupported:"이 브라우저는 영상 내보내기를 지원하지 않습니다", mediaClipNeedMedia:"먼저 곡을 불러오세요",
  mediaWall:"배경／스크린세이버", mediaWallShow:"배경 표시", mediaWallHide:"배경 닫기", mediaWallHint:"사생활이 필요할 때 배경으로 영상을 가립니다. ESC 또는 같은 키로 돌아갑니다.", mediaWallStyle:"배경", mediaWallMidnight:"미드나이트", mediaWallAurora:"오로라", mediaWallPaper:"종이", mediaWallCustom:"업로드한 이미지", mediaWallUpload:"이미지 선택", mediaWallUploadHint:"이미지는 이번 세션 동안 이 기기에만 보관되며 외부로 업로드되지 않습니다.", mediaWallResetImage:"업로드한 이미지 제거", mediaWallNoImage:"이미지를 선택하면 여기에 표시됩니다.", mediaWallClock:"시계 표시", mediaWallPlayback:"배경 표시 중 동영상", mediaWallStopVideo:"동영상 멈추기", mediaWallContinueVideo:"동영상 계속 재생", mediaWallTrigger:"배경 키 동작", mediaWallToggle:"토글", mediaWallHold:"누르는 동안 표시",
  mediaVideoMax:"전체 화면으로 보기", mediaVideoMaxClose:"전체 화면 닫기",
  mediaVideoZoomIn:"동영상 확대", mediaVideoZoomOut:"동영상 축소", mediaVideoFaster:"재생 속도 높이기", mediaVideoSlower:"재생 속도 낮추기", mediaVideoPause:"재생／일시정지",
  mediaVideoKeysHint:"동영상 확대·축소, 역재생, 구간 반복과 미디어 플레이어 조작 키를 지정합니다. 게임 판정과 기록은 바뀌지 않습니다.",
  mediaVideoKeysReset:"↺ 동영상 키 초기화", mediaVideoCapture0:"'동영상 확대'로 지정할 키를 누르세요. ESC로 취소.", mediaVideoCapture1:"'동영상 축소'로 지정할 키를 누르세요. ESC로 취소.", mediaVideoCapture2:"'재생 속도 높이기'로 지정할 키를 누르세요. ESC로 취소.", mediaVideoCapture3:"'재생 속도 낮추기'로 지정할 키를 누르세요. ESC로 취소.", mediaVideoCapture4:"'재생／일시정지'로 지정할 키를 누르세요. ESC로 취소.", mediaVideoCapture5:"'역재생'으로 지정할 키를 누르세요. ESC로 취소.", mediaVideoCapture6:"'구간 반복'으로 지정할 키를 누르세요. ESC로 취소.", mediaVideoCapture7:"'배경／스크린세이버'로 지정할 키를 누르세요. ESC로 취소.",
  mediaVideoToastZoom:"동영상 확대 {n}x", mediaVideoToastRate:"재생 속도 {n}x",
  mediaPip:"📌 그림 속 그림", mediaPipClose:"📌 그림 속 그림 종료", mediaPipUnsupported:"이 브라우저는 그림 속 그림을 지원하지 않습니다",
  mediaResumeRewind:"⏪ 다시 재생 시 되감기", mediaResumeOff:"끔", mediaResumeSet:"다시 재생 시 {s}초 되감기",
  mediaSleepTrack:"💤 이번 곡 끝날 때", mediaSleepTrackSet:"이번 곡이 끝날 때 재생을 멈춥니다",
  mediaWakeLockTitle:"🔆 화면 켜짐 유지", mediaWakeLockHint:"동영상 재생 중 화면이 어두워지는 것을 막습니다(오디오만 재생할 때는 막지 않습니다). 지원하지 않는 브라우저에서는 아무것도 하지 않습니다.", mediaWakeLockToggle:"동영상 재생 중 화면 켜짐 유지",
  mediaWaveTitle:"🌊 파형 탐색 표시줄", mediaWaveHint:"탐색 표시줄에 음량 포락선(파형)을 그립니다. 포인터를 올리면 해당 위치의 시간이 표시됩니다. 재료는 기기 내 분석 캐시뿐이며, 분석이 없는 곡(긴 곡, 경량화 설정 등)은 일반 표시줄로 남습니다.", mediaWaveToggle:"탐색 표시줄에 파형 표시",
  mediaLyricsTitle:"🎤 가사", mediaLyricsHint:"재생 위치에 맞춰 내장 가사(ID3 USLT/SYLT, MP4 ©lyr, FLAC/Ogg LYRICS), 폴더의 같은 이름 .lrc, 또는 선택한 가사 파일을 표시합니다. 동기 가사는 줄을 클릭해 그 위치로 이동할 수 있습니다. 선택한 가사는 곡별로 기기에만 저장되며 업로드되지 않습니다.", mediaLyricsNone:"이 곡의 가사를 찾지 못했습니다.", mediaLyricsLoading:"가사를 불러오는 중…", mediaLyricsSourceEmbedded:"출처: 내장 태그", mediaLyricsSourceFile:"출처: 폴더의 .lrc ({name})", mediaLyricsSourceManual:"출처: 선택한 파일 ({name})", mediaLyricsPlain:"※ 동기화되지 않은 가사 (그대로 표시)", mediaLyricsChoose:"📄 가사 파일 선택", mediaLyricsClear:"✖ 선택한 가사 지우기", mediaLyricsSaved:"이 곡의 가사를 저장했습니다 ({n}줄)", mediaLyricsTooBig:"이 가사 파일은 너무 큽니다 (최대 256KB).", mediaLyricsReadFailed:"이 가사 파일을 읽을 수 없습니다.", mediaLyricsNeedSong:"먼저 곡을 재생해 주세요.",
  mediaSubsTitle:"💬 자막", mediaSubsHint:"선택한 SRT/VTT 자막 파일 또는 폴더의 같은 이름 .srt/.vtt를 영상 위에 표시합니다. '지연'으로 자막의 빠르기·느리기를 조정할 수 있습니다. 선택한 자막과 지연은 곡별로 기기에만 저장되며 업로드되지 않습니다. PIP 중에도 자막이 표시됩니다.", mediaSubsNone:"이 영상의 자막을 찾지 못했습니다.", mediaSubsLoading:"자막을 불러오는 중…", mediaSubsSourceFile:"출처: 폴더의 자막 ({name})", mediaSubsSourceManual:"출처: 선택한 파일 ({name})", mediaSubsChoose:"📄 자막 파일 선택", mediaSubsClear:"✖ 선택한 자막 지우기", mediaSubsSaved:"이 곡의 자막을 저장했습니다 ({n}개 큐)", mediaSubsTooBig:"이 자막 파일은 너무 큽니다 (최대 512KB).", mediaSubsReadFailed:"이 자막 파일을 읽을 수 없습니다.", mediaSubsNeedSong:"먼저 영상을 재생해 주세요.", mediaSubsOn:"자막 표시", mediaSubsOffset:"지연", mediaSubsEarlier:"− 앞당기기", mediaSubsLater:"＋ 늦추기", mediaSubsReset:"↺ 0", mediaSubsOffsetNow:"현재: {s}초",
  mediaChapTitle:"🔖 챕터", mediaChapHint:"M4B/MP4 등에 내장된 챕터(chpl) 목록입니다. 클릭하면 그 위치로 이동합니다. 챕터는 읽기 전용이며 파일에 기록하거나 업로드하지 않습니다. iTunes 방식 챕터 트랙은 지원하지 않습니다.", mediaChapNone:"챕터를 찾지 못했습니다.", mediaChapLoading:"챕터를 불러오는 중…", mediaChapCount:"챕터 {n}개", mediaChapNow:"▶ {name}", mediaChapPrev:"⏮ 이전 챕터", mediaChapNext:"다음 챕터 ⏭", mediaSleepChapter:"이번 챕터 끝에서 정지", mediaSleepChapterSet:"챕터 끝에서 정지합니다 ({m})", mediaSleepChapterNone:"이 곡에는 챕터가 없습니다.",
  mediaModeStatus:"미디어 플레이어 중 (게임 기록에 영향 없음)"
});

const HOLD_MS = 650;
if (!Array.isArray(core.settings.videoKeys) || core.settings.videoKeys.length !== core.VIDEO_KEY_DEFAULTS.length || core.settings.videoKeys.some(k => !core.validCode(k)) || new Set(core.settings.videoKeys).size !== core.VIDEO_KEY_DEFAULTS.length) core.settings.videoKeys = core.VIDEO_KEY_DEFAULTS.slice();
let overlay, dialog, powerButton;
let mediaReturnFocus = null;   /* 🎥 基地から開いたときの戻り先（trk186） */
let mediaOpen = false, holdTimer = 0, longPressed = false;
let repeatMode = core.settings.mediaRepeat || "off", shuffle = !!core.settings.mediaShuffle;
let mediaRate = Number(core.settings.mediaRate) || 1, sleepTimer = 0, sleepUntil = 0, tickTimer = 0;
let seeking = false, queueFilter = "", videoBinding = null;
let reverseActive = false, reverseLoading = false, reverseTimer = 0, reverseSource = null, reverseGain = null;
let reverseBuffer = null, reverseBufferKey = "", reverseVideoMuted = false, reverseStartAt = 0, reverseClockAt = 0;
let loopTimer = 0;
let loopA = null, loopB = null, loopActive = false, loopKeyDown = false;
let wallOverlay, wallClockNode, wallDateNode, wallNode, wallStyleNode, wallClockCheck, wallPlaybackNode, wallTriggerNode, wallFileNode, wallResetNode;
let maxNode = null;   /* 🖥 「全画面で表示」（js/video-max.js） */
let pipNode = null, pipActive = false;                /* 📌 画中画（trk164） */
let resumeNode = null;                                /* ⏪ スマート巻き戻しの選択（trk164） */
let startZeroNode = null;                             /* ⏮ 常に最初から再生のチェック（trk193） */
let wakeLock = null, wakeRequested = false;           /* 🔆 Screen Wake Lock（trk164） */
let lyricsBox = null, lyricsListNode = null, lyricsSourceNode = null, lyricsFileNode = null, lyricsClearNode = null;  /* 🎤 歌詞パネル（trk166） */
let lyricsState = { key:"", request:0, data:null, active:-2, loading:false };  /* 🎤 歌詞の状態（active=-2 は「次の描画で必ず付け直す」印） */
/* 💬 字幕（trk169）：パネル・オーバーレイ・PiP用トラックの部品と状態 */
let subsBox = null, subsOverlay = null, subsSourceNode = null, subsFileNode = null, subsClearNode = null;
let subsOnNode = null, subsOffsetNode = null, subsEarlierNode = null, subsLaterNode = null, subsResetNode = null;
let subsState = { key:"", request:0, data:null, loading:false, texts:"" };
/* 🔖 チャプター（trk170）：パネル・一覧・状態と、「チャプターの終わり」スリープの停止位置 */
let chapBox = null, chapListNode = null, chapSourceNode = null, chapNowNode = null, chapPrevNode = null, chapNextNode = null;
let waveNode = null, waveTipNode = null, waveWrapNode = null, waveCols = null, waveSig = "";   /* 🌊 波形シークバー（trk173） */
let chapState = { key:"", request:0, data:null, active:-2, loading:false };  /* active=-2 は「次の描画で必ず付け直す」印 */
let sleepChapterEnd = 0;   /* 💤 停止する再生位置（秒）。0＝未設定 */
const chapCache = new Map();   /* 曲キー → チャプター|null（メモリだけ。正はファイルの中にあるので保存しない） */
let sleepTrackMode = false, sleepFadeArm = 0, sleepFadeTimer = 0, sleepFadeBase = 1;  /* 💤 スリープタイマー強化（trk164） */
const SLEEP_FADE_SECONDS = 15;                        /* 💤 停止前のフェードアウト秒数 */
/* ✨ フレーム補完（js/frame-interp.js）：区間ループのすぐ上に置く設定と、映像エリア */
let interpBox = null, interpModeNode = null, interpStrengthNode = null, interpStrengthVal = null;
let interpStatusNode = null, interpHintNode = null, interpUnsupported = null;
let stageWrap = null, stageCanvas = null, stageCtx = null, stageNote = null;
let stageRaf = 0;
let wallActive = false, wallKeyDown = false, wallTimer = 0, wallWasPlaying = false, wallCustomURL = "";
let mediaExitBinding = null;
const VIDEO_KEY_LABELS = ["mediaVideoZoomIn", "mediaVideoZoomOut", "mediaVideoFaster", "mediaVideoSlower", "mediaVideoPause", "mediaReverse", "mediaLoop", "mediaWallKey"];
const REVERSE_KEY_INDEX = 5, LOOP_KEY_INDEX = 6, WALL_KEY_INDEX = 7;
const VIDEO_KEY_BAD = ["Escape", "Tab", "F5", "F11", "F12", "MetaLeft", "MetaRight", "Backquote", "Backspace"];
const MEDIA_POS_KEY = "trk_media_positions_v1", MEDIA_LOOP_KEY = "trk_media_loop_presets_v1";
let mediaPositions = {}, mediaLoopPresets = {};
try { mediaPositions = JSON.parse(localStorage.getItem(MEDIA_POS_KEY)) || {}; } catch (_) { mediaPositions = {}; }
try { mediaLoopPresets = JSON.parse(localStorage.getItem(MEDIA_LOOP_KEY)) || {}; } catch (_) { mediaLoopPresets = {}; }
function mediaLoopStoreKey() { return (core.currentSong && core.currentSong.key) || core.fingerprint || ""; }
function storedMediaLoops() { const list = mediaLoopPresets[mediaLoopStoreKey()]; return Array.isArray(list) ? list.filter(x => x && Number.isFinite(x.a) && Number.isFinite(x.b) && x.b > x.a).slice(0, 8) : []; }
function saveMediaLoopStore() { try { localStorage.setItem(MEDIA_LOOP_KEY, JSON.stringify(mediaLoopPresets)); } catch (_) {} }
function mediaPositionKey() { return core.fingerprint || (core.currentSong && core.currentSong.key) || ""; }
/* trk164: ⏪ スマート巻き戻しと 💤 スリープ・フェードの純関数（DOM不要 → テストで直接検証できる） */
function resumeRewindSeconds(v) { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(30, n) : 0; }
function rewindResumePosition(p, seconds) {
  const pos = Number(p);
  if (!Number.isFinite(pos) || pos <= 0) return 0;
  const s = resumeRewindSeconds(seconds);
  return s > 0 ? Math.max(0, Math.round((pos - s) * 10) / 10) : pos;
}
function planSleepFade(totalSeconds, fadeSeconds) {
  const total = Number(totalSeconds), fade = Number(fadeSeconds);
  if (!Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(fade) || fade <= 0 || fade >= total) return null;
  return { startAfter: total - fade, fade };
}
function savedMediaPosition(opts = {}) {
  /* ⏮ 常に最初から再生（trk193）：オンなら保存位置を使わず、開いたときも曲を選んだときも 0:00 から。
     保存した位置そのものは消さない（オフに戻せば、また続きから再生できる）。 */
  if (core.settings.mediaStartFromZero === true) return 0;
  const p = Number(mediaPositions[mediaPositionKey()]);
  if (!(Number.isFinite(p) && p > 5 && core.video.duration > p + 5)) return 0;
  /* ⏪ スマート巻き戻し（trk164）：「続きから再生」のときだけ数秒戻す。一時停止からの再開では戻さない */
  return opts && opts.resume ? rewindResumePosition(p, resumeRewindSeconds(core.settings.mediaResumeRewind)) : p;
}
function saveMediaPosition(clear = false) {
  const key = mediaPositionKey(); if (!key || !core.videoReady) return;
  if (clear || core.video.ended || !Number.isFinite(core.video.currentTime) || core.video.currentTime < 5 || core.video.currentTime >= (core.video.duration || Infinity) - 5) delete mediaPositions[key];
  else mediaPositions[key] = Math.round(core.video.currentTime * 10) / 10;
  try { localStorage.setItem(MEDIA_POS_KEY, JSON.stringify(mediaPositions)); } catch (_) {}
}
function loopHasRange() { return Number.isFinite(loopA) && Number.isFinite(loopB) && loopB > loopA; }
function loopStatusText() {
  if (!Number.isFinite(loopA)) return tr("mediaLoopNone");
  if (!Number.isFinite(loopB)) return tr("mediaLoopOnlyA", { a:mpFmt(loopA) });
  return loopActive ? tr("mediaLoopRange", { a:mpFmt(loopA), b:mpFmt(loopB) }) : tr("mediaLoop", {});
}
function setMediaLoopRange(a, b, active = true) {
  if (!core.videoReady || !Number.isFinite(core.video.duration) || core.video.duration <= 0) return false;
  const duration = core.video.duration;
  loopA = Math.max(0, Math.min(duration, Number(a) || 0));
  loopB = Math.max(0, Math.min(duration, Number(b) || loopA + .1));
  if (loopB - loopA < .1) {
    if (loopA >= duration - .1) { loopB = duration; loopA = Math.max(0, duration - .1); }
    else loopB = Math.min(duration, loopA + .1);
  }
  loopActive = loopB > loopA && active; loopKeyDown = false;
  try { core.video.currentTime = loopA; } catch (_) {}
  renderLoopUI(); return loopHasRange();
}
function setQuickMediaLoop(seconds) {
  if (!core.videoReady || !Number.isFinite(core.video.duration)) return;
  const len = Math.min(Number(seconds) || 5, core.video.duration), cur = Math.max(0, core.video.currentTime || 0);
  const start = Math.max(0, Math.min(cur, core.video.duration - len));
  setMediaLoopRange(start, start + len, true);
}
function setRandomMediaLoop() {
  if (!core.videoReady || !Number.isFinite(core.video.duration)) return;
  const len = Math.min(core.video.duration, 4 + Math.floor(Math.random() * 9));
  const start = Math.random() * Math.max(0, core.video.duration - len);
  setMediaLoopRange(start, start + len, true);
}
function saveMediaLoopPreset() {
  if (!loopHasRange()) { if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaLoopNeedRange")); return; }
  const key = mediaLoopStoreKey(); if (!key) return;
  const list = storedMediaLoops().filter(x => Math.abs(x.a - loopA) > .1 || Math.abs(x.b - loopB) > .1);
  list.unshift({ a:Math.round(loopA * 10) / 10, b:Math.round(loopB * 10) / 10 });
  mediaLoopPresets[key] = list.slice(0, 8); saveMediaLoopStore();
  if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaLoopSaved"));
  renderLoopUI();
}
function clearMediaLoopPresets() {
  const key = mediaLoopStoreKey(); if (!key) return;
  delete mediaLoopPresets[key]; saveMediaLoopStore(); renderLoopUI();
}
function deleteMediaLoopPreset(index) {
  const key = mediaLoopStoreKey(); if (!key) return;
  const list = storedMediaLoops().filter((_, i) => i !== index);
  if (list.length) mediaLoopPresets[key] = list; else delete mediaLoopPresets[key];
  saveMediaLoopStore(); renderLoopUI();
}
function syncLoopPresetSelection() {
  if (!loopPresetListNode) return;
  const list = storedMediaLoops();
  loopPresetListNode.querySelectorAll(".mediaLoopPreset").forEach((button, i) => {
    const x = list[i], selected = !!x && loopHasRange() && Math.abs(x.a - loopA) < .11 && Math.abs(x.b - loopB) < .11;
    button.classList.toggle("selected", selected); button.setAttribute("aria-pressed", String(selected));
  });
}
/* 🎬 記録した区間を映像で書き出す。設定は持たない（区間の行の 🎬 を押すだけ）。
   動画要素の映像と音をそのまま録るので、区間の長さのぶん待つ。終わったら再生位置・再生/停止・速度・ループを元に戻す。 */
let clipBusy = false, clipAbort = null;
function clipMimeType() {
  const can = m => typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(m);
  return ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(can) || "";
}
function clipFileName(a, b, ext) {
  const base = String(core.mediaName || "clip").replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 80) || "clip";
  return `${base}_${a.toFixed(1)}-${b.toFixed(1)}s.${ext}`;
}
function exportLoopClip(a, b) {
  const say = key => { if (typeof showToast === "function") window.Trk.play.showToast(tr(key)); };
  if (clipBusy) { say("mediaClipBusy"); return; }
  const v = core.video;
  if (!core.videoReady || !v) { say("mediaClipNeedMedia"); return; }
  if (!(v.videoWidth > 0)) { say("mediaClipNoVideo"); return; }
  if (typeof MediaRecorder === "undefined" || typeof v.captureStream !== "function") { say("mediaClipUnsupported"); return; }
  let stream;
  try { stream = v.captureStream(); } catch (_) { say("mediaClipUnsupported"); return; }
  const mime = clipMimeType();
  let rec;
  try { rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
  catch (_) { stream.getTracks().forEach(t => t.stop()); say("mediaClipUnsupported"); return; }

  const resume = { paused: v.paused, time: v.currentTime, rate: v.playbackRate, loop: loopActive };
  const chunks = [];
  let timer = 0, aborted = false, restored = false;
  const restore = (seek) => {
    if (restored) return; restored = true;
    clipBusy = false; clipAbort = null; loopActive = resume.loop;
    try { v.playbackRate = resume.rate || 1; } catch (_) {}
    if (seek && Number.isFinite(resume.time)) { try { v.currentTime = resume.time; } catch (_) {} }
    if (!resume.paused && !aborted) v.play().catch(() => {});
    renderLoopUI();
  };
  const finish = (abort = false) => {
    if (abort) aborted = true;
    clearInterval(timer);
    try { v.pause(); } catch (_) {}
    if (rec.state === "inactive") restore(!aborted);
    else { try { rec.stop(); } catch (_) { restore(!aborted); } }
  };
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    clearInterval(timer);
    stream.getTracks().forEach(t => t.stop());
    if (!aborted) {
      const type = rec.mimeType || mime || "video/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size > 0) { downloadBlob(blob, clipFileName(a, b, type.includes("mp4") ? "mp4" : "webm")); say("mediaClipDone"); }
      else say("mediaClipFailed");
    }
    restore(!aborted);
  };
  rec.onerror = () => { say("mediaClipFailed"); finish(true); };

  clipBusy = true; clipAbort = () => finish(true);
  loopActive = false;
  if (reverseActive || reverseLoading) stopReverse(false, true);
  try { v.playbackRate = 1; } catch (_) {}
  renderLoopUI();
  say("mediaClipBusy");
  const start = () => {
    if (aborted || !clipBusy) return;
    try { rec.start(1000); } catch (_) { finish(true); return; }
    const t0 = performance.now(), limit = (b - a) * 1000 + 5000;
    v.play().catch(() => finish(true));
    timer = setInterval(() => {
      if (v.currentTime >= b - 0.03 || v.ended || performance.now() - t0 > limit) finish(false);
      else if (v.paused && performance.now() - t0 > 800) finish(false);
    }, 30);
  };
  if (Math.abs(v.currentTime - a) < 0.05) start();
  else {
    const onSeeked = () => { v.removeEventListener("seeked", onSeeked); start(); };
    v.addEventListener("seeked", onSeeked);
    try { v.currentTime = a; } catch (_) { v.removeEventListener("seeked", onSeeked); finish(true); }
  }
}
function renderLoopPresets() {
  if (!loopPresetListNode) return;
  const key = mediaLoopStoreKey(), list = storedMediaLoops(), sig = list.map(x => `${x.a}:${x.b}`).join("|");
  if (loopPresetRenderKey === key && loopPresetRenderSig === sig) {
    if (loopSaveNode) loopSaveNode.disabled = !loopHasRange();
    if (loopClearPresetsNode) loopClearPresetsNode.disabled = !list.length;
    syncLoopPresetSelection(); return;
  }
  loopPresetRenderKey = key; loopPresetRenderSig = sig; loopPresetListNode.textContent = "";
  if (!list.length) loopPresetListNode.append(core.el("span", "hint", tr("mediaLoopNoPresets")));
  else list.forEach((x, i) => {
    const row = core.el("div", "mediaLoopPresetRow");
    const b = core.el("button", "mediaLoopPreset", `${mpFmt(x.a)} – ${mpFmt(x.b)}`); b.type = "button"; b.title = tr("mediaLoopRange", { a:mpFmt(x.a), b:mpFmt(x.b) });
    b.addEventListener("click", () => setMediaLoopRange(x.a, x.b, true));
    const del = core.el("button", "mediaLoopPresetDelete", "×"); del.type = "button"; del.title = tr("mediaLoopDelete"); del.setAttribute("aria-label", tr("mediaLoopDelete")); del.addEventListener("click", () => deleteMediaLoopPreset(i));
    const clip = core.el("button", "mediaLoopPresetClip", "🎬"); clip.type = "button";
    clip.title = tr("mediaClipExport"); clip.setAttribute("aria-label", tr("mediaClipExport"));
    clip.addEventListener("click", () => exportLoopClip(x.a, x.b));
    row.append(b, clip, del); loopPresetListNode.append(row);
  });
  if (loopSaveNode) loopSaveNode.disabled = !loopHasRange();
  if (loopClearPresetsNode) loopClearPresetsNode.disabled = !list.length;
  syncLoopPresetSelection();
}
function renderLoopUI() {
  if (loopStatusNode) loopStatusNode.textContent = loopStatusText();
  if (loopSetANode) loopSetANode.disabled = !core.videoReady;
  if (loopSetBNode) loopSetBNode.disabled = !core.videoReady || !Number.isFinite(loopA);
  if (loopClearNode) loopClearNode.disabled = !Number.isFinite(loopA);
  loopQuickNodes.forEach(n => { n.disabled = !core.videoReady; });
  if (loopModeNode) loopModeNode.value = core.settings.mediaLoopTrigger || "toggle";
  renderLoopPresets();
}
function clearMediaLoop(silent = false) {
  loopA = loopB = null; loopActive = false; loopKeyDown = false;
  if (!silent && typeof showToast === "function") window.Trk.play.showToast(tr("mediaLoopClear"));
  renderLoopUI();
}
function setMediaLoopPoint(which) {
  if (!core.videoReady || !Number.isFinite(core.video.duration)) return;
  const t = Math.max(0, Math.min(core.video.duration, core.video.currentTime || 0));
  if (which === "a") {
    loopA = t; loopB = null; loopActive = false;
  } else if (Number.isFinite(loopA)) {
    if (Math.abs(t - loopA) < .1) return;
    if (t < loopA) [loopA, loopB] = [t, loopA]; else loopB = t;
    loopActive = true;
    if (core.settings.mediaLoopTrigger === "hold") loopActive = false;
  }
  renderLoopUI();
}
function cycleMediaLoop() {
  if (!core.videoReady) return;
  if (!Number.isFinite(loopA)) setMediaLoopPoint("a");
  else if (!Number.isFinite(loopB)) setMediaLoopPoint("b");
  else clearMediaLoop();
}
function activateHeldLoop() {
  if (!Number.isFinite(loopA)) { setMediaLoopPoint("a"); return; }
  if (!Number.isFinite(loopB)) { setMediaLoopPoint("b"); if (loopHasRange()) { loopActive = true; loopKeyDown = true; renderLoopUI(); } return; }
  loopActive = true; loopKeyDown = true; renderLoopUI();
}
function releaseHeldLoop() {
  if (core.settings.mediaLoopTrigger === "hold" && loopKeyDown) { loopActive = false; loopKeyDown = false; renderLoopUI(); }
}
function stopReverseAudio() {
  if (reverseSource) { reverseSource.onended = null; try { reverseSource.stop(); } catch (_) {} reverseSource = null; }
  if (reverseGain) { try { reverseGain.disconnect(); } catch (_) {} reverseGain = null; }
}
function stopReverse(resume = false, silent = true) {
  if (!reverseActive && !reverseLoading) return;
  reverseActive = false; reverseLoading = false; clearInterval(reverseTimer); reverseTimer = 0;
  stopReverseAudio();
  core.video.muted = reverseVideoMuted; core.video.playbackRate = mediaRate;
  if (resume && core.videoReady) core.video.play().catch(() => {});
  if (!silent && typeof showToast === "function") window.Trk.play.showToast(tr("mediaForward"));
  renderMedia();
}
async function reverseAudioForCurrentSong() {
  const key = (core.currentSong && core.currentSong.key) || mediaPositionKey();
  if (reverseBuffer && reverseBufferKey === key) return reverseBuffer;
  if (!core.currentSong || !core.currentSong.file || typeof decodeAudio !== "function" || typeof getAC !== "function") throw new Error("reverse audio unavailable");
  const decoded = await window.Trk.media.decodeAudio(await core.currentSong.file.arrayBuffer());
  const ac = window.Trk.media.getAC(); if (!ac) throw new Error("audio context unavailable");
  const reversed = ac.createBuffer(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
  for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
    const from = decoded.getChannelData(ch), to = reversed.getChannelData(ch);
    for (let i = 0, n = from.length; i < n; i++) to[i] = from[n - i - 1];
  }
  reverseBuffer = reversed; reverseBufferKey = key;
  return reversed;
}
function reverseClockSeconds() {
  if (reverseHasAudio && typeof audioCtx !== "undefined" && window.Trk.media.audioCtx) return window.Trk.media.audioCtx.currentTime;
  return performance.now() / 1000;
}
let reverseHasAudio = false, reverseBoundaryBusy = false;
function reverseTick() {
  if (!reverseActive || reverseLoading || !core.videoReady) return;
  const elapsed = Math.max(0, reverseClockSeconds() - reverseClockAt) * Math.abs(mediaRate || 1);
  const t = reverseStartAt - elapsed;
  if (loopActive && loopHasRange() && t <= loopA) {
    if (reverseBoundaryBusy) return;
    reverseBoundaryBusy = true;
    core.video.currentTime = loopB;
    startReverseAt(loopB, true).finally(() => { reverseBoundaryBusy = false; });
    return;
  }
  if (t <= .02) {
    core.video.currentTime = 0; stopReverse(false, true);
    if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaReverseDone"));
    return;
  }
  try { core.video.currentTime = t; } catch (_) {}
  renderMedia();
}
async function startReverseAt(position, restart = false) {
  if (!core.videoReady || !Number.isFinite(core.video.duration) || core.video.duration <= 0) return;
  if (reverseLoading && !restart) return;
  if (!reverseActive) { reverseVideoMuted = !!core.video.muted; reverseActive = true; }
  reverseLoading = true; clearInterval(reverseTimer); reverseTimer = 0; stopReverseAudio();
  core.video.pause(); core.video.muted = true;
  let start = Math.max(0, Math.min(core.video.duration, Number(position) || 0));
  if (!restart && start <= .02) start = core.video.duration;
  try { core.video.currentTime = start; } catch (_) {}
  if (typeof showToast === "function" && !restart) window.Trk.play.showToast(tr("mediaReverseLoading"));
  let buffer = null;
  try { const gestureAC = typeof getAC === "function" ? window.Trk.media.getAC() : null; if (gestureAC && gestureAC.state === "suspended") gestureAC.resume().catch(() => {}); } catch (_) {}
  try { buffer = await reverseAudioForCurrentSong(); } catch (_) {
    reverseBuffer = null; reverseBufferKey = "";
    if (typeof showToast === "function" && !restart) window.Trk.play.showToast(tr("mediaReverseUnavailable"));
  }
  if (!reverseActive || !core.videoReady) return;
  reverseHasAudio = false;
  const ac = buffer && typeof getAC === "function" ? window.Trk.media.getAC() : null;
  if (buffer && ac) {
    try {
      if (ac.state === "suspended") await ac.resume();
      const src = ac.createBufferSource(), gain = ac.createGain();
      src.buffer = buffer; src.playbackRate.value = Math.max(.05, Math.abs(mediaRate || 1));
      gain.gain.value = reverseVideoMuted ? 0 : Math.max(0, Math.min(1, Number(core.settings.musicVolume) || 0));
      src.connect(gain); gain.connect(ac.destination);
      const offset = Math.max(0, Math.min(buffer.duration - .001, buffer.duration * (1 - start / core.video.duration)));
      reverseSource = src; reverseGain = gain; reverseHasAudio = true;
      src.onended = () => { if (reverseActive && reverseSource === src) reverseTick(); };
      src.start(0, offset);
    } catch (_) { reverseHasAudio = false; stopReverseAudio(); }
  }
  reverseStartAt = start; reverseClockAt = reverseClockSeconds(); reverseLoading = false;
  reverseTimer = setInterval(reverseTick, 25);
  renderMedia();
}
function toggleReverse() {
  if (!mediaActive() || !core.videoReady) return;
  if (reverseActive || reverseLoading) stopReverse(true, false);
  else startReverseAt(core.video.currentTime || 0);
}
function checkMediaLoop() {
  if (!mediaActive() || !loopActive || !loopHasRange() || !core.videoReady || reverseActive || core.video.paused) return;
  if ((core.video.currentTime || 0) >= loopB - .02) {
    try { core.video.currentTime = loopA; } catch (_) {}
  }
}
function renderWall() {
  if (!wallOverlay) return;
  const configuredStyle = core.settings.mediaWallStyle || "midnight";
  const style = configuredStyle === "custom" && !wallCustomURL ? "midnight" : configuredStyle;
  wallOverlay.dataset.style = style;
  wallOverlay.style.backgroundImage = configuredStyle === "custom" && wallCustomURL ? `url("${wallCustomURL}")` : "";
  if (wallClockNode) wallClockNode.hidden = !core.settings.mediaWallClock;
  if (wallDateNode) wallDateNode.hidden = !core.settings.mediaWallClock;
  if (wallDateNode) {
    const now = new Date();
    try {
      wallClockNode.textContent = now.toLocaleTimeString(core.settings.language || undefined, { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false });
      wallDateNode.textContent = now.toLocaleDateString(core.settings.language || undefined, { weekday:"short", year:"numeric", month:"short", day:"numeric" });
    } catch (_) { wallClockNode.textContent = now.toLocaleTimeString(); wallDateNode.textContent = now.toLocaleDateString(); }
  }
  if (wallNode) { wallNode.textContent = tr(wallActive ? "mediaWallHide" : "mediaWallShow"); wallNode.dataset.i18n = wallActive ? "mediaWallHide" : "mediaWallShow"; wallNode.setAttribute("aria-pressed", String(wallActive)); }
}
function activateWall() {
  if (!mediaActive() || wallActive) return;
  if (window.TrkVideoMax && window.TrkVideoMax.isOpen()) window.TrkVideoMax.close();   /* 🖥 壁紙の上に残さない */
  wallActive = true; wallKeyDown = false;
  wallWasPlaying = !!(reverseActive || reverseLoading || (core.videoReady && !core.video.paused && !core.video.ended));
  if (core.settings.mediaWallStopsVideo) { stopReverse(false, true); core.video.pause(); }
  wallOverlay.hidden = false; document.body.classList.add("mediaWallOpen");
  clearInterval(wallTimer); wallTimer = setInterval(renderWall, 1000); renderWall();
}
function deactivateWall(resume = true) {
  if (!wallActive) return;
  wallActive = false; wallKeyDown = false; clearInterval(wallTimer); wallTimer = 0;
  wallOverlay.hidden = true; document.body.classList.remove("mediaWallOpen");
  const shouldResume = resume && core.settings.mediaWallStopsVideo && wallWasPlaying && core.videoReady && !document.hidden;
  wallWasPlaying = false;
  if (shouldResume) core.video.play().catch(() => {});
  renderMedia();
}
function toggleWall() {
  if (!mediaActive()) return;
  if (wallActive) deactivateWall(true); else activateWall();
}
function videoAction(action) {
  if (action === 0 || action === 1) {
    core.settings.videoZoom = Math.max(.5, Math.min(3, (Number(core.settings.videoZoom) || 1) + (action === 0 ? .1 : -.1)));
    const z = document.getElementById("videoZoom"); if (z) z.value = core.settings.videoZoom;
    const zv = document.getElementById("videoZoomVal"); if (zv) zv.textContent = core.settings.videoZoom.toFixed(1) + "x";
    core.saveUserPrefs();
    if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaVideoToastZoom", { n:core.settings.videoZoom.toFixed(1) }));
    return;
  }
  if (!mediaActive()) return;
  if (action === 2 || action === 3) {
    const next = Math.max(.5, Math.min(2, (Number(mediaRate) || 1) + (action === 2 ? .25 : -.25)));
    setRate(next); renderMedia();
    if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaVideoToastRate", { n:next.toFixed(2) }));
  } else if (action === 4) playPause();
  else if (action === REVERSE_KEY_INDEX) toggleReverse();
  else if (action === LOOP_KEY_INDEX) core.settings.mediaLoopTrigger === "hold" ? activateHeldLoop() : cycleMediaLoop();
  else if (action === WALL_KEY_INDEX) core.settings.mediaWallTrigger === "hold" ? (activateWall(), wallKeyDown = true) : toggleWall();
}
function syncMediaExitUI() {
  const value = document.getElementById("mediaExitKeyValue"), button = document.getElementById("mediaExitKeyAssign"), check = document.getElementById("mediaExitConfirmCheck");
  if (value) value.textContent = core.formatKey(core.settings.mediaExitKey);
  if (button) button.classList.toggle("listening", mediaExitBinding !== null);
  if (check) check.checked = core.settings.mediaExitConfirm !== false;
}
function captureMediaExitKey(code) {
  if (mediaExitBinding === null) return;
  if (code === "Escape") { mediaExitBinding = null; syncMediaExitUI(); return; }
  const used = [...(core.settings.videoKeys || []), core.settings.menuKey, core.settings.mediaExitKey, "Space", "ArrowLeft", "ArrowRight", "KeyN", "KeyP"];
  if (VIDEO_KEY_BAD.includes(code) || (used.includes(code) && code !== core.settings.mediaExitKey)) return;
  core.settings.mediaExitKey = code; mediaExitBinding = null; core.saveUserPrefs(); syncMediaExitUI();
}
function requestMediaExit() {
  const go = () => closeMedia();
  if (core.settings.mediaExitConfirm === false || typeof confirm !== "function" || confirm(tr("mediaExitConfirm"))) go();
}
function captureVideoKey(code) {
  const i = videoBinding;
  if (code === "Escape") { videoBinding = null; syncVideoKeysUI(); return; }
  if (VIDEO_KEY_BAD.includes(code) || ((core.settings.videoKeys || []).includes(code) && core.settings.videoKeys[i] !== code)) {
    if (typeof showToast === "function") window.Trk.play.showToast(tr("reservedKey"));
    return;
  }
  core.settings.videoKeys[i] = code; videoBinding = null; core.saveUserPrefs(); syncVideoKeysUI();
}
let syncVideoKeysUI = () => {};

const mpFmt = sec => {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};
const mpSongs = () => typeof allSongs === "function" ? window.Trk.library.allSongs().filter(Boolean) : [];
const mediaActive = () => !!window.Trk.overlay.is("media");
function currentList() {
  const q = queueFilter.trim().toLowerCase();
  return mpSongs().filter(it => !q || `${it.title || ""} ${it.artist || ""} ${it.packName || ""} ${it.dir || ""}`.toLowerCase().includes(q));
}
function setRate(value) {
  mediaRate = Number(value) || 1;
  core.settings.mediaRate = mediaRate;
  if (core.video) core.video.playbackRate = mediaRate;
  core.saveUserPrefs();
  if (reverseActive && !reverseLoading) startReverseAt(core.video.currentTime || 0, true);
}
function setRepeat(value) {
  repeatMode = ["off", "one", "all"].includes(value) ? value : "off";
  core.settings.mediaRepeat = repeatMode;
  core.saveUserPrefs(); renderMedia();
}
function setShuffle(value) {
  shuffle = !!value;
  core.settings.mediaShuffle = shuffle;
  core.saveUserPrefs(); renderMedia();
}
function stopSleepTimer(silent = true) {
  clearTimeout(sleepTimer); sleepTimer = 0; sleepUntil = 0;
  if (sleepFadeArm) { clearTimeout(sleepFadeArm); sleepFadeArm = 0; }
  if (sleepFadeTimer) { clearInterval(sleepFadeTimer); sleepFadeTimer = 0; restoreSleepFadeVolume(); }  /* 💤 フェードを打ち消して音量を戻す（trk164） */
  sleepTrackMode = false;
  sleepChapterEnd = 0;   /* 🔖 チャプター終わりスリープも一緒に解除（trk170） */
  if (!silent) renderMedia();
}
/* 💤 フェードアウト後の音量を戻す（trk164）。次に再生したとき無音にならないようにする */
function restoreSleepFadeVolume() {
  if (!core.videoReady) return;
  core.video.volume = Math.max(0, Math.min(1, Number(core.settings.musicVolume) || 0));
  if (reverseGain) { try { reverseGain.gain.value = core.video.volume; } catch (_) {} }
}
async function setSleep(minutes) {
  const n = Number(minutes) || 0;
  stopSleepTimer(true);
  /* 🔖「チャプターの終わりで止める」モード（trk170）：いまのチャプターの境界（次のチャプターの開始）で止まる。
     最終チャプターなら曲の終わりで止まる。チャプターが無ければ何もしない（トーストで知らせる） */
  if (Number(minutes) === -2) {
    let chs = null;
    try { chs = await ensureChapters(); } catch (_) { chs = null; }
    const t = core.videoReady ? (core.video.currentTime || 0) : 0;
    let end = 0;
    if (chs && chs.length) {
      for (const c of chs) if (c.t > t + 1) { end = c.t; break; }   /* +1秒：境界の直上で選んでも即停止しないように */
      if (!end && Number.isFinite(core.video.duration) && core.video.duration > t) end = core.video.duration;
    }
    if (!end) {
      if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaSleepChapterNone"));
      renderMedia(); return;
    }
    sleepChapterEnd = end;
    if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaSleepChapterSet", { m: mpFmt(end) }));
    renderMedia();
    return;
  }
  /* 💤「この曲の終わり」モード（trk164）：今の曲が終わったところで停止する。リピート／シャッフルより優先 */
  if (Number(minutes) === -1) {
    sleepTrackMode = true;
    if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaSleepTrackSet"));
    renderMedia();
    return;
  }
  if (n > 0) {
    const totalMs = n * 60000;
    sleepUntil = Date.now() + totalMs;
    /* 💤 停止前の15秒はフェードアウト（trk164）。逆再生中は音量を逆再生側が管理しているので触らない */
    const fade = planSleepFade(totalMs / 1000, SLEEP_FADE_SECONDS);
    if (fade) {
      sleepFadeBase = core.videoReady ? core.video.volume : Number(core.settings.musicVolume) || 0;
      sleepFadeArm = setTimeout(() => {
        sleepFadeArm = 0;
        if (!sleepUntil || sleepTrackMode || !core.videoReady || reverseActive) return;
        sleepFadeTimer = setInterval(() => {
          if (!core.videoReady || reverseActive) return;   /* 逆再生を始めたら音量は逆再生側の管理に任せる */
          core.video.volume = Math.max(0, core.video.volume - Math.max(.02, sleepFadeBase / SLEEP_FADE_SECONDS));
          if (reverseGain) { try { reverseGain.gain.value = core.video.volume; } catch (_) {} }
        }, 1000);
      }, fade.startAfter * 1000);
    }
    sleepTimer = setTimeout(() => {
      sleepTimer = 0; sleepUntil = 0;
      if (sleepFadeTimer) { clearInterval(sleepFadeTimer); sleepFadeTimer = 0; }
      core.video.pause();
      restoreSleepFadeVolume();
      if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaSleepDone"));
      renderMedia();
    }, totalMs);
    if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaSleepSet", { n }));
  }
  renderMedia();
}
function mediaCandidates() {
  const list = mpSongs();
  if (!list.length) return [];
  if (shuffle) {
    const cur = core.currentSong && core.currentSong.key;
    const other = list.filter(x => x.key !== cur);
    return other.length ? other : list;
  }
  return list;
}
function nextMediaSong(dir = 1) {
  const list = mediaCandidates(); if (!list.length) return null;
  if (shuffle) return list[Math.floor(Math.random() * list.length)];
  const i = core.currentSong ? list.findIndex(x => x.key === core.currentSong.key) : -1;
  return list[(i + dir + list.length) % list.length];
}
async function playSong(it, fromStart = true) {
  if (!it || typeof selectSong !== "function") return;
  if (sleepTrackMode || sleepChapterEnd) { sleepTrackMode = false; sleepChapterEnd = 0; renderMedia(); }  /* 💤 手で別の曲を選んだら「この曲／チャプターの終わり」スリープは解除（trk164/170） */
  if (reverseActive || reverseLoading) stopReverse(false, true);
  clearMediaLoop(true);
  if (core.phase !== "title") {
    if (typeof toTitle === "function") window.Trk.play.toTitle();
    else return;
  }
  window._trkMediaPlayerMode = true;
  if (!core.currentSong || core.currentSong.key !== it.key) {
    saveMediaPosition();
    await window.Trk.library.selectSong(it);
  } else if (!core.videoReady) {
    await window.Trk.library.selectSong(it);
  }
  if (!mediaActive() || core.currentSong !== it || !core.videoReady) { renderMedia(); return; }
  if (fromStart) { try { core.video.currentTime = savedMediaPosition({ resume: true }); } catch (_) {} }  /* ⏪ 続きから再生のときだけ巻き戻す（trk164） */
  core.video.muted = false; core.video.volume = core.settings.musicVolume; setRate(mediaRate);
  try { await core.video.play(); } catch (_) { showMediaStatus("mediaLoadFailed"); }
  renderMedia(); updateMediaSession();
}
function playPause() {
  if (!core.videoReady) return;
  if (reverseActive || reverseLoading) { stopReverse(true, false); renderMedia(); return; }
  if (core.video.paused || core.video.ended) {
    if (core.video.ended) { try { core.video.currentTime = 0; } catch (_) {} }
    core.video.muted = false; core.video.volume = core.settings.musicVolume; core.video.play().catch(() => showMediaStatus("mediaLoadFailed"));
  } else core.video.pause();
  renderMedia();
}
async function stepMedia(dir) {
  const it = nextMediaSong(dir);
  if (it) await playSong(it, true);
  else showMediaStatus("mediaNoSongs");
}
function seekBy(delta) {
  if (!core.videoReady || !Number.isFinite(core.video.duration)) return;
  if (reverseActive || reverseLoading) stopReverse(false, true);
  core.video.currentTime = Math.max(0, Math.min(core.video.duration, (core.video.currentTime || 0) + delta));
  renderMedia();
}
function showMediaStatus(key, vars) {
  if (!statusNode) return;
  /* 🎞 trk196：読み込みに失敗した理由が分かっているなら、ひとことの「読み込めませんでした」ではなく理由を出す */
  const failure = key === "mediaLoadFailed" && core.mediaLoadFailure;
  if (failure && failure.known) { statusNode.textContent = tr(failure.key, failure.vars); statusNode.dataset.i18n = ""; return; }
  statusNode.textContent = tr(key, vars);
  statusNode.dataset.i18n = key;
}
function endedMedia() {
  if (!mediaActive()) return;
  mediaPlayNotedKey = "";   /* 🎧 最後まで再生＝「ちゃんと聴いた」（trk172・リピートで何周しても周ごとに数える） */
  noteMediaPlay();
  /* 🔖「チャプターの終わりで止める」で最終チャプターが曲の終わりと一致するとき（trk170） */
  if (sleepChapterEnd) {
    saveMediaPosition(true);
    stopSleepTimer(true);
    core.video.pause();
    if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaSleepDone"));
    renderMedia(); updateMediaSession();
    return;
  }
  /* 💤 スリープ「この曲の終わり」（trk164）：リピート／シャッフルより優先。続き再生の位置も消して止まる */
  if (sleepTrackMode) {
    saveMediaPosition(true);
    stopSleepTimer(true);
    core.video.pause();
    if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaSleepDone"));
    renderMedia(); updateMediaSession();
    return;
  }
  if (repeatMode === "one") { saveMediaPosition(true); try { core.video.currentTime = 0; } catch (_) {} core.video.play().catch(() => {}); }
  else if (repeatMode === "all" || shuffle) stepMedia(1);
  else saveMediaPosition(true);
  renderMedia(); updateMediaSession();
}
function updateMediaSession() {
  const ms = navigator.mediaSession;
  if (!ms) return;
  const s = core.currentSong || {};
  if (typeof MediaMetadata !== "undefined" && s) {
    const d = trackDisplayMeta(core.currentSong);   /* 🏷 ロック画面・通知もタグ込みの表示名に揃える（trk167） */
    try { ms.metadata = new MediaMetadata({ title:d.title || s.title || core.baseName(core.mediaName) || "trk!", artist:d.artist || s.artist || "trk!", album:d.album || s.packName || "trk!", artwork:[{ src:"icons/icon-512.png", sizes:"512x512", type:"image/png" }] }); } catch (_) {}
  }
  try {
    if (core.videoReady && Number.isFinite(core.video.duration) && core.video.duration > 0 && typeof ms.setPositionState === "function") {
      ms.setPositionState({ duration:core.video.duration, playbackRate:core.video.playbackRate || 1, position:Math.max(0, Math.min(core.video.duration, core.video.currentTime || 0)) });
    }
  } catch (_) {}
}
async function sessionSong(dir) {
  const pick = dir > 0 ? window.Trk.library.nextSong : window.Trk.library.prevSong;
  if (typeof pick !== "function" || typeof selectSong !== "function") return;
  const it = pick(); if (!it) return;
  if (core.phase !== "title" && typeof toTitle === "function") window.Trk.play.toTitle();
  await window.Trk.library.selectSong(it);
  if (core.settings.autoPlay && core.phase === "title" && core.videoReady && core.chart.length && core.currentSong === it && typeof startGame === "function") window.Trk.play.startGame();
}
function installMediaSession() {
  const ms = navigator.mediaSession; if (!ms) return;
  const act = (name, fn) => { try { ms.setActionHandler(name, fn); } catch (_) {} };
  act("play", () => mediaActive() ? playPause() : (core.phase === "paused" ? window.Trk.play.resumeGame() : core.video.play().catch(() => {})));
  act("pause", () => mediaActive() ? playPause() : (core.phase === "playing" ? window.Trk.play.pauseGame() : core.video.pause()));
  act("previoustrack", () => mediaActive() ? stepMedia(-1) : sessionSong(-1));
  act("nexttrack", () => mediaActive() ? stepMedia(1) : sessionSong(1));
  act("seekbackward", d => seekBy(-(d && d.seekOffset || 10)));
  act("seekforward", d => seekBy(d && d.seekOffset || 10));
  act("seekto", d => { if (Number.isFinite(d && d.seekTime) && core.videoReady) { if (reverseActive || reverseLoading) stopReverse(false, true); core.video.currentTime = Math.max(0, Math.min(core.video.duration || 0, d.seekTime)); } });
}

let statusNode, queueNode, progressNode, playNode, timeNode, titleNode, subNode, volumeNode, muteNode, shuffleNode, repeatNode, rateNode, sleepNode, searchNode;
let reverseNode, loopStatusNode, loopSetANode, loopSetBNode, loopClearNode, loopModeNode, loopPresetListNode, loopSaveNode, loopClearPresetsNode;
let loopPresetRenderKey = null, loopPresetRenderSig = null, loopQuickNodes = [];
function tx(tag, key, cls) { const n = core.el(tag, cls || "", tr(key)); n.dataset.i18n = key; return n; }
function makeButton(key, cls = "mediaSmallBtn") { const b = core.el("button", cls, tr(key)); b.type = "button"; b.dataset.i18n = key; return b; }
function trackDisplayMeta(s) {
  /* 🏷 表示名は library の優先順（ユーザー設定名→タグ→カタログ曲名→ファイル名）に揃える（trk167） */
  const lib = window.Trk.library;
  if (s && lib && typeof lib.songDisplayMeta === "function") { try { return lib.songDisplayMeta(s); } catch (_) {} }
  return { title: s ? s.title : "", artist: s ? s.artist || "" : "", album: "" };
}
function updateTrackText() {
  const s = core.currentSong;
  const d = trackDisplayMeta(s);
  titleNode.textContent = s ? (d.title || s.title) : tr("mediaNoTrack");
  subNode.textContent = s ? [d.artist || s.artist, d.album, s.packName, srcLabelSafe(s)].filter(Boolean).join(" · ") : tr("mediaModeStatus");
  titleNode.dataset.i18n = s ? "" : "mediaNoTrack";
  if (!s) delete titleNode.dataset.i18n;
}
function srcLabelSafe(s) {
  try { return typeof srcLabel === "function" ? window.Trk.library.srcLabel(s) : s.source || ""; } catch (_) { return s.source || ""; }
}
function renderQueue() {
  if (!queueNode) return;
  queueNode.textContent = "";
  const all = currentList();
  if (!all.length) { queueNode.append(core.el("div", "mediaEmpty", tr(mpSongs().length ? "mediaNoMatch" : "mediaNoSongs"))); return; }
  for (const it of all.slice(0, 300)) {
    const b = core.el("button", "mediaQueueItem" + (core.currentSong && core.currentSong.key === it.key ? " selected" : ""));
    b.type = "button"; b.dataset.key = it.key;
    const d = trackDisplayMeta(it);   /* 🏷 キューもタグ込みの表示名（trk167） */
    const name = core.el("strong", "mediaQueueName", d.title || it.title || "song");
    const meta = core.el("span", "mediaQueueMeta", [d.artist || it.artist, d.album, srcLabelSafe(it)].filter(Boolean).join(" · "));
    b.append(name, meta);
    b.addEventListener("click", () => playSong(it, true));
    queueNode.append(b);
  }
  if (all.length > 300) queueNode.append(core.el("div", "hint", `+ ${all.length - 300}`));
}
/* ================= ✨ フレーム補完（js/frame-interp.js） =================
   ・設定は区間ループのすぐ上。効果は上の映像エリアで見られます。
   ・重い処理なので、表示しているときだけ取り込みを動かします。 */
const interpStrengthValue = () => Math.max(0, Math.min(1, Number(core.settings.frameInterpStrength)));
function hasVideoFrames() { return !!(core.videoReady && core.video && core.video.videoWidth > 0); }
/* 📌 画中画（trk164）：動画を画面の隅に小さく最前面表示する。対応ブラウザだけで動く */
function pipSupported() {
  return !!(typeof document !== "undefined" && document.pictureInPictureEnabled && core.video && typeof core.video.requestPictureInPicture === "function");
}
async function togglePip() {
  if (!pipSupported() || !core.videoReady) return;
  try {
    if (document.pictureInPictureElement) { await document.exitPictureInPicture(); pipActive = false; }
    else { await core.video.requestPictureInPicture(); pipActive = true; }
  } catch (err) {
    pipActive = false;
    if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaPipUnsupported"));
    console.error("[media] PiP:", err);
  }
  renderMedia();
}
/* 🔆 Screen Wake Lock（trk164）：動画の再生中だけ画面の消灯を防ぐ。
   音声だけの再生では防がない（端末の省電力を尊重）。非対応ブラウザでは何もしない */
function wakeLockSupported() { return !!(typeof navigator !== "undefined" && navigator.wakeLock && typeof navigator.wakeLock.request === "function"); }
async function updateWakeLock() {
  if (!wakeLockSupported()) return;
  const want = !!(mediaOpen && core.videoReady && !core.video.paused && !core.video.ended &&
    hasVideoFrames() && core.settings.mediaWakeLock !== false &&
    typeof document !== "undefined" && !document.hidden);
  if (want && !wakeLock && !wakeRequested) {
    wakeRequested = true;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });  /* タブ非表示などでブラウザが外したら追従 */
    } catch (err) { wakeLock = null; console.error("[media] Wake Lock:", err); }
    wakeRequested = false;
  } else if (!want && wakeLock) {
    const lock = wakeLock; wakeLock = null;
    try { await lock.release(); } catch (_) {}
  }
}
/* ================= 🎤 歌詞（trk166：js/lyrics.js ＋ audio-art.js extractLyrics） =================
   歌詞は読むだけ：埋め込みタグ（ID3 USLT/SYLT・MP4 ©lyr・FLAC/Ogg LYRICS）→ フォルダの同名 .lrc →
   手で選んだファイルの順に探す（選んだ歌詞は localStorage に曲単位で残る）。
   ハイライトは renderMedia の 250ms 周期に相乗り。行のクリックでその位置へシークする。
   ⚠ ファイルは端末から出さない。元ファイルへの書き戻しもしない。 */
function lyricsBoxOpen() { return !!(lyricsBox && lyricsBox.open); }
async function loadLyrics(force = false) {
  const api = window.Trk.lyrics; if (!api) return;
  const s = core.currentSong;
  if (!s) { lyricsState = { key:"", request:lyricsState.request, data:null, active:-2, loading:false }; renderLyrics(); return; }
  if (!force && lyricsState.key === s.key && (lyricsState.data || lyricsState.loading)) return;
  const request = ++lyricsState.request, key = s.key;
  lyricsState = { key, request, data:null, active:-2, loading:true };
  renderLyrics();
  let data = null;
  try { data = await api.resolveLyrics(s); } catch (_) { data = null; }
  if (request !== lyricsState.request) return;          /* 読み込み中に曲が変わったら古い結果は無視 */
  lyricsState.loading = false; lyricsState.data = data;
  renderLyrics();
}
function lyricSourceText() {
  const d = lyricsState.data;
  if (lyricsState.loading) return tr("mediaLyricsLoading");
  if (!d) return tr("mediaLyricsNone");
  const base = d.source === "manual" ? tr("mediaLyricsSourceManual", { name: d.name })
    : d.source === "folder" ? tr("mediaLyricsSourceFile", { name: d.name })
    : tr("mediaLyricsSourceEmbedded");
  return d.synced ? base : `${base} ${tr("mediaLyricsPlain")}`;
}
function renderLyrics() {
  if (!lyricsBox) return;
  const api = window.Trk.lyrics; if (!api) return;
  if (lyricsSourceNode) lyricsSourceNode.textContent = lyricSourceText();
  if (lyricsClearNode) lyricsClearNode.disabled = !api.manualLyrics(core.currentSong && core.currentSong.key);
  if (!lyricsBoxOpen() || !lyricsListNode) return;
  const d = lyricsState.data;
  const sig = d ? `${lyricsState.key}|${d.source}|${d.lines.length}` : "none";
  if (lyricsListNode.dataset.sig !== sig) {
    lyricsListNode.dataset.sig = sig;
    lyricsListNode.textContent = "";
    lyricsState.active = -2;
    if (d) for (const line of d.lines) {
      const clickable = d.synced && Number.isFinite(line.t);
      const node = clickable ? core.el("button", "lyricLine") : core.el("div", "lyricLine lyricLineStatic");
      if (clickable) { node.type = "button"; node.title = mpFmt(line.t); node.addEventListener("click", () => seekToLyric(line.t)); }
      node.textContent = line.text || "♪";              /* 時刻だけ的行（間奏）は ♪ で置く */
      lyricsListNode.append(node);
    }
  }
  if (!d || !d.synced) return;
  if (reverseActive || reverseLoading || !core.videoReady) return;   /* 逆再生中は時計が違うので付けない */
  const idx = api.activeLineIndex(d.lines, core.video.currentTime || 0);
  if (idx === lyricsState.active) return;
  lyricsState.active = idx;
  const nodes = lyricsListNode.children;
  for (let i = 0; i < nodes.length; i++) nodes[i].classList.toggle("lyricLineActive", i === idx);
  const activeNode = idx >= 0 ? nodes[idx] : null;
  if (activeNode && typeof activeNode.scrollIntoView === "function") activeNode.scrollIntoView({ block:"center", behavior:"smooth" });
}
function seekToLyric(t) {
  if (!core.videoReady || !Number.isFinite(t)) return;
  if (reverseActive || reverseLoading) stopReverse(false, true);
  try { core.video.currentTime = t; } catch (_) {}
  lyricsState.active = -2;                               /* 次の描画でハイライトを付け直す */
  renderLyrics();
}
async function chooseLyricsFile(file) {
  const api = window.Trk.lyrics; if (!api || !file) return;
  const toast = m => { if (typeof showToast === "function") window.Trk.play.showToast(m); };
  const song = core.currentSong;
  if (!song) { toast(tr("mediaLyricsNeedSong")); return; }
  const r = await api.readLyricsFile(file);
  if (r.error === "tooBig") { toast(tr("mediaLyricsTooBig")); return; }
  if (r.error) { toast(tr("mediaLyricsReadFailed")); return; }
  api.saveManualLyrics(song.key, r.text, file.name);
  await loadLyrics(true);
  toast(tr("mediaLyricsSaved", { n: lyricsState.data ? lyricsState.data.lines.length : 0 }));
}
/* ================= 💬 字幕（trk169：js/subtitles.js ＋ オーバーレイ ＋ PiP用トラック） =================
   映像は canvas に描いて表示するので、画面の字幕は DOM オーバーレイ（この下の renderSubsOverlay）。
   📌 画中画だけはビデオ要素そのものが出るので、同じ内容の WebVTT を <track> で付けておく。
   読み込み：動画の曲が変わったとき・プレーヤーを開いたとき・パネルを開いたとき。動画の曲だけ（it.video）。 */
function subsAllowed() { const s = core.currentSong; return !!(s && s.video); }
function subsOffsetText(off) { const s = (Math.round(Number(off) || 0) / 1000).toFixed(2); return `${off > 0 ? "+" : ""}${s}`; }
async function loadSubs(force = false) {
  const api = window.Trk.subtitles; if (!api) return;
  const s = core.currentSong;
  if (!subsAllowed()) {
    subsState = { key:"", request:subsState.request, data:null, loading:false, texts:subsState.texts };
    api.setCurrent(null); api.detachTrack(core.video);
    renderSubsOverlay(); renderSubs(); return;
  }
  if (!force && subsState.key === s.key && (subsState.data || subsState.loading)) return;
  const request = ++subsState.request, key = s.key;
  subsState = { key, request, data:null, loading:true, texts:"" };
  renderSubs();
  let data = null;
  try { data = await api.resolveSubs(s); } catch (_) { data = null; }
  if (request !== subsState.request) return;          /* 読み込み中に曲が変わったら古い結果は無視 */
  subsState.loading = false; subsState.data = data;
  applySubs();
  renderSubs();
}
function applySubs() {
  const api = window.Trk.subtitles; if (!api) return;
  const d = subsState.data;
  api.setCurrent(d, core.settings.mediaSubsOn !== false);
  if (d && core.settings.mediaSubsOn !== false) api.attachTrack(core.video, d.cues, d.offsetMs, d.name || tr("mediaSubsTitle"));
  else api.detachTrack(core.video);
  subsState.texts = "";                                /* オーバーレイを次の描画で必ず付け直す */
}
function subsSourceText() {
  if (subsState.loading) return tr("mediaSubsLoading");
  const d = subsState.data;
  if (!d) return tr("mediaSubsNone");
  return d.source === "manual" ? tr("mediaSubsSourceManual", { name: d.name }) : tr("mediaSubsSourceFile", { name: d.name });
}
function renderSubs() {
  if (!subsBox) return;
  const api = window.Trk.subtitles;
  subsBox.hidden = !subsAllowed();
  if (subsSourceNode) subsSourceNode.textContent = subsSourceText();
  if (subsClearNode) subsClearNode.disabled = !(api && api.manualSubs(core.currentSong && core.currentSong.key));
  if (subsOnNode) subsOnNode.checked = core.settings.mediaSubsOn !== false;
  if (subsOffsetNode) subsOffsetNode.textContent = api && subsState.data ? tr("mediaSubsOffsetNow", { s: subsOffsetText(subsState.data.offsetMs) }) : "";
  for (const b of [subsEarlierNode, subsLaterNode, subsResetNode]) if (b) b.disabled = !subsState.data;
}
function renderSubsOverlay() {
  if (!subsOverlay) return;
  const api = window.Trk.subtitles; if (!api) return;
  if (reverseActive || reverseLoading || !core.videoReady) {   /* 逆再生中は時計が違うので隠す（歌詞と同じ理由） */
    api.pauseOverlay(true);
    if (subsState.texts !== "") { subsState.texts = ""; subsOverlay.textContent = ""; subsOverlay.hidden = true; }
    return;
  }
  api.pauseOverlay(false);
  const texts = api.currentTexts(core.video.currentTime || 0).join("\n");
  if (texts !== subsState.texts) { subsState.texts = texts; subsOverlay.textContent = texts; subsOverlay.hidden = !texts; }
}
function shiftSubsOffset(deltaMs) {
  const api = window.Trk.subtitles; const song = core.currentSong;
  if (!api || !song || !subsState.data) return;
  const off = api.clampOffset(subsState.data.offsetMs + deltaMs);
  api.saveSubsOffset(song.key, off);
  subsState.data = { ...subsState.data, offsetMs: off };
  applySubs();
  renderSubs();
}
async function chooseSubsFile(file) {
  const api = window.Trk.subtitles; if (!api || !file) return;
  const toast = m => { if (typeof showToast === "function") window.Trk.play.showToast(m); };
  const song = core.currentSong;
  if (!song) { toast(tr("mediaSubsNeedSong")); return; }
  const r = await api.readSubsFile(file);
  if (r.error === "tooBig") { toast(tr("mediaSubsTooBig")); return; }
  if (r.error) { toast(tr("mediaSubsReadFailed")); return; }
  api.saveManualSubs(song.key, r.text, file.name, api.subsOffset(song.key));
  await loadSubs(true);
  toast(tr("mediaSubsSaved", { n: subsState.data ? subsState.data.cues.length : 0 }));
}
/* ================= 🔖 チャプター（trk170：audio-art.js extractChapters ＋ 一覧・ジャンプ） =================
   M4B（オーディオブック）の定番・chpl（Nero形式）を読む。読み取りだけで保存もしない（メモリ内のキャッシュだけ）。
   チャプターの境界は 💤 スリープタイマーの「チャプターの終わりで止める」にもつながる（下の setSleep）。 */
function chapsAllowed() {
  const s = core.currentSong; if (!s) return false;
  const name = (s.file && s.file.name) || s.base || s.title || "";
  return ["m4b", "m4a", "mp4", "mov"].includes(core.extOf(name));
}
async function ensureChapters() {
  const api = window.Trk.media && window.Trk.media.audioArt;
  const s = core.currentSong;
  if (!api || !s || !s.file || !chapsAllowed()) return null;
  if (chapCache.has(s.key)) return chapCache.get(s.key);
  let chs = null;
  try { chs = await api.extractChapters(s.file); } catch (_) { chs = null; }
  if (chapCache.size >= 50) chapCache.clear();   /* ざっくり上限：いっぱいになったら全部消す（ただのキャッシュ） */
  chapCache.set(s.key, chs);
  return chs;
}
async function loadChapters(force = false) {
  const s = core.currentSong;
  if (!chapsAllowed()) {
    chapState = { key:"", request:chapState.request, data:null, active:-2, loading:false };
    renderChapters(); return;
  }
  if (!force && chapState.key === s.key && (chapState.data || chapState.loading)) return;
  const request = ++chapState.request, key = s.key;
  chapState = { key, request, data:null, active:-2, loading:true };
  renderChapters();
  let data = null;
  try { data = await ensureChapters(); } catch (_) { data = null; }
  if (request !== chapState.request) return;      /* 読み込み中に曲が変わったら古い結果は無視 */
  chapState.loading = false; chapState.data = data;
  renderChapters();
}
/* 再生位置（秒）が属するチャプターの index（境界の +0.25 秒は丸め）。まだ先頭より前なら -1 */
function chapterIndexAt(chs, seconds) {
  if (!Array.isArray(chs) || !chs.length || !Number.isFinite(seconds)) return -1;
  let lo = 0, hi = chs.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (chs[mid].t <= seconds + .25) { found = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return found;
}
function renderChapters() {
  if (!chapBox) return;
  chapBox.hidden = !chapsAllowed();
  if (chapSourceNode) chapSourceNode.textContent = chapState.loading ? tr("mediaChapLoading") : chapState.data ? tr("mediaChapCount", { n: chapState.data.length }) : tr("mediaChapNone");
  for (const b of [chapPrevNode, chapNextNode]) if (b) b.disabled = !(chapState.data && chapState.data.length);
  if (!chapListNode) return;
  const d = chapState.data;
  const sig = d ? `${chapState.key}|${d.length}|${d[0].t}|${d[0].text}` : "none";
  if (chapListNode.dataset.sig !== sig) {
    chapListNode.dataset.sig = sig;
    chapListNode.textContent = "";
    chapState.active = -2;
    if (d) for (const c of d) {
      const node = core.el("button", "chapLine");
      node.type = "button";
      node.append(core.el("span", "chapTime mono", mpFmt(c.t)), core.el("span", "chapText", c.text));
      node.addEventListener("click", () => seekToChapter(c.t));
      chapListNode.append(node);
    }
  }
  renderChaptersActive();
}
function renderChaptersActive() {
  if (!chapListNode || !chapState.data) { if (chapNowNode && chapNowNode.textContent) chapNowNode.textContent = ""; return; }
  if (reverseActive || reverseLoading || !core.videoReady) return;   /* 逆再生中は時計が違うので付けない（歌詞・字幕と同じ） */
  const idx = chapterIndexAt(chapState.data, core.video.currentTime || 0);
  if (idx === chapState.active) return;
  chapState.active = idx;
  const nodes = chapListNode.children;
  for (let i = 0; i < nodes.length; i++) nodes[i].classList.toggle("chapLineActive", i === idx);
  if (chapNowNode) chapNowNode.textContent = idx >= 0 ? tr("mediaChapNow", { name: chapState.data[idx].text }) : "";
}
function seekToChapter(t) {
  if (!core.videoReady || !Number.isFinite(t)) return;
  if (reverseActive || reverseLoading) stopReverse(false, true);
  try { core.video.currentTime = t; } catch (_) {}
  chapState.active = -2;                            /* 次の描画でハイライトを付け直す */
  renderChaptersActive();
}
function stepChapter(delta) {
  const d = chapState.data;
  if (!d || !d.length || !core.videoReady) return;
  const t = core.video.currentTime || 0;
  const idx = chapterIndexAt(d, t);
  let target = null;
  if (delta > 0) target = idx + 1 < d.length ? d[idx + 1].t : null;
  /* ⏮ 前のチャプター：いまのチャプターに入って3秒以上たっていたら先頭へ、それなら1つ前へ（定番の操作感） */
  else if (idx >= 0 && t - d[idx].t > 3) target = d[idx].t;
  else target = idx - 1 >= 0 ? d[idx - 1].t : 0;
  if (target != null) seekToChapter(target);
}
/* 🎧「ちゃんと聴いた」計数（trk172・⚡スマート棚の材料）：30秒（短い曲は半分）を超えて再生したら
   1曲につき1回だけ library.noteMediaPlayed へ。逆再生中は数えない（時計が違うため）。 */
let mediaPlayNotedKey = "";
function noteMediaPlay() {
  const s = core.currentSong;
  if (!s || !s.key || !core.videoReady || reverseActive || reverseLoading) return;
  if (mediaPlayNotedKey === s.key) return;
  const t = core.video.currentTime || 0, d = core.video.duration || 0;
  if (t < 30 && !(d > 0 && t >= d / 2)) return;
  mediaPlayNotedKey = s.key;
  const lib = window.Trk.library;
  if (lib && typeof lib.noteMediaPlayed === "function") lib.noteMediaPlayed(s.key);
}
/* 🌊 波形シークバー（trk173・PLAYER-ROADMAP #14）：解析キャッシュ（core.analysis＝端末内・trk_analysis_cache_v1）の
   rms 包絡をシークバーに重ねて描く。解析が無い曲（長い曲・🪶軽量化・大きなファイル）では何も描かない＝ふつうのバーのまま。
   ホバーサムネ（動画フレーム）は別のデコード経路が要るので今回は見送り＝代わりに「その位置の時刻」の吹き出しを出す。 */
function waveColumns(a, cols) {
  if (!a || !a.rms || !(a.frames > 0) || !(cols > 0)) return null;
  const rms = a.rms, frames = a.frames;
  const max = Number.isFinite(a.maxRms) && a.maxRms > 0 ? a.maxRms : 1;
  const out = new Float32Array(cols);
  for (let x = 0; x < cols; x++) {
    const f0 = Math.floor(x * frames / cols), f1 = Math.min(frames, Math.max(f0 + 1, Math.ceil((x + 1) * frames / cols)));
    let m = 0;
    for (let f = f0; f < f1; f++) { const v = rms[f]; if (v > m) m = v; }
    out[x] = Math.min(1, Math.pow(m / max, 0.7));   /* ガンマ補正：静かな部分も見えるように */
  }
  return out;
}
function drawWave() {
  if (!waveNode) return;
  const a = core.settings.mediaWave !== false ? core.analysis : null;
  if (!a || !a.rms || !(a.frames > 0) || !core.videoReady || !Number.isFinite(core.video.duration) || core.video.duration <= 0) {
    waveNode.hidden = true;
    if (waveTipNode) waveTipNode.hidden = true;
    return;
  }
  const w = waveNode.clientWidth, h = waveNode.clientHeight;
  if (w < 8 || h < 4) return;
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
  if (waveNode.width !== pw || waveNode.height !== ph) { waveNode.width = pw; waveNode.height = ph; waveCols = null; }
  const s = core.currentSong;
  const sig = `${s ? s.key : ""}|${a.frames}|${pw}`;
  if (waveSig !== sig || !waveCols) { waveCols = waveColumns(a, pw); waveSig = sig; }
  const ctx = waveNode.getContext("2d");
  if (!ctx || !waveCols) return;
  waveNode.hidden = false;
  ctx.clearRect(0, 0, pw, ph);
  const progress = Math.min(1, Math.max(0, (core.video.currentTime || 0) / core.video.duration));
  const playedTo = Math.round(progress * pw), mid = ph / 2;
  for (let x = 0; x < pw; x++) {
    const v = waveCols[x];
    if (v <= 0.005) continue;
    const bh = Math.max(1, Math.round(v * (ph - 2)));
    ctx.fillStyle = x < playedTo ? "rgba(255,209,102,.75)" : "rgba(160,190,255,.32)";
    ctx.fillRect(x, Math.round(mid - bh / 2), 1, bh);
  }
}
/* 💤「チャプターの終わり」スリープの見張り（250ms周期に相乗り）。境界に達したら曲の終わりモードと同じ形で止まる */
function checkChapterSleep() {
  if (!sleepChapterEnd || !core.videoReady || reverseActive || reverseLoading) return;
  if ((core.video.currentTime || 0) < sleepChapterEnd) return;
  saveMediaPosition(true);
  stopSleepTimer(true);
  core.video.pause();
  if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaSleepDone"));
  renderMedia(); updateMediaSession();
}
function renderInterp() {
  const FI = window.TrkFrameInterp;
  if (!interpBox) return;
  const supported = !!(FI && FI.supported());
  const m = core.settings.frameInterp || "off";
  if (interpModeNode) {
    interpModeNode.value = m;
    interpModeNode.disabled = !supported;
  }
  if (interpStrengthNode) {
    interpStrengthNode.value = String(interpStrengthValue());
    interpStrengthNode.disabled = !supported || m !== "flow";
  }
  if (interpStrengthVal) interpStrengthVal.textContent = Math.round(interpStrengthValue() * 100) + "%";
  if (interpUnsupported) {
    const st0 = FI ? FI.stats() : null;
    interpUnsupported.textContent = st0 && st0.blocked ? tr("mediaInterpBlocked") : tr("mediaInterpUnsupported");
    interpUnsupported.hidden = supported;
  }
  if (interpHintNode) interpHintNode.hidden = !supported;
  if (interpStatusNode) {
    if (!supported || m === "off") interpStatusNode.textContent = "";
    else {
      const st = FI.stats();
      interpStatusNode.textContent = !st.ready ? tr("mediaInterpWarmup")
        : tr("mediaInterpStat", { src: st.srcFps || "-", out: st.outFps || "-", w: st.w, h: st.h }) +
          (st.degraded ? " · " + tr("mediaInterpDegraded") : "");
    }
  }
}
function drawMediaStage() {
  if (!stageCanvas || !stageCtx) return;
  const w = stageCanvas.width, h = stageCanvas.height;
  if (!w || !h) return;
  let drew = false;
  const FI = window.TrkFrameInterp;
  if (FI && core.settings.frameInterp !== "off") { try { drew = FI.drawTo(stageCtx, w, h); } catch (_) { drew = false; } }
  if (!drew) {
    stageCtx.fillStyle = "#000";
    stageCtx.fillRect(0, 0, w, h);
    if (hasVideoFrames()) {
      const s = Math.min(w / core.video.videoWidth, h / core.video.videoHeight);
      const dw = core.video.videoWidth * s, dh = core.video.videoHeight * s;
      stageCtx.drawImage(core.video, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
  }
}
function mediaStageTick() {
  stageRaf = requestAnimationFrame(mediaStageTick);
  if (!mediaOpen || !stageWrap || stageWrap.hidden) return;
  /* 🪶 軽量化：映像ステージを描く回数を減らす（音・再生位置・操作はそのまま） */
  if (typeof TrkLite === "object" && !TrkLite.allow("media", performance.now())) return;
  if (!stageCtx) { try { stageCtx = stageCanvas.getContext("2d", { alpha: false }); } catch (_) { return; } }
  const dpr = typeof TrkLite === "object" ? TrkLite.pixelRatio(2) : Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.max(2, Math.round((stageCanvas.clientWidth || 480) * dpr));
  const ch = Math.max(2, Math.round((stageCanvas.clientHeight || 270) * dpr));
  if (stageCanvas.width !== cw || stageCanvas.height !== ch) { stageCanvas.width = cw; stageCanvas.height = ch; }
  drawMediaStage();
}
function syncMediaStage() {
  if (!stageWrap || !stageCanvas) return;
  const FI = window.TrkFrameInterp;
  const frames = hasVideoFrames();
  const show = mediaOpen;                       // 枠はプレーヤーを開いているときだけ
  stageWrap.hidden = !show;
  stageCanvas.hidden = !frames;                 // 映像が無い曲では注記だけ出す
  if (show && frames) {
    if (FI && core.settings.frameInterp !== "off") FI.attach("media", stageCanvas);
    if (!stageRaf) stageRaf = requestAnimationFrame(mediaStageTick);
  } else {
    if (FI) FI.detach("media");
    if (stageRaf) { cancelAnimationFrame(stageRaf); stageRaf = 0; }
  }
  if (stageNote) stageNote.hidden = frames;
}

function renderMedia() {
  if (!mediaOpen || !overlay) return;
  updateTrackText();
  const ready = !!(core.videoReady && core.currentSong);
  const cur = ready ? (core.video.currentTime || 0) : 0, dur = ready && Number.isFinite(core.video.duration) ? core.video.duration : 0;
  if (progressNode) {
    progressNode.max = String(dur || 1); progressNode.value = String(Math.min(cur, dur || 0)); progressNode.disabled = !ready;
    progressNode.setAttribute("aria-valuetext", `${mpFmt(cur)} / ${mpFmt(dur)}`);
  }
  if (timeNode) timeNode.textContent = `${mpFmt(cur)} / ${mpFmt(dur)}`;
  if (playNode) {
    const playKey = reverseActive || reverseLoading ? "mediaForward" : (core.video.ended ? "mediaRestart" : (core.video.paused || !ready ? "mediaPlay" : "mediaPause"));
    playNode.textContent = tr(playKey); playNode.dataset.i18n = playKey;
  }
  if (reverseNode) { reverseNode.textContent = tr(reverseActive || reverseLoading ? "mediaForward" : "mediaReverseStart"); reverseNode.dataset.i18n = reverseActive || reverseLoading ? "mediaForward" : "mediaReverseStart"; reverseNode.disabled = !ready; reverseNode.classList.toggle("selected", reverseActive || reverseLoading); reverseNode.setAttribute("aria-pressed", String(reverseActive || reverseLoading)); }
  if (maxNode) {
    const maxOn = !!(window.TrkVideoMax && window.TrkVideoMax.isOpen());
    const key = maxOn ? "mediaVideoMaxClose" : "mediaVideoMax";
    maxNode.textContent = tr(key); maxNode.dataset.i18n = key;
    maxNode.disabled = !ready;
    maxNode.classList.toggle("selected", maxOn);
    maxNode.setAttribute("aria-pressed", String(maxOn));
  }
  if (pipNode) {   /* 📌 画中画（trk164） */
    const pipOn = pipActive || !!(typeof document !== "undefined" && document.pictureInPictureElement);
    const pipKey = pipOn ? "mediaPipClose" : "mediaPip";
    pipNode.textContent = tr(pipKey); pipNode.dataset.i18n = pipKey;
    pipNode.disabled = !ready || !pipSupported();
    pipNode.title = pipSupported() ? "" : tr("mediaPipUnsupported");
    pipNode.classList.toggle("selected", pipOn);
    pipNode.setAttribute("aria-pressed", String(pipOn));
  }
  if (volumeNode) volumeNode.value = String(core.settings.musicVolume);
  if (muteNode) { const isMuted = reverseActive || reverseLoading ? reverseVideoMuted : core.video.muted; muteNode.textContent = isMuted ? tr("mediaUnmute") : tr("mediaMute"); muteNode.dataset.i18n = isMuted ? "mediaUnmute" : "mediaMute"; }
  if (shuffleNode) { shuffleNode.classList.toggle("selected", shuffle); shuffleNode.setAttribute("aria-pressed", String(shuffle)); }
  if (repeatNode) { repeatNode.value = repeatMode; }
  if (rateNode) rateNode.value = String(mediaRate);
  if (sleepNode) sleepNode.value = sleepTrackMode ? "track" : sleepChapterEnd ? "chapter" : sleepUntil ? String(Math.max(1, Math.round((sleepUntil - Date.now()) / 60000))) : "0";
  if (statusNode) {
    const statusKey = reverseLoading ? "mediaReverseLoading" : reverseActive ? "mediaReverse" : core.videoReady && core.currentSong ? (core.video.ended ? "mediaEnded" : core.video.paused ? "mediaPaused" : "mediaNow") : "mediaNoTrack";
    /* 🎞 trk196：曲は選べたが読み込めなかったときは「曲がありません」ではなく、その理由を出す */
    const failure = !core.videoReady && core.currentSong && core.mediaLoadFailure;
    /* 🎞 trk200：映像は出るが音が出ない入れ物（AC3・DTS の .mkv など）は、止まっているあいだ理由を出す。
       再生中は「再生中」のままにして、状態行を理由で埋めない（音が出ないことには変わりがないが、操作の邪魔をしない） */
    const silent = core.videoReady && core.video.paused && core.mediaLoadWarning;
    if (failure && failure.known) { statusNode.textContent = tr(failure.key, failure.vars); statusNode.dataset.i18n = ""; }
    else if (silent) { statusNode.textContent = tr(silent.key, silent.vars); statusNode.dataset.i18n = ""; }
    else { statusNode.textContent = tr(statusKey); statusNode.dataset.i18n = ""; }
  }
  renderLoopUI();
  renderLyrics();   /* 🎤 歌詞のハイライト（250ms周期に相乗り。パネルが閉じているときは状態表示だけ） */
  renderSubsOverlay();   /* 💬 字幕オーバーレイ（trk169・同じ周期に相乗り。変わったときだけDOMを触る） */
  renderChaptersActive();   /* 🔖 チャプターのハイライト（trk170・行が変わったときだけ付け替え） */
  checkChapterSleep();      /* 💤「チャプターの終わりで止める」の見張り（trk170） */
  noteMediaPlay();          /* 🎧「ちゃんと聴いた」計数（trk172・30秒/半分を超えたら1回だけ） */
  drawWave();               /* 🌊 波形シークバー（trk173・再生位置の塗り分けを250ms周期で更新） */
  renderWall();
  renderQueue();
  syncMediaStage();
  renderInterp();
  updateMediaSession();
  updateWakeLock();   /* 🔆 再生状態に合わせて取得／解放（250ms周期。非対応では即return） */
}
/* 🚪 メディアプレイヤーを抜けたときの続き方（trk206）＝ 純粋関数（DOMなしで決まる）。
   "keep"   … そのまま流し続ける（既定。メディアプレイヤーへ入るときと同じで曲が途切れない）
   "reload" … いったん止めて、プレビューの開始位置から鳴らし直す（❓謎設定 mediaReloadOnExit＝昔の動き）
   "pause"  … 止める（ゲーム開始などで閉じるとき／プレビューがオフのとき）
   2026-10-27 のプレイフィール改善：既定を "reload" から "keep" に変えた。 */
function mediaExitPlan(st) {
  if (!st || st.close !== true) return "pause";     /* ゲーム開始（phase が変わった）ときは止める */
  if (st.phase !== "title") return "pause";
  if (st.reloadOnExit === true) return "reload";    /* ❓謎設定（不具合の再現） */
  return st.previewEnabled === true ? "keep" : "pause";   /* プレビューがオフならタイトルでは鳴らさない */
}
function closeMedia(restore = true) {
  if (!mediaOpen) return;
  if (window.TrkVideoMax && window.TrkVideoMax.isOpen()) window.TrkVideoMax.close();   /* 🖥 全画面表示も一緒に閉じる */
  /* 📌 画中画も一緒に終える（trk164）：閉じたあとに浮き窓だけ残さない */
  if (typeof document !== "undefined" && document.pictureInPictureElement) { try { document.exitPictureInPicture(); } catch (_) {} }
  pipActive = false;
  deactivateWall(false);
  mediaOpen = false; window.Trk.overlay.set("media", false); window._trkMediaPlayerMode = false;
  clearInterval(tickTimer); tickTimer = 0; stopSleepTimer(true); seeking = false;
  clearInterval(loopTimer); loopTimer = 0; stopReverse(false, true); clearMediaLoop(true);
  saveMediaPosition(); core.video.playbackRate = 1;
  /* 🚪 抜け方（trk206）。既定は「そのまま流す」＝プレイヤーで聴いていた曲が曲リストでも途切れない */
  const exitPlan = mediaExitPlan({
    close: restore === true, phase: core.phase,
    reloadOnExit: core.settings.mediaReloadOnExit === true,
    previewEnabled: core.settings.previewEnabled === true,
  });
  if (exitPlan !== "keep") core.video.pause();
  updateWakeLock();   /* 🔆 閉じたら即解放（mediaOpen=false → 不要） */
  if (stageRaf) { cancelAnimationFrame(stageRaf); stageRaf = 0; }
  if (window.TrkFrameInterp) window.TrkFrameInterp.detach("media");
  if (stageWrap) stageWrap.hidden = true;
  overlay.hidden = true; document.body.classList.remove("mediaOpen");
  if (exitPlan === "reload" && typeof startPreview === "function") setTimeout(window.Trk.library.startPreview, 50);
  /* 流し続けるときは位置を動かさず、音量だけ選曲中のプレビュー相当へ静かに戻す（library.js） */
  else if (exitPlan === "keep" && window.Trk.library && typeof window.Trk.library.previewContinue === "function") window.Trk.library.previewContinue();
  if (mediaReturnFocus && mediaReturnFocus.isConnected) mediaReturnFocus.focus();   /* 🎥 開いた入口へ焦点を戻す（trk186） */
  else if (powerButton) powerButton.focus();
}
function openMedia() {
  if (!overlay || mediaOpen || (window.TrkSafeMode && TrkSafeMode())) return;
  mediaReturnFocus = document.activeElement;
  if (window.Trk.overlay.is("synth") && typeof window._trkCloseSynth === "function") window._trkCloseSynth();
  mediaOpen = true; window.Trk.overlay.set("media", true); window._trkMediaPlayerMode = true;
  overlay.hidden = false; document.body.classList.add("mediaOpen");
  if (core.videoReady) { core.video.muted = false; core.video.volume = core.settings.musicVolume; setRate(mediaRate); }
  /* ⏪ 止まっている／終わっているときだけ続き位置へ（再生中の飛び防止。再開時は巻き戻しを適用＝trk164） */
  if (core.currentSong && core.videoReady && (core.video.paused || core.video.ended)) { try { core.video.currentTime = savedMediaPosition({ resume: true }); } catch (_) {} }
  tickTimer = setInterval(renderMedia, 250); loopTimer = setInterval(checkMediaLoop, 40);
  renderMedia(); updateMediaSession(); syncMediaStage();
  if (lyricsBoxOpen()) loadLyrics();   /* 🎤 開いたままだった歌詞パネルの読み直し（trk166） */
  loadSubs(true);   /* 💬 字幕はパネルが閉じていても読む（オーバーレイ表示のため・trk169） */
  loadChapters(true);   /* 🔖 チャプターも先に読む（「チャプターの終わりで止める」がパネルを閉じていても使えるように・trk170） */
  mediaPlayNotedKey = "";   /* 🎧 開き直しも新しい再生として数え直す（trk172） */
  const focus = playNode || closeNode; if (focus) focus.focus();
}
function syncMediaOpenBtn() {   /* 🎥 基地ボタンの文言（trk186） */
  const button = document.getElementById("mediaOpenBtn");
  if (!button) return;
  button.textContent = tr("mediaOpenBtn");
  button.title = tr("mediaOpenBtnHint");
}
let closeNode;
function buildMedia() {
  powerButton = document.querySelector("#tvDock .tvPow");
  if (!powerButton) return false;
  const mediaOpenBtn = document.getElementById("mediaOpenBtn");   /* 🎥 常時入口（trk186） */
  if (mediaOpenBtn) {
    syncMediaOpenBtn();
    mediaOpenBtn.addEventListener("click", openMedia);
  }
  overlay = core.el("div", "instOverlay mediaOverlay"); overlay.id = "mediaPlayerMode"; overlay.hidden = true;
  const backdrop = core.el("div", "instBackdrop");
  dialog = core.el("section", "instDialog mediaDialog"); dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true"); dialog.setAttribute("aria-labelledby", "mediaTitle");
  const header = core.el("header", "instHeader mediaHeader");
  const hwrap = core.el("div"); const h = tx("h2", "mediaTitle"); h.id = "mediaTitle";
  hwrap.append(h, tx("p", "mediaSubtitle", "instSubtitle"));
  closeNode = makeButton("mediaClose", "instClose mediaExitBtn");   /* ← 曲リストに戻る（trk187・明示ボタンは即退出） */
  closeNode.addEventListener("click", () => closeMedia());
  header.append(hwrap, closeNode);

  const display = core.el("div", "mediaDisplay");
  titleNode = core.el("strong", "mediaDisplayTitle", tr("mediaNoTrack"));
  subNode = core.el("span", "mediaDisplaySub", tr("mediaModeStatus"));
  statusNode = core.el("span", "mediaStatus", tr("mediaPaused"));
  display.append(titleNode, subNode, statusNode);

  /* ✨ 映像エリア（フレーム補完の効果をここで見られます） */
  stageWrap = core.el("div", "mediaStage"); stageWrap.hidden = true;
  stageCanvas = document.createElement("canvas"); stageCanvas.className = "mediaStageCanvas"; stageCanvas.hidden = true;
  stageNote = core.el("div", "mediaStageNote hint", tr("mediaStageNoVideo")); stageNote.dataset.i18n = "mediaStageNoVideo";
  subsOverlay = core.el("div", "mediaSubs"); subsOverlay.hidden = true;   /* 💬 字幕オーバーレイ（trk169・クリックは通す） */
  stageWrap.append(stageCanvas, subsOverlay, stageNote);

  const controls = core.el("div", "mediaControls");
  const prev = makeButton("mediaPrev", "mediaControlBtn");
  playNode = makeButton("mediaPlay", "mediaControlBtn mediaPlayBtn");
  const next = makeButton("mediaNext", "mediaControlBtn");
  reverseNode = makeButton("mediaReverseStart", "mediaSmallBtn");
  /* 🖥 逆再生の右＝「全画面で表示」（壁紙はひとつ右へずれます） */
  maxNode = makeButton("mediaVideoMax", "mediaSmallBtn");
  /* 📌 画中画（trk164）：全画面の右に置く。非対応ブラウザでは無効のまま理由をタイトルで示す */
  pipNode = makeButton("mediaPip", "mediaSmallBtn");
  pipNode.addEventListener("click", togglePip);
  core.video.addEventListener("enterpictureinpicture", () => { pipActive = true; renderMedia(); });
  core.video.addEventListener("leavepictureinpicture", () => { pipActive = false; renderMedia(); });
  wallNode = makeButton("mediaWallShow", "mediaSmallBtn");
  const restart = makeButton("mediaRestart", "mediaSmallBtn");
  prev.addEventListener("click", () => stepMedia(-1)); playNode.addEventListener("click", playPause); next.addEventListener("click", () => stepMedia(1)); reverseNode.addEventListener("click", toggleReverse); wallNode.addEventListener("click", toggleWall);
  restart.addEventListener("click", () => { if (core.videoReady) { if (reverseActive || reverseLoading) stopReverse(false, true); saveMediaPosition(true); core.video.currentTime = 0; core.video.play().catch(() => {}); } });
  maxNode.addEventListener("click", () => { if (window.TrkVideoMax) window.TrkVideoMax.toggle(); });
  if (window.TrkVideoMax) window.TrkVideoMax.onChange(() => renderMedia());
  controls.append(prev, playNode, next, reverseNode, maxNode, pipNode, wallNode, restart);

  const progressRow = core.el("div", "mediaProgressRow");
  progressNode = document.createElement("input"); progressNode.type = "range"; progressNode.min = "0"; progressNode.step = "0.1"; progressNode.value = "0"; progressNode.className = "mediaProgress"; progressNode.setAttribute("aria-label", tr("mediaSeek"));
  timeNode = core.el("span", "mono mediaTime", "0:00 / 0:00");
  /* 🌊 波形シークバー（trk173）：range の上に canvas を重ねる（pointer-events:none＝操作は range のまま）。
     吹き出しはホバー位置の時刻（動画フレームのサムネはデコード経路が別なので今回は見送り） */
  waveWrapNode = core.el("div", "mediaProgressWrap");
  waveNode = document.createElement("canvas"); waveNode.className = "mediaWave"; waveNode.setAttribute("aria-hidden", "true"); waveNode.hidden = true;
  waveTipNode = core.el("div", "mediaWaveTip"); waveTipNode.hidden = true;
  waveWrapNode.append(waveNode, progressNode, waveTipNode);
  progressRow.append(waveWrapNode, timeNode);
  waveWrapNode.addEventListener("pointermove", e => {
    if (!waveTipNode || core.settings.mediaWave === false || !core.videoReady || !Number.isFinite(core.video.duration) || core.video.duration <= 0) return;
    const r = waveWrapNode.getBoundingClientRect();
    if (!r.width) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    waveTipNode.textContent = mpFmt(ratio * core.video.duration);
    waveTipNode.style.left = (ratio * 100) + "%";
    waveTipNode.hidden = false;
  });
  waveWrapNode.addEventListener("pointerleave", () => { if (waveTipNode) waveTipNode.hidden = true; });
  if (typeof ResizeObserver === "function") {   /* 幅が変わったら包絡を計算し直す（Dialog のリサイズ・端末回転） */
    const ro = new ResizeObserver(() => { waveCols = null; waveSig = ""; drawWave(); });
    ro.observe(waveWrapNode);
  }
  progressNode.addEventListener("pointerdown", () => { seeking = true; });
  progressNode.addEventListener("pointerup", () => { seeking = false; });
  progressNode.addEventListener("input", () => { if (core.videoReady && core.video.duration) { if (reverseActive || reverseLoading) stopReverse(false, true); core.video.currentTime = Number(progressNode.value); timeNode.textContent = `${mpFmt(core.video.currentTime)} / ${mpFmt(core.video.duration)}`; } });

  /* ✨ フレーム補完の設定（区間ループのすぐ上） */
  const FI = window.TrkFrameInterp;
  interpBox = core.el("section", "mediaInterpBox");
  const fiHead = tx("h3", "mediaInterpTitle");
  const fiRow = core.el("label", "mediaOption mediaInterpRow");
  fiRow.append(tx("span", "mediaInterpMode"));
  interpModeNode = document.createElement("select");
  for (const [value, key] of [["off", "mediaInterpOff"], ["blend", "mediaInterpBlend"], ["flow", "mediaInterpFlow"]]) {
    const o = document.createElement("option"); o.value = value; o.dataset.i18n = key; o.textContent = tr(key); interpModeNode.append(o);
  }
  fiRow.append(interpModeNode);
  const fiStrengthRow = core.el("label", "mediaOption mediaInterpRow");
  fiStrengthRow.append(tx("span", "mediaInterpStrength"));
  interpStrengthNode = document.createElement("input");
  interpStrengthNode.type = "range"; interpStrengthNode.min = "0"; interpStrengthNode.max = "1"; interpStrengthNode.step = "0.05";
  interpStrengthVal = core.el("span", "mono");
  fiStrengthRow.append(interpStrengthNode, interpStrengthVal);
  interpStatusNode = core.el("div", "hint mediaInterpStatus", "");
  interpHintNode = tx("p", "mediaInterpHint", "hint");
  interpUnsupported = tx("p", "mediaInterpUnsupported", "hint status");
  interpUnsupported.hidden = true;
  interpBox.append(fiHead, fiRow, fiStrengthRow, interpStatusNode, interpHintNode, interpUnsupported);
  interpModeNode.addEventListener("change", () => { if (FI) FI.setMode(interpModeNode.value); renderInterp(); renderMedia(); });
  interpStrengthNode.addEventListener("input", () => {
    core.settings.frameInterpStrength = Number(interpStrengthNode.value);
    interpStrengthVal.textContent = Math.round(core.settings.frameInterpStrength * 100) + "%";
    core.saveUserPrefs();
  });
  if (FI) FI.onChange(renderInterp);

  const loopBox = core.el("section", "mediaLoopBox");
  const loopHeading = tx("h3", "mediaLoop");
  loopStatusNode = core.el("div", "hint", tr("mediaLoopNone"));
  const loopHint = tx("p", "mediaLoopHint", "hint");
  const loopButtons = core.el("div", "miniActions");
  loopSetANode = makeButton("mediaLoopSetA"); loopSetBNode = makeButton("mediaLoopSetB"); loopClearNode = makeButton("mediaLoopClear");
  loopSetANode.addEventListener("click", () => setMediaLoopPoint("a")); loopSetBNode.addEventListener("click", () => setMediaLoopPoint("b")); loopClearNode.addEventListener("click", () => clearMediaLoop());
  loopButtons.append(loopSetANode, loopSetBNode, loopClearNode);
  const loopModeLabel = core.el("label", "mediaOption"); loopModeLabel.append(tx("span", "mediaLoopMode"));
  loopModeNode = document.createElement("select");
  for (const [value, key] of [["toggle", "mediaLoopToggle"], ["hold", "mediaLoopHold"]]) { const o = document.createElement("option"); o.value = value; o.dataset.i18n = key; o.textContent = tr(key); loopModeNode.append(o); }
  loopModeLabel.append(loopModeNode); loopModeNode.addEventListener("change", () => { core.settings.mediaLoopTrigger = loopModeNode.value; core.saveUserPrefs(); if (core.settings.mediaLoopTrigger !== "hold") loopActive = loopHasRange(); renderLoopUI(); });
  const loopLabHeading = tx("h4", "mediaLoopLabTitle");
  const loopQuickHint = tx("p", "mediaLoopQuickHint", "hint");
  const loopQuickButtons = core.el("div", "miniActions"); loopQuickNodes = [];
  for (const [seconds, key] of [[5, "mediaLoopQuick5"], [10, "mediaLoopQuick10"], [20, "mediaLoopQuick20"]]) { const b = makeButton(key, "mediaSmallBtn"); b.addEventListener("click", () => setQuickMediaLoop(seconds)); loopQuickButtons.append(b); loopQuickNodes.push(b); }
  const randomLoop = makeButton("mediaLoopRandom", "mediaSmallBtn"); randomLoop.addEventListener("click", setRandomMediaLoop); loopQuickButtons.append(randomLoop); loopQuickNodes.push(randomLoop);
  const loopSaveRow = core.el("div", "miniActions"); loopSaveNode = makeButton("mediaLoopSave", "mediaSmallBtn"); loopSaveNode.addEventListener("click", saveMediaLoopPreset); loopClearPresetsNode = makeButton("mediaLoopClearPresets", "mediaSmallBtn"); loopClearPresetsNode.addEventListener("click", clearMediaLoopPresets); loopSaveRow.append(loopSaveNode, loopClearPresetsNode);
  const loopPresetHeading = tx("div", "mediaLoopPresets", "mediaLoopPresetHeading"); loopPresetListNode = core.el("div", "mediaLoopPresetList");
  /* 🎛 ループ・ラボ（クイック・保存・プリセット）は開発者表示（設定 devView）の中。A-B の基本操作は常に出す */
  const loopLabBox = core.el("div", "mediaLoopLab devOnly");
  loopLabBox.append(loopLabHeading, loopQuickHint, loopQuickButtons, loopSaveRow, loopPresetHeading, loopPresetListNode);
  loopBox.append(loopHeading, loopStatusNode, loopHint, loopButtons, loopModeLabel, loopLabBox);

  /* 🎤 歌詞（trk166）：折りたたみパネル。開いたときだけ歌詞を読む（埋め込みタグはファイルに触るので） */
  lyricsBox = core.el("details", "mediaLyricsBox"); lyricsBox.id = "mediaLyricsBox";
  if (core.settings.mediaLyricsOpen) lyricsBox.open = true;
  lyricsBox.append(tx("summary", "mediaLyricsTitle"), tx("p", "mediaLyricsHint", "hint"));
  lyricsSourceNode = core.el("div", "hint mediaLyricsSource", tr("mediaLyricsNone"));
  const lyricsActions = core.el("div", "miniActions");
  const lyricsUploadRow = core.el("label", "mediaLyricsUploadRow"); lyricsUploadRow.append(tx("span", "mediaLyricsChoose"));
  lyricsFileNode = document.createElement("input"); lyricsFileNode.type = "file"; lyricsFileNode.accept = ".lrc,.txt,text/plain";
  lyricsUploadRow.append(lyricsFileNode);
  lyricsClearNode = makeButton("mediaLyricsClear", "mediaSmallBtn"); lyricsClearNode.disabled = true;
  lyricsClearNode.addEventListener("click", () => {
    const api = window.Trk.lyrics, song = core.currentSong;
    if (!api || !song) return;
    api.clearManualLyrics(song.key);
    loadLyrics(true);
  });
  lyricsActions.append(lyricsUploadRow, lyricsClearNode);
  lyricsListNode = core.el("div", "mediaLyricsList");
  lyricsBox.append(lyricsSourceNode, lyricsActions, lyricsListNode);
  lyricsBox.addEventListener("toggle", () => {
    core.settings.mediaLyricsOpen = lyricsBox.open; core.saveUserPrefs();
    if (lyricsBox.open) loadLyrics(); else lyricsState.active = -2;
  });
  lyricsFileNode.addEventListener("change", () => { const f = lyricsFileNode.files && lyricsFileNode.files[0]; lyricsFileNode.value = ""; if (f) chooseLyricsFile(f); });

  /* 💬 字幕（trk169）：折りたたみパネル（動画の曲だけ表示）。オーバーレイはパネルの開閉に関係なく働く */
  subsBox = core.el("details", "mediaSubsBox"); subsBox.id = "mediaSubsBox"; subsBox.hidden = true;
  if (core.settings.mediaSubsOpen) subsBox.open = true;
  subsBox.append(tx("summary", "mediaSubsTitle"), tx("p", "mediaSubsHint", "hint"));
  subsSourceNode = core.el("div", "hint mediaSubsSource", tr("mediaSubsNone"));
  const subsActions = core.el("div", "miniActions");
  const subsUploadRow = core.el("label", "mediaSubsUploadRow"); subsUploadRow.append(tx("span", "mediaSubsChoose"));
  subsFileNode = document.createElement("input"); subsFileNode.type = "file"; subsFileNode.accept = ".srt,.vtt,text/plain";
  subsUploadRow.append(subsFileNode);
  subsClearNode = makeButton("mediaSubsClear", "mediaSmallBtn"); subsClearNode.disabled = true;
  subsClearNode.addEventListener("click", () => {
    const api = window.Trk.subtitles, song = core.currentSong;
    if (!api || !song) return;
    api.clearManualSubs(song.key);
    loadSubs(true);
  });
  subsActions.append(subsUploadRow, subsClearNode);
  const subsOnLab = core.el("label", "check");
  subsOnNode = document.createElement("input"); subsOnNode.type = "checkbox"; subsOnNode.checked = core.settings.mediaSubsOn !== false;
  subsOnLab.append(subsOnNode, tx("span", "mediaSubsOn"));
  subsOnNode.addEventListener("change", () => {
    core.settings.mediaSubsOn = subsOnNode.checked; core.saveUserPrefs();
    applySubs(); renderSubs();
  });
  const subsOffsetRow = core.el("div", "mediaSubsOffsetRow");
  subsOffsetRow.append(tx("span", "mediaSubsOffset"));
  subsEarlierNode = makeButton("mediaSubsEarlier", "mediaSmallBtn");
  subsResetNode = makeButton("mediaSubsReset", "mediaSmallBtn");
  subsLaterNode = makeButton("mediaSubsLater", "mediaSmallBtn");
  subsEarlierNode.addEventListener("click", () => shiftSubsOffset(-250));
  subsLaterNode.addEventListener("click", () => shiftSubsOffset(250));
  subsResetNode.addEventListener("click", () => shiftSubsOffset(-(subsState.data ? subsState.data.offsetMs : 0)));
  subsOffsetNode = core.el("span", "mono", "");
  subsOffsetRow.append(subsEarlierNode, subsResetNode, subsLaterNode, subsOffsetNode);
  subsBox.append(subsSourceNode, subsActions, subsOnLab, subsOffsetRow);
  subsBox.addEventListener("toggle", () => {
    core.settings.mediaSubsOpen = subsBox.open; core.saveUserPrefs();
    if (subsBox.open) loadSubs();
  });
  subsFileNode.addEventListener("change", () => { const f = subsFileNode.files && subsFileNode.files[0]; subsFileNode.value = ""; if (f) chooseSubsFile(f); });

  /* 🔖 チャプター（trk170）：折りたたみパネル（M4B などチャプターを持てる曲だけ表示）。クリックでジャンプ */
  chapBox = core.el("details", "mediaChapBox"); chapBox.id = "mediaChapBox"; chapBox.hidden = true;
  if (core.settings.mediaChapOpen) chapBox.open = true;
  chapBox.append(tx("summary", "mediaChapTitle"), tx("p", "mediaChapHint", "hint"));
  chapSourceNode = core.el("div", "hint mediaChapSource", tr("mediaChapNone"));
  chapNowNode = core.el("div", "hint mediaChapNow");
  const chapNavRow = core.el("div", "miniActions");
  chapPrevNode = makeButton("mediaChapPrev", "mediaSmallBtn");
  chapNextNode = makeButton("mediaChapNext", "mediaSmallBtn");
  chapPrevNode.addEventListener("click", () => stepChapter(-1));
  chapNextNode.addEventListener("click", () => stepChapter(1));
  chapNavRow.append(chapPrevNode, chapNextNode);
  chapListNode = core.el("div", "mediaChapList");
  chapBox.append(chapSourceNode, chapNowNode, chapNavRow, chapListNode);
  chapBox.addEventListener("toggle", () => {
    core.settings.mediaChapOpen = chapBox.open; core.saveUserPrefs();
    if (chapBox.open) loadChapters();
  });

  const options = core.el("div", "mediaOptions");
  const volumeRow = core.el("label", "mediaOption mediaVolumeRow"); volumeRow.append(tx("span", "mediaVolume"));
  volumeNode = document.createElement("input"); volumeNode.type = "range"; volumeNode.min = "0"; volumeNode.max = "1"; volumeNode.step = "0.01"; volumeRow.append(volumeNode);
  volumeNode.addEventListener("input", () => { core.settings.musicVolume = Number(volumeNode.value); if (core.settings.musicVolume > 0) core.rememberMusicVolume(core.settings.musicVolume); core.video.volume = core.settings.musicVolume; if (reverseGain) reverseGain.gain.value = core.settings.musicVolume; core.saveUserPrefs(); });
  muteNode = makeButton("mediaMute", "mediaSmallBtn"); muteNode.addEventListener("click", () => { if (reverseActive || reverseLoading) { reverseVideoMuted = !reverseVideoMuted; if (reverseGain) reverseGain.gain.value = reverseVideoMuted ? 0 : core.settings.musicVolume; } else core.video.muted = !core.video.muted; renderMedia(); });
  shuffleNode = makeButton("mediaShuffle", "mediaSmallBtn"); shuffleNode.addEventListener("click", () => setShuffle(!shuffle));
  const repeatLabel = core.el("label", "mediaOption"); repeatLabel.append(tx("span", "mediaRepeat"));
  repeatNode = document.createElement("select");
  for (const [value, key] of [["off", "mediaRepeatOff"], ["one", "mediaRepeatOne"], ["all", "mediaRepeatAll"]]) { const o = document.createElement("option"); o.value = value; o.dataset.i18n = key; o.textContent = tr(key); repeatNode.append(o); }
  repeatLabel.append(repeatNode); repeatNode.addEventListener("change", () => setRepeat(repeatNode.value));
  const rateLabel = core.el("label", "mediaOption"); rateLabel.append(tx("span", "mediaRate"));
  rateNode = document.createElement("select"); for (const v of [.5, .75, 1, 1.25, 1.5, 2]) { const o = document.createElement("option"); o.value = v; o.textContent = `${v.toFixed(2)}x`; rateNode.append(o); }
  rateLabel.append(rateNode); rateNode.addEventListener("change", () => { setRate(rateNode.value); });
  const sleepLabel = core.el("label", "mediaOption"); sleepLabel.append(tx("span", "mediaSleep"));
  sleepNode = document.createElement("select"); for (const [v, key] of [[0, "mediaSleepOff"], [15, "mediaSleep15"], [30, "mediaSleep30"], [60, "mediaSleep60"]]) { const o = document.createElement("option"); o.value = v; o.dataset.i18n = key; o.textContent = tr(key); sleepNode.append(o); }
  { const o = document.createElement("option"); o.value = "track"; o.dataset.i18n = "mediaSleepTrack"; o.textContent = tr("mediaSleepTrack"); sleepNode.append(o); }  /* 💤 この曲の終わりで止める（trk164） */
  { const o = document.createElement("option"); o.value = "chapter"; o.dataset.i18n = "mediaSleepChapter"; o.textContent = tr("mediaSleepChapter"); sleepNode.append(o); }  /* 🔖 チャプターの終わりで止める（trk170） */
  sleepLabel.append(sleepNode); sleepNode.addEventListener("change", () => setSleep(sleepNode.value === "track" ? -1 : sleepNode.value === "chapter" ? -2 : sleepNode.value));
  /* ⏪ スマート巻き戻し（trk164）：続きから再生するときだけ数秒戻す。オーディオブックの定番。初期オフ */
  /* ⏮ 常に最初から再生（trk193）：設定画面・曲名タブのバーと同じ1つの値を、ここからも変えられる）
     メディアプレーヤーの中に置くことで「続きから」の設定がその場で見つかる。 */
  const zeroRow = core.el("label", "mediaOption mediaCheckRow");
  startZeroNode = document.createElement("input"); startZeroNode.type = "checkbox"; startZeroNode.id = "mediaStartFromZeroPlayer";
  const zeroText = document.createElement("span"); zeroText.dataset.i18n = "mediaStartFromZero"; zeroText.textContent = tr("mediaStartFromZero");
  zeroRow.append(startZeroNode, zeroText);
  startZeroNode.checked = core.settings.mediaStartFromZero === true;
  startZeroNode.addEventListener("change", () => {
    core.settings.mediaStartFromZero = startZeroNode.checked === true;
    core.saveUserPrefs();
    if (typeof window.Trk.library.setStartFromZero === "function") window.Trk.library.setStartFromZero(startZeroNode.checked);
    else if (typeof window.Trk.library.syncStartZeroInputs === "function") window.Trk.library.syncStartZeroInputs();
    if (startZeroNode.checked) { try { core.video.currentTime = 0; } catch (_) {} }
  });
  const resumeLabel = core.el("label", "mediaOption"); resumeLabel.append(tx("span", "mediaResumeRewind"));
  resumeNode = document.createElement("select");
  for (const [v, key] of [[0, "mediaResumeOff"], [3, ""], [5, ""], [10, ""], [15, ""], [30, ""]]) {
    const o = document.createElement("option"); o.value = String(v);
    if (key) { o.dataset.i18n = key; o.textContent = tr(key); } else o.textContent = `${v}s`;  /* 秒数は言語に依らない表記 */
    resumeNode.append(o);
  }
  resumeNode.value = [0, 3, 5, 10, 15, 30].includes(Number(core.settings.mediaResumeRewind)) ? String(Number(core.settings.mediaResumeRewind)) : "0";
  resumeNode.addEventListener("change", () => {
    core.settings.mediaResumeRewind = resumeRewindSeconds(resumeNode.value);
    core.saveUserPrefs();
    if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaResumeSet", { s: core.settings.mediaResumeRewind }));
  });
  resumeLabel.append(resumeNode);
  options.append(volumeRow, muteNode, shuffleNode, repeatLabel, rateLabel, sleepLabel, resumeLabel, zeroRow);

  const queuePanel = core.el("section", "mediaQueuePanel");
  const qhead = core.el("div", "mediaQueueHead"); qhead.append(tx("h3", "mediaQueue"), tx("p", "mediaQueueHint", "hint"));
  searchNode = document.createElement("input"); searchNode.type = "search"; searchNode.placeholder = tr("mediaSearch"); searchNode.dataset.i18nPlaceholder = "mediaSearch"; searchNode.className = "mediaSearch"; searchNode.addEventListener("input", () => { queueFilter = searchNode.value; renderQueue(); });
  queueNode = core.el("div", "mediaQueueList"); queuePanel.append(qhead, searchNode, queueNode);

  const footer = core.el("footer", "instFooter mediaFooter"); footer.append(tx("span", "mediaModeStatus"), tx("span", "mediaKeyboard", "instKeyHint"));
  /* 📜 ヘッダー（← 曲リストに戻る）はスクロール面の外に置き、中身だけ .mediaBody でスクロールさせる（trk187）。
     インラインのパネル順は従来どおり変えない。 */
  const body = core.el("div", "instBody mediaBody");
  body.append(display, stageWrap, controls, progressRow, lyricsBox, subsBox, chapBox, interpBox, loopBox, options, queuePanel, footer);
  dialog.append(header, body);
  wallOverlay = core.el("section", "mediaWall"); wallOverlay.hidden = true; wallOverlay.setAttribute("role", "dialog"); wallOverlay.setAttribute("aria-modal", "true"); wallOverlay.setAttribute("aria-label", tr("mediaWall"));
  const wallTop = core.el("div", "mediaWallTop"); wallTop.append(tx("strong", "mediaWall"));
  const wallClose = makeButton("mediaWallHide", "mediaWallClose"); wallClose.addEventListener("click", () => deactivateWall(true)); wallTop.append(wallClose);
  const wallCenter = core.el("div", "mediaWallCenter"); wallClockNode = core.el("div", "mediaWallClock", "00:00:00"); wallDateNode = core.el("div", "mediaWallDate", ""); wallCenter.append(wallClockNode, wallDateNode);
  const wallHint = tx("div", "mediaWallHint", "mediaWallHintText");
  wallOverlay.append(wallTop, wallCenter, wallHint);
  overlay.append(backdrop, dialog, wallOverlay); document.body.append(overlay);

  backdrop.addEventListener("click", () => closeMedia());
  overlay.addEventListener("click", e => { if (e.target === overlay) closeMedia(); });
  overlay.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.code === "Tab") {
      const fs = [...dialog.querySelectorAll("button,input,select")].filter(n => !n.disabled && !n.hidden && n.getClientRects().length);
      if (!fs.length) return;
      const i = fs.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); fs[fs.length - 1].focus(); }
      else if (!e.shiftKey && (i < 0 || i === fs.length - 1)) { e.preventDefault(); fs[0].focus(); }
    }
  });
  overlay.addEventListener("keyup", e => e.stopPropagation());
  const isTyping = t => t && ["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName);
  addEventListener("keydown", e => {
    const code = core.keyCodeOf(e);      // 📺 TVリモコン・メディアキー対応（e.code が空でも e.key を使う）
    if (mediaExitBinding !== null) { e.preventDefault(); e.stopImmediatePropagation(); captureMediaExitKey(code); return; }
    if (videoBinding !== null) { e.preventDefault(); e.stopImmediatePropagation(); captureVideoKey(code); return; }
    if (window.Trk.overlay.is("synth") || window.Trk.overlay.is("study")) return;
    const videoKey = (core.settings.videoKeys || []).indexOf(code);
    if (videoKey >= 0 && (mediaActive() || core.phase === "title" || core.phase === "paused")) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat && (!wallActive || videoKey === WALL_KEY_INDEX)) videoAction(videoKey);
      return;
    }
    if (!mediaOpen) return;
    if (wallActive && code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); deactivateWall(true); return; }
    if (code === core.settings.mediaExitKey || code === "Escape" || code === "BrowserBack" || code === "GoBack") { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) requestMediaExit(); return; }
    if (wallActive) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (isTyping(e.target)) return;
    if (e.code === "Space") { e.preventDefault(); e.stopImmediatePropagation(); playPause(); }
    else if (e.code === "ArrowLeft") { e.preventDefault(); e.stopImmediatePropagation(); seekBy(-10); }
    else if (e.code === "ArrowRight") { e.preventDefault(); e.stopImmediatePropagation(); seekBy(10); }
    else if (e.code === "KeyN") { e.preventDefault(); e.stopImmediatePropagation(); stepMedia(1); }
    else if (e.code === "KeyP") { e.preventDefault(); e.stopImmediatePropagation(); stepMedia(-1); }
  }, true);
  addEventListener("keyup", e => {
    if (mediaExitBinding !== null || videoBinding !== null || window.Trk.overlay.is("synth") || window.Trk.overlay.is("study") || !mediaActive()) return;
    if (core.settings.mediaLoopTrigger === "hold" && (core.settings.videoKeys || [])[LOOP_KEY_INDEX] === core.keyCodeOf(e)) {
      e.preventDefault(); e.stopImmediatePropagation(); releaseHeldLoop();
    }
    if (core.settings.mediaWallTrigger === "hold" && (core.settings.videoKeys || [])[WALL_KEY_INDEX] === core.keyCodeOf(e) && wallKeyDown) {
      e.preventDefault(); e.stopImmediatePropagation(); deactivateWall(true);
    }
  }, true);

  let lastPositionSave = 0;
  for (const type of ["play", "pause", "timeupdate", "loadedmetadata", "durationchange", "volumechange", "ratechange", "ended", "loadeddata"]) core.video.addEventListener(type, () => {
    if (type === "timeupdate" && Date.now() - lastPositionSave > 2000) { lastPositionSave = Date.now(); saveMediaPosition(); }
    if (type === "ended") endedMedia(); else renderMedia();
  });
  core.on("beforeLoad", () => { if (clipAbort) clipAbort(); stopReverse(false, true); clearMediaLoop(true); reverseBuffer = null; reverseBufferKey = ""; });
  core.on("songSelected", () => { renderMedia(); if (lyricsBoxOpen()) loadLyrics(); loadSubs(true); });   /* 🎤 曲が変わったら歌詞も（trk166）💬 字幕も（trk169） */
  core.on("mediaReady", () => { if (mediaOpen) renderMedia(); updateMediaSession(); });
  core.on("songSelected", () => { loadChapters(true); });   /* 🔖 曲が変わったらチャプターも（trk170・上の歌詞/字幕の行とは別に購読） */
  core.on("songSelected", () => { mediaPlayNotedKey = ""; });   /* 🎧 新しい曲の「ちゃんと聴いた」計数は最初から（trk172・これも別購読） */
  core.on("records", renderQueue); core.on("packsChanged", renderQueue);
  core.on("songTags", () => { renderQueue(); if (mediaOpen) renderMedia(); });   /* 🏷 タグが届いたら表示名を追従（trk167） */ core.on("language", () => {
    syncMediaOpenBtn();   /* 🎥 基地ボタンの文言も追従（trk186） */
    if (stageNote) { stageNote.textContent = tr("mediaStageNoVideo"); stageNote.dataset.i18n = "mediaStageNoVideo"; }
    renderInterp();
    loopPresetRenderKey = loopPresetRenderSig = null;
    if (searchNode) searchNode.placeholder = tr("mediaSearch");
    if (progressNode) progressNode.setAttribute("aria-label", tr("mediaSeek"));
    if (wallOverlay) wallOverlay.setAttribute("aria-label", tr("mediaWall"));
    if (lyricsListNode) lyricsListNode.dataset.sig = "";   /* 🎤 言語が変わったら歌詞リストを作り直す（trk166） */
    renderSubs();   /* 💬 字幕パネルの出典・状態の文章を新しい言語で（trk169） */
    if (mediaOpen) renderMedia();
  });
  core.on("phase", p => { if (p !== "title" && mediaOpen) closeMedia(false); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && mediaOpen) { releaseHeldLoop(); stopReverse(false, true); core.video.pause(); }
    else if (!document.hidden && mediaOpen) updateWakeLock();   /* 🔆 タブに戻ったら取り直し（非表示で自動解放されるため。trk164） */
  });

  let pointerTimer = 0;
  powerButton.addEventListener("pointerdown", e => {
    if (e.button !== undefined && e.button !== 0) return;
    clearTimeout(pointerTimer); longPressed = false;
    pointerTimer = setTimeout(() => { longPressed = true; openMedia(); }, HOLD_MS);
  }, true);
  for (const type of ["pointerup", "pointerleave", "pointercancel"]) powerButton.addEventListener(type, () => { clearTimeout(pointerTimer); }, true);
  powerButton.addEventListener("click", e => {
    if (!longPressed) return;
    e.preventDefault(); e.stopImmediatePropagation(); longPressed = false;
  }, true);
  powerButton.addEventListener("contextmenu", e => e.preventDefault());

  function buildVideoKeysUI() {
    const anchor = document.querySelector('#settingsScreen [data-i18n="playerMode"]')?.closest("label");
    if (!anchor || document.getElementById("mediaVideoKeysPanel")) return;
    const panel = core.el("details", "subPanel"); panel.id = "mediaVideoKeysPanel";
    const heading = tx("summary", "mediaVideoKeysTitle");
    const hint = tx("div", "mediaVideoKeysHint", "hint");
    const rows = core.el("div", "keyRows"); rows.style.marginTop = "10px";
    const reset = tx("button", "mediaVideoKeysReset"); reset.type = "button"; reset.style.marginTop = "8px";
    syncVideoKeysUI = () => {
      rows.textContent = "";
      VIDEO_KEY_LABELS.forEach((key, i) => {
        const row = core.el("div", "keyRow"), b = core.el("button", "", tr("assign"));
        b.type = "button"; b.classList.toggle("listening", videoBinding === i);
        b.addEventListener("click", () => { core.bindingSlot = null; core.updateKeyUI(); videoBinding = i; syncVideoKeysUI(); });
        row.append(core.el("strong", "", tr(key)), core.el("span", "keyValue", core.formatKey(core.settings.videoKeys[i])), b);
        rows.append(row);
      });
    };
    reset.addEventListener("click", () => { core.settings.videoKeys = core.VIDEO_KEY_DEFAULTS.slice(); videoBinding = null; core.saveUserPrefs(); syncVideoKeysUI(); });
    panel.append(heading, hint, rows, reset);
    const wallPanel = core.el("details", "subPanel mediaWallSettingsPanel"); wallPanel.id = "mediaWallSettingsPanel";
    const wallHeading = tx("summary", "mediaWall");
    const wallHint = tx("div", "mediaWallHint", "hint");
    const wallStyleLabel = core.el("label", "mediaOption"); wallStyleLabel.append(tx("span", "mediaWallStyle"));
    wallStyleNode = document.createElement("select");
    for (const [value, key] of [["midnight", "mediaWallMidnight"], ["aurora", "mediaWallAurora"], ["paper", "mediaWallPaper"], ["custom", "mediaWallCustom"]]) { const o = document.createElement("option"); o.value = value; o.dataset.i18n = key; o.textContent = tr(key); wallStyleNode.append(o); }
    wallStyleLabel.append(wallStyleNode);
    const wallClockLabel = core.el("label", "checkLine"); wallClockCheck = document.createElement("input"); wallClockCheck.type = "checkbox"; wallClockLabel.append(wallClockCheck, tx("span", "mediaWallClock"));
    const wallPlaybackLabel = core.el("label", "mediaOption"); wallPlaybackLabel.append(tx("span", "mediaWallPlayback"));
    wallPlaybackNode = document.createElement("select"); for (const [value, key] of [["stop", "mediaWallStopVideo"], ["continue", "mediaWallContinueVideo"]]) { const o = document.createElement("option"); o.value = value; o.dataset.i18n = key; o.textContent = tr(key); wallPlaybackNode.append(o); } wallPlaybackLabel.append(wallPlaybackNode);
    const wallTriggerLabel = core.el("label", "mediaOption"); wallTriggerLabel.append(tx("span", "mediaWallTrigger"));
    wallTriggerNode = document.createElement("select"); for (const [value, key] of [["toggle", "mediaWallToggle"], ["hold", "mediaWallHold"]]) { const o = document.createElement("option"); o.value = value; o.dataset.i18n = key; o.textContent = tr(key); wallTriggerNode.append(o); } wallTriggerLabel.append(wallTriggerNode);
    const wallUploadRow = core.el("label", "mediaWallUploadRow"); wallUploadRow.append(tx("span", "mediaWallUpload")); wallFileNode = document.createElement("input"); wallFileNode.type = "file"; wallFileNode.accept = "image/*"; wallUploadRow.append(wallFileNode);
    wallResetNode = tx("button", "mediaWallResetImage", "mediaSmallBtn"); wallResetNode.type = "button";
    const wallUploadHint = tx("div", "mediaWallUploadHint", "hint");
    const syncWallSettingsUI = () => { wallStyleNode.value = core.settings.mediaWallStyle || "midnight"; wallClockCheck.checked = core.settings.mediaWallClock !== false; wallPlaybackNode.value = core.settings.mediaWallStopsVideo === false ? "continue" : "stop"; wallTriggerNode.value = core.settings.mediaWallTrigger || "toggle"; renderWall(); };
    wallStyleNode.addEventListener("change", () => { core.settings.mediaWallStyle = wallStyleNode.value; core.saveUserPrefs(); renderWall(); });
    wallClockCheck.addEventListener("change", () => { core.settings.mediaWallClock = wallClockCheck.checked; core.saveUserPrefs(); renderWall(); });
    wallPlaybackNode.addEventListener("change", () => { core.settings.mediaWallStopsVideo = wallPlaybackNode.value !== "continue"; core.saveUserPrefs(); });
    wallTriggerNode.addEventListener("change", () => { core.settings.mediaWallTrigger = wallTriggerNode.value; core.saveUserPrefs(); });
    wallFileNode.addEventListener("change", () => { const f = wallFileNode.files && wallFileNode.files[0]; if (!f || !f.type.startsWith("image/")) return; if (wallCustomURL) URL.revokeObjectURL(wallCustomURL); wallCustomURL = URL.createObjectURL(f); core.settings.mediaWallStyle = "custom"; core.saveUserPrefs(); syncWallSettingsUI(); });
    wallResetNode.addEventListener("click", () => { if (wallCustomURL) URL.revokeObjectURL(wallCustomURL); wallCustomURL = ""; core.settings.mediaWallStyle = "midnight"; wallFileNode.value = ""; core.saveUserPrefs(); syncWallSettingsUI(); });
    wallPanel.append(wallHeading, wallHint, wallStyleLabel, wallClockLabel, wallPlaybackLabel, wallTriggerLabel, wallUploadRow, wallUploadHint, wallResetNode);
    /* 🔆 画面を消灯させない（Wake Lock。trk164）：壁紙パネルの隣に置く小さな設定 */
    const wakePanel = core.el("details", "subPanel mediaWakePanel"); wakePanel.id = "mediaWakePanel";
    const wakeHeading = tx("summary", "mediaWakeLockTitle");
    const wakeHint = tx("div", "mediaWakeLockHint", "hint");
    const wakeCheckLabel = core.el("label", "checkLine");
    const wakeCheck = document.createElement("input"); wakeCheck.type = "checkbox"; wakeCheck.checked = core.settings.mediaWakeLock !== false;
    wakeCheck.addEventListener("change", () => { core.settings.mediaWakeLock = wakeCheck.checked; core.saveUserPrefs(); updateWakeLock(); });
    wakeCheckLabel.append(wakeCheck, tx("span", "mediaWakeLockToggle"));
    wakePanel.append(wakeHeading, wakeHint, wakeCheckLabel);
    /* 🌊 波形シークバー（trk173）：🔆 の隣に置く小さな設定 */
    const wavePanel = core.el("details", "subPanel mediaWavePanel"); wavePanel.id = "mediaWavePanel";
    const waveHeading = tx("summary", "mediaWaveTitle");
    const waveHint = tx("div", "mediaWaveHint", "hint");
    const waveCheckLabel = core.el("label", "checkLine");
    const waveCheck = document.createElement("input"); waveCheck.type = "checkbox"; waveCheck.checked = core.settings.mediaWave !== false;
    waveCheck.addEventListener("change", () => { core.settings.mediaWave = waveCheck.checked; core.saveUserPrefs(); drawWave(); });
    waveCheckLabel.append(waveCheck, tx("span", "mediaWaveToggle"));
    wavePanel.append(waveHeading, waveHint, waveCheckLabel);
    anchor.after(panel, wallPanel, wakePanel, wavePanel);
    core.on("language", () => { syncVideoKeysUI(); syncWallSettingsUI(); });
    syncVideoKeysUI(); syncWallSettingsUI();
  }
  const mediaExitAssign = document.getElementById("mediaExitKeyAssign"), mediaExitConfirmCheck = document.getElementById("mediaExitConfirmCheck");
  if (mediaExitAssign) mediaExitAssign.addEventListener("click", () => { mediaExitBinding = 0; syncMediaExitUI(); });
  if (mediaExitConfirmCheck) mediaExitConfirmCheck.addEventListener("change", e => { core.settings.mediaExitConfirm = e.target.checked; core.saveUserPrefs(); });
  core.on("language", syncMediaExitUI);
  syncMediaExitUI();
  buildVideoKeysUI();
  installMediaSession();
  renderInterp();
  syncMediaStage();
  return true;
}

/* The TV dock is built by its own DOMContentLoaded callback first. */
addEventListener("DOMContentLoaded", () => {
  if (!buildMedia()) return;
  core.applyLanguage(core.settings.language);
});
window.TrkMediaPlayer = { open:openMedia, close:closeMedia, isOpen:mediaActive,
  /* trk164: テスト用の素の関数（DOM不要の決定だけを取り出して検証できる） */
  resumeRewindSeconds, rewindResumePosition, planSleepFade, pipSupported, wakeLockSupported,
  mediaExitPlan };
/* ⏮ 常に最初から再生（trk193）：設定画面や曲名タブのバーで変わった値を、ここへも反映する */
window.TrkMediaStartZeroSync = on => { if (startZeroNode) startZeroNode.checked = on === true; };
window.Trk.overlay.set("media", false);
window._trkMediaPlayerMode = false;
})();
/* ✅ media-player-mode.js 完了 */
