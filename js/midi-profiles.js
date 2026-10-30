// SPDX-License-Identifier: GPL-3.0-or-later
/*
 * Code-generated MIDI timbre and optional TRK MIDI MIX profiles.
 * No SF2/SF3 files, instrument samples, game audio, or hardware ROM data are bundled.
 * Reference names describe broad tonal inspiration only; these are not sample banks,
 * hardware emulations, endorsements, or reproductions of any named product.
 */
(() => {
  "use strict";

  const DEFAULT_ID = "studio_gm";
  const name = (ja, en, zh, ko) => ({ ja, en, zh, ko });
  const band = (type, freq, gain, q = 0.8) => ({ type, freq, gain, q });
  const eq = (...bands) => ({ type: "eq", bands });
  const room = (size, decay, mix) => ({ type: "reverb", size, decay, mix });
  const chorus = (ms, depth, rate, mix, feedback = 0) => ({ type: "chorus", ms, depth, rate, mix, feedback });
  const width = amount => ({ type: "width", amount });
  const drive = (amount, mix = 1) => ({ type: "drive", amount, mix });
  const lofi = (bits, cutoff) => ({ type: "lofi", bits, cutoff });
  const comp = (threshold, ratio, makeup = 0) => ({ type: "comp", threshold, ratio, attack: 0.012, release: 0.22, knee: 12, makeup });
  const delay = (ms, feedback, mix, tone = 6200) => ({ type: "delay", beats: 0, ms, feedback, mix, tone });
  const synth = (waveform, blend, cutoff, attack, decay, release, detune, unison, vibrato, driveAmount, space, bits = 16, noise = 0) => ({
    waveform, blend, cutoff, attack, decay, release, detune, unison,
    vibrato, vibratoRate: 5.2, drive: driveAmount, space, bits, noise
  });

  const profiles = [
    // Ten original, code-only profiles informed by broad characteristics associated with existing banks / devices.
    { id: "fluidr3_style", category: "reference", name: name("FluidR3 GM風 · コード音色", "FluidR3 GM-inspired · procedural", "FluidR3 GM 风格 · 代码音色", "FluidR3 GM풍 · 코드 음색"), synth: synth("saw", .09, 14500, .95, .96, 1.02, 2.5, .06, .008, .02, .12), mixChain: [eq(band("peaking", 3200, .7), band("highshelf", 8200, .5)), room(1.2, 1.8, .08)] },
    { id: "sgm_style", category: "reference", name: name("SGM V2.0風 · コード音色", "SGM V2.0-inspired · procedural", "SGM V2.0 风格 · 代码音色", "SGM V2.0풍 · 코드 음색"), synth: synth("triangle", .12, 11800, .9, 1.08, 1.08, 4, .1, .012, .04, .2), mixChain: [eq(band("lowshelf", 150, 1.1), band("peaking", 2400, .6)), chorus(18, 2.2, .42, .13), room(1.8, 2.5, .13)] },
    { id: "generaluser_style", category: "reference", name: name("GeneralUser GS風 · コード音色", "GeneralUser GS-inspired · procedural", "GeneralUser GS 风格 · 代码音色", "GeneralUser GS풍 · 코드 음색"), synth: synth("sine", .13, 13200, 1, 1, 1, 1.5, .04, .005, .015, .08), mixChain: [eq(band("lowshelf", 120, .4), band("highshelf", 9800, .35)), room(.9, 1.5, .06)] },
    { id: "gs_compact_style", category: "reference", name: name("コンパクトGSモジュール風 · コード音色", "Compact GS module-inspired · procedural", "紧凑型 GS 模块风格 · 代码音色", "컴팩트 GS 모듈풍 · 코드 음색"), synth: synth("triangle", .1, 9900, .82, .9, .76, 1, .025, .003, .01, .04), mixChain: [eq(band("lowshelf", 170, -.8), band("peaking", 1300, .8), band("highshelf", 7600, -.5)), room(.55, 1.15, .035)] },
    { id: "gs88pro_style", category: "reference", name: name("SC-88Pro世代GS風 · コード音色", "SC-88Pro-era GS-inspired · procedural", "SC-88Pro 世代 GS 风格 · 代码音色", "SC-88Pro 세대 GS풍 · 코드 음색"), synth: synth("saw", .16, 13800, .72, .92, .84, 2, .05, .004, .035, .09), mixChain: [eq(band("peaking", 2600, 1.15), band("highshelf", 7200, .65)), comp(-25, 1.8, 1.1), room(.8, 1.35, .045)] },
    { id: "gm2_wide_style", category: "reference", name: name("SC-8850世代GM2風 · コード音色", "SC-8850-era GM2-inspired · procedural", "SC-8850 世代 GM2 风格 · 代码音色", "SC-8850 세대 GM2풍 · 코드 음색"), synth: synth("saw", .18, 16800, .88, .98, 1.08, 6, .15, .014, .025, .19), mixChain: [eq(band("highshelf", 7600, .8), band("lowshelf", 110, .5)), width(1.18), chorus(14, 2.8, .54, .16), room(1.5, 2.1, .1)] },
    { id: "xg_sparkle_style", category: "reference", name: name("XG系ブライト風 · コード音色", "XG-inspired bright · procedural", "XG 系明亮风格 · 代码音色", "XG 계열 브라이트풍 · 코드 음색"), synth: synth("pulse", .14, 17500, .86, .91, .92, 3, .08, .01, .03, .16), mixChain: [eq(band("peaking", 4100, .7), band("highshelf", 9400, 1.35)), chorus(12, 1.8, .62, .1), room(1.3, 1.9, .09)] },
    { id: "pcm_natural_style", category: "reference", name: name("WAV/PCM自然音風 · コード音色", "WAV/PCM natural-inspired · procedural", "WAV/PCM 自然音风 · 代码音色", "WAV/PCM 내추럴풍 · 코드 음색"), synth: synth("sine", .08, 18200, 1.08, .88, .88, .5, .015, .002, 0, .035), mixChain: [eq(band("lowshelf", 100, .25), band("highshelf", 12000, .25)), width(1.04)] },
    { id: "soft_rompler_style", category: "reference", name: name("ソフトROMpler鍵盤風 · コード音色", "Soft ROMpler keyboard-inspired · procedural", "柔和 ROMpler 键盘风格 · 代码音色", "부드러운 ROMpler 키보드풍 · 코드 음색"), synth: synth("triangle", .2, 8500, 1.22, 1.12, 1.2, 5, .11, .018, .02, .24), mixChain: [eq(band("highshelf", 6700, -.65), band("peaking", 900, .65)), chorus(22, 3.2, .31, .18), room(2.2, 2.8, .16)] },
    { id: "studio_gm", category: "reference", name: name("スタジオGM風 · ニュートラル", "Studio GM-like · neutral", "录音室 GM 风格 · 中性", "스튜디오 GM풍 · 뉴트럴"), synth: synth("sine", .05, 15800, 1, 1, 1, .7, .02, .004, .005, .06), mixChain: [eq(band("peaking", 2800, .25), band("highshelf", 11000, .2)), room(.75, 1.25, .035)] },

    // Fourteen trk originals. Each is generated from oscillators / filters in code, not sample data.
    { id: "trk_clear_sky", category: "trk", name: name("青空", "Clear Sky", "晴空", "맑은 하늘"), synth: synth("triangle", .16, 17200, .92, .98, .94, 1.5, .05, .004, .01, .04), mixChain: [eq(band("highshelf", 8700, 1.1), band("peaking", 3100, .45)), width(1.08)] },
    { id: "trk_moonlit", category: "trk", name: name("月明かり", "Moonlit", "月光", "달빛"), synth: synth("sine", .2, 5600, 1.3, 1.2, 1.34, 2, .08, .012, .015, .3), mixChain: [eq(band("highshelf", 5200, -2.2), band("lowshelf", 180, .8)), room(2.7, 3.2, .18)] },
    { id: "trk_orbit", category: "trk", name: name("オービット", "Orbit", "轨道", "오비트"), synth: synth("fm", .28, 14500, .88, 1.06, 1.18, 7, .19, .023, .04, .38), mixChain: [delay(285, .24, .18, 7200), width(1.22), room(2.1, 2.8, .12)] },
    { id: "trk_aurora", category: "trk", name: name("オーロラ", "Aurora", "极光", "오로라"), synth: synth("saw", .2, 15800, 1.25, .98, 1.32, 11, .24, .03, .025, .32), mixChain: [chorus(23, 4.8, .28, .24), width(1.28), room(2.4, 3.3, .2)] },
    { id: "trk_aster", category: "trk", name: name("星屑", "Aster", "星屑", "아스터"), synth: synth("metal", .44, 17700, .52, .54, .72, 2, .04, .004, .02, .1), mixChain: [eq(band("peaking", 5100, 1.5), band("highshelf", 9800, .9)), chorus(9, 1.4, .8, .08), room(1.3, 2, .1)] },
    { id: "trk_petal", category: "trk", name: name("花びら", "Petal", "花瓣", "꽃잎"), synth: synth("triangle", .24, 11200, 1.46, 1.28, 1.22, 3.2, .1, .015, .005, .18), mixChain: [eq(band("peaking", 1900, -.35), band("highshelf", 7500, -.65)), room(2.5, 2.7, .18)] },
    { id: "trk_neon", category: "trk", name: name("ネオン", "Neon", "霓虹", "네온"), synth: synth("saw", .43, 13800, .42, .83, .68, 5.5, .13, .01, .17, .08), mixChain: [drive(.12, .62), eq(band("highshelf", 6400, 1.05)), comp(-27, 2.1, .8)] },
    { id: "trk_tape", category: "trk", name: name("テープ", "Tape", "磁带", "테이프"), synth: synth("triangle", .25, 6900, 1.08, 1.36, 1.48, 4, .1, .045, .16, .24, 10, .003), mixChain: [lofi(11, 8200), drive(.1, .5), chorus(26, 2.2, .19, .13)] },
    { id: "trk_crystal", category: "trk", name: name("クリスタル", "Crystal", "水晶", "크리스털"), synth: synth("metal", .62, 19400, .34, .46, .62, .8, .02, .001, .012, .14), mixChain: [eq(band("peaking", 6200, 1.4, 1.2), band("highshelf", 11200, .9)), width(1.2), room(1.7, 2.5, .14)] },
    { id: "trk_velvet", category: "trk", name: name("ベルベット", "Velvet", "天鹅绒", "벨벳"), synth: synth("saw", .1, 7900, 1.5, 1.18, 1.5, 8, .19, .026, .015, .2), mixChain: [eq(band("highshelf", 5400, -1.4), band("lowshelf", 190, .7)), chorus(29, 3.4, .24, .17), room(1.8, 2.8, .15)] },
    { id: "trk_voltage", category: "trk", name: name("ボルテージ", "Voltage", "电压", "볼티지"), synth: synth("square", .32, 12600, .38, .88, .75, 4.4, .11, .009, .22, .05), mixChain: [drive(.2, .72), eq(band("peaking", 1800, .75), band("highshelf", 6700, .55)), comp(-29, 2.8, 1.2)] },
    { id: "trk_bloom", category: "trk", name: name("ブルーム", "Bloom", "绽放", "블룸"), synth: synth("saw", .22, 16200, 1.28, 1.02, 1.38, 9.5, .22, .026, .02, .35), mixChain: [width(1.42), chorus(20, 4.1, .36, .21), room(2.6, 3.5, .18)] },
    { id: "trk_pixel", category: "trk", name: name("ピクセル", "Pixel", "像素", "픽셀"), synth: synth("square", .58, 7200, .12, .65, .3, 0, 0, 0, .08, .02, 7), mixChain: [lofi(7, 7800), eq(band("highshelf", 5200, .75)), comp(-32, 2.2, 1)] },
    { id: "trk_deep", category: "trk", name: name("ディープ", "Deep", "深海", "딥"), synth: synth("organ", .3, 6400, .48, 1.26, 1.42, 1.2, .04, .009, .04, .16), mixChain: [eq(band("lowshelf", 110, 2.2), band("highshelf", 6100, -1.2)), comp(-28, 2.4, 1)] }
  ];

  const deepFreeze = value => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return Object.freeze(value);
  };
  const byId = Object.create(null);
  for (const profile of profiles) {
    if (!/^[a-z0-9_]{1,40}$/.test(profile.id) || Object.prototype.hasOwnProperty.call(byId, profile.id)) continue;
    byId[profile.id] = deepFreeze(profile);
  }
  const list = Object.freeze(profiles.filter(profile => Object.prototype.hasOwnProperty.call(byId, profile.id)));
  const get = id => typeof id === "string" && Object.prototype.hasOwnProperty.call(byId, id) ? byId[id] : null;
  const api = Object.freeze({
    defaultId: DEFAULT_ID,
    list: () => list,
    get,
    normalize: id => get(id) ? id : DEFAULT_ID
  });

  window.Trk = window.Trk || {};
  window.Trk.midiProfiles = api;
})();
