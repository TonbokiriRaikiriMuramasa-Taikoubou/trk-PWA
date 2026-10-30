<!-- SPDX-License-Identifier: GPL-3.0-or-later (this README only — NOT the model) -->
# lat-miku/ — Lat式ミク Ver2.31（同梱済み ✅）

**このフォルダのモデル・テクスチャ・ReadMe.txt は GPL の対象ではありません**（NOTICE.md 3a 参照）。

## 明記（ReadMe.txt の再配布条件にもとづく表示）

- モデル製作者：**Lat 様**（http://innoce.nobody.jp/）
- モデル名：Lat式ミク Ver.2.31（Normal）
- 改変：**なし**（データは無改変。`Lat式ミクVer2.31_Normal.pmd` のファイル名のみ
  `LatMiku_Ver2.31_Normal.pmd` にリネーム。テクスチャ名・中身はすべて原本のまま）
- キャラクター：初音ミク — クリプトン・フューチャー・メディア株式会社の
  **ピアプロ・キャラクター・ライセンス（PCL）** にもとづく利用（trk! は非営利・無償）
- 規約原文：同梱の **`ReadMe.txt`**（UTF-16・原本のまま。再配布時は必ずこのファイルごと）

ReadMe.txt（利用規約）より：
> ■再配布について■
> ピアプロ・キャラクター・ライセンス対象内外問わず、上記規約内であれば再配布OKです。
> 但し、その際はこのReadMe.txtを同梱し、モデル製作者と改変元を明記してください。

## 入っているもの

- `LatMiku_Ver2.31_Normal.pmd` … Normal 版モデル本体
- テクスチャ18ファイル（bmp/png/sph/spa。PMD内部の参照名と一致させるため**原名のまま**）
- `ReadMe.txt` … 規約原文（無改変）
- `preset.json` … trk! が💠ボタンを出すためのマニフェスト

元の配布 zip には White／セーラー服（冬・夏）などの衣装違いも入っています。
足したいときは同じ要領で .pmd と追加テクスチャを置き、`preset.json` を増やして
`js/mmd.js` の `PRESET_DIRS` にフォルダ名を足してください。

## おすすめ設定（preset.json 済み）

- credit: `Lat式ミク / Lat様`（クレジット欄に自動で入ります）
- motion: `jump`（内蔵④ ジャンプ・130BPM）
