// SPDX-License-Identifier: GPL-3.0-or-later
/* ========================================================================== 
   trk! fx-synth.js — 🎹 safe visual editor for composing trk-fx effect chains
   Loads after fx.js so it can use window.TrkFX and the existing FX JSON editor.
   Drafts live only in memory; apply is temporary, Save uses fx.js's validated
   preset-save action, and Import/Export use the public trk-fx JSON format.
   ========================================================================== */
"use strict";
(() => {
  const core = window.Trk.core;

/* ============ 文章（接頭辞 synth…） ============ */
Object.assign(TEXT.ja, {
  synthTitle:"🎛 エフェクトチェーンを組み立てる",
  synthHint:"エフェクトをつないで音を調整します。「適用」で試し、下書きは「マイプリセットに保存」かJSON書き出しで残せます。",
  synthName:"プリセット名", synthNamePlaceholder:"わたしの音", synthEffectType:"エフェクトの種類",
  synthMaster:"🎚 マスター", synthMasterVol:"出力音量", synthMasterHint:"5バンドEQはFXラックのEQスライダーと共通です。",
  synthLoad:"いまのエフェクトを読み込む", synthImport:"⇧ trk-fxを読み込む", synthExport:"⇩ JSONを書き出す",
  synthApply:"▶ 音に適用", synthSave:"⭐ マイプリセットに保存", synthAdd:"＋ エフェクトを追加",
  synthAddHint:"順番に通ります。エフェクトは最大16個まで。",
  synthNoEffects:"まだエフェクトがありません。上から追加してください。",
  synthSaveHint:"適用して聴いてから保存できます。EQはFXラックの5バンドEQと共通で、音量はマスター欄から調整できます。",
  synthStep:"{n}番目", synthMoveUp:"上へ", synthMoveDown:"下へ", synthRemove:"外す", synthRemoveBand:"バンドを外す",
  synthAddBand:"＋ EQバンドを追加", synthEqBand:"EQバンド {n}", synthBandLimit:"EQは最大10バンドです。",
  synthFxEq:"イコライザー (EQ)", synthFxComp:"コンプレッサー", synthFxGain:"ゲイン", synthFxWidth:"ステレオ幅",
  synthFxVocalCut:"ボーカルカット", synthFxDelay:"ディレイ", synthFxReverb:"リバーブ", synthFxDrive:"ドライブ",
  synthFxLofi:"ローファイ", synthFxPump:"ポンピング", synthFxTremolo:"トレモロ", synthFxAutopan:"オートパン",
  synthFxSweep:"フィルタースイープ", synthFxRingmod:"リングモジュレーター", synthFxChorus:"コーラス",
  synthFxNoise:"環境音", synthFxCrossfeed:"クロスフィード",
  synthParamThreshold:"しきい値", synthParamRatio:"圧縮比", synthParamAttack:"アタック", synthParamRelease:"リリース",
  synthParamKnee:"ニー", synthParamMakeup:"補正ゲイン", synthParamDb:"ゲイン", synthParamGain:"ゲイン", synthParamAmount:"量",
  synthParamKeepBass:"低音を残す", synthParamBeats:"周期（拍）", synthParamMs:"時間", synthParamFeedback:"フィードバック",
  synthParamMix:"ミックス", synthParamTone:"音色", synthParamSize:"部屋の大きさ", synthParamDecay:"減衰",
  synthParamDepth:"深さ", synthParamBits:"ビット数", synthParamCutoff:"カットオフ", synthParamRate:"速さ",
  synthParamFilter:"フィルター", synthParamFrom:"開始周波数", synthParamTo:"終了周波数", synthParamQ:"Q",
  synthParamFreq:"周波数", synthParamKind:"音の種類", synthParamLevel:"音量",
  synthFilterLabel:"フィルターの種類", synthFilterLowShelf:"低音シェルフ", synthFilterHighShelf:"高音シェルフ",
  synthFilterPeaking:"ピーキング", synthFilterLowpass:"ローパス", synthFilterHighpass:"ハイパス",
  synthFilterBandpass:"バンドパス", synthFilterNotch:"ノッチ",
  synthNoisePink:"ピンクノイズ", synthNoiseVinyl:"レコードノイズ", synthNoiseTape:"テープノイズ",
  synthNoiseRain:"雨", synthNoiseWind:"風", synthNoiseFire:"焚き火", synthNoiseCrowd:"人ごみ",
  synthLoaded:"いまのエフェクトを読み込みました。", synthApplied:"シンセの設定を一時エフェクトとして適用しました。",
  synthSaved:"マイプリセットに保存しました。", synthSaveFailed:"保存できませんでした。マイプリセットの上限（30個）を確認してください。",
  synthSaveUnavailable:"保存用のエディターが見つかりません。設定画面のサウンドエフェクト欄から保存してください。",
  synthExported:"trk-fxを書き出しました。", synthImported:"trk-fxを読み込みました。",
  synthBad:"trk-fx JSONを読み込めませんでした。形式と内容を確認してください。",
  synthTooBig:"ファイルが大きすぎます（1MBまで）。", synthApplyFailed:"この設定を適用できませんでした。"
});
Object.assign(TEXT.en, {
  synthTitle:"🎛 Build an effect chain",
  synthHint:"Connect effects to shape your sound. Choose Apply to try it, then save to My Presets or export JSON to keep it.",
  synthName:"Preset name", synthNamePlaceholder:"My sound", synthEffectType:"Effect type",
  synthMaster:"🎚 Master", synthMasterVol:"Output volume", synthMasterHint:"The five-band EQ is shared with the FX rack sliders.",
  synthLoad:"Load current effect", synthImport:"⇧ Import trk-fx", synthExport:"⇩ Export JSON",
  synthApply:"▶ Apply to audio", synthSave:"⭐ Save to My Presets", synthAdd:"＋ Add effect",
  synthAddHint:"Effects run in order. Up to 16 effects per chain.",
  synthNoEffects:"No effects yet. Add one above.",
  synthSaveHint:"Apply and listen before saving. EQ is shared with the FX rack; adjust output volume in Master.",
  synthStep:"Step {n}", synthMoveUp:"Move up", synthMoveDown:"Move down", synthRemove:"Remove", synthRemoveBand:"Remove band",
  synthAddBand:"＋ Add EQ band", synthEqBand:"EQ band {n}", synthBandLimit:"EQ supports up to 10 bands.",
  synthFxEq:"Equalizer (EQ)", synthFxComp:"Compressor", synthFxGain:"Gain", synthFxWidth:"Stereo width",
  synthFxVocalCut:"Vocal cut", synthFxDelay:"Delay", synthFxReverb:"Reverb", synthFxDrive:"Drive",
  synthFxLofi:"Lo-fi", synthFxPump:"Pump", synthFxTremolo:"Tremolo", synthFxAutopan:"Auto-pan",
  synthFxSweep:"Filter sweep", synthFxRingmod:"Ring modulator", synthFxChorus:"Chorus",
  synthFxNoise:"Ambience noise", synthFxCrossfeed:"Crossfeed",
  synthParamThreshold:"Threshold", synthParamRatio:"Ratio", synthParamAttack:"Attack", synthParamRelease:"Release",
  synthParamKnee:"Knee", synthParamMakeup:"Make-up gain", synthParamDb:"Gain", synthParamGain:"Gain", synthParamAmount:"Amount",
  synthParamKeepBass:"Keep bass", synthParamBeats:"Period (beats)", synthParamMs:"Time", synthParamFeedback:"Feedback",
  synthParamMix:"Mix", synthParamTone:"Tone", synthParamSize:"Room size", synthParamDecay:"Decay",
  synthParamDepth:"Depth", synthParamBits:"Bit depth", synthParamCutoff:"Cutoff", synthParamRate:"Rate",
  synthParamFilter:"Filter", synthParamFrom:"Start frequency", synthParamTo:"End frequency", synthParamQ:"Q",
  synthParamFreq:"Frequency", synthParamKind:"Noise type", synthParamLevel:"Level",
  synthFilterLabel:"Filter type", synthFilterLowShelf:"Low shelf", synthFilterHighShelf:"High shelf",
  synthFilterPeaking:"Peaking", synthFilterLowpass:"Low-pass", synthFilterHighpass:"High-pass",
  synthFilterBandpass:"Band-pass", synthFilterNotch:"Notch",
  synthNoisePink:"Pink noise", synthNoiseVinyl:"Vinyl crackle", synthNoiseTape:"Tape hiss",
  synthNoiseRain:"Rain", synthNoiseWind:"Wind", synthNoiseFire:"Fire", synthNoiseCrowd:"Crowd",
  synthLoaded:"Loaded the current effect into the synthesizer.", synthApplied:"Applied as a temporary effect.",
  synthSaved:"Saved to My Presets.", synthSaveFailed:"Couldn't save. Check whether the 30-preset limit has been reached.",
  synthSaveUnavailable:"The preset editor wasn't found. Save from Sound Effects in Settings instead.",
  synthExported:"Exported trk-fx JSON.", synthImported:"Imported trk-fx JSON.",
  synthBad:"Couldn't read this trk-fx JSON. Check its format and contents.",
  synthTooBig:"File is too large (maximum 1 MB).", synthApplyFailed:"Couldn't apply this configuration."
});
Object.assign(TEXT.zh, {
  synthTitle:"🎛 组合效果链",
  synthHint:"连接不同效果来塑造声音。点击“应用”试听，并保存到“我的预设”或导出JSON。", 
  synthName:"预设名称", synthNamePlaceholder:"我的声音", synthEffectType:"效果类型",
  synthMaster:"🎚 主控", synthMasterVol:"输出音量", synthMasterHint:"五段EQ与效果器架上的EQ滑块共用。",
  synthLoad:"读取当前音效", synthImport:"⇧ 导入 trk-fx", synthExport:"⇩ 导出JSON",
  synthApply:"▶ 应用到声音", synthSave:"⭐ 保存到我的预设", synthAdd:"＋ 添加效果",
  synthAddHint:"效果按顺序依次处理。最多16个效果。",
  synthNoEffects:"还没有效果，请在上方添加。",
  synthSaveHint:"试听后再保存。EQ与效果器架共用；输出音量在主控中调整。", 
  synthStep:"第{n}步", synthMoveUp:"上移", synthMoveDown:"下移", synthRemove:"移除", synthRemoveBand:"移除频段",
  synthAddBand:"＋ 添加EQ频段", synthEqBand:"EQ频段 {n}", synthBandLimit:"EQ最多支持10个频段。",
  synthFxEq:"均衡器 (EQ)", synthFxComp:"压缩器", synthFxGain:"增益", synthFxWidth:"立体声宽度",
  synthFxVocalCut:"人声消除", synthFxDelay:"延迟", synthFxReverb:"混响", synthFxDrive:"失真",
  synthFxLofi:"低保真", synthFxPump:"泵动", synthFxTremolo:"颤音", synthFxAutopan:"自动声像",
  synthFxSweep:"滤波扫频", synthFxRingmod:"环形调制器", synthFxChorus:"合唱", synthFxNoise:"环境噪声", synthFxCrossfeed:"交叉馈送",
  synthParamThreshold:"阈值", synthParamRatio:"压缩比", synthParamAttack:"起音", synthParamRelease:"释放",
  synthParamKnee:"拐点", synthParamMakeup:"补偿增益", synthParamDb:"增益", synthParamGain:"增益", synthParamAmount:"强度",
  synthParamKeepBass:"保留低音", synthParamBeats:"周期（拍）", synthParamMs:"时间", synthParamFeedback:"反馈",
  synthParamMix:"混合", synthParamTone:"音色", synthParamSize:"房间大小", synthParamDecay:"衰减",
  synthParamDepth:"深度", synthParamBits:"位深", synthParamCutoff:"截止频率", synthParamRate:"速度",
  synthParamFilter:"滤波器", synthParamFrom:"起始频率", synthParamTo:"结束频率", synthParamQ:"Q值",
  synthParamFreq:"频率", synthParamKind:"噪声类型", synthParamLevel:"音量",
  synthFilterLabel:"滤波类型", synthFilterLowShelf:"低架", synthFilterHighShelf:"高架",
  synthFilterPeaking:"峰值", synthFilterLowpass:"低通", synthFilterHighpass:"高通", synthFilterBandpass:"带通", synthFilterNotch:"陷波",
  synthNoisePink:"粉红噪声", synthNoiseVinyl:"唱片杂音", synthNoiseTape:"磁带噪声", synthNoiseRain:"雨声",
  synthNoiseWind:"风声", synthNoiseFire:"篝火", synthNoiseCrowd:"人群",
  synthLoaded:"已将当前音效载入合成器。", synthApplied:"已作为临时音效应用。",
  synthSaved:"已保存到我的预设。", synthSaveFailed:"保存失败，请确认是否已达到30个预设的上限。",
  synthSaveUnavailable:"找不到预设编辑器。请在设置的音效栏中保存。",
  synthExported:"已导出 trk-fx JSON。", synthImported:"已导入 trk-fx JSON。",
  synthBad:"无法读取此 trk-fx JSON，请检查格式和内容。", synthTooBig:"文件过大（最大1MB）。", synthApplyFailed:"无法应用此配置。"
});
Object.assign(TEXT.ko, {
  synthTitle:"🎛 이펙트 체인 만들기",
  synthHint:"이펙트를 연결해 소리를 조정하세요. 적용해서 들어본 뒤 내 프리셋에 저장하거나 JSON으로 내보낼 수 있습니다.",
  synthName:"프리셋 이름", synthNamePlaceholder:"나만의 소리", synthEffectType:"이펙트 종류",
  synthMaster:"🎚 마스터", synthMasterVol:"출력 음량", synthMasterHint:"5밴드 EQ는 이펙트 랙의 EQ 슬라이더와 공유됩니다.",
  synthLoad:"현재 이펙트 불러오기", synthImport:"⇧ trk-fx 가져오기", synthExport:"⇩ JSON 내보내기",
  synthApply:"▶ 오디오에 적용", synthSave:"⭐ 내 프리셋에 저장", synthAdd:"＋ 이펙트 추가",
  synthAddHint:"이펙트는 순서대로 적용됩니다. 체인당 최대 16개입니다.",
  synthNoEffects:"아직 이펙트가 없습니다. 위에서 추가하세요.",
  synthSaveHint:"적용해 들어본 뒤 저장하세요. EQ는 이펙트 랙과 공유되며 출력 음량은 마스터에서 조정합니다.", 
  synthStep:"{n}단계", synthMoveUp:"위로", synthMoveDown:"아래로", synthRemove:"제거", synthRemoveBand:"밴드 제거",
  synthAddBand:"＋ EQ 밴드 추가", synthEqBand:"EQ 밴드 {n}", synthBandLimit:"EQ 밴드는 최대 10개입니다.",
  synthFxEq:"이퀄라이저 (EQ)", synthFxComp:"컴프레서", synthFxGain:"게인", synthFxWidth:"스테레오 폭",
  synthFxVocalCut:"보컬 컷", synthFxDelay:"딜레이", synthFxReverb:"리버브", synthFxDrive:"드라이브",
  synthFxLofi:"로파이", synthFxPump:"펌핑", synthFxTremolo:"트레몰로", synthFxAutopan:"오토 팬",
  synthFxSweep:"필터 스윕", synthFxRingmod:"링 모듈레이터", synthFxChorus:"코러스", synthFxNoise:"환경 노이즈", synthFxCrossfeed:"크로스피드",
  synthParamThreshold:"임계값", synthParamRatio:"비율", synthParamAttack:"어택", synthParamRelease:"릴리스",
  synthParamKnee:"니", synthParamMakeup:"보정 게인", synthParamDb:"게인", synthParamGain:"게인", synthParamAmount:"양",
  synthParamKeepBass:"저음 유지", synthParamBeats:"주기 (박자)", synthParamMs:"시간", synthParamFeedback:"피드백",
  synthParamMix:"믹스", synthParamTone:"음색", synthParamSize:"공간 크기", synthParamDecay:"감쇠",
  synthParamDepth:"깊이", synthParamBits:"비트 깊이", synthParamCutoff:"컷오프", synthParamRate:"속도",
  synthParamFilter:"필터", synthParamFrom:"시작 주파수", synthParamTo:"끝 주파수", synthParamQ:"Q",
  synthParamFreq:"주파수", synthParamKind:"노이즈 종류", synthParamLevel:"레벨",
  synthFilterLabel:"필터 종류", synthFilterLowShelf:"로우 셸프", synthFilterHighShelf:"하이 셸프",
  synthFilterPeaking:"피킹", synthFilterLowpass:"로우패스", synthFilterHighpass:"하이패스",
  synthFilterBandpass:"밴드패스", synthFilterNotch:"노치",
  synthNoisePink:"핑크 노이즈", synthNoiseVinyl:"레코드 잡음", synthNoiseTape:"테이프 노이즈",
  synthNoiseRain:"비", synthNoiseWind:"바람", synthNoiseFire:"모닥불", synthNoiseCrowd:"군중",
  synthLoaded:"현재 이펙트를 신시사이저로 불러왔습니다.", synthApplied:"임시 이펙트로 적용했습니다.",
  synthSaved:"내 프리셋에 저장했습니다.", synthSaveFailed:"저장하지 못했습니다. 프리셋 30개 제한을 확인해 주세요.",
  synthSaveUnavailable:"프리셋 편집기를 찾지 못했습니다. 설정의 사운드 이펙트에서 저장해 주세요.",
  synthExported:"trk-fx JSON을 내보냈습니다.", synthImported:"trk-fx JSON을 가져왔습니다.",
  synthBad:"trk-fx JSON을 읽지 못했습니다. 형식과 내용을 확인해 주세요.", synthTooBig:"파일이 너무 큽니다 (최대 1MB).", synthApplyFailed:"이 설정을 적용하지 못했습니다."
});

/* ============ エフェクト・パラメーターの定義 ============ */
const FX_TYPES = [
  ["eq", "synthFxEq"], ["comp", "synthFxComp"], ["gain", "synthFxGain"], ["width", "synthFxWidth"],
  ["vocalCut", "synthFxVocalCut"], ["delay", "synthFxDelay"], ["reverb", "synthFxReverb"], ["drive", "synthFxDrive"],
  ["lofi", "synthFxLofi"], ["pump", "synthFxPump"], ["tremolo", "synthFxTremolo"], ["autopan", "synthFxAutopan"],
  ["sweep", "synthFxSweep"], ["ringmod", "synthFxRingmod"], ["chorus", "synthFxChorus"],
  ["noise", "synthFxNoise"], ["crossfeed", "synthFxCrossfeed"]
];
const BIQUAD_TYPES = [
  ["lowshelf", "synthFilterLowShelf"], ["peaking", "synthFilterPeaking"], ["highshelf", "synthFilterHighShelf"],
  ["lowpass", "synthFilterLowpass"], ["highpass", "synthFilterHighpass"], ["bandpass", "synthFilterBandpass"], ["notch", "synthFilterNotch"]
];
const NOISE_TYPES = [
  ["pink", "synthNoisePink"], ["vinyl", "synthNoiseVinyl"], ["tape", "synthNoiseTape"], ["rain", "synthNoiseRain"],
  ["wind", "synthNoiseWind"], ["fire", "synthNoiseFire"], ["crowd", "synthNoiseCrowd"]
];
const FILTER_TYPES = [["lowpass", "synthFilterLowpass"], ["highpass", "synthFilterHighpass"], ["bandpass", "synthFilterBandpass"]];
const p = (key, min, max, step, format, log = false) => ({ key, label:"synthParam" + key[0].toUpperCase() + key.slice(1), min, max, step, format, log });
const PARAMS = {
  comp:[p("threshold", -60, 0, 1, "db"), p("ratio", 1, 20, .5, "ratio"), p("attack", 0, 1, .005, "seconds"),
    p("release", .01, 1, .01, "seconds"), p("knee", 0, 40, 1, "db"), p("makeup", 0, 24, .5, "db")],
  gain:[p("db", -24, 12, .5, "db")],
  width:[p("amount", 0, 2, .02, "ratio")],
  vocalCut:[p("amount", 0, 1, .01, "percent"), p("keepBass", 40, 400, 1, "freq", true)],
  delay:[p("beats", 0, 4, .25, "beats"), p("ms", 1, 2000, 1, "ms", true), p("feedback", 0, .9, .01, "percent"),
    p("mix", 0, 1, .01, "percent"), p("tone", 500, 20000, 1, "freq", true)],
  reverb:[p("size", .2, 8, .1, "seconds"), p("decay", .5, 8, .1, "seconds"), p("mix", 0, 1, .01, "percent")],
  drive:[p("amount", 0, 1, .01, "percent"), p("mix", 0, 1, .01, "percent")],
  lofi:[p("bits", 2, 16, 1, "integer"), p("cutoff", 500, 20000, 1, "freq", true)],
  pump:[p("depth", 0, 1, .01, "percent"), p("beats", .25, 4, .25, "beats")],
  tremolo:[p("depth", 0, 1, .01, "percent"), p("beats", .125, 8, .125, "beats")],
  autopan:[p("depth", 0, 1, .01, "percent"), p("beats", .5, 32, .5, "beats")],
  sweep:[p("from", 20, 20000, 1, "freq", true), p("to", 20, 20000, 1, "freq", true),
    p("beats", .25, 32, .25, "beats"), p("q", .1, 18, .1, "decimal")],
  ringmod:[p("freq", 1, 5000, 1, "freq", true), p("mix", 0, 1, .01, "percent")],
  chorus:[p("ms", 1, 50, .5, "ms"), p("depth", .1, 20, .1, "decimal"), p("rate", .02, 10, .02, "hz"),
    p("feedback", 0, .9, .01, "percent"), p("mix", 0, 1, .01, "percent")],
  noise:[p("level", -60, -6, 1, "db")],
  crossfeed:[p("amount", 0, .6, .01, "percent")]
};
const MAX_CHAIN = 16, MAX_BANDS = 10, IMPORT_MAX = 1024 * 1024;

function defaultEffect(type) {
  switch (type) {
    case "eq": return { type:"eq", bands:[
      { type:"lowshelf", freq:120, gain:2, q:.8 },
      { type:"peaking", freq:1000, gain:0, q:1 },
      { type:"highshelf", freq:10000, gain:-2, q:.8 }
    ] };
    case "comp": return { type:"comp", threshold:-24, ratio:3, attack:.01, release:.25, knee:10, makeup:0 };
    case "gain": return { type:"gain", db:0 };
    case "width": return { type:"width", amount:1 };
    case "vocalCut": return { type:"vocalCut", amount:.9, keepBass:150 };
    case "delay": return { type:"delay", beats:0, ms:300, feedback:.3, mix:.25, tone:6000 };
    case "reverb": return { type:"reverb", size:2, decay:2.5, mix:.2 };
    case "drive": return { type:"drive", amount:.2, mix:1 };
    case "lofi": return { type:"lofi", bits:8, cutoff:6000 };
    case "pump": return { type:"pump", depth:.35, beats:1 };
    case "tremolo": return { type:"tremolo", depth:.3, beats:.5 };
    case "autopan": return { type:"autopan", depth:.7, beats:8 };
    case "sweep": return { type:"sweep", filter:"lowpass", from:300, to:8000, beats:4, q:1 };
    case "ringmod": return { type:"ringmod", freq:40, mix:.5 };
    case "chorus": return { type:"chorus", ms:15, depth:3, rate:.6, feedback:0, mix:.3 };
    case "noise": return { type:"noise", kind:"pink", level:-30 };
    case "crossfeed": return { type:"crossfeed", amount:.3 };
    default: return null;
  }
}
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));

/* ============ 画面 ============ */
addEventListener("DOMContentLoaded", () => {
  /* tv-dock.js moves .dockMore outside #fxDock into .songCol before this runs. */
  const dockMore = document.querySelector(".songCol > details.dockMore") || document.querySelector("#fxDock details.dockMore");
  const fxPanel = core.$("fxPanel"), quick = core.$("fxQuickPanel");
  if (!dockMore || !fxPanel || !quick || !window.TrkFX) return;

  const tx = (tag, key, cls = "") => {
    const node = core.el(tag, cls, tr(key));
    node.dataset.i18n = key;
    return node;
  };
  const setTitle = (node, key) => {
    node.title = tr(key);
    node.setAttribute("aria-label", tr(key));
    node.dataset.titleKey = key;
    return node;
  };
  const panel = core.el("details", "subPanel fxSynth");
  panel.id = "fxSynthPanel";
  const summary = tx("summary", "synthTitle");
  const hint = tx("div", "synthHint", "hint fxSynthHint");
  const nameLabel = core.el("label", "field fxSynthName");
  nameLabel.append(tx("span", "synthName"));
  const nameInput = document.createElement("input");
  nameInput.type = "text"; nameInput.maxLength = 24; nameInput.autocomplete = "off";
  nameLabel.append(nameInput);
  const master = core.el("section", "fxSynthMaster");
  const masterHead = tx("h3", "synthMaster");
  const masterHint = tx("div", "synthMasterHint", "hint fxSynthMasterHint");
  const masterControls = core.el("div", "fxSynthParams");
  master.append(masterHead, masterHint, masterControls);

  const topActions = core.el("div", "miniActions fxSynthActions");
  const loadBtn = tx("button", "synthLoad"); loadBtn.type = "button";
  const importLabel = core.el("label", "fileBtn small fxSynthFile");
  const importInput = document.createElement("input");
  importInput.type = "file"; importInput.accept = "application/json,.json"; importInput.hidden = true;
  const importText = tx("span", "synthImport");
  importLabel.append(importInput, importText);
  const exportBtn = tx("button", "synthExport"); exportBtn.type = "button";
  topActions.append(loadBtn, importLabel, exportBtn);

  const addRow = core.el("div", "fxSynthAddRow");
  const typeSelect = document.createElement("select"); typeSelect.className = "fxSynthTypePicker";
  typeSelect.setAttribute("aria-label", tr("synthEffectType"));
  const addBtn = tx("button", "synthAdd", "fxMini"); addBtn.type = "button";
  addRow.append(typeSelect, addBtn);
  const addHint = tx("div", "synthAddHint", "hint fxSynthAddHint");
  const chainHost = core.el("div", "fxSynthChain");
  const footerHint = tx("div", "synthSaveHint", "hint fxSynthSaveHint");
  const bottomActions = core.el("div", "miniActions fxSynthActions");
  const applyBtn = tx("button", "synthApply", "primary slim"); applyBtn.type = "button";
  const saveBtn = tx("button", "synthSave", "primary slim"); saveBtn.type = "button";
  bottomActions.append(applyBtn, saveBtn);
  const status = core.el("div", "hint status fxSynthStatus");
  panel.append(summary, hint, nameLabel, master, topActions, addRow, addHint, chainHost, footerHint, bottomActions, status);
  const eqAnchor = dockMore.querySelector(".fxDockEq");
  if (eqAnchor) dockMore.insertBefore(panel, eqAnchor);
  else dockMore.append(panel);

  let synthDraft = {
    name:tr("synthNamePlaceholder"), author:"", url:"", chain:[],
    eq:Array.isArray(core.settings.fxEq) ? core.settings.fxEq.slice() : [0, 0, 0, 0, 0],
    volume:Number.isFinite(Number(core.settings.fxVolume)) ? Number(core.settings.fxVolume) : 0
  };
  let synthDirty = false;
  let currentSignature = "";
  let statusInfo = null;

  function setStatus(key, vars) {
    statusInfo = key ? { key, vars } : null;
    status.textContent = statusInfo ? tr(statusInfo.key, statusInfo.vars) : "";
    status.dataset.i18n = statusInfo ? statusInfo.key : "";
  }
  function currentFx() { return TrkFX.current(); }
  function signature() {
    const cur = currentFx();
    const eq = cur && Array.isArray(cur.eq) ? cur.eq : core.settings.fxEq;
    const volume = cur && Number.isFinite(Number(cur.volume)) ? cur.volume : core.settings.fxVolume;
    return `${cur ? core.settings.fxPreset + "|" + cur.name + "|" + JSON.stringify(cur.chain) : "off"}|${JSON.stringify(eq)}|${volume}`;
  }
  function populateCurrent(showMessage) {
    const cur = currentFx();
    synthDraft = {
      name:cur && cur.name ? String(cur.name).slice(0, 24) : tr("synthNamePlaceholder"),
      author:cur && typeof cur.author === "string" ? cur.author : "", url:cur && typeof cur.url === "string" ? cur.url : "",
      chain:cur && Array.isArray(cur.chain) ? copy(cur.chain) : [],
      eq:cur && Array.isArray(cur.eq) ? cur.eq.slice() : (Array.isArray(core.settings.fxEq) ? core.settings.fxEq.slice() : [0, 0, 0, 0, 0]),
      volume:cur && Number.isFinite(Number(cur.volume)) ? Number(cur.volume) : (Number.isFinite(Number(core.settings.fxVolume)) ? Number(core.settings.fxVolume) : 0)
    };
    synthDirty = false;
    currentSignature = signature();
    nameInput.value = synthDraft.name;
    renderMaster();
    renderChain();
    if (showMessage) setStatus("synthLoaded");
  }
  function syncFromCurrent() {
    const next = signature();
    if (!synthDirty && next !== currentSignature) populateCurrent(false);
  }
  function markDirty() {
    synthDirty = true;
    setStatus(null);
  }

  function fillSelect(select, options, selected) {
    select.textContent = "";
    for (const [value, key] of options) {
      const option = document.createElement("option");
      option.value = value; option.textContent = tr(key); option.dataset.i18n = key;
      select.append(option);
    }
    if (selected != null) select.value = selected;
  }
  function formatValue(value, spec) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    switch (spec.format) {
      case "percent": return `${Math.round(n * 100)}%`;
      case "db": return `${n > 0 ? "+" : ""}${Number(n.toFixed(1))} dB`;
      case "freq": return n >= 1000 ? `${Number((n / 1000).toFixed(n >= 10000 ? 0 : 1))} kHz` : `${Math.round(n)} Hz`;
      case "ms": return `${Number(n.toFixed(1))} ms`;
      case "seconds": return n < .1 ? `${Math.round(n * 1000)} ms` : `${Number(n.toFixed(2))} s`;
      case "beats": return n === 0 ? "ms" : `${Number(n.toFixed(3))} beat`;
      case "ratio": return `${Number(n.toFixed(2))}×`;
      case "hz": return `${Number(n.toFixed(2))} Hz`;
      case "integer": return String(Math.round(n));
      case "decimal": return String(Number(n.toFixed(2)));
      default: return String(Number(n.toFixed(2)));
    }
  }
  function percent(spec, value) {
    return Math.max(0, Math.min(1, (Number(value) - spec.min) / (spec.max - spec.min || 1)));
  }
  function rangeFromInput(raw, spec) {
    if (spec.log) return spec.min * Math.pow(spec.max / spec.min, Number(raw) / 1000);
    const n = Number(raw), decimals = String(spec.step).includes(".") ? String(spec.step).split(".")[1].length : 0;
    return Number((Math.round(n / spec.step) * spec.step).toFixed(Math.min(6, decimals + 1)));
  }
  function rangeToInput(value, spec) {
    if (spec.log) return String(Math.round(1000 * Math.log(Number(value) / spec.min) / Math.log(spec.max / spec.min)));
    return String(value);
  }
  function makeRangeControl(target, spec, value, idSuffix) {
    const control = core.el("div", "fxSynthControl");
    const label = tx("span", spec.label, "fxSynthControlLabel");
    const dial = core.el("div", "fxSynthDial");
    const readout = core.el("span", "fxSynthDialValue");
    dial.append(readout);
    const slider = document.createElement("input");
    slider.type = "range"; slider.className = "fxSynthRange";
    if (spec.log) { slider.min = "0"; slider.max = "1000"; slider.step = "1"; }
    else { slider.min = String(spec.min); slider.max = String(spec.max); slider.step = String(spec.step); }
    slider.value = rangeToInput(value, spec);
    slider.id = `fxSynth-${idSuffix}`;
    label.id = `${slider.id}-label`;
    slider.setAttribute("aria-labelledby", label.id);
    function refreshReadout(v) {
      readout.textContent = formatValue(v, spec);
      const progress = spec.log ? Number(slider.value) / 1000 : percent(spec, v);
      dial.style.setProperty("--fx-pct", `${(progress * 75).toFixed(1)}%`);
      slider.setAttribute("aria-valuetext", formatValue(v, spec));
    }
    refreshReadout(value);
    slider.addEventListener("input", () => {
      const next = rangeFromInput(slider.value, spec);
      target[spec.key] = next;
      refreshReadout(next);
      markDirty();
    });
    control.append(label, dial, slider);
    return control;
  }
  function makeChoice(target, key, options, current, labelKey, cls = "") {
    const field = core.el("label", "field fxSynthChoice " + cls);
    field.append(tx("span", labelKey));
    const select = document.createElement("select");
    fillSelect(select, options, current);
    select.addEventListener("change", () => { target[key] = select.value; markDirty(); });
    field.append(select);
    return field;
  }
  function iconButton(icon, key, fn) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "fxMini fxSynthIcon"; button.textContent = icon;
    setTitle(button, key); button.addEventListener("click", fn);
    return button;
  }
  function renderMaster() {
    masterControls.textContent = "";
    const volumeSpec = { key:"volume", label:"synthMasterVol", min:-12, max:6, step:.5, format:"db", log:false };
    masterControls.append(makeRangeControl(synthDraft, volumeSpec, synthDraft.volume, "master-volume"));
  }

  function renderEqEffect(effect, index, host) {
    const bands = Array.isArray(effect.bands) ? effect.bands : (effect.bands = []);
    const bandHost = core.el("div", "fxSynthBands");
    bands.forEach((band, bandIndex) => {
      const bandCard = core.el("section", "fxSynthBand");
      const head = core.el("div", "fxSynthBandHead");
      const bandTitle = core.el("strong", "", tr("synthEqBand", { n:bandIndex + 1 }));
      const remove = iconButton("×", "synthRemoveBand", () => {
        if (effect.bands.length <= 1) return;
        effect.bands.splice(bandIndex, 1); markDirty(); renderChain();
      });
      remove.disabled = bands.length <= 1;
      head.append(bandTitle, remove);
      const choice = makeChoice(band, "type", BIQUAD_TYPES, band.type, "synthFilterLabel", "fxSynthBandType");
      const params = core.el("div", "fxSynthParams");
      params.append(
        makeRangeControl(band, p("freq", 20, 20000, 1, "freq", true), band.freq, `eq-${index}-${bandIndex}-freq`),
        makeRangeControl(band, p("gain", -24, 24, .5, "db"), band.gain, `eq-${index}-${bandIndex}-gain`),
        makeRangeControl(band, p("q", .1, 18, .1, "decimal"), band.q, `eq-${index}-${bandIndex}-q`)
      );
      bandCard.append(head, choice, params);
      bandHost.append(bandCard);
    });
    const addBand = tx("button", "synthAddBand", "fxMini fxSynthAddBand"); addBand.type = "button";
    addBand.disabled = bands.length >= MAX_BANDS;
    addBand.addEventListener("click", () => {
      if (effect.bands.length >= MAX_BANDS) return;
      effect.bands.push({ type:"peaking", freq:1000, gain:0, q:1 });
      markDirty(); renderChain();
    });
    const limit = tx("div", "synthBandLimit", "hint fxSynthLimit"); limit.hidden = bands.length < MAX_BANDS;
    host.append(bandHost, addBand, limit);
  }

  function renderEffect(effect, index) {
    const card = core.el("article", "fxSynthEffect");
    card.dataset.type = effect.type;
    const head = core.el("div", "fxSynthEffectHead");
    const stepLabel = core.el("span", "fxSynthStep", tr("synthStep", { n:index + 1 }));
    const effectSelect = document.createElement("select"); effectSelect.className = "fxSynthEffectType";
    fillSelect(effectSelect, FX_TYPES, effect.type);
    effectSelect.setAttribute("aria-label", tr("synthEffectType"));
    effectSelect.addEventListener("change", () => {
      const next = defaultEffect(effectSelect.value);
      if (!next) return;
      synthDraft.chain[index] = next; markDirty(); renderChain();
    });
    const tools = core.el("div", "fxSynthEffectTools");
    const up = iconButton("↑", "synthMoveUp", () => {
      if (!index) return;
      [synthDraft.chain[index - 1], synthDraft.chain[index]] = [synthDraft.chain[index], synthDraft.chain[index - 1]];
      markDirty(); renderChain();
    });
    const down = iconButton("↓", "synthMoveDown", () => {
      if (index >= synthDraft.chain.length - 1) return;
      [synthDraft.chain[index + 1], synthDraft.chain[index]] = [synthDraft.chain[index], synthDraft.chain[index + 1]];
      markDirty(); renderChain();
    });
    const remove = iconButton("×", "synthRemove", () => {
      s   });
    up.disabled = index === 0; down.disabled = index === synthDraft.chain.length - 1;
    tools.append(up, down, remove);
    head.append(stepLabel, effectSelect, tools);
    const content = core.el("div", "fxSynthEffectBody");
    if (effect.type === "eq") renderEqEffect(effect, index, content);
    else {
      const params = core.el("div", "fxSynthParams");
      for (const spec of PARAMS[effect.type] || []) {
        if (typeof effect[spec.key] !== "number") continue;
        params.append(makeRangeControl(effect, spec, effect[spec.key], `${index}-${spec.key}`));
      }
      if (effect.type === "sweep") params.append(makeChoice(effect, "filter", FILTER_TYPES, effect.filter, "synthParamFilter"));
      if (effect.type === "noise") params.append(makeChoice(effect, "kind", NOISE_TYPES, effect.kind, "synthParamKind"));
      content.append(params);
    }
    card.append(head, content);
    return card;
  }

  function renderChain() {
    chainHost.textContent = "";
    if (!synthDraft.chain.length) chainHost.append(tx("div", "synthNoEffects", "hint fxSynthEmpty"));
    synthDraft.chain.forEach((effect, index) => chainHost.append(renderEffect(effect, index)));
    fillSelect(typeSelect, FX_TYPES, typeSelect.value || "eq");
    addBtn.disabled = synthDraft.chain.length >= MAX_CHAIN;
    addHint.textContent = tr("synthAddHint") + (synthDraft.chain.length >= MAX_CHAIN ? ` (${MAX_CHAIN}/${MAX_CHAIN})` : ` (${synthDraft.chain.length}/${MAX_CHAIN})`);
    nameInput.placeholder = tr("synthNamePlaceholder");
  }

  function cleanDraft() {
    const checked = TrkFX.clean({
      format:"trk-fx", version:1, name:synthDraft.name, author:synthDraft.author, url:synthDraft.url, chain:synthDraft.chain,
      eq:Array.isArray(synthDraft.eq) ? synthDraft.eq : core.settings.fxEq,
      volume:synthDraft.volume
    });
    if (!checked) return null;
    const output = {
      format:"trk-fx", version:1, name:checked.name || tr("synthNamePlaceholder"), chain:checked.chain,
      eq:Array.isArray(checked.eq) ? checked.eq.slice() : [0, 0, 0, 0, 0],
      volume:Number.isFinite(Number(checked.volume)) ? Number(checked.volume) : 0
    };
    if (checked.author) output.author = checked.author;
    if (checked.url) output.url = checked.url;
    return output;
  }
  function currentExport() { return cleanDraft(); }
  function applyDraft() {
    const payload = cleanDraft();
    if (!payload) { setStatus("synthApplyFailed"); return false; }
    const result = TrkFX.apply(payload);
    if (result == null || !core.settings.fxOn) { setStatus("synthApplyFailed"); return false; }
    populateCurrent(false);
    setStatus("synthApplied");
    return true;
  }
  function saveDraft() {
    if (!applyDraft()) return;
    const jsonEditor = fxPanel.querySelector("textarea.fxEditor");
    const saveAction = fxPanel.querySelector('button[data-i18n="sfxApply"]');
    if (!jsonEditor || !saveAction) { setStatus("synthSaveUnavailable"); return; }
    const current = currentFx();
    if (!current) { setStatus("synthApplyFailed"); return; }
    jsonEditor.value = JSON.stringify(current, null, 2);
    /* Reuse fx.js's own validator and storePreset path instead of duplicating persistence. */
    saveAction.click();
    if (typeof core.settings.fxPreset === "string" && core.settings.fxPreset.startsWith("my_")) {
      populateCurrent(false);
      setStatus("synthSaved");
    } else {
      setStatus("synthSaveFailed");
    }
  }
  function exportDraft() {
    const output = currentExport();
    if (!output) { setStatus("synthApplyFailed"); return; }
    core.downloadJSON(output, `${core.safeName(output.name)}.trk-fx.json`);
    setStatus("synthExported");
  }
  async function importDraft(file) {
    if (!file) return;
    if (file.size > IMPORT_MAX) { setStatus("synthTooBig"); return; }
    let raw = null;
    try { raw = JSON.parse(await file.text()); } catch (_) {}
    const checked = raw && TrkFX.clean(raw);
    if (!checked) { setStatus("synthBad"); return; }
    synthDraft = {
      name:checked.name || tr("synthNamePlaceholder"), author:checked.author || "", url:checked.url || "", chain:copy(checked.chain || []),
      eq:Array.isArray(checked.eq) ? checked.eq.slice() : (Array.isArray(core.settings.fxEq) ? core.settings.fxEq.slice() : [0, 0, 0, 0, 0]),
      volume:Number.isFinite(Number(checked.volume)) ? Number(checked.volume) : (Number.isFinite(Number(core.settings.fxVolume)) ? Number(core.settings.fxVolume) : 0)
    };
    synthDirty = true;
    nameInput.value = synthDraft.name;
    renderMaster();
    renderChain();
    setStatus("synthImported");
  }

  fillSelect(typeSelect, FX_TYPES, "eq");
  const eqMirrors = Array.from(dockMore.querySelectorAll(".fxDockEq input[type=range]"));
  eqMirrors.forEach((range, index) => range.addEventListener("input", () => {
    if (index < 5) { synthDraft.eq[index] = Number(range.value); markDirty(); }
  }));
  const fxRanges = Array.from(fxPanel.querySelectorAll('input[type="range"]'));
  fxRanges.slice(0, 5).forEach((range, index) => range.addEventListener("input", () => {
    if (index < 5) { synthDraft.eq[index] = Number(range.value); markDirty(); }
  }));
  if (fxRanges[5]) fxRanges[5].addEventListener("input", () => { synthDraft.volume = Number(fxRanges[5].value); markDirty(); });
  nameInput.addEventListener("input", () => { synthDraft.name = nameInput.value.slice(0, 24); markDirty(); });
  loadBtn.addEventListener("click", () => populateCurrent(true));
  addBtn.addEventListener("click", () => {
    if (synthDraft.chain.length >= MAX_CHAIN) return;
    const next = defaultEffect(typeSelect.value);
    if (!next) return;
    synthDraft.chain.push(next); markDirty(); renderChain();
  });
  applyBtn.addEventListener("click", applyDraft);
  saveBtn.addEventListener("click", saveDraft);
  exportBtn.addEventListener("click", exportDraft);
  importInput.addEventListener("change", async event => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    await importDraft(file);
  });
  panel.addEventListener("toggle", () => {
    if (panel.open && !synthDirty) populateCurrent(false);
  });
  nameInput.value = synthDraft.name;
  renderChain();
  populateCurrent(false);

  const presetSelect = quick.querySelector("select");
  if (presetSelect) {
    const observer = new MutationObserver(() => syncFromCurrent());
    observer.observe(presetSelect, { childList:true });
  }
  core.on("language", () => {
    summary.textContent = tr("synthTitle");
    hint.textContent = tr("synthHint");
    nameLabel.querySelector("[data-i18n='synthName']").textContent = tr("synthName");
    masterHead.textContent = tr("synthMaster"); masterHint.textContent = tr("synthMasterHint");
    loadBtn.textContent = tr("synthLoad"); importText.textContent = tr("synthImport");
    exportBtn.textContent = tr("synthExport"); addBtn.textContent = tr("synthAdd");
    footerHint.textContent = tr("synthSaveHint"); applyBtn.textContent = tr("synthApply"); saveBtn.textContent = tr("synthSave");
    addRow.querySelectorAll("option").forEach(option => { const key = option.dataset.i18n; if (key) option.textContent = tr(key); });
    nameInput.placeholder = tr("synthNamePlaceholder");
    renderMaster(); renderChain();
    if (statusInfo) status.textContent = tr(statusInfo.key, statusInfo.vars);
  });
  core.on("chart", syncFromCurrent);
});
})();
/* ✅ fx-synth.js 完了 */
