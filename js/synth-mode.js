// SPDX-License-Identifier: GPL-3.0-or-later
/* ========================================================================== 
   trk! synth-mode.js — 🎹 play-along synthesizer
   Open by long-pressing the FX dock's speaker/power button. Uses Web Audio
   oscillators (plus optional local one-shot samples); no audio is uploaded.
   ========================================================================== */
"use strict";
(() => {
  const core = window.Trk.core;

/* ============ 文章 ============ */
Object.assign(TEXT.ja, {
  instHoldHint:"長押しでシンセを開く", instFastHoldHint:"0.2秒長押しでシンセを開く", instHoldDisabledHint:"設定でシンセモードが無効です。",
  instSettingsTitle:"🎹 シンセモード", instSettingsHint:"⏻スピーカーを長押ししてシンセを開きます。通常は0.65秒、下の高速オプションを使うと0.2秒です。",
  instDisableOption:"🚫 シンセモードを起動しない", instFastOption:"⚡ 高速でシンセモードを起動する（起動まで0.2秒）",
  instKeyboardLockOption:"🔒 シンセモード中はキーボードを鍵盤に固定する（初期オン）", instKeyboardLockHint:"ONなら、音色名やスライダーにフォーカスがあっても、割り当てたキーは鍵盤を鳴らします。OFFで通常の入力に戻ります。",
  instWideKeyboardOption:"↔ 鍵盤を横に広くする（大きな画面向け）", instWideKeyboardHint:"ONにすると、画面に余裕があるとき鍵盤の各キーを少し大きく表示します。スマホ向けの初期値はOFFです。",
  instTitle:"🎹 シンセモード",
  instSubtitle:"曲を聴きながら、画面の鍵盤またはパソコンのキーで演奏できます。",
  instClose:"閉じる", instEscapeClose:"ESCで閉じる", instDisplay:"📺 VIDEO / 📊 SPECTRUM",
  instPreset:"音色プリセット", instEdited:"編集中の音色", instPatchName:"音色名",
  instSave:"⭐ 音色を保存", instDelete:"削除", instReset:"初期音色に戻す",
  instSourceTitle:"🎛 音源レイヤー", instSourceHint:"オシレーターを重ねるか、端末の音声ファイルを短いサンプルとして追加できます。音色の変更は⭐で保存できます。サンプルはこのページを開いている間だけ使えます。",
  instAddOsc:"＋ オシレーター", instAddSample:"⇧ サンプルを追加", instOsc:"オシレーター", instSample:"サンプル",
  instWave:"波形", instSine:"サイン波", instSquare:"矩形波", instTriangle:"三角波", instSaw:"ノコギリ波",
  instOctave:"オクターブ", instDetune:"デチューン", instLevel:"レイヤー音量", instRoot:"サンプルの基準音", instRemoveSource:"外す",
  instNoSources:"音源がありません。オシレーターを追加してください。", instSourceLimit:"音源は最大6レイヤーです。",
  instPitch:"🎚 ピッチ（半音）", instPitchHint:"0は元の音程です。±8半音の範囲で鍵盤全体を移調します。",
  instMaster:"マスター音量", instFilter:"フィルター", instFilterType:"種類", instLowpass:"ローパス", instHighpass:"ハイパス", instBandpass:"バンドパス", instNotch:"ノッチ",
  instCutoff:"カットオフ", instQ:"レゾナンス Q", instEnvelope:"🎚 音の形（エンベロープ）", instAttack:"アタック", instDecay:"ディケイ", instSustain:"サステイン", instRelease:"リリース",
  instKeyboard:"🎹 2オクターブ鍵盤", instAssign:"⌨ キーアサイン", instAssignHint:"アサインをON → 画面の鍵盤を選択 → 割り当てるキーを押します。ESCで終了、Deleteで割り当てを解除。",
  instAssignPick:"画面の鍵盤から、割り当てる音を選んでください。",
  instAssignPress:"{note} に割り当てるキーを押してください。",
  instAssigned:"{note} に {key} を割り当てました。",
  instKeyCleared:"{note} のキー割り当てを解除しました。",
  instKeyMoved:"{key} の割り当てを {note} に移しました。",
  instBadKey:"そのキーは割り当てできません。別のキーを押してください。",
  instMapOff:"キーアサインを終了しました。", instMapOn:"割り当てる音を選んでください。",
  instTrackPlay:"▶ 曲を再生", instTrackPause:"⏸ 曲を一時停止", instTrackMute:"🔊 曲をミュート", instTrackUnmute:"🔇 曲のミュート解除",
  instTrackNone:"曲を選ぶと、ここで再生しながら演奏できます。", instTrackBlocked:"曲を再生できませんでした。もう一度再生ボタンを押してください。",
  instVol:"曲の音量", instAudioUnavailable:"このブラウザーではWeb Audioを使えません。",
  instSampleTooBig:"サンプルは12MB以下の音声ファイルを選んでください。", instSampleTooLong:"サンプルは30秒以内の音声ファイルを選んでください。", instSampleDecode:"サンプルを読み込めませんでした。対応形式の音声をお試しください。",
  instSampleAdded:"「{name}」をサンプル音源に追加しました（端末内のみ）。", instSampleRootHint:"サンプルはC4を基準に音程を変えて再生します。",
  instPatchSaved:"「{name}」をこの端末に保存しました。サンプル音源そのものは保存されません。",
  instPatchLimit:"カスタム音色は最大20個です。不要な音色を削除してください。",
  instPatchNoOsc:"保存できるオシレーター音源がありません。音源を追加してください。",
  instPatchDeleted:"カスタム音色を削除しました。", instDeleteConfirm:"このカスタム音色を削除しますか？",
  instSavedSourcesOnly:"サンプルファイルはプリセットに含まれません。オシレーター設定だけを保存しました。",
  instStop:"■ 音を止める", instPresetSine:"サイン・キー", instPresetSquare:"スクエア・リード", instPresetSaw:"ソー・リード",
  instPresetPad:"ウォーム・パッド", instPresetPluck:"プラック", instPresetBass:"サブベース", instPresetOrgan:"オルガン", instPresetBell:"ベル", instPresetSuper:"スーパーソー", instPresetZunpet:"ZUNPET風ブラス",
  instPresetGuitar:"エレキギター", instPresetESax:"電子サックス", instPresetEPiano:"FMエレピ", instPresetStrings:"シンセストリングス", instPresetChip:"8ビットチップ", instPresetVocal:"ボコーダーボイス"
});
Object.assign(TEXT.en, {
  instHoldHint:"Long-press to open the synthesizer", instFastHoldHint:"Hold for 0.2 seconds to open synth", instHoldDisabledHint:"Synth mode is disabled in Settings",
  instSettingsTitle:"🎹 Synthesizer mode", instSettingsHint:"Long-press the ⏻ speaker to open the synth. The default hold is 0.65 seconds; the fast option below uses 0.2 seconds.",
  instDisableOption:"🚫 Don't launch synth mode", instFastOption:"⚡ Fast synth launch (open after a 0.2-second hold)",
  instKeyboardLockOption:"🔒 Lock the keyboard to the piano in synth mode (on by default)", instKeyboardLockHint:"When on, mapped keys play the piano even when a sound-name field or slider has focus. Turn it off to restore normal text and control input.",
  instWideKeyboardOption:"↔ Make the piano keys wider (for larger screens)", instWideKeyboardHint:"When on, each key is shown a little wider when there is room. It is off by default for phone-sized screens.",
  instTitle:"🎹 Synth mode",
  instSubtitle:"Play with the on-screen keys or your computer keyboard while a song is playing.",
  instClose:"Close", instEscapeClose:"Press ESC to close", instDisplay:"📺 VIDEO / 📊 SPECTRUM",
  instPreset:"Sound preset", instEdited:"Edited sound", instPatchName:"Sound name",
  instSave:"⭐ Save sound", instDelete:"Delete", instReset:"Reset to initial sound",
  instSourceTitle:"🎛 Sound layers", instSourceHint:"Stack oscillators or add a short audio sample from this device. Save your sound with ⭐; samples are available only while this page is open.",
  instAddOsc:"＋ Add oscillator", instAddSample:"⇧ Add sample", instOsc:"Oscillator", instSample:"Sample",
  instWave:"Waveform", instSine:"Sine", instSquare:"Square", instTriangle:"Triangle", instSaw:"Sawtooth",
  instOctave:"Octave", instDetune:"Detune", instLevel:"Layer level", instRoot:"Sample root note", instRemoveSource:"Remove",
  instNoSources:"No sound sources. Add an oscillator to begin.", instSourceLimit:"Up to 6 sound layers.",
  instPitch:"🎚 Pitch (semitones)", instPitchHint:"0 keeps the original pitch. Shift every key by up to 8 semitones.",
  instMaster:"Master volume", instFilter:"Filter", instFilterType:"Type", instLowpass:"Low-pass", instHighpass:"High-pass", instBandpass:"Band-pass", instNotch:"Notch",
  instCutoff:"Cutoff", instQ:"Resonance Q", instEnvelope:"🎚 Envelope", instAttack:"Attack", instDecay:"Decay", instSustain:"Sustain", instRelease:"Release",
  instKeyboard:"🎹 Two-octave keyboard", instAssign:"⌨ Key mapping", instAssignHint:"Turn mapping on → select an on-screen key → press the computer key to assign. ESC exits; Delete clears a mapping.",
  instAssignPick:"Select a piano key on screen to map.", instAssignPress:"Press the key to assign to {note}.",
  instAssigned:"Mapped {key} to {note}.", instKeyCleared:"Cleared the key for {note}.", instKeyMoved:"Moved {key} to {note}.",
  instBadKey:"That key can't be assigned. Please choose another.", instMapOff:"Key mapping finished.", instMapOn:"Select a note to assign.",
  instTrackPlay:"▶ Play song", instTrackPause:"⏸ Pause song", instTrackMute:"🔊 Mute song", instTrackUnmute:"🔇 Unmute song",
  instTrackNone:"Choose a song to play along with it here.", instTrackBlocked:"Couldn't start the song. Press Play again to allow playback.",
  instVol:"Song volume", instAudioUnavailable:"Web Audio is not available in this browser.",
  instSampleTooBig:"Choose an audio sample no larger than 12 MB.", instSampleTooLong:"Choose an audio sample no longer than 30 seconds.", instSampleDecode:"Couldn't decode the sample. Try another supported audio format.",
  instSampleAdded:"Added “{name}” as a sample source (on this device only).", instSampleRootHint:"Samples are pitch-shifted from C4.",
  instPatchSaved:"Saved “{name}” on this device. Audio sample files are not saved.",
  instPatchLimit:"Up to 20 custom sounds. Delete one to make room.", instPatchNoOsc:"No oscillator source to save. Add an oscillator first.",
  instPatchDeleted:"Deleted the custom sound.", instDeleteConfirm:"Delete this custom sound?",
  instSavedSourcesOnly:"Sample files are not included in presets. Only oscillator settings were saved.",
  instStop:"■ Stop notes", instPresetSine:"Sine Keys", instPresetSquare:"Square Lead", instPresetSaw:"Saw Lead",
  instPresetPad:"Warm Pad", instPresetPluck:"Pluck", instPresetBass:"Sub Bass", instPresetOrgan:"Organ", instPresetBell:"Bell", instPresetSuper:"Super Saw", instPresetZunpet:"ZUNPET-style Brass",
  instPresetGuitar:"Electric Guitar", instPresetESax:"Electric Sax", instPresetEPiano:"FM E-Piano", instPresetStrings:"Synth Strings", instPresetChip:"8-bit Chip", instPresetVocal:"Vocoder Voice"
});
Object.assign(TEXT.zh, {
  instHoldHint:"长按打开合成器", instFastHoldHint:"长按0.2秒打开合成器", instHoldDisabledHint:"合成器模式已在设置中禁用",
  instSettingsTitle:"🎹 合成器模式", instSettingsHint:"长按⏻扬声器打开合成器。默认长按0.65秒；启用下方快速选项后为0.2秒。",
  instDisableOption:"🚫 不启动合成器模式", instFastOption:"⚡ 快速启动合成器（长按0.2秒打开）",
  instKeyboardLockOption:"🔒 合成器模式中将键盘固定为琴键（默认开启）", instKeyboardLockHint:"开启后，即使音色名称或滑块获得焦点，已分配的按键仍会弹奏琴键。关闭后恢复普通输入。",
  instWideKeyboardOption:"↔ 加宽屏幕键盘（适合大屏幕）", instWideKeyboardHint:"开启后，在屏幕有余量时会将每个琴键显示得稍宽一些。手机初始为关闭。",
  instTitle:"🎹 合成器模式",
  instSubtitle:"播放歌曲时，可以使用屏幕键盘或电脑键盘一起演奏。",
  instClose:"关闭", instEscapeClose:"按ESC关闭", instDisplay:"📺 画面 / 📊 频谱",
  instPreset:"音色预设", instEdited:"编辑中的音色", instPatchName:"音色名称",
  instSave:"⭐ 保存音色", instDelete:"删除", instReset:"恢复初始音色",
  instSourceTitle:"🎛 音源层", instSourceHint:"可以叠加振荡器，或从此设备添加短音频采样。使用⭐保存音色；采样仅在本页面打开期间可用。",
  instAddOsc:"＋ 添加振荡器", instAddSample:"⇧ 添加采样", instOsc:"振荡器", instSample:"采样",
  instWave:"波形", instSine:"正弦波", instSquare:"方波", instTriangle:"三角波", instSaw:"锯齿波",
  instOctave:"八度", instDetune:"微调音高", instLevel:"层音量", instRoot:"采样基准音", instRemoveSource:"移除",
  instNoSources:"没有音源，请先添加振荡器。", instSourceLimit:"最多6个音源层。",
  instPitch:"🎚 音高（半音）", instPitchHint:"0表示原始音高。可将所有琴键移调±8个半音。",
  instMaster:"主音量", instFilter:"滤波器", instFilterType:"类型", instLowpass:"低通", instHighpass:"高通", instBandpass:"带通", instNotch:"陷波",
  instCutoff:"截止频率", instQ:"共振 Q", instEnvelope:"🎚 音量包络", instAttack:"起音", instDecay:"衰减", instSustain:"延音", instRelease:"释音",
  instKeyboard:"🎹 两个八度键盘", instAssign:"⌨ 键位分配", instAssignHint:"开启分配 → 选择屏幕上的琴键 → 按下要分配的电脑按键。ESC退出，Delete清除分配。",
  instAssignPick:"请在屏幕键盘上选择要分配的音符。", instAssignPress:"按下要分配给 {note} 的按键。",
  instAssigned:"已将 {key} 分配给 {note}。", instKeyCleared:"已清除 {note} 的按键。", instKeyMoved:"已将 {key} 移到 {note}。",
  instBadKey:"此按键不可分配，请选择其他按键。", instMapOff:"已结束键位分配。", instMapOn:"请选择要分配的音符。",
  instTrackPlay:"▶ 播放歌曲", instTrackPause:"⏸ 暂停歌曲", instTrackMute:"🔊 静音歌曲", instTrackUnmute:"🔇 取消静音",
  instTrackNone:"选择歌曲后，即可在这里一边播放一边演奏。", instTrackBlocked:"无法播放歌曲，请再次按播放键以允许播放。",
  instVol:"歌曲音量", instAudioUnavailable:"此浏览器不支持 Web Audio。",
  instSampleTooBig:"请选择不超过12MB的音频采样。", instSampleTooLong:"请选择不超过30秒的音频采样。", instSampleDecode:"无法解码采样，请尝试其他支持的音频格式。",
  instSampleAdded:"已添加“{name}”作为采样音源（仅限此设备）。", instSampleRootHint:"采样将以C4为基准变调播放。",
  instPatchSaved:"已在此设备保存“{name}”。音频采样文件不会保存。", instPatchLimit:"自定义音色最多20个，请先删除一个。",
  instPatchNoOsc:"没有可保存的振荡器音源，请先添加振荡器。", instPatchDeleted:"已删除自定义音色。",
  instDeleteConfirm:"要删除此自定义音色吗？", instSavedSourcesOnly:"预设不包含采样文件，仅保存振荡器设置。",
  instStop:"■ 停止发声", instPresetSine:"正弦键盘", instPresetSquare:"方波主音", instPresetSaw:"锯齿主音",
  instPresetPad:"暖音铺底", instPresetPluck:"拨弦", instPresetBass:"低音贝斯", instPresetOrgan:"管风琴", instPresetBell:"钟声", instPresetSuper:"超级锯齿", instPresetZunpet:"ZUNPET风格铜管",
  instPresetGuitar:"电吉他", instPresetESax:"电子萨克斯", instPresetEPiano:"FM电钢琴", instPresetStrings:"合成弦乐", instPresetChip:"8位芯片", instPresetVocal:"人声编码器"
});
Object.assign(TEXT.ko, {
  instHoldHint:"길게 눌러 신시사이저 열기", instFastHoldHint:"0.2초 길게 눌러 신시사이저 열기", instHoldDisabledHint:"설정에서 신시사이저 모드가 비활성화되었습니다",
  instSettingsTitle:"🎹 신시사이저 모드", instSettingsHint:"⏻ 스피커를 길게 눌러 신시사이저를 엽니다. 기본은 0.65초이며, 아래 고속 옵션을 사용하면 0.2초입니다.",
  instDisableOption:"🚫 신시사이저 모드 시작 안 함", instFastOption:"⚡ 신시사이저 빠르게 열기 (0.2초 길게 누르기)",
  instKeyboardLockOption:"🔒 신시사이저 모드에서 키보드를 건반에 고정 (기본 켜짐)", instKeyboardLockHint:"켜면 음색 이름이나 슬라이더에 포커스가 있어도 지정된 키가 건반을 연주합니다. 끄면 일반 입력으로 돌아갑니다.",
  instWideKeyboardOption:"↔ 화면 건반을 넓게 표시 (큰 화면용)", instWideKeyboardHint:"켜면 화면에 여유가 있을 때 건반 하나하나가 조금 더 넓게 표시됩니다. 휴대폰 기본값은 꺼짐입니다.",
  instTitle:"🎹 신시사이저 모드",
  instSubtitle:"곡을 들으면서 화면 건반이나 컴퓨터 키보드로 연주할 수 있습니다.",
  instClose:"닫기", instEscapeClose:"ESC로 닫기", instDisplay:"📺 영상 / 📊 스펙트럼",
  instPreset:"음색 프리셋", instEdited:"편집 중인 음색", instPatchName:"음색 이름",
  instSave:"⭐ 음색 저장", instDelete:"삭제", instReset:"초기 음색으로 재설정",
  instSourceTitle:"🎛 사운드 레이어", instSourceHint:"오실레이터를 겹치거나 이 기기의 짧은 오디오 샘플을 추가할 수 있습니다. ⭐로 음색을 저장할 수 있으며 샘플은 이 페이지를 여는 동안만 사용할 수 있습니다.",
  instAddOsc:"＋ 오실레이터 추가", instAddSample:"⇧ 샘플 추가", instOsc:"오실레이터", instSample:"샘플",
  instWave:"파형", instSine:"사인파", instSquare:"구형파", instTriangle:"삼각파", instSaw:"톱니파",
  instOctave:"옥타브", instDetune:"디튠", instLevel:"레이어 음량", instRoot:"샘플 기준 음", instRemoveSource:"제거",
  instNoSources:"사운드 소스가 없습니다. 오실레이터를 추가하세요.", instSourceLimit:"최대 6개 레이어입니다.",
  instPitch:"🎚 피치(반음)", instPitchHint:"0은 원래 음정입니다. 모든 건반을 최대 ±8반음 이동합니다.",
  instMaster:"마스터 음량", instFilter:"필터", instFilterType:"종류", instLowpass:"로우패스", instHighpass:"하이패스", instBandpass:"밴드패스", instNotch:"노치",
  instCutoff:"컷오프", instQ:"레조넌스 Q", instEnvelope:"🎚 엔벌로프", instAttack:"어택", instDecay:"디케이", instSustain:"서스테인", instRelease:"릴리스",
  instKeyboard:"🎹 2옥타브 건반", instAssign:"⌨ 키 지정", instAssignHint:"지정을 켜고 → 화면 건반을 선택한 뒤 → 지정할 컴퓨터 키를 누르세요. ESC로 종료, Delete로 해제합니다.",
  instAssignPick:"화면 건반에서 지정할 음을 선택하세요.", instAssignPress:"{note}에 지정할 키를 누르세요.",
  instAssigned:"{note}에 {key}를 지정했습니다.", instKeyCleared:"{note}의 키 지정을 해제했습니다.", instKeyMoved:"{key} 지정을 {note}로 옮겼습니다.",
  instBadKey:"지정할 수 없는 키입니다. 다른 키를 선택하세요.", instMapOff:"키 지정을 마쳤습니다.", instMapOn:"지정할 음을 선택하세요.",
  instTrackPlay:"▶ 곡 재생", instTrackPause:"⏸ 곡 일시정지", instTrackMute:"🔊 곡 음소거", instTrackUnmute:"🔇 곡 음소거 해제",
  instTrackNone:"곡을 선택하면 여기서 재생하며 함께 연주할 수 있습니다.", instTrackBlocked:"곡을 재생하지 못했습니다. 다시 재생 버튼을 눌러 주세요.",
  instVol:"곡 음량", instAudioUnavailable:"이 브라우저는 Web Audio를 지원하지 않습니다.",
  instSampleTooBig:"12MB 이하의 오디오 샘플을 선택하세요.", instSampleTooLong:"30초 이하의 오디오 샘플을 선택하세요.", instSampleDecode:"샘플을 디코딩하지 못했습니다. 지원되는 다른 형식을 시도하세요.",
  instSampleAdded:"'{name}' 샘플 소스를 추가했습니다 (이 기기에서만).", instSampleRootHint:"샘플은 C4를 기준으로 음정을 바꿔 재생합니다.",
  instPatchSaved:"'{name}'을(를) 이 기기에 저장했습니다. 오디오 샘플 파일은 저장되지 않습니다.",
  instPatchLimit:"사용자 음색은 최대 20개입니다. 하나를 삭제해 주세요.", instPatchNoOsc:"저장할 오실레이터 소스가 없습니다. 먼저 추가하세요.",
  instPatchDeleted:"사용자 음색을 삭제했습니다.", instDeleteConfirm:"이 사용자 음색을 삭제할까요?",
  instSavedSourcesOnly:"프리셋에는 샘플 파일이 포함되지 않습니다. 오실레이터 설정만 저장했습니다.",
  instStop:"■ 음 멈추기", instPresetSine:"사인 키", instPresetSquare:"스퀘어 리드", instPresetSaw:"쏘 리드",
  instPresetPad:"웜 패드", instPresetPluck:"플럭", instPresetBass:"서브베이스", instPresetOrgan:"오르간", instPresetBell:"벨", instPresetSuper:"슈퍼쏘", instPresetZunpet:"ZUNPET 스타일 브라스",
  instPresetGuitar:"일렉트릭 기타", instPresetESax:"전자 색소폰", instPresetEPiano:"FM 일렉트릭 피아노", instPresetStrings:"신스 스트링", instPresetChip:"8비트 칩", instPresetVocal:"보코더 보이스"
});

/* ============ 音色（基本波形を重ねた、編集可能なスターター） ============ */
const src = (id, wave, octave = 0, detune = 0, level = .6) => ({ id, kind:"osc", wave, octave, detune, level });
const PRESETS = [
  { id:"sine", nameKey:"instPresetSine", sources:[src("sine", "sine", 0, 0, .72)], filter:{ type:"lowpass", cutoff:15000, q:.7 }, env:{ attack:.008, decay:.16, sustain:.68, release:.3 } },
  { id:"square", nameKey:"instPresetSquare", sources:[src("square", "square", 0, 0, .36), src("square-sub", "triangle", -1, 0, .18)], filter:{ type:"lowpass", cutoff:7200, q:1 }, env:{ attack:.006, decay:.12, sustain:.58, release:.18 } },
  { id:"saw", nameKey:"instPresetSaw", sources:[src("saw", "sawtooth", 0, 0, .31), src("saw-sub", "triangle", -1, 0, .14)], filter:{ type:"lowpass", cutoff:6200, q:1.2 }, env:{ attack:.012, decay:.18, sustain:.58, release:.22 } },
  { id:"pad", nameKey:"instPresetPad", sources:[src("pad-a", "sawtooth", 0, -9, .2), src("pad-b", "sawtooth", 0, 9, .2), src("pad-tri", "triangle", 0, 0, .14)], filter:{ type:"lowpass", cutoff:3900, q:.8 }, env:{ attack:.48, decay:.42, sustain:.72, release:1.15 } },
  { id:"pluck", nameKey:"instPresetPluck", sources:[src("pluck-tri", "triangle", 0, 0, .48), src("pluck-high", "sine", 1, 0, .18)], filter:{ type:"lowpass", cutoff:8200, q:.8 }, env:{ attack:.004, decay:.4, sustain:.04, release:.16 } },
  { id:"bass", nameKey:"instPresetBass", sources:[src("bass-tri", "triangle", -1, 0, .55), src("bass-sine", "sine", -1, 0, .25)], filter:{ type:"lowpass", cutoff:920, q:1.1 }, env:{ attack:.006, decay:.12, sustain:.78, release:.13 } },
  { id:"organ", nameKey:"instPresetOrgan", sources:[src("organ-square", "square", 0, 0, .26), src("organ-sine", "sine", 0, 0, .28), src("organ-upper", "square", 1, 0, .09)], filter:{ type:"lowpass", cutoff:7800, q:.7 }, env:{ attack:.008, decay:.08, sustain:.88, release:.09 } },
  { id:"bell", nameKey:"instPresetBell", sources:[src("bell-fund", "sine", 0, 0, .38), src("bell-oct", "sine", 1, 0, .23), src("bell-high", "sine", 2, 0, .1)], filter:{ type:"lowpass", cutoff:16000, q:.7 }, env:{ attack:.003, decay:.72, sustain:.008, release:.55 } },
  { id:"supersaw", nameKey:"instPresetSuper", sources:[src("super-a", "sawtooth", 0, -14, .2), src("super-b", "sawtooth", 0, 0, .2), src("super-c", "sawtooth", 0, 14, .2)], filter:{ type:"lowpass", cutoff:5600, q:1 }, env:{ attack:.02, decay:.28, sustain:.62, release:.38 } },
  { id:"zunpet", nameKey:"instPresetZunpet", sources:[src("zunpet-brass", "sawtooth", 0, -5, .27), src("zunpet-edge", "square", 0, 5, .14), src("zunpet-octave", "triangle", 1, 0, .08)], filter:{ type:"lowpass", cutoff:5200, q:1.7 }, env:{ attack:.012, decay:.16, sustain:.72, release:.18 } },
  /* プラック感のある中域＋胴鳴りで、エレキギターらしい立ち上がりを作る */
  { id:"guitar", nameKey:"instPresetGuitar", sources:[src("guitar-pick", "sawtooth", 0, -7, .23), src("guitar-string", "square", 0, 7, .09), src("guitar-body", "triangle", -1, 0, .22), src("guitar-harmonic", "sine", 1, 0, .06)], filter:{ type:"lowpass", cutoff:4300, q:1.8 }, env:{ attack:.002, decay:.48, sustain:.18, release:.28 } },
  /* リード波形＋矩形波のリードを軽く混ぜ、電子サックスの息のような明るさを出す */
  { id:"esax", nameKey:"instPresetESax", sources:[src("esax-body", "sawtooth", 0, -5, .18), src("esax-reed", "square", 0, 5, .1), src("esax-air", "triangle", 1, 0, .06), src("esax-sub", "triangle", -1, 0, .08)], filter:{ type:"lowpass", cutoff:3600, q:2.3 }, env:{ attack:.045, decay:.18, sustain:.72, release:.24 } },
  { id:"epiano", nameKey:"instPresetEPiano", sources:[src("epiano-fund", "sine", 0, 0, .38), src("epiano-tine", "triangle", 1, 0, .18), src("epiano-shimmer", "sine", 2, 0, .07)], filter:{ type:"lowpass", cutoff:7000, q:1 }, env:{ attack:.004, decay:.65, sustain:.15, release:.5 } },
  { id:"strings", nameKey:"instPresetStrings", sources:[src("strings-a", "sawtooth", 0, -11, .16), src("strings-b", "sawtooth", 0, 11, .16), src("strings-body", "triangle", -1, 0, .13)], filter:{ type:"lowpass", cutoff:4200, q:.9 }, env:{ attack:.24, decay:.42, sustain:.65, release:.8 } },
  { id:"chip", nameKey:"instPresetChip", sources:[src("chip-lead", "square", 0, 0, .28), src("chip-sub", "triangle", -1, 0, .16), src("chip-oct", "square", 1, 0, .08)], filter:{ type:"lowpass", cutoff:11000, q:.7 }, env:{ attack:.002, decay:.16, sustain:.5, release:.08 } },
  { id:"vocal", nameKey:"instPresetVocal", sources:[src("vocal-formant", "sawtooth", 0, -4, .15), src("vocal-core", "triangle", 0, 4, .18), src("vocal-octave", "sine", 1, 0, .06)], filter:{ type:"lowpass", cutoff:2800, q:2.2 }, env:{ attack:.05, decay:.2, sustain:.7, release:.25 } }
];
const PRESET_BY_ID = Object.fromEntries(PRESETS.map(p => [p.id, p]));
const STATE_KEY = "trk_synth_mode_v1", PATCH_KEY = "trk_synth_patches_v1";
const SAMPLE_LIMIT = 12 * 1024 * 1024, MAX_SAMPLE_SECONDS = 30, MAX_SOURCES = 6, MAX_VOICES = 20, MAX_PATCHES = 20;
const WAVE_TYPES = ["sine", "triangle", "sawtooth", "square"];
const FILTER_TYPES = ["lowpass", "highpass", "bandpass", "notch"];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const WHITE_SEMIS = new Set([0, 2, 4, 5, 7, 9, 11]);
const WHITE_W = 42, BLACK_W = 26, WIDE_KEY_SCALE = 1.28, FIRST_MIDI = 48, LAST_MIDI = 72; // C3..C5
const DEFAULT_KEY_CODES = [
  "KeyZ", "KeyS", "KeyX", "KeyD", "KeyC", "KeyV", "KeyG", "KeyB", "KeyH", "KeyN", "KeyJ", "KeyM",
  "KeyQ", "Digit2", "KeyW", "Digit3", "KeyE", "KeyR", "Digit5", "KeyT", "Digit6", "KeyY", "Digit7", "KeyU", "KeyI"
];
const RESERVED_KEY_CODES = new Set(["Escape", "Tab", "F5", "F11", "F12", "MetaLeft", "MetaRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "Backspace", "Delete"]);
const safeKeyCode = code => typeof code === "string" && code.length > 0 && code.length <= 24 && !RESERVED_KEY_CODES.has(code) && !(code[0] === "F" && Number(code.slice(1)) > 0) && !code.startsWith("Numpad");
function normalizeKeyMap(raw) {
  if (!Array.isArray(raw) || raw.length !== 25) return DEFAULT_KEY_CODES.slice();
  const used = new Set();
  return raw.map(code => {
    if (!safeKeyCode(code) || used.has(code)) return "";
    used.add(code); return code;
  });
}
const keyCodeLabel = code => {
  if (!code) return "—";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return ({ Space:"Space", Comma:",", Period:".", Slash:"/", Semicolon:";", Minus:"-", Equal:"=", BracketLeft:"[", BracketRight:"]", Quote:"'" })[code] || code;
};
const noteName = midi => `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
const clamp = (v, lo, hi, fallback) => Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : fallback;
const clone = v => JSON.parse(JSON.stringify(v));

function normalizePatch(raw, id) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim().slice(0, 24) || "My Sound";
  const sources = [];
  if (Array.isArray(raw.sources)) {
    for (let i = 0; i < raw.sources.length && sources.length < MAX_SOURCES; i++) {
      const s = raw.sources[i];
      if (!s || s.kind !== "osc" || !WAVE_TYPES.includes(s.wave)) continue; // sample data is deliberately session-only
      sources.push({
        id: /^[-a-zA-Z0-9_]{1,40}$/.test(String(s.id || "")) ? String(s.id) : `osc-${i + 1}`,
        kind:"osc", wave:s.wave, octave:Math.round(clamp(s.octave, -2, 2, 0)),
        detune:clamp(s.detune, -50, 50, 0), level:clamp(s.level, 0, 1, .35)
      });
    }
  }
  if (!sources.length) return null;
  const f = raw.filter && typeof raw.filter === "object" ? raw.filter : {};
  const e = raw.env && typeof raw.env === "object" ? raw.env : {};
  return {
    id: String(id || raw.id || ""), name,
    sources,
    filter:{ type:FILTER_TYPES.includes(f.type) ? f.type : "lowpass", cutoff:clamp(f.cutoff, 80, 18000, 5000), q:clamp(f.q, .1, 14, .8) },
    env:{ attack:clamp(e.attack, .002, 2, .01), decay:clamp(e.decay, .005, 2, .18), sustain:clamp(e.sustain, 0, 1, .6), release:clamp(e.release, .02, 3, .25) }
  };
}

/* ============ 初期化・画面 ============ */
addEventListener("DOMContentLoaded", () => {
  const power = document.querySelector("#fxDock .dockPow");
  if (!power || !window.TrkFX) return;

  const node = (tag, cls = "", value = "") => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (value != null) n.textContent = value;
    return n;
  };
  const tx = (tag, key, cls = "") => node(tag, cls, tr(key));
  const btn = (key, cls = "") => { const b = tx("button", key, cls); b.type = "button"; return b; };
  const label = (key, control, cls = "") => { const l = node("label", cls); l.append(tx("span", key), control); return l; };

  /* A badge hints that ⏻ has a second, long-press action. */
  const powerBadge = node("span", "instPowerBadge", "🎹");
  powerBadge.setAttribute("aria-hidden", "true");
  power.append(powerBadge);
  const powerHelp = () => {
    const hintKey = core.settings.synthModeDisabled ? "instHoldDisabledHint" : core.settings.synthModeFastStart ? "instFastHoldHint" : "instHoldHint";
    const value = `${tr("dockPower")} · ${tr(hintKey)}`;
    if (power.title !== value) power.title = value;
    if (power.getAttribute("aria-label") !== value) power.setAttribute("aria-label", value);
    powerBadge.hidden = !!core.settings.synthModeDisabled;
  };
  const helpObserver = new MutationObserver(powerHelp);
  helpObserver.observe(power, { attributes:true, attributeFilter:["title", "aria-label"] });
  powerHelp();

  const overlay = node("div", "instOverlay"); overlay.id = "synthMode"; overlay.hidden = true;
  const backdrop = node("div", "instBackdrop"); backdrop.setAttribute("data-inst-close", "1");
  const dialog = node("section", "instDialog");
  dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true"); dialog.setAttribute("aria-labelledby", "instHeading");
  const header = node("header", "instHeader");
  const headText = node("div");
  const title = tx("h2", "instTitle"); title.id = "instHeading";
  const subtitle = tx("p", "instSubtitle", "instSubtitle");
  headText.append(title, subtitle);
  const closeBtn = btn("instClose", "instClose"); closeBtn.setAttribute("aria-label", tr("instClose"));
  header.append(headText, closeBtn);

  const display = node("div", "instDisplay");
  const canvas = node("canvas", "instScope"); canvas.setAttribute("aria-label", tr("instDisplay"));
  const displayTint = node("div", "instDisplayTint");
  const displayInfo = node("div", "instDisplayInfo");
  const displayMode = tx("span", "instDisplay", "instDisplayMode");
  const displayTrack = node("strong", "instDisplayTrack", "trk! synthesizer");
  displayInfo.append(displayMode, displayTrack);
  display.append(canvas, displayTint, displayInfo);

  const songRow = node("div", "instSongRow");
  const songPlay = btn("instTrackPlay", "instSongBtn primary");
  const songMute = btn("instTrackMute", "instSongBtn");
  const songName = node("div", "instSongName");
  const songVolume = document.createElement("input"); songVolume.type = "range"; songVolume.min = "0"; songVolume.max = "1"; songVolume.step = ".01";
  const songVol = label("instVol", songVolume, "instSongVolume");
  songRow.append(songPlay, songMute, songName, songVol);

  const body = node("div", "instBody");
  const patchBar = node("section", "instPanel instPatchBar");
  const presetSelect = document.createElement("select"); presetSelect.className = "instSelect";
  const presetLabel = label("instPreset", presetSelect, "instPresetSelect");
  const patchNameInput = document.createElement("input"); patchNameInput.type = "text"; patchNameInput.maxLength = 24; patchNameInput.autocomplete = "off";
  const nameLabel = label("instPatchName", patchNameInput, "instPatchNameField");
  const savePatchBtn = btn("instSave", "instSmallBtn");
  const deletePatchBtn = btn("instDelete", "instSmallBtn instDeletePatch"); deletePatchBtn.hidden = true;
  const resetBtn = btn("instReset", "instSmallBtn");
  patchBar.append(presetLabel, nameLabel, savePatchBtn, deletePatchBtn, resetBtn);

  const columns = node("div", "instColumns");
  const sourcePanel = node("section", "instPanel instSourcePanel");
  const sourceHead = tx("h3", "instSourceTitle");
  const sourceHint = tx("p", "instSourceHint", "instHint");
  const sourceHost = node("div", "instSources");
  const sourceActions = node("div", "instSourceActions");
  const addOscBtn = btn("instAddOsc", "instSmallBtn");
  const addSampleLabel = node("label", "fileBtn small instSampleBtn");
  addSampleLabel.tabIndex = 0; addSampleLabel.setAttribute("role", "button"); addSampleLabel.setAttribute("aria-label", tr("instAddSample"));
  const sampleInput = document.createElement("input"); sampleInput.type = "file"; sampleInput.accept = "audio/*,.wav,.mp3,.ogg,.oga,.m4a,.aac,.flac"; sampleInput.hidden = true;
  const sampleText = tx("span", "instAddSample"); addSampleLabel.append(sampleInput, sampleText);
  sourceActions.append(addOscBtn, addSampleLabel);
  sourcePanel.append(sourceHead, sourceHint, sourceHost, sourceActions);

  const voicePanel = node("section", "instPanel instVoicePanel");
  const voiceHead = tx("h3", "instFilter");
  const voiceControls = node("div", "instControls");
  const envHead = tx("h3", "instEnvelope", "instEnvHead");
  const envControls = node("div", "instControls");
  voicePanel.append(voiceHead, voiceControls, envHead, envControls);
  columns.append(sourcePanel, voicePanel);

  const pianoPanel = node("section", "instPanel instPianoPanel");
  const pianoHeader = node("div", "instPianoHeader");
  const pianoTitle = tx("h3", "instKeyboard");
  const mapBtn = btn("instAssign", "instSmallBtn instMapBtn"); mapBtn.setAttribute("aria-pressed", "false");
  const stopBtn = btn("instStop", "instSmallBtn instStopBtn");
  pianoHeader.append(pianoTitle, mapBtn, stopBtn);
  const mapHint = tx("p", "instAssignHint", "instHint instMapHint");
  const pianoScroll = node("div", "instPianoScroll"); pianoScroll.setAttribute("role", "group"); pianoScroll.setAttribute("aria-label", tr("instKeyboard"));
  const piano = node("div", "instPiano"); pianoScroll.append(piano);
  const status = node("div", "hint status instStatus"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
  pianoPanel.append(pianoHeader, mapHint, pianoScroll, status);

  const footer = node("footer", "instFooter");
  const keyHint = node("span", "instKeyHint", "Z S X D C V G B H N J M  ·  Q 2 W 3 E R 5 T 6 Y 7 U I");
  const closeTip = tx("span", "instEscapeClose", "instCloseTip");
  footer.append(keyHint, closeTip);
  body.append(patchBar, columns, pianoPanel);
  dialog.append(header, display, songRow, body, footer);
  overlay.append(backdrop, dialog);
  document.body.append(overlay);

  /* Settings: keep the launch controls beside the other audio / spectrum options. */
  const synthSettingsPanel = node("details", "panel"); synthSettingsPanel.id = "synthModeSettings";
  const synthSettingsHint = tx("div", "instSettingsHint", "hint");
  const synthDisableRow = window.Trk.modes.makeCheck("synthModeDisabled", "synthModeDisabled", "instDisableOption");
  const synthFastRow = window.Trk.modes.makeCheck("synthModeFastStart", "synthModeFastStart", "instFastOption");
  const synthKeyboardLockRow = window.Trk.modes.makeCheck("synthModeKeyboardLock", "synthModeKeyboardLock", "instKeyboardLockOption");
  const synthKeyboardLockHint = tx("div", "instKeyboardLockHint", "hint");
  const synthWideKeyboardRow = window.Trk.modes.makeCheck("synthModeWideKeyboard", "synthModeWideKeyboard", "instWideKeyboardOption");
  const synthWideKeyboardHint = tx("div", "instWideKeyboardHint", "hint");
  synthSettingsPanel.append(tx("summary", "instSettingsTitle"), synthSettingsHint, synthDisableRow, synthFastRow, synthKeyboardLockRow, synthKeyboardLockHint, synthWideKeyboardRow, synthWideKeyboardHint);
  const synthSettingsAnchor = document.getElementById("specPanel") || document.getElementById("fxPanel") ||
    (document.getElementById("seEnabled") && document.getElementById("seEnabled").closest("details.panel"));
  if (synthSettingsAnchor) synthSettingsAnchor.after(synthSettingsPanel);
  const synthDisableInput = synthDisableRow.querySelector("input");
  const synthFastInput = synthFastRow.querySelector("input");
  const synthKeyboardLockInput = synthKeyboardLockRow.querySelector("input");
  const synthWideKeyboardInput = synthWideKeyboardRow.querySelector("input");
  window._trkSyncSynthModeSettings = () => {
    synthDisableInput.checked = !!core.settings.synthModeDisabled;
    synthFastInput.checked = !!core.settings.synthModeFastStart;
    synthKeyboardLockInput.checked = core.settings.synthModeKeyboardLock !== false;
    synthWideKeyboardInput.checked = !!core.settings.synthModeWideKeyboard;
    renderPiano();
    updatePowerHint();
  };
  synthDisableInput.addEventListener("change", updatePowerHint);
  synthFastInput.addEventListener("change", updatePowerHint);
  synthWideKeyboardInput.addEventListener("change", renderPiano);
  window.addEventListener("resize", () => { if (!overlay.hidden) renderPiano(); });

  /* ============ 状態 ============ */
  let customPatches = loadCustomPatches();
  let state = loadState();
  let keyMap = normalizeKeyMap(state.keyMap);
  let master = clamp(state.master, 0, 1, .46);
  let pitchSemitones = Math.round(clamp(state.pitch, -8, 8, 0));
  let currentPatch = null, originPresetId = "sine", selectedPresetId = "sine", dirty = false;
  let assignMode = false, pendingMidi = null;
  let audio = null, synthBus = null, synthLimiter = null, analyser = null, visualBins = null;
  let visualRaf = 0, lastDraw = 0, pressTimer = 0, longPressed = false;
  const sampleBank = new Map(), voices = new Map(), pressedMidi = new Map();
  let sourceSerial = 1;
  let statusKey = "", statusVars = null;

  function loadCustomPatches() {
    try {
      const raw = JSON.parse(localStorage.getItem(PATCH_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.slice(0, MAX_PATCHES).map((p, i) => normalizePatch(p, p && p.id || `user-${i + 1}`)).filter(Boolean);
    } catch (_) { return []; }
  }
  function persistPatches() { try { localStorage.setItem(PATCH_KEY, JSON.stringify(customPatches)); } catch (_) {} }
  function loadState() {
    try { const raw = JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); return raw && typeof raw === "object" ? raw : {}; }
    catch (_) { return {}; }
  }
  function persistState() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify({ keyMap, master, pitch:pitchSemitones, preset:originPresetId })); } catch (_) {}
  }
  function customById(id) { return customPatches.find(p => p.id === id) || null; }
  function patchLabel(p) { return p.nameKey ? tr(p.nameKey) : p.name; }
  function populatePresets() {
    presetSelect.textContent = "";
    const edited = document.createElement("option"); edited.value = "__edited"; edited.textContent = tr("instEdited");
    presetSelect.append(edited);
    const built = document.createElement("optgroup"); built.label = tr("instPreset");
    for (const p of PRESETS) { const o = document.createElement("option"); o.value = p.id; o.textContent = tr(p.nameKey); built.append(o); }
    presetSelect.append(built);
    if (customPatches.length) {
      const own = document.createElement("optgroup"); own.label = tr("instSave");
      for (const p of customPatches) { const o = document.createElement("option"); o.value = p.id; o.textContent = p.name; own.append(o); }
      presetSelect.append(own);
    }
  }
  function setStatus(key, vars) { statusKey = key || ""; statusVars = vars || null; status.textContent = key ? tr(key, vars) : ""; }
  function presetData(id) {
    const p = PRESET_BY_ID[id] || customById(id);
    return p ? clone(p) : clone(PRESET_BY_ID.sine);
  }
  function choosePreset(id, initial = false) {
    if (!PRESET_BY_ID[id] && !customById(id)) id = "sine";
    stopAllNotes(); dirty = false; originPresetId = id; selectedPresetId = id;
    currentPatch = presetData(id);
    pruneSamples();
    currentPatch.name = patchLabel(currentPatch);
    patchNameInput.value = currentPatch.name;
    presetSelect.value = id;
    deletePatchBtn.hidden = !id.startsWith("user-");
    renderSources(); renderVoiceControls(); renderPiano();
    if (!initial) { persistState(); setStatus(""); }
  }
  function markEdited() {
    if (!dirty) { dirty = true; selectedPresetId = "__edited"; presetSelect.value = "__edited"; }
    deletePatchBtn.hidden = !originPresetId.startsWith("user-");
  }
  function freshSourceId() { return `layer-${Date.now().toString(36)}-${(sourceSerial++).toString(36)}`; }
  function updateSelectedNote(midi, active) {
    const b = piano.querySelector(`[data-midi="${midi}"]`);
    if (b) { b.classList.toggle("pressed", active); b.setAttribute("aria-pressed", String(active)); }
  }
  function pruneSamples() {
    const keep = new Set((currentPatch && currentPatch.sources || []).filter(s => s.kind === "sample").map(s => s.sampleId));
    for (const id of sampleBank.keys()) if (!keep.has(id)) sampleBank.delete(id);
  }

  /* ============ 鍵盤（QWERTYのZ列＋Q列。黒鍵を数字・中段キーに対応） ============ */
  function pianoScale() {
    if (!core.settings.synthModeWideKeyboard) return 1;
    const viewport = Number(window.innerWidth) || Number(document.documentElement && document.documentElement.clientWidth) || 0;
    const available = pianoScroll.clientWidth || Math.max(0, viewport - 40);
    /* 小画面では従来の630pxを守り、余裕のある画面だけ最大806pxまで広げる。 */
    return available ? Math.max(1, Math.min(WIDE_KEY_SCALE, available / (15 * WHITE_W))) : WIDE_KEY_SCALE;
  }
  function renderPiano() {
    piano.textContent = "";
    const scale = pianoScale(), whiteW = WHITE_W * scale, blackW = BLACK_W * scale;
    const whiteIndexFor = midi => {
      let n = 0;
      for (let m = FIRST_MIDI; m < midi; m++) if (WHITE_SEMIS.has(m % 12)) n++;
      return n;
    };
    for (let midi = FIRST_MIDI; midi <= LAST_MIDI; midi++) {
      const pc = midi % 12, white = WHITE_SEMIS.has(pc), whiteIndex = whiteIndexFor(midi);
      const b = document.createElement("button"); b.type = "button"; b.className = `instKey ${white ? "white" : "black"}`;
      b.dataset.midi = String(midi); b.style.left = `${white ? whiteIndex * whiteW : whiteIndex * whiteW - blackW / 2}px`;
      if (white) b.style.width = `${whiteW}px`; else b.style.width = `${blackW}px`;
      b.style.setProperty("--key-index", whiteIndex);
      b.classList.toggle("assignTarget", assignMode && pendingMidi === midi);
      const note = node("span", "instNote", noteName(midi));
      const cap = node("kbd", "instKeyCap", keyCodeLabel(keyMap[midi - FIRST_MIDI]));
      b.append(note, cap);
      b.setAttribute("aria-label", `${noteName(midi)} · ${keyCodeLabel(keyMap[midi - FIRST_MIDI])}`);
      b.setAttribute("aria-pressed", String(pressedMidi.has(midi)));
      if (!white) b.style.zIndex = "3";
      piano.append(b);
    }
    piano.style.width = `${15 * whiteW}px`;
    piano.dataset.wide = scale > 1 ? "1" : "0";
    for (const midi of pressedMidi.keys()) updateSelectedNote(midi, true);
  }

  /* ============ 音声エンジン ============ */
  function ensureAudio() {
    if (audio && synthBus) {
      if (audio.state === "suspended") audio.resume().catch(() => {});
      return true;
    }
    try {
      if (window.TrkFX && typeof window.TrkFX.tap === "function") {
        try { analyser = window.TrkFX.tap(2048); if (analyser) { audio = analyser.context; } } catch (_) { analyser = null; }
      }
      if (!audio && typeof getAC === "function") audio = window.Trk.media.getAC();
      if (!audio) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (C) audio = new C();
      }
      if (!audio) { setStatus("instAudioUnavailable"); return false; }
      synthBus = audio.createGain(); synthBus.gain.value = master * .42;
      synthLimiter = audio.createDynamicsCompressor();
      synthLimiter.threshold.value = -8; synthLimiter.knee.value = 8; synthLimiter.ratio.value = 8;
      synthLimiter.attack.value = .004; synthLimiter.release.value = .14;
      synthBus.connect(synthLimiter); synthLimiter.connect(audio.destination);
      if (!analyser) { analyser = audio.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = .78; }
      if (analyser.context === audio) {
        try { synthBus.connect(analyser); } catch (_) {}
        visualBins = new Uint8Array(analyser.frequencyBinCount);
      }
      if (audio.state === "suspended") audio.resume().catch(() => {});
      return true;
    } catch (e) {
      console.warn("synth-mode: audio unavailable", e);
      setStatus("instAudioUnavailable"); return false;
    }
  }
  function updateMaster() {
    if (synthBus && audio) synthBus.gain.setTargetAtTime(master * .42, audio.currentTime, .025);
    persistState();
  }
  function applyPitchToVoices() {
    if (!audio) return;
    const t = audio.currentTime;
    for (const voice of voices.values()) {
      voice.midi = voice.keyMidi + pitchSemitones;
      for (const item of voice.sourceNodes.values()) {
        const source = item.config;
        if (item.kind === "osc") {
          item.source.frequency.setTargetAtTime(440 * Math.pow(2, (voice.midi - 69) / 12) * Math.pow(2, source.octave), t, .025);
        } else {
          item.source.playbackRate.setTargetAtTime(Math.pow(2, (voice.midi - source.rootMidi) / 12), t, .025);
        }
      }
    }
  }
  function applyFilterToVoices() {
    if (!audio || !currentPatch) return;
    for (const v of voices.values()) {
      v.filter.type = currentPatch.filter.type;
      v.filter.frequency.setTargetAtTime(currentPatch.filter.cutoff, audio.currentTime, .03);
      v.filter.Q.setTargetAtTime(currentPatch.filter.q, audio.currentTime, .03);
    }
  }
  function noteOn(token, keyMidi) {
    if (!ensureAudio() || !currentPatch || voices.has(token)) return;
    if (voices.size >= MAX_VOICES) releaseVoice(voices.keys().next().value);
    const midi = keyMidi + pitchSemitones;
    const t = audio.currentTime + .006;
    const filter = audio.createBiquadFilter();
    filter.type = currentPatch.filter.type;
    filter.frequency.setValueAtTime(currentPatch.filter.cutoff, t);
    filter.Q.setValueAtTime(currentPatch.filter.q, t);
    const envelope = audio.createGain(); envelope.gain.setValueAtTime(.0001, t);
    const env = clone(currentPatch.env);
    const attackEnd = t + Math.max(.003, env.attack), decayEnd = attackEnd + Math.max(.005, env.decay);
    envelope.gain.linearRampToValueAtTime(1, attackEnd);
    envelope.gain.linearRampToValueAtTime(Math.max(.0001, env.sustain), decayEnd);
    filter.connect(envelope); envelope.connect(synthBus);
    const sourceNodes = new Map();
    for (const s of currentPatch.sources) {
      try {
        const layer = audio.createGain(); layer.gain.setValueAtTime(s.level, t);
        let sourceNode;
        if (s.kind === "sample") {
          const item = sampleBank.get(s.sampleId); if (!item || !item.buffer) continue;
          sourceNode = audio.createBufferSource(); sourceNode.buffer = item.buffer;
          sourceNode.playbackRate.setValueAtTime(Math.pow(2, (midi - s.rootMidi) / 12), t);
        } else {
          if (!WAVE_TYPES.includes(s.wave)) continue;
          sourceNode = audio.createOscillator(); sourceNode.type = s.wave;
          sourceNode.frequency.setValueAtTime(440 * Math.pow(2, (midi - 69) / 12) * Math.pow(2, s.octave), t);
          sourceNode.detune.setValueAtTime(s.detune, t);
        }
        sourceNode.connect(layer); layer.connect(filter); sourceNode.start(t);
        sourceNodes.set(s.id, { source:sourceNode, gain:layer, kind:s.kind, config:s });
      } catch (_) {}
    }
    if (!sourceNodes.size) { try { filter.disconnect(); envelope.disconnect(); } catch (_) {} return; }
    const voice = { token, keyMidi, midi, filter, envelope, sourceNodes, release:env.release, releasing:false };
    voices.set(token, voice);
    pressedMidi.set(keyMidi, (pressedMidi.get(keyMidi) || 0) + 1); updateSelectedNote(keyMidi, true);
    setStatus("");
  }
  function releaseVoice(token) {
    const voice = voices.get(token); if (!voice || voice.releasing) return;
    voice.releasing = true;
    const t = audio ? audio.currentTime : 0, end = t + Math.max(.025, voice.release);
    const g = voice.envelope.gain;
    try {
      if (typeof g.cancelAndHoldAtTime === "function") g.cancelAndHoldAtTime(t);
      else { g.cancelScheduledValues(t); g.setValueAtTime(Math.max(.001, g.value || .001), t); }
      g.exponentialRampToValueAtTime(.0001, end);
    } catch (_) { try { g.setTargetAtTime(.0001, t, Math.max(.02, voice.release / 3)); } catch (_) {} }
    for (const item of voice.sourceNodes.values()) { try { item.source.stop(end + .04); } catch (_) {} }
    const count = (pressedMidi.get(voice.keyMidi) || 1) - 1;
    if (count > 0) pressedMidi.set(voice.keyMidi, count); else { pressedMidi.delete(voice.keyMidi); updateSelectedNote(voice.keyMidi, false); }
    voices.delete(token); // Count only held voices; the release tail can overlap a retrigger.
    setTimeout(() => {
      for (const item of voice.sourceNodes.values()) { try { item.source.disconnect(); item.gain.disconnect(); } catch (_) {} }
      try { voice.filter.disconnect(); voice.envelope.disconnect(); } catch (_) {}
      if (voices.get(token) === voice) voices.delete(token);
    }, Math.ceil(Math.max(.03, voice.release) * 1000) + 100);
  }
  function noteOff(token) { releaseVoice(token); }
  function stopAllNotes() { for (const token of Array.from(voices.keys())) releaseVoice(token); }
  function updateSourceVoices(source) {
    if (!audio) return;
    for (const voice of voices.values()) {
      const item = voice.sourceNodes.get(source.id); if (!item) continue;
      item.gain.gain.setTargetAtTime(source.level, audio.currentTime, .025);
      if (item.kind === "osc") {
        item.source.type = source.wave;
        item.source.detune.setTargetAtTime(source.detune, audio.currentTime, .025);
        item.source.frequency.setTargetAtTime(440 * Math.pow(2, (voice.midi - 69) / 12) * Math.pow(2, source.octave), audio.currentTime, .025);
      } else {
        item.source.playbackRate.setTargetAtTime(Math.pow(2, (voice.midi - source.rootMidi) / 12), audio.currentTime, .025);
      }
    }
  }

  /* ============ コントロール ============ */
  function sourceSelect(source, key, options, onChange) {
    const sel = document.createElement("select"); sel.className = "instSelect";
    for (const [value, labelKey] of options) { const o = document.createElement("option"); o.value = value; o.textContent = tr(labelKey); sel.append(o); }
    sel.value = String(source[key]);
    sel.addEventListener("change", () => { source[key] = options.some(([v]) => typeof v === "number") ? Number(sel.value) : sel.value; markEdited(); onChange && onChange(); });
    return sel;
  }
  function rangeControl(key, value, min, max, step, formatter, onInput, cls = "") {
    const wrap = node("label", `instControl ${cls}`.trim());
    const head = node("span", "instControlHead");
    head.append(node("span", "instControlName", tr(key)));
    const readout = node("span", "instControlValue", formatter(value));
    head.append(readout);
    const input = document.createElement("input"); input.type = "range"; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value); input.setAttribute("aria-label", tr(key));
    input.addEventListener("input", () => { const v = Number(input.value); readout.textContent = formatter(v); onInput(v); });
    wrap.append(head, input);
    return wrap;
  }
  function freqFromNorm(v) { return 80 * Math.pow(18000 / 80, v / 1000); }
  function normFromFreq(f) { return Math.round(Math.log(f / 80) / Math.log(18000 / 80) * 1000); }
  function renderVoiceControls() {
    if (!currentPatch) return;
    voiceControls.textContent = ""; envControls.textContent = "";
    voiceControls.append(rangeControl("instMaster", master, 0, 1, .01, v => `${Math.round(v * 100)}%`, v => { master = v; updateMaster(); }, "instMasterControl"));
    voiceControls.append(rangeControl("instPitch", pitchSemitones, -8, 8, 1, v => `${v > 0 ? "+" : ""}${v} st`, v => {
      pitchSemitones = Math.round(v); applyPitchToVoices(); persistState();
    }, "instPitchControl"));
    voiceControls.append(tx("div", "instPitchHint", "hint instPitchHint"));
    const type = document.createElement("select"); type.className = "instSelect";
    for (const [v, k] of [["lowpass", "instLowpass"], ["highpass", "instHighpass"], ["bandpass", "instBandpass"], ["notch", "instNotch"]]) { const o = document.createElement("option"); o.value = v; o.textContent = tr(k); type.append(o); }
    type.value = currentPatch.filter.type;
    type.addEventListener("change", () => { currentPatch.filter.type = type.value; markEdited(); applyFilterToVoices(); });
    voiceControls.append(label("instFilterType", type, "instControl instSelectControl"));
    voiceControls.append(rangeControl("instCutoff", normFromFreq(currentPatch.filter.cutoff), 0, 1000, 1, v => `${Math.round(freqFromNorm(v))} Hz`, v => {
      currentPatch.filter.cutoff = freqFromNorm(v); markEdited(); applyFilterToVoices();
    }));
    voiceControls.append(rangeControl("instQ", currentPatch.filter.q, .1, 14, .1, v => v.toFixed(1), v => {
      currentPatch.filter.q = v; markEdited(); applyFilterToVoices();
    }));
    envControls.append(rangeControl("instAttack", currentPatch.env.attack, .002, 2, .01, v => `${v.toFixed(2)} s`, v => { currentPatch.env.attack = v; markEdited(); }));
    envControls.append(rangeControl("instDecay", currentPatch.env.decay, .005, 2, .01, v => `${v.toFixed(2)} s`, v => { currentPatch.env.decay = v; markEdited(); }));
    envControls.append(rangeControl("instSustain", currentPatch.env.sustain, 0, 1, .01, v => `${Math.round(v * 100)}%`, v => { currentPatch.env.sustain = v; markEdited(); }));
    envControls.append(rangeControl("instRelease", currentPatch.env.release, .02, 3, .01, v => `${v.toFixed(2)} s`, v => { currentPatch.env.release = v; markEdited(); }));
  }
  function renderSources() {
    sourceHost.textContent = "";
    if (!currentPatch.sources.length) sourceHost.append(tx("div", "instNoSources", "instEmptySources"));
    for (const source of currentPatch.sources) {
      const card = node("div", "instSource");
      const head = node("div", "instSourceHead");
      const titleText = source.kind === "sample" ? `${tr("instSample")}: ${source.name}` : tr("instOsc");
      head.append(node("strong", "", titleText));
      const remove = btn("instRemoveSource", "instRemoveSourceBtn"); remove.setAttribute("aria-label", tr("instRemoveSource"));
      remove.addEventListener("click", () => {
        stopAllNotes(); currentPatch.sources = currentPatch.sources.filter(s => s.id !== source.id);
        if (source.kind === "sample") sampleBank.delete(source.sampleId);
        markEdited(); renderSources();
      });
      head.append(remove); card.append(head);
      if (source.kind === "osc") {
        const row = node("div", "instSourceGrid");
        const waves = [["sine", "instSine"], ["square", "instSquare"], ["triangle", "instTriangle"], ["sawtooth", "instSaw"]];
        const wave = sourceSelect(source, "wave", waves, () => updateSourceVoices(source));
        row.append(label("instWave", wave, "instControl instSelectControl"));
        const octave = document.createElement("select"); octave.className = "instSelect";
        for (const n of [-2, -1, 0, 1, 2]) { const o = document.createElement("option"); o.value = String(n); o.textContent = `${n > 0 ? "+" : ""}${n}`; octave.append(o); }
        octave.value = String(source.octave);
        octave.addEventListener("change", () => { source.octave = Number(octave.value); markEdited(); updateSourceVoices(source); });
        row.append(label("instOctave", octave, "instControl instSelectControl"));
        row.append(rangeControl("instDetune", source.detune, -50, 50, 1, v => `${v} ¢`, v => { source.detune = v; markEdited(); updateSourceVoices(source); }));
        row.append(rangeControl("instLevel", source.level, 0, 1, .01, v => `${Math.round(v * 100)}%`, v => { source.level = v; markEdited(); updateSourceVoices(source); }));
        card.append(row);
      } else {
        const sampleHint = tx("div", "instSampleRootHint", "hint instSampleHint");
        const notes = document.createElement("select"); notes.className = "instSelect";
        for (let midi = 36; midi <= 84; midi++) { const o = document.createElement("option"); o.value = String(midi); o.textContent = noteName(midi); notes.append(o); }
        notes.value = String(source.rootMidi); notes.addEventListener("change", () => { source.rootMidi = Number(notes.value); markEdited(); updateSourceVoices(source); });
        card.append(sampleHint, label("instRoot", notes, "instControl instSelectControl"), rangeControl("instLevel", source.level, 0, 1, .01, v => `${Math.round(v * 100)}%`, v => { source.level = v; markEdited(); updateSourceVoices(source); }));
      }
      sourceHost.append(card);
    }
  }

  /* ============ プリセット保存・読込 ============ */
  function savePatch() {
    const name = patchNameInput.value.trim().slice(0, 24) || tr("instEdited");
    const oscillators = currentPatch.sources.filter(s => s.kind === "osc");
    if (!oscillators.length) { setStatus("instPatchNoOsc"); return; }
    const existing = originPresetId.startsWith("user-") ? customById(originPresetId) : null;
    if (!existing && customPatches.length >= MAX_PATCHES) { setStatus("instPatchLimit"); return; }
    const hadSamples = currentPatch.sources.some(s => s.kind === "sample");
    const livePatch = clone(currentPatch);
    const id = existing ? existing.id : `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const safe = normalizePatch({ id, name, sources:oscillators, filter:currentPatch.filter, env:currentPatch.env }, id);
    if (!safe) { setStatus("instPatchNoOsc"); return; }
    if (existing) customPatches = customPatches.map(p => p.id === id ? safe : p); else customPatches.push(safe);
    persistPatches(); populatePresets();
    originPresetId = safe.id; currentPatch = hadSamples ? livePatch : clone(safe);
    currentPatch.id = safe.id; currentPatch.name = name; currentPatch.nameKey = null;
    dirty = hadSamples; selectedPresetId = dirty ? "__edited" : safe.id;
    patchNameInput.value = name; presetSelect.value = selectedPresetId;
    deletePatchBtn.hidden = false; persistState();
    setStatus(hadSamples ? "instSavedSourcesOnly" : "instPatchSaved", { name });
  }
  function deletePatch() {
    if (!originPresetId.startsWith("user-") || !customById(originPresetId)) return;
    if (!confirm(tr("instDeleteConfirm"))) return;
    customPatches = customPatches.filter(p => p.id !== originPresetId); persistPatches(); populatePresets();
    choosePreset("sine"); setStatus("instPatchDeleted");
  }

  /* ============ サンプルを読み込む ============ */
  async function importSample(file) {
    if (!file) return;
    if (file.size > SAMPLE_LIMIT) { setStatus("instSampleTooBig"); return; }
    if (currentPatch.sources.length >= MAX_SOURCES) { setStatus("instSourceLimit"); return; }
    if (!ensureAudio()) return;
    try {
      const buffer = typeof decodeAudio === "function" ? await window.Trk.media.decodeAudio(await file.arrayBuffer()) : await audio.decodeAudioData(await file.arrayBuffer());
      if (buffer.duration > MAX_SAMPLE_SECONDS) { setStatus("instSampleTooLong"); return; }
      const sampleId = `sample-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      sampleBank.set(sampleId, { buffer, name:file.name });
      currentPatch.sources.push({ id:freshSourceId(), kind:"sample", sampleId, name:file.name.slice(0, 80), rootMidi:60, level:.55 });
      patchNameInput.value = patchNameInput.value || tr("instEdited");
      markEdited(); renderSources(); setStatus("instSampleAdded", { name:file.name });
    } catch (e) { console.warn("synth-mode: sample decode failed", e); setStatus("instSampleDecode"); }
  }

  /* ============ 表示・曲コントロール ============ */
  function refreshText() {
    title.textContent = tr("instTitle"); subtitle.textContent = tr("instSubtitle"); closeBtn.textContent = tr("instClose"); closeBtn.setAttribute("aria-label", tr("instClose"));
    displayMode.textContent = tr("instDisplay"); sourceHead.textContent = tr("instSourceTitle"); sourceHint.textContent = tr("instSourceHint");
    voiceHead.textContent = tr("instFilter"); envHead.textContent = tr("instEnvelope"); pianoTitle.textContent = tr("instKeyboard"); mapBtn.textContent = tr("instAssign");
    stopBtn.textContent = tr("instStop"); savePatchBtn.textContent = tr("instSave"); resetBtn.textContent = tr("instReset");
    deletePatchBtn.textContent = tr("instDelete"); addOscBtn.textContent = tr("instAddOsc"); sampleText.textContent = tr("instAddSample"); addSampleLabel.setAttribute("aria-label", tr("instAddSample"));
    mapHint.textContent = tr("instAssignHint"); closeTip.textContent = tr("instEscapeClose"); songName.textContent = trackTitle();
    songVol.firstChild.textContent = tr("instVol");
    keyHint.textContent = "Z S X D C V G B H N J M  ·  Q 2 W 3 E R 5 T 6 Y 7 U I";
    if (statusKey) status.textContent = tr(statusKey, statusVars);
    populatePresets();
    presetSelect.value = selectedPresetId;
    if (selectedPresetId === "__edited") presetSelect.value = "__edited";
    if (currentPatch) {
      if (!dirty && currentPatch.nameKey) patchNameInput.value = tr(currentPatch.nameKey);
      renderSources(); renderVoiceControls(); renderPiano();
    }
    updateTrackControls();
    updatePowerHint();
  }
  function trackTitle() {
    const t = document.getElementById("songTitleBig");
    const s = t && t.textContent.trim();
    return s || tr("instTrackNone");
  }
  function updateTrackControls() {
    const loaded = core.videoReady;
    songPlay.textContent = tr(core.video.paused ? "instTrackPlay" : "instTrackPause");
    songMute.textContent = tr(core.video.muted ? "instTrackUnmute" : "instTrackMute");
    songName.textContent = trackTitle();
    songPlay.disabled = !loaded;
    displayTrack.textContent = (loaded && trackTitle() !== tr("instTrackNone")) ? trackTitle() : "trk! synthesizer";
    songVolume.value = String(core.settings.musicVolume);
    songMute.setAttribute("aria-pressed", String(core.video.muted));
  }
  function updatePowerHint() { powerHelp(); }
  function fitCanvas() {
    const r = canvas.getBoundingClientRect(); if (!r.width || !r.height) return;
    const dpr = typeof TrkLite === "object" ? TrkLite.pixelRatio(2) : Math.min(2, window.devicePixelRatio || 1);   // 🪶 軽量化は描画解像度の上限
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  function drawScope(now) {
    if (overlay.hidden) return;
    const reduce = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
      (typeof TrkLite === "object" && TrkLite.decorBlocked && TrkLite.decorBlocked());   // 🪶 軽量化も「動きを減らす」と同じ扱い
    if (now - lastDraw >= (reduce ? 100 : 32)) {
      lastDraw = now; fitCanvas();
      const r = canvas.getBoundingClientRect(), dpr = typeof TrkLite === "object" ? TrkLite.pixelRatio(2) : Math.min(2, window.devicePixelRatio || 1);   // 🪶 軽量化は描画解像度の上限
      const w = r.width, h = r.height, g = canvas.getContext("2d");
      if (w && h && g) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.fillStyle = "#071018"; g.fillRect(0, 0, w, h);
        try {
          if (core.video.videoWidth > 0 && !core.video.paused) {
            const scale = Math.max(w / core.video.videoWidth, h / core.video.videoHeight);
            const dw = core.video.videoWidth * scale, dh = core.video.videoHeight * scale;
            g.globalAlpha = .26; g.drawImage(core.video, (w - dw) / 2, (h - dh) / 2, dw, dh); g.globalAlpha = 1;
          }
        } catch (_) { g.globalAlpha = 1; }
        g.fillStyle = "rgba(2,8,14,.48)"; g.fillRect(0, 0, w, h);
        if (analyser && visualBins && analyser.context === audio) {
          try {
            analyser.getByteFrequencyData(visualBins);
            const count = Math.min(72, Math.floor(w / 7)), gap = 3, barW = Math.max(2, (w - gap * (count - 1)) / count);
            for (let i = 0; i < count; i++) {
              const u = count > 1 ? i / (count - 1) : 0;
              const bin = Math.min(visualBins.length - 1, Math.floor(Math.pow(u, 2.2) * visualBins.length * .82));
              const v = visualBins[bin] / 255;
              const bh = Math.max(2, v * h * .82), x = i * (barW + gap), y = h - bh - 6;
              const hue = 188 + u * 125;
              g.fillStyle = `hsla(${hue}, 95%, ${55 + v * 12}%, .92)`;
              g.shadowColor = `hsla(${hue}, 95%, 58%, .72)`; g.shadowBlur = v > .08 ? 10 : 0;
              g.fillRect(x, y, barW, bh);
            }
            g.shadowBlur = 0;
          } catch (_) {}
        }
        g.strokeStyle = "rgba(255,255,255,.13)"; g.lineWidth = 1;
        for (let y = 20; y < h; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      }
    }
    visualRaf = requestAnimationFrame(drawScope);
  }
  function startScope() { cancelAnimationFrame(visualRaf); lastDraw = 0; visualRaf = requestAnimationFrame(drawScope); }

  /* ============ モード開閉・キーアサイン ============ */
  function updateMapButton() { mapBtn.classList.toggle("selected", assignMode); mapBtn.setAttribute("aria-pressed", String(assignMode)); }
  function setAssign(on) {
    assignMode = !!on; pendingMidi = null;
    if (assignMode) stopAllNotes();
    updateMapButton(); renderPiano();
    if (assignMode) setStatus("instMapOn"); else setStatus("instMapOff");
  }
  function openSynth() {
    if (core.settings.synthModeDisabled || (window.TrkSafeMode && window.TrkSafeMode())) return;
    window.Trk.overlay.set("synth", true);
    overlay.hidden = false; document.body.classList.add("instOpen");
    refreshText(); updateTrackControls(); startScope(); closeBtn.focus();
    ensureAudio();
  }
  function closeSynth(restoreFocus = true) {
    if (overlay.hidden) return;
    stopAllNotes();
    if (assignMode) setAssign(false); else pendingMidi = null;
    window.Trk.overlay.set("synth", false);
    overlay.hidden = true; document.body.classList.remove("instOpen");
    cancelAnimationFrame(visualRaf); visualRaf = 0;
    if (restoreFocus) power.focus();
  }
  window._trkCloseSynth = closeSynth;
  // Let controls and text fields keep their native keyboard behavior, but do not
  // let those events bubble back into the rhythm-game hotkeys behind the modal.
  overlay.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.code !== "Tab") return;
    const focusables = Array.from(dialog.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"))
      .filter(el => !el.hidden && !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
    if (!focusables.length) { e.preventDefault(); closeBtn.focus(); return; }
    const first = focusables[0], last = focusables[focusables.length - 1], active = document.activeElement;
    if (e.shiftKey && (active === first || !dialog.contains(active))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !dialog.contains(active))) { e.preventDefault(); first.focus(); }
  });
  overlay.addEventListener("keyup", e => e.stopPropagation());
  closeBtn.addEventListener("click", () => closeSynth());
  backdrop.addEventListener("click", () => closeSynth());
  overlay.addEventListener("click", e => { if (e.target === overlay) closeSynth(); });
  document.addEventListener("click", e => { if (e.target && e.target.closest && e.target.closest("[data-inst-close]")) closeSynth(); });
  mapBtn.addEventListener("click", () => setAssign(!assignMode));
  stopBtn.addEventListener("click", stopAllNotes);
  presetSelect.addEventListener("change", () => { if (presetSelect.value !== "__edited") choosePreset(presetSelect.value); });
  patchNameInput.addEventListener("input", () => { currentPatch.name = patchNameInput.value.slice(0, 24); currentPatch.nameKey = null; markEdited(); });
  savePatchBtn.addEventListener("click", savePatch);
  deletePatchBtn.addEventListener("click", deletePatch);
  resetBtn.addEventListener("click", () => choosePreset("sine"));
  addOscBtn.addEventListener("click", () => {
    if (currentPatch.sources.length >= MAX_SOURCES) { setStatus("instSourceLimit"); return; }
    currentPatch.sources.push(src(freshSourceId(), "sawtooth", 0, 0, .28));
    markEdited(); renderSources(); setStatus("");
  });
  sampleInput.addEventListener("change", e => { const file = e.target.files && e.target.files[0]; e.target.value = ""; importSample(file); });
  addSampleLabel.addEventListener("keydown", e => {
    if (!["Enter", "Space"].includes(e.code)) return;
    e.preventDefault(); sampleInput.click();
  });
  songPlay.addEventListener("click", async () => {
    if (!core.videoReady) return;
    if (!core.video.paused) { core.video.pause(); return; }
    try {
      if (core.video.muted) core.video.muted = false;
      if (core.video.ended) { try { core.video.currentTime = typeof previewStartFor === "function" ? window.Trk.library.previewStartFor() : 0; } catch (_) {} }
      await core.video.play();
    } catch (_) { setStatus("instTrackBlocked"); }
    updateTrackControls();
  });
  songMute.addEventListener("click", () => { core.video.muted = !core.video.muted; updateTrackControls(); });
  songVolume.addEventListener("input", () => {
    const v = Number(songVolume.value); core.settings.musicVolume = v;
    const mainVolume = document.getElementById("volume");
    if (mainVolume) { mainVolume.value = String(v); mainVolume.dispatchEvent(new Event("input", { bubbles:true })); }
    else { if (v > 0) core.rememberMusicVolume(v); core.video.volume = v; core.saveUserPrefs(); }
  });
  let lastPianoPointer = 0;
  piano.addEventListener("pointerdown", e => {
    const b = e.target.closest("button[data-midi]"); if (!b) return;
    lastPianoPointer = Date.now();
    e.preventDefault();
    const midi = Number(b.dataset.midi);
    if (assignMode) {
      pendingMidi = midi; renderPiano(); setStatus("instAssignPress", { note:noteName(midi) }); return;
    }
    const token = `pointer-${e.pointerId}`;
    try { b.setPointerCapture(e.pointerId); } catch (_) {}
    noteOn(token, midi);
  });
  const endPointer = e => noteOff(`pointer-${e.pointerId}`);
  piano.addEventListener("pointerup", endPointer); piano.addEventListener("pointercancel", endPointer); piano.addEventListener("lostpointercapture", endPointer);
  piano.addEventListener("contextmenu", e => e.preventDefault());
  piano.addEventListener("click", e => {
    const b = e.target.closest("button[data-midi]"); if (!b || Date.now() - lastPianoPointer < 350) return;
    if (assignMode) {
      pendingMidi = Number(b.dataset.midi); renderPiano(); setStatus("instAssignPress", { note:noteName(pendingMidi) }); return;
    }
    if (e.detail !== 0) return;
    const token = `assist-${b.dataset.midi}`; noteOn(token, Number(b.dataset.midi)); setTimeout(() => noteOff(token), 180);
  });

  const isTyping = target => !!(target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)));
  function assignPhysicalKey(code) {
    if (code === "Delete" || code === "Backspace") {
      if (pendingMidi == null) { setStatus("instAssignPick"); return; }
      keyMap[pendingMidi - FIRST_MIDI] = ""; const n = pendingMidi; pendingMidi = null;
      renderPiano(); persistState(); setStatus("instKeyCleared", { note:noteName(n) }); return;
    }
    if (!safeKeyCode(code)) { setStatus("instBadKey"); return; }
    if (pendingMidi == null) { setStatus("instAssignPick"); return; }
    const previous = keyMap.indexOf(code);
    const midi = pendingMidi;
    if (previous >= 0 && previous !== midi - FIRST_MIDI) keyMap[previous] = "";
    keyMap[midi - FIRST_MIDI] = code; pendingMidi = null;
    renderPiano(); persistState();
    setStatus(previous >= 0 && previous !== midi - FIRST_MIDI ? "instKeyMoved" : "instAssigned", { note:noteName(midi), key:keyCodeLabel(code) });
  }
  window.addEventListener("keydown", e => {
    if (overlay.hidden || window.Trk.overlay.is("study")) return;
    if (e.code === "Tab") return; // keep the modal keyboard-navigable
    if (e.ctrlKey || e.metaKey || e.altKey) return; // retain browser/system shortcuts
    if (e.code === "Escape") {
      e.preventDefault(); e.stopImmediatePropagation();
      if (assignMode) setAssign(false); else closeSynth();
      return;
    }
    const mappedIndex = keyMap.indexOf(e.code);
    if (assignMode && isTyping(e.target) && !core.settings.synthModeKeyboardLock) return; // OFFなら文字入力を優先
    if (assignMode) {
      const activeAction = e.target && e.target.closest && e.target.closest("button,[role='button']");
      if (pendingMidi == null && activeAction && ["Enter", "Space"].includes(e.code)) return; // keep focused controls operable
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat) assignPhysicalKey(e.code);
      return;
    }
    /* ON（初期値）では、フォーカスがスライダーやステータス欄にあっても
       割り当て済みのキーを先に奪い、鍵盤へ固定する。repeatも毎回止めるので
       range inputがキーリピートで動くこともない。 */
    if (core.settings.synthModeKeyboardLock && mappedIndex >= 0) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat) noteOn(`key-${e.code}`, FIRST_MIDI + mappedIndex);
      return;
    }
    if (isTyping(e.target)) return;
    if (e.repeat) return;
    if (mappedIndex >= 0) { e.preventDefault(); e.stopImmediatePropagation(); noteOn(`key-${e.code}`, FIRST_MIDI + mappedIndex); return; }
    const activeButton = e.target && e.target.closest && e.target.closest("button,[role='button']");
    if ((e.code === "Enter" || e.code === "Space") && activeButton) return;
    if (["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight"].includes(e.code)) return;
    e.preventDefault(); e.stopImmediatePropagation(); // keep game hotkeys from leaking through the open instrument
  }, true);
  window.addEventListener("keyup", e => {
    if (overlay.hidden || window.Trk.overlay.is("study")) return;
    const token = `key-${e.code}`;
    /* keydownと同じ優先順位でkeyupも止める。これでフォーカス中のrange/selectへ
       リリース時のキーイベントが流れず、押鍵の開始と終了が必ず対になる。 */
    if (core.settings.synthModeKeyboardLock && keyMap.indexOf(e.code) >= 0) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (voices.has(token)) noteOff(token);
      return;
    }
    if (voices.has(token)) { e.preventDefault(); e.stopImmediatePropagation(); noteOff(token); return; }
    if (!isTyping(e.target) && e.code !== "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) e.stopImmediatePropagation();
  }, true);
  window.addEventListener("blur", stopAllNotes);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopAllNotes(); });

  /* Hold on ⏻ opens this mode; a short click still toggles the original speaker mute. */
  power.addEventListener("pointerdown", e => {
    if (e.button !== undefined && e.button !== 0) return;
    clearTimeout(pressTimer); longPressed = false;
    if (core.settings.synthModeDisabled) return;
    const holdMs = core.settings.synthModeFastStart ? 200 : 650;
    pressTimer = setTimeout(() => {
      if (core.settings.synthModeDisabled || (window.TrkSafeMode && window.TrkSafeMode())) return;
      longPressed = true; openSynth();
    }, holdMs);
  }, true);
  for (const type of ["pointerup", "pointerleave", "pointercancel"]) power.addEventListener(type, () => clearTimeout(pressTimer), true);
  window.addEventListener("pointerup", () => { clearTimeout(pressTimer); setTimeout(() => { longPressed = false; }, 0); }, true);
  window.addEventListener("pointercancel", () => { clearTimeout(pressTimer); longPressed = false; }, true);
  power.addEventListener("click", e => {
    if (!longPressed) return;
    e.preventDefault(); e.stopImmediatePropagation(); longPressed = false;
  }, true);
  power.addEventListener("contextmenu", e => e.preventDefault());

  /* Keep track state and labels current while the modal is open. */
  for (const type of ["play", "pause", "volumechange", "loadedmetadata", "loadeddata", "canplay", "ended"]) core.video.addEventListener(type, updateTrackControls);
  on("chart", updateTrackControls);
  on("language", refreshText);
  on("phase", p => { if (p !== "title") closeSynth(false); });

  /* Restore the last instrument patch and the user key map. */
  populatePresets();
  const restoreId = String(state.preset || "sine");
  choosePreset(PRESET_BY_ID[restoreId] || customById(restoreId) ? restoreId : "sine", true);
  renderVoiceControls(); renderSources(); renderPiano(); updateTrackControls(); updatePowerHint();
});
})();
/* ✅ synth-mode.js 完了 */
