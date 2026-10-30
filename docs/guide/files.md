# 📁 ファイル構成

> リポジトリのファイル構成。

← [📚 ガイド目次](index.md)　／　[README](../../README.md)

```
trk/
├─ index.html  privacy.html  credits.html  manifest.webmanifest  sw.js  verified.json
├─ package.json  capacitor.config.ts
├─ css/style.css  css/study-room.css  … 書斎の見た目（本棚・リーダー・TV）
├─ icons/                        … アプリのアイコン
├─ assets/optional-demo-audio/   … 任意の First Spark デモ音源＋手づくり譜面3種（軽量版ではフォルダーごと削除可）
（trk's OST Vol.1 の音源は同梱せず、music-library の .stpack で別配布。スコアは tools/ost-scores/）
├─ js/
│  ├─ i18n.js  i18n-options.js   … 4言語の文章
│  ├─ data.js                    … スキン・レイアウト・難易度・マスコット登録
│  ├─ characters/miku.js         … 初音ミク（PCL）。削除してもゲームは動きます
│  ├─ core.js                    … 設定・状態・共通処理
│  ├─ player.js                  … 再生操作・区間リピート
│  ├─ media.js                   … 読み込み・音声解析・譜面生成
│  ├─ judge-match.js             … MANUAL の打鍵とノーツの対応づけ（純関数）
│  ├─ game.js                    … 進行・判定・記録
│  ├─ render.js                  … 描画
│  ├─ custom.js                  … ノーツ・スキン作成・パック
│  ├─ truck.js  modes.js  stage.js  stagefx.js  catch.js   … 各モード・体力・称号・演出
│  ├─ extras.js                  … オフセット測定・ゴーストなど
│  ├─ tv-presets.js  tv-dock.js  … 映像フィルター・TVドック・カスタムTVスキン
│  ├─ fx-presets.js  fx.js  fx-dock.js   … サウンドエフェクトと、左下の 🔥 TRKアンプ
│  ├─ library.js                 … 選曲画面・AUTO・ラジオ・曲のタブ（棚）
│  ├─ lib-skins.js               … 棚スキン30種（曲タブの見た目・🎨ボタン）
│  ├─ verified.js                … 公認パック
│  ├─ addons.js  addons/         … アドオン（あとから機能を足すしくみ・見本）
│  ├─ main.js  speed.js          … 入力・起動・速度
│  ├─ vrm.js                     … VRMマスコット
│  ├─ mmd.js                     … MMDマスコット（原則持ち込み。再配布条件付きLat式を同梱）
│  ├─ favs.js                    … ⭐ お気に入りのフォルダ管理（1軍／2軍／🧊／📤元）
│  ├─ spectrum.js                … 📊 スペクトラム（音の見える化・TVの画面に重ねられる）
│  └─ study-room.js  study-room-utils.js  … 📚 書斎（端末内の画像・文章ビューア）
├─ docs/  HANDOFF.md  pack-format.md  android.md  verified.md  og.png
├─ tools/make-icons.html         … アイコンとOGP画像を作るツール
├─ tools/check-repo.mjs          … 依存なしの静的スモーク検査
├─ tools/check-study-room.mjs    … 📚 書斎の読み込み・文字コード・安全側の静的検査
├─ tools/prepare-mobile-web.mjs  … Capacitor用Web資産の同期
├─ .github/ISSUE_TEMPLATE/       … 不具合・アイデアのフォーム
├─ README.md  NOTICE.md  CONTRIBUTING.md  LICENSE
```

---
