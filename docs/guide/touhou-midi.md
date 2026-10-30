# Touhou music in trk!

This is a local-file guide, not an official Touhou Project resource. trk! ships Japanese song-title metadata only: **no game audio, extracted MIDI, soundfont, or extraction executable is bundled**. The catalogue is a pinned TouhouThemeDB community snapshot (commit [`e70e645`](https://github.com/thpatch/TouhouThemeDB/tree/e70e6451cf2e44d75564c09aa7c5a9cc09982692), The Unlicense). Its 904 release IDs include duplicate/arranged entries; 862 are grouped as Touhou Project music and 42 associated-game IDs are deliberately listed in a separate series. This is not an official completeness claim, and upstream display totals can differ by snapshot and counting rules.

## 日本語

### 1. 手元のファイルを再生・曲名に照合

- `.mid` / `.midi` はtrk!内蔵のコード生成GM風音源でWAV化します。設定の **🔊 サウンド**から24プロフィール（参考音色傾向10種＋trkオリジナル14種）を選べます。どれも実サンプル／SoundFont／ROMではなく、実機や製品のエミュレーションでもありません。標準MIDIファイル（SMF 0/1、PPQ）のみ対応し、SMPTE時間形式には未対応です。入力上限は8 MiB、曲の上限は10分です。
- 変換には処理量の上限もあります（各音が鳴っている時間の合計×サンプリング周波数で2億まで。聞こえなくなった余韻は数えません）。目安として、4和音が続く9分半の曲や、平均37音前後が同時に鳴る密な4分の曲は収まります。超えると「長い、または同時に鳴る音が多すぎる」と表示します。長い曲は変換中に進み具合（%）を表示し、別の曲を選ぶと変換を止めます。手元のMIDIがどのくらいかは `node tools/midi-budget.mjs ファイル.mid` で確かめられます（ファイルは読むだけで、どこにも送りません）。
- MP3、OGG、FLAC、WAVなどの音声ファイルも、従来どおりMusicフォルダまたは「曲ファイルを追加」から読み込めます。**TRK MIDI MIX**は通常音声用の別機能で、選曲画面左下の **✨ TRKエフェクト**欄の直下にあります。初期オフで、MIDI合成・SoundFont・音声からMIDIへの変換ではありません。
- ファイル名のベース部分をカタログIDにすると曲名に照合され、一覧やプレイリストではカタログ曲名で表示します（元ファイル名・プロフィールは変更しません）。例：`th06_05.mid` → `th06_05` → `おてんば恋娘`、`th06_15.mid` → `U.N.オーエンは彼女なのか？`。拡張子は照合に影響しません。音源ファイルはアプリへアップロードされず、端末内で処理します。
- 全作品・全曲にMIDIファイルが入っているわけではありません。ゲーム／製品版／体験版ごとに収録内容が異なります。

### 2. ゲーム音声を抽出する場合

1. 自分が正規に入手したゲームのインストール先を使い、利用地域・製品の条件を守ってください。購入したことだけで、抽出音源の再配布や動画利用の許可が生じるわけではありません。
2. Windows版ゲームの音声抽出ツールとして、別配布の [Touhou Music Room](https://github.com/DTM9025/musicroom/releases/latest) があります。上流READMEは公式Windows作品を対象と説明し、OGG、FLAC、MP3などでの書き出しとファイル名のカスタマイズを案内しています。**MIDIを出力するツールではありません**。対応作品・入力形式・依存ツールのライセンスを、使う版のREADMEと配布物で確認してください。
3. Touhou Music Room本体・`bgmlib`・`th_tool_shared` の上流 [`LICENSE.md`](https://github.com/DTM9025/musicroom/blob/master/LICENSE.md) はGPL-3.0-or-later（追加許可あり）です。外部ソフトとして紹介するだけで、trk!には組み込まず、実行ファイルも同梱しません。
4. 書き出し先をMusicフォルダ（またはそのサブフォルダ）にして、trk!でそのフォルダを読み込みます。`th06_01.ogg` のようにIDを含む名前を維持すれば、カタログ曲名に自動照合できます。
5. 抽出物を公開・共有・再配布しないでください。抽出ツールのライセンスはゲーム音楽の利用許諾ではありません。

### 3. `thtk`について（BGM抽出用としては案内しません）

Touhou Patch Centerの[thtkガイド](https://www.thpatch.net/wiki/Touhou_Patch_Center:THTK)は、thtkをゲームのアーカイブ／リソース解析用CLIツールと説明する一方、**BGMアーカイブは抽出できない**と記載しています。したがって、`th06_01.mid` などの音楽ファイルを取り出す手順としてthtkを勧めていません。thtkの[`COPYING`](https://github.com/thpatch/thtk/blob/master/COPYING)本文には二条件のBSD風の許諾・免責条項がありますが、GitHubのライセンス識別は`NOASSERTION`です。ソフト本体を組み込まないため、コードや実行ファイルの再配布もありません。

MIDIが実際に含まれるゲーム／配布物がある場合も、ファイル形式と抽出方法は作品ごとに確認してください。無いMIDIを抽出ツールが生成するわけではありません。

## English

### Play and match a local file

- `.mid` / `.midi` is rendered to WAV by trk!'s built-in code-generated GM-style synthesizer. Settings → **🔊 Sound** offers 24 profiles (10 broad reference-inspired directions and 14 trk originals). They contain no real samples, SoundFont bank, or ROM data and do not emulate a hardware device or product. Supported: Standard MIDI Files, type 0/1 with PPQ timing; SMPTE timing is unsupported. Limits: 8 MiB input and 10 minutes per file.
- Rendering also has a work limit: the total sounding time of all notes × the sample rate may be up to 200 million (decayed, inaudible tails are not counted). For reference, a 9.5-minute loop of four-note chords and a dense 4-minute arrangement with about 37 notes sounding at once both fit. Beyond that, trk! says the MIDI is too long or has too many notes sounding at once. Long renders show a percentage, and choosing another song stops the render. To see where your own file stands, run `node tools/midi-budget.mjs song.mid` (it only reads the file and sends nothing).
- Audio files such as MP3, OGG, FLAC and WAV still use the regular local-file player. **TRK MIDI MIX** is a separate effect for ordinary playback; it sits directly below the bottom-left **✨ TRK effects** panel, starts off, and is neither SoundFont synthesis nor audio-to-MIDI conversion.
- Keep the catalogue ID in the filename. For example, `th06_05.mid` resolves to `おてんば恋娘`, and `th06_15.mid` to `U.N.オーエンは彼女なのか？`. Lists and playlists show the catalogue title without changing the filename or saved profile; the extension does not matter. Files are processed locally and are not uploaded.
- Not every track or game edition contains a MIDI file. Availability varies by game, full release and demo.

### Extract rendered game audio

1. Use files from a game you lawfully obtained and follow the applicable product and regional terms. Buying a game does not itself grant permission to redistribute extracted music or use it in a video.
2. For Windows game audio, the separately distributed [Touhou Music Room](https://github.com/DTM9025/musicroom/releases/latest) is an external extractor. Its upstream README describes support for official Windows releases and export to OGG, FLAC, MP3 and other formats. **It does not export MIDI.** Check the documentation and third-party terms for the exact release and game.
3. Its upstream [`LICENSE.md`](https://github.com/DTM9025/musicroom/blob/master/LICENSE.md) states GPL-3.0-or-later with an additional permission. trk! links to the separate project; it does not incorporate or bundle the program.
4. Export into your Music folder, then select that folder in trk!. Filenames such as `th06_01.ogg` match the catalogue entry.
5. Do not publish or redistribute extracted audio. An extractor's software license does not license the game's music.

### Why the guide does not recommend thtk for music extraction

The Touhou Patch Center [thtk guide](https://www.thpatch.net/wiki/Touhou_Patch_Center:THTK) describes thtk as a game-resource/archive CLI toolkit and explicitly says that it **cannot extract BGM archives**. Its [`COPYING`](https://github.com/thpatch/thtk/blob/master/COPYING) contains two-condition BSD-style terms, although GitHub's license detector reports `NOASSERTION`. It is therefore not recommended here as a MIDI/BGM extractor, and no thtk code or binary is bundled.

## 中文

- `.mid` / `.midi` 由 trk! 内置的代码生成 GM 风格合成器渲染为 WAV。设置 → **🔊 声音**可选 24 种配置（10 种宽泛参考风格＋14 种 trk 原创）。不含真实采样、SoundFont 或 ROM 数据，也不模拟任何硬件或产品。支持 SMF 0/1、PPQ，不支持 SMPTE；单文件上限 8 MiB、10 分钟。
- 渲染还有处理量上限：所有音符的发声时长总和×采样率最多 2 亿（已衰减到听不见的余音不计入）。例如持续四和弦的 9 分半乐曲、平均约 37 个音同时发声的 4 分钟密集编曲都在范围内。超出时会提示“MIDI过长或同时发声的音符过多”。较长的渲染会显示百分比，选择其他曲目会停止渲染。可用 `node tools/midi-budget.mjs 文件.mid` 查看自己的文件（只读取文件，不会发送）。
- 文件名保留曲目ID即可，例如 `th06_05.mid` 会显示为「おてんば恋娘」，`th06_15.mid` 会显示为「U.N.オーエンは彼女なのか？」。只改变界面显示，不修改原文件名或已保存的曲目资料。音频可使用 Music 文件夹或文件导入功能；本地文件不会上传。并非每款游戏、每首曲目或每个体验版都包含 MIDI。
- MP3、OGG、FLAC、WAV 等仍由普通本地播放器播放。**TRK MIDI MIX**是另一项普通音频效果，位于选曲画面左下 **✨ TRK效果**面板的正下方，默认关闭；它不是 SoundFont 合成，也不会把音频转换成 MIDI。
- Windows 游戏音频可另行查看 [Touhou Music Room](https://github.com/DTM9025/musicroom/releases/latest)。上游说明支持官方 Windows 作品，并可导出 OGG、FLAC、MP3 等音频；**它不输出 MIDI**。本项目不集成、不附带该工具；其上游许可证为 GPL-3.0-or-later（含额外许可）。请使用自己合法取得的游戏，确认具体版本的支持与第三方条款，并勿分发提取出的音频。
- Touhou Patch Center 的 [thtk指南](https://www.thpatch.net/wiki/Touhou_Patch_Center:THTK)明确说明 thtk **不能提取BGM档案**，因此不将它作为音乐/MIDI提取器推荐。它的上游 [`COPYING`](https://github.com/thpatch/thtk/blob/master/COPYING)包含BSD双条件风格条款，但GitHub许可证识别为`NOASSERTION`。

## 한국어

- `.mid` / `.midi`는 trk!의 코드 생성 GM 스타일 신시사이저로 WAV 렌더링합니다. 설정 → **🔊 사운드**에서 24개 프로필(넓은 참고 스타일 10개＋trk 오리지널 14개)을 고를 수 있습니다. 실제 샘플·SoundFont·ROM 데이터를 포함하지 않으며 하드웨어나 제품을 에뮬레이션하지 않습니다. SMF 0/1, PPQ를 지원하며 SMPTE는 지원하지 않습니다. 파일은 최대 8MiB, 10분입니다.
- 렌더링에는 처리량 상한도 있습니다. 모든 음이 울리는 시간의 합×샘플링 주파수가 2억까지입니다(들리지 않을 만큼 감쇠한 여운은 세지 않습니다). 예를 들어 4화음이 이어지는 9분 30초 곡이나 평균 37개 안팎의 음이 동시에 울리는 밀도 높은 4분 곡은 들어갑니다. 넘으면 "MIDI가 너무 길거나 동시에 울리는 음이 너무 많다"고 표시합니다. 긴 렌더링은 진행률(%)을 보여 주고, 다른 곡을 고르면 렌더링을 멈춥니다. 내 파일이 어느 정도인지는 `node tools/midi-budget.mjs 파일.mid`로 확인할 수 있습니다(파일을 읽기만 하고 어디에도 보내지 않습니다).
- 파일명에 곡 ID를 유지하면 됩니다. 예를 들어 `th06_05.mid`는 「おてんば恋娘」, `th06_15.mid`는 「U.N.オーエンは彼女なのか？」로 목록과 플레이리스트에 표시합니다. 원본 파일명과 저장된 프로필은 바꾸지 않습니다. Music 폴더 또는 파일 추가로 불러오며, 로컬 파일은 업로드하지 않습니다. 모든 게임·곡·체험판에 MIDI가 포함되는 것은 아닙니다.
- MP3, OGG, FLAC, WAV 등은 일반 로컬 플레이어로 재생합니다. **TRK MIDI MIX**는 일반 오디오용 별도 효과이며, 곡 선택 화면 왼쪽 아래 **✨ TRK 효과** 패널 바로 아래에 있습니다. 기본값은 꺼짐이며 SoundFont 합성이나 오디오→MIDI 변환이 아닙니다.
- Windows 게임 음원 추출은 별도 배포되는 [Touhou Music Room](https://github.com/DTM9025/musicroom/releases/latest)을 확인하세요. upstream 설명에 따르면 공식 Windows 작품의 게임 음원을 OGG, FLAC, MP3 등으로 내보낼 수 있지만 **MIDI를 출력하지는 않습니다**. upstream 라이선스는 추가 허가가 있는 GPL-3.0-or-later입니다. 이 앱은 도구를 포함하지 않습니다. 정식으로 취득한 게임만 사용하고, 해당 버전의 지원 및 종속 도구 조건을 확인하며 추출 음원을 재배포하지 마세요.
- Touhou Patch Center의 [thtk 안내](https://www.thpatch.net/wiki/Touhou_Patch_Center:THTK)는 thtk가 **BGM 아카이브를 추출할 수 없다**고 명시하므로 MIDI/음악 추출기로 권하지 않습니다. upstream [`COPYING`](https://github.com/thpatch/thtk/blob/master/COPYING)은 BSD 2조건 계열 문구지만 GitHub 라이선스 검출은 `NOASSERTION`입니다.
