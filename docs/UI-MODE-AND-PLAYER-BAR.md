# 画面の形の切り替えと、下の再生バー（trk221）

記録日：2026-10-31。作業ブランチ `arena/608b424c-trk-pwa`。
**実ブラウザ・実機での確認は未実施**（このセッションにはブラウザと端末がありません）。確認したのは自動検査と jsdom の通し確認です。

---

## 1. 何を作ったか

利用者からの2つの要望に、1つの設定の組として応えました。

| # | 要望 | 作ったもの |
| --- | --- | --- |
| 1 | PC でもモバイル版と同じ UX を使える切り替え設定（PC でも縦型のスタンドで使う／スマホ版でも大型タブレットで使う） | `settings.uiMode`（`auto` / `desktop` / `mobile`）。`js/mobile-shell.js` に「入れる／外す」を持たせ、開き直さずにその場で切り替わる |
| 2 | 下側に常に再生バーと楽曲名を表示する設定（PC／apk をプレイヤーとして押し出す） | `js/player-bar.js`＋`css/player-bar.css`。`settings.playerBar`（`on` / `auto` / `off`）。スキンの色に追従 |

参考にした画面：**Clementine（PC）の下部プレイヤー**と **VLC（Android）の下部ミニプレイヤー**。
採ったのは「下に固定」「左にジャケットと曲名」「中央に再生と曲送り」「上端の細いシーク線」という並びです。
採らなかったのは、プレイリストの常設・イコライザの常設・閉じるボタンだけで消える挙動（trk では設定に戻せるようにしました）。

---

## 2. 設定（保存は本体の設定だけ）

| 設定 | 値 | 既定 | 効くところ |
| --- | --- | --- | --- |
| `uiMode`（画面の形） | `auto` / `desktop` / `mobile` | `auto` | `body.trk-mobile` の有無（＝下部ナビとスマホ用の見た目） |
| `playerBar`（下の再生バー） | `on` / `auto` / `off` | `auto` | `#trkPlayerBar` の表示 |

- 保存先は既存の `core.settings`（`shadow_taiko_preferences_v2`）です。**新しい保存キーは増やしていません。**
- 検証は `core.js` の `pick()` で行うので、保存が壊れていても既定へ落ちます。
- `?reset=all`（工場出荷状態）では、どちらも既定へ戻します（`resetAllPrefs()`）。
- 設定画面の欄：⚙ → **🖥 画面と再生バー**（`#uiPanel`）。日本語・英語・中国語・韓国語の4言語。

### 2.1 画面の形（`uiMode`）

| 選んだ値 | PC（マウス） | スマホ・タブレット |
| --- | --- | --- |
| `auto` | PC型（これまでどおり） | スマホ型（下部ナビ） |
| `desktop` | PC型 | **PC型**（大きいタブレットで広く使う） |
| `mobile` | **スマホ型**（縦型のスタンド・小さい窓） | スマホ型 |

- `auto` の判定は `js/lite.js` の `TrkLite.info().mobile`（粗いポインタ／端末の UA）。判定を2か所に書かないため、シェルからは同じ窓口を呼びます。
- 切り替え方は3つ。どれも同じ `settings.uiMode` を書きます。
  1. ⚙ → 🖥 画面と再生バー → 「画面の形」
  2. 選曲画面の右上の **📱／🖥** ボタン（押すたびに 自動 → スマホ型 → PC型）
  3. 開発者向け：`Trk.mobileShell.setMode("mobile")`
- 切り替えは `enable()`／`disable()` で行い、**開き直さずに**その場で効きます。`disable()` は下部ナビ・エフェクト画面・縦向きの案内・再生画面の「ゲームモードへ」を片付け、`body.trk-mobile` と `data-trk-view` を外します。
- PC の既定（`auto`・マウスの PC）では、`body.trk-mobile` が付かず、`css/mobile-shell.css` の規則は一切当たりません。**PC の見た目は変わりません**（右上の切り替えボタンだけが増えます）。

---

## 3. 下の再生バー（`playerBar`）

### 3.1 出す／出さない

| 値 | 曲を選んでいないとき | 曲を選んだとき |
| --- | --- | --- |
| `on` | **出す**（曲名の欄は「曲を選ぶと、ここに曲名が出ます。」） | 出す |
| `auto`（既定） | 出さない | 出す |
| `off` | 出さない | 出さない |

どの値でも、次のあいだは**引っ込みます**（ステージと操作の邪魔をしないため）。

- ゲーム中（`core.phase` が `playing`／`paused`）
- 再生画面（メディアプレーヤー）を開いている間
- 書斎（`body.study-room-open`）
- ほかの窓（プレイリスト・「ようこそ」・インストール案内・`role="dialog" aria-modal` の重ね表示）

リザルト（`ended`）では出します（曲名を見ながら次の曲へ送れるように）。

### 3.2 部品と操作

```
[────────── 上端の細いシーク線（再生中だけ動かせる）──────────]
[ジャケット] [曲名 / 歌手]  [⏮][▶][⏭]  [0:12 / 3:45]  [🔊 音量] [⛶][✕]
```

| 部品 | 何をするか | 本体のどこを呼ぶか |
| --- | --- | --- |
| ▶／⏸ | 押した瞬間の意味は、曲名バナーの本物のボタンと同じ（選曲中はプレビュー、ゲーム中は一時停止／再開） | `#songBanner .bannerPlayBtn` をそのまま押す（**状態を二重に持たない**）。アイコンと説明もそこから写す |
| ⏮／⏭ | 前の曲／次の曲（選曲中だけ） | `Trk.library.prevSong()`／`nextSong()` → `selectSong()` |
| シーク線 | 0〜1000 を曲の長さに直して移動（再生中・一時停止中だけ） | `Trk.play.seekTo()`。ドラッグ中は追従を止め、離して0.9秒で戻す |
| 音量 | 0〜1 | `core.settings.musicVolume`・`rememberMusicVolume()`・`video.volume`・`#volume`・`saveUserPrefs()` |
| ⛶ | 再生画面を開く | `TrkMediaPlayer.open()` |
| ✕ | 「表示しない」にする | `settings.playerBar = "off"`＋保存＋通知（設定で戻せることを伝える） |

- 曲名と歌手は `Trk.library.songDisplayMeta()`（ユーザー設定 → タグ → 曲の情報の順）。曲が変わったときだけ読み直します。
- ジャケットは `Trk.library.loadSongArtwork()` の Blob を、このバー専用の `URL.createObjectURL` で表示し、**差し替え時に必ず `revokeObjectURL`** します（512 KB 超・画像以外は飾りに使わない）。
- 時間表示は `m:ss`、1時間を超えたら `h:mm:ss`。長さが分からないときは `--:--`。

### 3.3 スキン

バー専用の色は持ちません。スキンが `:root` に書く CSS 変数（`--ui-panel` `--ui-soft` `--ui-text` `--ui-muted` `--ui-border` `--ui-button-hover` `--ui-accent`）だけを使います。
`core.applySkin()` が値を書き換えると、バーも同じ色になります。検査（`tests/trk221-player-bar.test.mjs`）で「決め打ちの色（`#rrggbb`）を書かない」ことを確かめています。

### 3.4 ほかの部品と重ならないようにする

バーは `position: fixed` なので、下にある物と重なり得ます。次の4つを避けています。

| 相手 | 対策 |
| --- | --- |
| スマホの下部ナビ | ナビの上に載せる（`--trk-playerbar-offset` にナビの高さを入れ、JS が測る） |
| 選曲画面のカード | PC は `.screen` の下余白、スマホ型は `.card` の下余白にバーの高さを足す（PC は 1920×1080 の縮小率を打ち消した値を渡す） |
| 🛟 セーフモードの浮きボタン（緊急の逃げ道） | バーの上へ逃がす（`!important` でインラインの `bottom` を上書き） |
| 通知（`.plToast`） | バーの高さぶん持ち上げる |

画面の形が切り替わったときは、`MutationObserver`（`body` の class と `.trk-mobile-nav` の出入り）で測り直します。

### 3.5 入力とゲームへの干渉

- バーは**ゲーム中（`playing`／`paused`）には出ません**。キー入力・パッド・キャンバスの操作を奪いません。
- 新しい音の通り道（`new Audio()` など）は作りません。鳴らすのは本体の `video` だけです。
- 選曲中は ⏮⏭ を押せます（バナーの ◀▶ と同じ扱い）。プレイ中は無効になります。

---

## 4. 変更したファイル

| ファイル | 変更 |
| --- | --- |
| `js/core.js` | `settings.uiMode`・`settings.playerBar` を追加、工場出荷状態で既定へ戻す |
| `js/mobile-shell.js` | `enable()`／`disable()` に分割、`uiMode` の適用、右上の 📱／🖥 ボタン、設定の選択との同期 |
| `js/player-bar.js`（新規） | バーの組み立て・表示判断・操作の配線 |
| `css/player-bar.css`（新規） | バーの見た目と、重なりを避ける余白 |
| `css/style.css` | `.uiModeBtn`（右上の切り替えボタン）の見た目 |
| `index.html` | `css/player-bar.css`、`js/player-bar.js`、設定の欄 `#uiPanel` |
| `js/i18n.js` | 4言語 × 24キー（`secUi`・`uiMode*`・`playerBar*`・`bar*`） |
| `sw.js` | キャッシュ名を `trk-v2026.10.31-trk221` へ。殻の先読みは `index.html` から読むので一覧の手直しは不要 |
| `tests/trk221-ui-mode.test.mjs`（新規） | 10件 |
| `tests/trk221-player-bar.test.mjs`（新規） | 17件 |

---

## 5. 検証（2026-10-31）

```sh
npm ci
npm run check            # 821 pass / 0 fail（trk221 の27件を追加）
node tools/check-repo.mjs  # 0 failure / 0 warning
```

jsdom で実際の `index.html` を開いて確かめたこと（`/tmp/smoke/trk221.mjs`。リポジトリには入れていません）：

- PC の UA・`uiMode=auto` では `body.trk-mobile` が付かない／右上の切り替えボタンがある
- ボタンを1回押すと `body.trk-mobile` が付き、下部ナビが出て、`localStorage` に `"uiMode":"mobile"` が入り、設定の選択も `mobile` を表示する
- 曲を選ぶ（`currentSong` を置いて `songSelected` を出す）と、ようこそを閉じたあとにバーが出る。曲名が入り、`--trk-playerbar-h: 60px`・`--trk-playerbar-offset: 66px`（スマホ型のとき）になる
- 音量スライダーが `core.settings.musicVolume` と設定画面の `#volume` の両方へ効く
- `phase` を `playing` にすると隠れ、戻すと出る
- 「PC型」へ戻すと下部ナビが片付き、offset が `0px` に戻り、バーは出たまま
- 設定の欄から `playerBar=off` で隠れて保存され、`on` で戻る
- 「PC型」→「スマホ型」と往復しても、下部ナビと縦向きの案内が戻る（部品は作り直さず、つなぎ直すだけ）

**未実施**：実ブラウザ（Chrome／Safari）での見た目、iPhone・iPad・Android 実機、縦型モニタでの見え方、スクリーンリーダーでの読み上げ順。

---

## 6. これから

1. 実ブラウザと実機で、`docs/PWA.md` §11 の手順から見た目を確認する（特にスマホ型＋下部ナビ＋再生バーの3段重ね、`env(safe-area-inset-bottom)` の入り方）。
2. 縦型モニタ（1080×1920 など）で「スマホ型」を選んだとき、カードの横幅が広がりすぎないかを確認する（必要なら `@media (min-aspect-ratio: 1/2)` で最大幅を決める）。
3. バーの折りたたみ（曲名だけの1行にする）や、歌詞・波形をバーへ出すかは、メディアプレーヤー本体（`docs/PLAYER-ROADMAP.md`）と重ならない範囲で検討する。
4. 画面の形の選択を、初回起動の案内（`js/ios-pwa.js` のインストール案内）と食い違わせない。今は「案内はスマホのときだけ出す」ままです。

---

## 7. 事実と推測の分け方

- **事実**：上の表・コマンドの結果・jsdom の確認項目は、このセッションで実行して得た結果です。
- **推測**：縦型モニタでの見え方、実機のセーフエリア、スキンごとのコントラストは、実ブラウザで見ていません。「たぶん大丈夫」は書いていません。
- **決めていない**：バーの既定を `auto` にしたのは、曲を選んでいない画面で空のバーが場所を取らないためです。「つねに表示」にしたい場合は設定で選べます。既定を `on` にするかは、実機を見てから決めます。
