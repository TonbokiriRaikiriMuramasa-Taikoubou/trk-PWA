# 🛠 MODを作る

> MOD（アドオン）の作り方。詳しくは docs/ADDONS.md。

← [📚 ガイド目次](index.md)　／　[README](../../README.md)

trk! はMODしやすいように、機能ごとにファイルを分けています。

- **自作キャラクター**：`js/characters/miku.js` を見本に `registerMascot()` を呼ぶファイルを作り、`index.html` に1行足すだけです。
- **内蔵スキン**：`js/data.js` の `SKINS` に1項目足すと、一覧に出ます（`cat` タグで棚の絞り込み、`--ui-bg`／`game.stage` には `linear-gradient(…)` も書けます。`locked:true` を付けると解禁フラグ `settings.skinGradUnlocked` が立つまで鍵がかかり、棚では「❓ ？？？」カードになります。実例：ごほうびのグラデュエーション🎓）。ミク系は `js/characters/miku.js` に登録します。
- **棚スキン（曲タブの見た目）**：`js/lib-skins.js` の `LIB_SKINS` と `LIB_SKIN_ORDER` に1項目、`css/style.css` に `#libPanel[data-lib-skin="ID"] …` の見た目を足すだけです。
- **アドオン**：`js/*.js` を触らずに機能を足せます。`TrkAddons.register({...})` を書いて、設定画面から入れるか `index.html` に1行。API は [docs/ADDONS.md](../ADDONS.md)、見本は `js/addons/example.js`。
- **TVスキン**：`js/tv-dock.js` の `TV_DOCK_SKINS` に1項目、`buildDeco()` に飾り、`css/style.css` に見た目を足します。自分で作るだけなら、設定画面の🎨（`#tvMaker`）からどうぞ。
- **サウンドエフェクト**：マイプリセット（`trk-fx` のJSON）か、`TRK_FX_PRESETS` に足す自分のファイル。
- **翻訳**：`js/i18n.js` などの `TEXT.ja / en / zh / ko`
- **参加のしかた**：[CONTRIBUTING.md](../../CONTRIBUTING.md)
- **開発の引き継ぎ資料**：[docs/HANDOFF.md](../HANDOFF.md)（設計の考え方・ファイル間の約束・保存データの形式）

派生版を公開するときは、別の名前にしてください（下の「ライセンスと権利」を参照）。

---
