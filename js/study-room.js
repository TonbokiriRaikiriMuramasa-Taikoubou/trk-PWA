(() => {
  const core = window.Trk.core;
// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ 📚 書斎：端末内の画像・文章リーダー ============
   ・取り込んだ本・栞・ジャケットは、この端末の中（IndexedDB trk_study_room_v1）だけに置きます。
   ・外部への送信はありません（fetch/XHR を使いません）。取り込んだ文章を HTML として解釈しません。
   ・?safe=1 では開かず、保存領域にも触りません。 */
"use strict";

/* 文言はこの機能内で4言語そろえる（tools/check-study-room.mjs が4言語の抜けを検査します）。 */
Object.assign(TEXT.ja, {
  studyTitle:"📚 書斎", studyOpenBtn:"📚 書斎", studyOpenBtnHint:"書斎（本棚・テレビ・画像リーダー）を開きます。曲リストの見出しを長押ししても開けます", studyLaunchHint:"♫を長押しして書斎を開く（キーボードではEnter）",
  /* 📂 trk208：フォルダーを共有して「フォルダのまま読む」（コピーしない） */
  studyShareFolder:"📂 フォルダを共有して読む",
  studyFolderScanning:"📂 「{name}」を調べています… {n}枚",
  studyFolderAdded:"📂 「{name}」から {books}冊（{pages}ページ）を本棚に並べました。ページはフォルダーから直接読みます（端末へコピーしません）。",
  studyFolderDenied:"📂 フォルダーの読み取りが許可されませんでした（キャンセルしたときは何も変わりません）。",
  studyFolderUnsupported:"このブラウザーではフォルダーを覚えられません。「🖼 画像フォルダを取り込む」からコピーして取り込んでください（Chrome／Edgeなら共有できます）。",
  studyFolderMissing:"📂 「{name}」フォルダーが見つかりません。📂 から同じフォルダーをもう一度選ぶと、同じ本として読めます。",
  studyFolderPermission:"📂 「{name}」の読み取り許可が切れています。📂 から同じフォルダーをもう一度選んでください。",
  studyFolderPageMissing:"「{name}」を読み込めませんでした（フォルダーの中で移動・削除された可能性があります）。",
  studyLinkedBadge:"📂 {name}（フォルダのまま）",
  studyClose:"✕ 書斎を閉じる", studyImportImages:"🖼 画像フォルダを取り込む",
  studyImportTextFiles:"＋ テキストを追加", studyImportTextFolder:"📄 テキストフォルダを取り込む",
  studyImportArchives:"🗜 CBZ/ZIPを取り込む", studyArchiveBad:"「{name}」は読み込めませんでした（壊れているか、暗号化されています）。", studyArchiveNoImages:"「{name}」の中に対応画像がありません。",
  studyImportWithNote:"{summary}（{note}）",
  studyShelf:"本棚", studySearch:"タイトル・フォルダを検索…", studyShelfEmpty:"本棚は空です。画像フォルダか TXT / MD / JSON を取り込んでください。",
  studyWelcomeTitle:"読みたいものを選ぶ", studyWelcomeHint:"画像はフォルダ単位、テキストはファイルごとにこの端末内へ保存します。外へアップロードしません。",
  studyWelcomeHelp:"操作が分からなくなったら、右上の「❓ キーの説明」を開いてください。",
  studySupported:"画像: JPG / PNG / WebP / GIF / AVIF / BMP · 文章: TXT / MD / JSON / CSV / HTML / XML など",
  studyTapHint:"画像の左側タップ／→で次へ · 右側タップ／←で前へ（🇺🇸ではタップ位置を反転） · Space / Enterで次へ · Enter長押しで栞 · Space長押しでページ移動 · Escで終了",
  studyVerticalHint:"縦にスクロール／フリックして読み進める · Space / Enterで次へ · Enter長押しで栞 · Aで自動スクロール · Escで終了",
  studyAutoScrollStart:"⏩ 自動スクロール", studyAutoScrollStop:"⏸ 自動スクロール停止",
  studyAutoScrollSpeedLabel:"自動スクロールの速度",
  studyAutoSpeedSlowest:"いちばん遅い", studyAutoSpeedSlow:"遅い", studyAutoSpeedNormal:"普通", studyAutoSpeedFast:"速い", studyAutoSpeedFastest:"いちばん速い",
  studyAutoScrollSpeedHint:"縦読みモードの「⏩ 自動スクロール」の速さ（1秒あたりのピクセル）。動いている最中の変更もすぐ効きます。タップや移動キー（↑↓・Space・PageUp / PageDown など）で止まります。",
  studyAutoScrollStarted:"自動スクロールを開始しました · タップか ↑↓ / Space / PageUp・PageDown で停止",
  studyAutoScrollEnd:"最後のページに着きました · 自動スクロールを停止しました",
  studyAutoScrollNeedVertical:"自動スクロールは縦読み漫画モードだけで使えます",
  studyHelpAuto:"縦読みの自動スクロール 開始／停止（縦読み漫画モードだけ）",
  studyReadBrightnessLabel:"明るさ（読書）", studyReadContrastLabel:"コントラスト（読書）", studyReadSpecialLabel:"特殊フィルタ（読書）",
  studyReadSpecialNone:"なし", studyReadSpecialInvert:"反転", studyReadSpecialGrayscale:"グレースケール", studyReadSpecialSepia:"セピア",
  studyReadFilterHint:"読書面（画像と文章）だけに CSS filter を当てます。全画面フィットや拡大率とは独立で、本棚やメニューは変わりません。初期値は 100% / 100% / なし。",
  studyBack:"← 本棚", studyFullscreen:"⛶ 画像を全画面化", studyModeLabel:"画像の並べ方",
  studyModeSingle:"一枚ずつ（中央）", studyModeSpread:"見開き（右が1ページ目）", studyModeVertical:"縦読み漫画",
  studyAmerican:"🇺🇸 アメリカン（左右・順序反転）", studyThemeLabel:"文字のスキン",
  studyThemePlain:"普通のテキスト", studyThemeDark:"ダークモード", studyThemeNeon:"ネオン",
  studyThemeLined:"ルーズリーフ", studyThemeGenko:"作文用紙（縦書き・右から）", studyThemeSticky:"付箋（黄色い紙）", studyThemeLetter:"便箋", studyThemeDiary:"日記帳", studyThemeHaiku:"俳句の短冊", studyThemeNewspaper:"新聞の紙面（段の罫線）", studyThemeStaff:"楽譜の余白（五線）",
  studyThemeGroupWriter:"✍ 文筆・読書", studyThemeGroupCode:"⌨ コーディング",
  studyThemeGroupAi:"◈ AI・プロンプト風（見た目のみ）", studyThemeGroupFree:"✦ 自由な発想",
  studyThemePaper:"和紙", studyThemeWarm:"クリーム", studyThemeSepia:"古書",
  studyThemeMidnight:"ミッドナイト", studyThemeTerminal:"ターミナル", studyThemeGraphite:"グラファイト",
  studyThemeBlueprint:"設計図", studyThemeContrast:"高コントラスト",
  studyThemePrompt:"プロンプト・ラボ", studyThemeNeural:"ニューラル", studyThemeLatent:"潜在空間",
  studyThemeMatrix:"トークン・マトリクス", studyThemeSynth:"シンセシス",
  studyThemeAurora:"オーロラ", studyThemeSunset:"サンセット", studyThemeOcean:"深海",
  studyThemeMint:"ミント", studyThemeDream:"ドリーム", studyThemePrism:"プリズム",
  studyTvToggle:"TVを流し見する", studyTvPosLabel:"TVの位置", studyTvTop:"上", studyTvBottom:"下", studyTvHidden:"表示しない",
  studyTvEmpty:"動画または曲のジャケットがここに表示されます。", studyTvCaption:"今の曲・動画を表示します。別の音声を重ねて再生しません。",
  studyTvHint:"（画像を長押しすると、この曲のジャケットにできます）",
  studyBookmark:"🔖 栞を挟む", studyBookmarkSaved:"🔖 栞を更新しました。", studyBookmarkError:"栞を保存できませんでした。",
  studyFullscreenFit:"全画面時に強制的に画面にフィットにする", studyFullscreenFitHint:"初期オフ。オンにすると全画面中は画像全体を縦横比を保って表示し、拡大・縮小操作を無効にします。見開きは左右それぞれ、縦読みは1枚ずつ画面に収めます。全画面を閉じると元の拡大率に戻ります。",
  studySettings:"⚙ 設定", studyMemoEdit:"✎ コピーを編集", studyMemoDone:"閲覧に戻る", studyExportText:"⇩ テキストコピーを書き出す",
  studyMemoSaved:"書斎内のコピーを保存しました。", studyMemoSaveError:"書斎内コピーを保存できませんでした。",
  studyEditorLabel:"テキスト編集", studyEditorSafety:"書斎内のコピーを編集します。元ファイルは変更せず、JS / HTMLは実行せず、Markdownも装飾表示しません。Tabで字下げ、Ctrl / ⌘+Sで保存、Escで閲覧に戻ります。",
  studyEditorUnsaved:"未保存の変更（自動保存します）", studyEditorSaving:"保存中…", studyEditorSaved:"書斎に保存済み",
  studyEditorSaveFailed:"保存に失敗しました。編集画面を閉じる前に、テキストコピーを書き出してください。",
  studyEditedTextFolderLabel:"編集した文章の本棚フォルダ", studyEditedTextFolderKeep:"自動で移動しない（今の場所）",
  studyEditedTextFolderHint:"選ぶと、編集内容を保存した本をこのフォルダへ整理します。本文は端末内の書斎に保存し、元ファイルは変更しません。",
  studyTextFiledInFolder:"編集した本を「{folder}」に整理しました。", studyEditedTextFolderSaveFailed:"本文は保存しましたが、本棚のフォルダを更新できませんでした。",
  studyExportFolderLabel:"書き出し先（端末）", studyChooseExportFolder:"書き出しフォルダを選ぶ", studyClearExportFolder:"解除",
  studyExportFolderNone:"未選択（ブラウザの通常ダウンロード先）", studyExportFolderSelected:"選択中：{name}（この起動中のみ）",
  studyExportFolderHint:"選んだフォルダに新しいファイルを作成します。同名があれば別名にし、既存ファイルは上書きしません。未対応ブラウザでは通常のダウンロードを使います。",
  studyExportSavedToFolder:"「{folder}」へ「{name}」を書き出しました。", studyExportFolderSelectError:"書き出しフォルダを選べませんでした。",
  studyExportFolderFallback:"選んだフォルダへ保存できなかったため、通常のダウンロードを開始しました。",
  studyNext:"◀ 次へ", studyNextRight:"次へ ▶", studyPrevious:"前へ ▶", studyPreviousLeft:"◀ 前へ",
  studyNextRightOnly:"次へ ▶", studyPreviousLeftOnly:"◀ 前へ", studyProgressDone:"完了",
  studyAssignCover:"🖼 このページを曲のジャケットに", studyCoverAssigned:"「{title}」のジャケットに設定しました。",
  studyCoverNeedSong:"曲を選んでから設定できます。", studyCoverNeedImage:"画像ページを開いてください。",
  studyCoverError:"ジャケットを保存できませんでした。", studyDelete:"削除", studyRename:"名前を変更", studyOpen:"開く",
  studyBookImages:"画像アルバム", studyBookText:"テキスト", studyPageCount:"{n}枚", studyPagesStatus:"{current} / {total}",
  studyPageRange:"{first}–{last} / {total}", studyPageLabel:"ページ", studyTextProgress:"{n}%",
  studyRenamePrompt:"新しい名前", studyRenamed:"名前を変更しました。", studyDeleteConfirm:"「{title}」を本棚から削除しますか？",
  studyDeleted:"本棚から削除しました。", studyReplace:"「{title}」は本棚にあります。置き換えますか？",
  studyImportProgress:"取り込み中… {n} / {total}", studyImportDone:"{n}件を本棚に追加しました。",
  studyNoImageFiles:"選択したフォルダに対応画像がありません。", studyNoTextFiles:"対応するテキストファイルがありません。",
  studyNoSearchResults:"一致する本がありません。", studyTextBatchLimit:"一度に取り込めるテキストは最大200ファイルです。", studyShelfLimit:"本棚は最大500冊です。",
  studyTooMany:"画像アルバムは最大{max}枚・合計{mb}MBまでです。", studyFileTooBig:"「{name}」は大きすぎます（1ファイル最大{mb}MB）。",
  studyTextTooBig:"「{name}」は大きすぎます（1ファイル最大{mb}MB）。", studyDecodeError:"「{name}」を文字として読み込めませんでした。",
  studyStorageError:"ブラウザ内への保存に失敗しました。空き容量を確認してください。",
  studyImageLoadError:"画像を読み込めませんでした。もう一度取り込んでください。",
  studySafeMode:"セーフモード中は、書斎の保存データを読み込みません。通常モードで開いてください。",
  studyProgressHint:"長押し中に開いたバーを動かすと、ページを移動できます。", studyBookmarked:"栞から再開しました。",
  studyMemoNeedText:"テキスト本でのみメモ帳を使えます。", studyFullscreenExit:"全画面を閉じる",
  studyHelp:"❓ キーの説明", studyHelpTitle:"書斎のキー操作", studyHelpClose:"閉じる",
  studyHelpNav:"→で次へ・←で前へ（設定で変更可）。画像の左右タップは綴じ方向に従います。テキストはスクロールします。マウスの中クリックで次へ進む設定もあります。",
  studyHelpSpace:"次のページへ。長押しすると、画像=ページ移動バー、テキスト=栞を挟みます。",
  studyHelpPg:"画像は倍率に関係なく上端／下端へ、端で押し直すと前／次のページへ（本の端では閉じて本棚へ。最後で閉じる動作は設定でオフにできます）。押しっぱなしでは端で止まります。⚙ 設定で直接ページ送りにもできます。縦読み・テキスト・画面に収まる画像は従来どおり。Home / Endは最初／最後へ。",
  studyHelpZoom:"画像の拡大・縮小・フィット（縦読みでは使いません）。Ctrl+ホイールやピンチでも変えられ、拡大した画像は↑ / ↓かホイールで送れます。1回の幅は⚙ 設定で1〜25%（初期値5%）。",
  studyHelpSearch:"テキスト本の本文を検索（Enter=次の一致 / Shift+Enter=前の一致）。",
  studyHelpBookmark:"B=栞を挟む・外す、M=栞一覧の開閉。",
  studyHelpTv:"T=TVの表示切替（上→下→非表示）、F=画像の全画面表示。",
  studyHelpEsc:"?=この説明、Esc=設定・説明を閉じる／書斎を閉じる。",
  studySortLabel:"並べ替え", studySortUpdated:"更新が新しい順", studySortAdded:"追加が古い順", studySortTitle:"名前順",
  studySortType:"種類別（画像→テキスト）", studySortSize:"大きい順", studyMore:"さらに{n}冊表示",
  studyFolderCreateHint:"クリックまたは長押しで新しいフォルダを作成", studyCreateFolderPrompt:"新しいフォルダ名を入力してください。",
  studyRenameFolderPrompt:"フォルダの新しい名前", studyFolderCreated:"フォルダを作成しました。", studyFolderDuplicate:"同じ名前のフォルダがあります。",
  studyFolderLimit:"フォルダは最大200個です。", studyFolderNameRequired:"フォルダ名を入力してください。", studyFolderCount:"{n}冊",
  studyFolderBack:"← 本棚へ戻る", studyFolderEmpty:"このフォルダは空です。本をここへドラッグできます。", studyFolderOpen:"フォルダを開く",
  studyFolderRename:"フォルダ名を変更", studyFolderDelete:"フォルダを削除（本は本棚に残す）",
  studyFolderDeleted:"フォルダを削除し、本を本棚へ戻しました。",
  studyShelfDragHint:"⋮⋮をドラッグして移動。自動並び替えを使わない設定で順番も変更できます。フォルダへドロップすると移動します。",
  studyKeepShelfVisible:"全画面表示でないときは本棚を表示する。", studyShelfVisibilityHint:"チェックを外すと本棚を隠します。右上の「本棚を表示」からいつでも戻せます。",
  studyShowShelf:"📚 本棚を表示", studyNextKeyLabel:"次へ", studyPreviousKeyLabel:"前へ", studyKeyChange:"変更", studyKeyPressKey:"キーを押す · Escでキャンセル",
  studyVerticalImageKeys:"画像ページを↑ / ↓で移動する", studyKeyAssignmentHint:"ボタンを押してから使いたいキーを押します。方向キー・英字・数字・PageUp / PageDown・Home / Endを設定でき、既存ショートカットは選べません。",
  studyKeyCaptureHint:"{action}に割り当てるキーを押してください。Escでキャンセル。", studyKeyAssigned:"{action}を「{key}」に設定しました。",
  studyKeyInvalid:"このキーは割り当てできません。別のキーを押してください。", studyKeyConflict:"次へと前へには別々のキーを割り当ててください。",
  studyKeyButtonLabel:"{action}のキーは{key}です。押して変更します。", studyKeyButtonCaptureLabel:"{action}キーを設定中です。キーを押してください。Escでキャンセルします。",
  studyDragHandle:"ドラッグして移動または並べ替え", studyShelfMoved:"本棚の配置を更新しました。",
  studyNoSort:"並び替えを使わない。", studyFoldersFirst:"フォルダを上に表示する。",
  studyNoDeleteConfirm:"削除の時、確認をしない。", studyManualOrderHint:"自動並び替えを止め、ドラッグでフォルダや本を自由に配置します。",
  studyStorageInfo:"{books}冊 · 画像{images}枚 · 書斎 {size}", studyStorageFree:"{books}冊 · 画像{images}枚 · 書斎 {size}（端末の空き 約{free}）",
  studyBookmarks:"🔖 栞一覧", studyBookmarkCount:"栞 {n}件",
  studyBookmarksEmpty:"栞を挟んだ本はありません。読みながら Enter 長押し（または🔖ボタン）で挟めます。",
  studyBookmarksHint:"栞は本ごとに1つ。押すとその位置から読み始めます。",
  studyBookmarkOpenAt:"{n}ページ目から開く", studyBookmarkOpenText:"先頭から約{n}%の位置から開く",
  studyBookmarkRemove:"栞を外す", studyBookmarkRemoved:"栞を外しました。",
  studyImportCancel:"中止", studyImportCancelled:"取り込みを中止しました。保存できた{n}冊はそのまま残ります。",
  studyImportAsk:"同じ名前の本が{count}冊あります。中身を置き換えますか？（「キャンセル」なら、新しい本だけを取り込みます）",
  studyImportSummary:"完了: {added}冊を追加 · {kept}冊はそのまま · {failed}件は失敗",
  studyQuotaError:"端末の空き容量が足りません。大きいアルバムや本を減らしてから、もう一度お試しください。",
  studyAlbumNestingLabel:"アルバムの分け方", studyAlbumNestingSplit:"サブフォルダごとに1冊", studyAlbumNestingFlat:"フォルダ全体で1冊",
  studyAlbumNestingHint:"次の取り込みから反映します。",
  studyClearCover:"🗑 ジャケットを外す", studyCoverCleared:"ジャケットを外しました。", studyCoverNeedCover:"この曲には、書斎のジャケットがまだありません。",
  studyCoverSource:"書斎のジャケット: {title}（{n}ページ目）", studyCoverHoldHint:"画像を長押しすると、この曲のジャケットにできます。",
  studyBookSearchPlaceholder:"本文を検索…", studyBookSearchCount:"{n} / {m}件", studyBookSearchNone:"見つかりません",
  studyBookSearchClear:"✕ 検索を終了", studyBookSearchPrev:"前の一致", studyBookSearchNext:"次の一致",
  studyBookSearchHint:"Enter=次の一致 · Shift+Enter=前の一致 · Esc=検索を終了",
  studyTextTuneLabel:"文字", studyTextSizeSmall:"小", studyTextSizeNormal:"普通", studyTextSizeLarge:"大", studyTextSizeHuge:"特大",
  studyTextSpacingTight:"詰める", studyTextSpacingNormal:"行間ふつう", studyTextSpacingLoose:"行間広め",
  studyTextWidthNarrow:"余白せまい", studyTextWidthNormal:"余白ふつう", studyTextWidthWide:"余白広い",
  studyTextTuneHint:"縦書き・ルーズリーフにも同じ設定が効きます。",
  studyZoomFit:"フィット", studyZoomValue:"{n}%", studyZoomHint:"Ctrl+ホイール・ピンチでも拡大できます。拡大した画像は↑ / ↓やホイールで送れます。",
  studyPageKeysTurnPages:"PageUP、PageDownをページ動作にする", studyPageKeysTurnPagesHint:"オフ（初期値）では、倍率に関係なく、はみ出した画像の上端／下端へ移動します。端で押し直すと前／次のページを続きの端から開き、本の端では全画面を終了して本棚へ戻ります（最後のページで閉じるかは下の設定で変更できます）。オンでは直接ページを送ります。縦読み・テキスト・画面に収まる画像は従来どおりです。",
  studyCloseOnLastPageDown:"最後のページ時PageDownで本を閉じる", studyCloseOnLastPageDownHint:"画像の端へ移動する操作で、最後のページの下端からもう一度PageDownを押すと、本を閉じて全画面を終了します（初期オン）。オフなら下端で止まります。先頭ページでのPageUp・中クリックの設定は変更しません。",
  studyMouseClickPages:"PCの簡易操作：左右クリックでページを送る", studyMouseClickPagesHint:"左クリックで次のページ、右クリックで前のページ。画像の本のときだけ働きます（ページ上の位置は選びません）。",
  studyMouseClickFlip:"左右を反転（右クリックで進む・左クリックで戻る）", studyMouseClickFlipHint:"トラックボールや左利きの人向け。上の「左右クリックでページを送る」がオンのときだけ選べます。",
  studyMiddleClickLabel:"マウスの中クリック", studyMiddleClickNone:"何もしない", studyMiddleClickNext:"次のページへ",
  studyMiddleClickClose:"閉じて本棚へ（全画面を終了）", studyMiddleClickNextHint:"画像の本のときだけ働きます（ブラウザの自動スクロールは止めます）。",
  studyZoomStepLabel:"拡大の送り幅", studyZoomStepOption:"{n}%", studyZoomStepHint:"−／＋・Ctrl+ホイール・ピンチの1回ぶんです（初期値5%＝100%→200%が20回）。",
  studyTvLookLabel:"TVの見た目", studyTvLookPlain:"素の画面", studyTvLookCrt:"ブラウン管", studyTvLookWood:"木枠",
  studyTvLookArcade:"アーケード", studyTvLookProjector:"プロジェクター", studyTvLookAquarium:"水槽",
  studyTvSizeLabel:"大きさ", studyTvSizeSmall:"小", studyTvSizeMedium:"中", studyTvSizeLarge:"大",
  studyTvRatioLabel:"画面比", studyTvRatio169:"16:9", studyTvRatio43:"4:3", studyTvRatio219:"21:9", studyTvNameToggle:"曲名を表示",
  studyTextStats:"{chars}字 · {lines}行", studyImageOrderLabel:"ページの順序", studyImageOrderNatural:"ファイル名順",
  studyImageOrderReverse:"逆順（右綴じ向け）", studyOrphanSweep:"未使用の画像データを整理しました（{n}件）。"
});
Object.assign(TEXT.en, {
  studyTitle:"📚 Study", studyOpenBtn:"📚 Study", studyOpenBtnHint:"Open Study (shelf, TV and the image reader). You can also hold the Songs heading", studyLaunchHint:"Hold ♫ Songs to open Study (press Enter when focused)",
  /* 📂 trk208: share a folder and read it in place (no copy) */
  studyShareFolder:"📂 Share a folder and read it",
  studyFolderScanning:"📂 Scanning “{name}”… {n} images",
  studyFolderAdded:"📂 Added {books} books ({pages} pages) from “{name}”. Pages are read straight from the folder — nothing is copied onto this device.",
  studyFolderDenied:"📂 Permission to read the folder was not granted (cancelling changes nothing).",
  studyFolderUnsupported:"This browser cannot remember a folder. Use “🖼 Import image folder” to copy the images instead (Chrome/Edge can share a folder).",
  studyFolderMissing:"📂 The folder “{name}” was not found. Pick the same folder again with 📂 and these books will read it.",
  studyFolderPermission:"📂 Reading “{name}” is no longer permitted. Pick the same folder again with 📂.",
  studyFolderPageMissing:"“{name}” could not be loaded (it may have been moved or deleted inside the folder).",
  studyLinkedBadge:"📂 {name} (read in place)",
  studyClose:"✕ Close Study", studyImportImages:"🖼 Import image folder", studyImportTextFiles:"＋ Add text files",
  studyImportTextFolder:"📄 Import text folder", studyShelf:"Bookshelf", studySearch:"Search titles and folders…",
  studyImportArchives:"🗜 Import CBZ/ZIP", studyArchiveBad:"“{name}” could not be read (it may be damaged or encrypted).", studyArchiveNoImages:"No supported images were found in “{name}”.",
  studyImportWithNote:"{summary} ({note})",
  studyShelfEmpty:"Your shelf is empty. Import an image folder or TXT / MD / JSON files.",
  studyWelcomeTitle:"Choose something to read", studyWelcomeHint:"Images are saved by folder and text files individually on this device. Nothing is uploaded.",
  studyWelcomeHelp:"If you get lost, open “❓ Shortcuts” at the top right.",
  studySupported:"Images: JPG / PNG / WebP / GIF / AVIF / BMP · Text: TXT / MD / JSON / CSV / HTML / XML, and more",
  studyTapHint:"Tap left / → for next · tap right / ← for previous (🇺🇸 reverses tap sides) · Space / Enter for next · hold Enter for a bookmark · hold Space for page seek · Esc to exit",
  studyVerticalHint:"Scroll or swipe vertically to read · Space / Enter for next · hold Enter for a bookmark · A for auto-scroll · Esc to exit",
  studyAutoScrollStart:"⏩ Auto-scroll", studyAutoScrollStop:"⏸ Stop auto-scroll",
  studyAutoScrollSpeedLabel:"Auto-scroll speed",
  studyAutoSpeedSlowest:"Slowest", studyAutoSpeedSlow:"Slow", studyAutoSpeedNormal:"Normal", studyAutoSpeedFast:"Fast", studyAutoSpeedFastest:"Fastest",
  studyAutoScrollSpeedHint:"Speed of “⏩ Auto-scroll” in vertical comic mode, in pixels per second. Changes apply live while it runs. A tap or a navigation key (↑↓, Space, Page Up / Down …) stops it.",
  studyAutoScrollStarted:"Auto-scroll started · tap or press ↑↓ / Space / Page Up·Down to stop",
  studyAutoScrollEnd:"Last page reached · auto-scroll stopped",
  studyAutoScrollNeedVertical:"Auto-scroll is only available in vertical comic mode",
  studyHelpAuto:"Start / stop auto-scroll for vertical reading (vertical comic mode only)",
  studyReadBrightnessLabel:"Brightness (reading)", studyReadContrastLabel:"Contrast (reading)", studyReadSpecialLabel:"Special filter (reading)",
  studyReadSpecialNone:"None", studyReadSpecialInvert:"Invert", studyReadSpecialGrayscale:"Grayscale", studyReadSpecialSepia:"Sepia",
  studyReadFilterHint:"Applies a CSS filter to the reading surfaces only (images and text). Independent of the full-screen fit and the zoom. The shelf and menus are unchanged. Defaults: 100% / 100% / none.",
  studyBack:"← Bookshelf", studyFullscreen:"⛶ Full-screen image", studyModeLabel:"Image layout",
  studyModeSingle:"Single page (centered)", studyModeSpread:"Two-page spread (page 1 on right)", studyModeVertical:"Vertical comic",
  studyAmerican:"🇺🇸 American mode (reverse sides and order)", studyThemeLabel:"Text skin",
  studyThemePlain:"Plain text", studyThemeDark:"Dark mode", studyThemeNeon:"Neon", studyThemeLined:"Loose-leaf paper",
  studyThemeGenko:"Manuscript paper (vertical, right to left)", studyThemeSticky:"Sticky note", studyThemeLetter:"Letter paper", studyThemeDiary:"Diary", studyThemeHaiku:"Haiku strip (tanzaku)", studyThemeNewspaper:"Newspaper (column rules)", studyThemeStaff:"Sheet music margin (staff)",
  studyThemeGroupWriter:"✍ Writing & reading", studyThemeGroupCode:"⌨ Coding",
  studyThemeGroupAi:"◈ AI / prompt aesthetics (visual only)", studyThemeGroupFree:"✦ Freeform",
  studyThemePaper:"Washi paper", studyThemeWarm:"Warm cream", studyThemeSepia:"Antique book",
  studyThemeMidnight:"Midnight", studyThemeTerminal:"Terminal green", studyThemeGraphite:"Graphite",
  studyThemeBlueprint:"Blueprint", studyThemeContrast:"High contrast", studyThemePrompt:"Prompt lab",
  studyThemeNeural:"Neural grid", studyThemeLatent:"Latent space", studyThemeMatrix:"Token matrix",
  studyThemeSynth:"Synthesis", studyThemeAurora:"Aurora", studyThemeSunset:"Sunset",
  studyThemeOcean:"Deep ocean", studyThemeMint:"Mint", studyThemeDream:"Dream", studyThemePrism:"Prism",
  studyTvToggle:"Watch TV while reading", studyTvPosLabel:"TV position",
  studyTvTop:"Top", studyTvBottom:"Bottom", studyTvHidden:"Hide TV", studyTvEmpty:"The current video or song cover appears here.",
  studyTvCaption:"Shows the current song or video without starting a second audio stream.",
  studyTvHint:"(hold an image to make it this song's cover)",
  studyBookmark:"🔖 Save bookmark", studyBookmarkSaved:"🔖 Bookmark saved.", studyBookmarkError:"Could not save the bookmark.",
  studyFullscreenFit:"Always fit images to the screen in full screen", studyFullscreenFitHint:"Off by default. In full screen, show the whole image without changing its aspect ratio and disable zoom controls. Each side of a spread fits separately; vertical mode fits one image at a time. Leaving full screen restores your original zoom.",
  studySettings:"⚙ Settings", studyMemoEdit:"✎ Edit copy", studyMemoDone:"Finish editing", studyExportText:"⇩ Export text copy",
  studyMemoSaved:"Saved the Study copy.", studyMemoSaveError:"Could not save the Study copy.",
  studyEditorLabel:"Text editor", studyEditorSafety:"You are editing a local Study copy. The original is untouched; JS / HTML are never run and Markdown is not rendered. Tab indents · Ctrl / ⌘+S saves · Esc returns to reading.",
  studyEditorUnsaved:"Unsaved changes · auto-save pending", studyEditorSaving:"Saving…", studyEditorSaved:"Saved in Study",
  studyEditorSaveFailed:"Save failed. Export a text copy before leaving the editor.",
  studyEditedTextFolderLabel:"Bookshelf folder for edited text", studyEditedTextFolderKeep:"Keep the current location",
  studyEditedTextFolderHint:"When selected, successfully saved text books are organized in this bookshelf folder. Text stays in Study's local browser storage; the original file is unchanged.",
  studyTextFiledInFolder:"Filed the edited book in “{folder}”.", studyEditedTextFolderSaveFailed:"The text was saved, but its bookshelf folder could not be updated.",
  studyExportFolderLabel:"Export location on this device", studyChooseExportFolder:"Choose export folder", studyClearExportFolder:"Clear",
  studyExportFolderNone:"Not selected (browser downloads)", studyExportFolderSelected:"Selected: {name} (this session only)",
  studyExportFolderHint:"A new file is created in the chosen folder. If its name already exists, a different name is used; existing files are never overwritten. Unsupported browsers use a normal download instead.",
  studyExportSavedToFolder:"Exported “{name}” to “{folder}”.", studyExportFolderSelectError:"Could not select an export folder.",
  studyExportFolderFallback:"Could not save in the selected folder, so a normal download was started instead.",
  studyNext:"◀ Next", studyNextRight:"Next ▶", studyPrevious:"Previous ▶", studyPreviousLeft:"◀ Previous",
  studyNextRightOnly:"Next ▶", studyPreviousLeftOnly:"◀ Previous", studyProgressDone:"Done",
  studyAssignCover:"🖼 Set this page as song cover", studyCoverAssigned:"Set as the cover for “{title}”.",
  studyCoverNeedSong:"Select a song first.", studyCoverNeedImage:"Open an image page first.", studyCoverError:"Could not save the cover.",
  studyDelete:"Delete", studyRename:"Rename", studyOpen:"Open", studyBookImages:"Image album", studyBookText:"Text",
  studyPageCount:"{n} images", studyPagesStatus:"{current} / {total}", studyPageRange:"{first}–{last} / {total}", studyPageLabel:"Page",
  studyTextProgress:"{n}%", studyRenamePrompt:"New title", studyRenamed:"Renamed.",
  studyDeleteConfirm:"Remove “{title}” from this shelf?", studyDeleted:"Removed from the shelf.", studyReplace:"“{title}” is already on the shelf. Replace it?",
  studyImportProgress:"Importing… {n} / {total}", studyImportDone:"Added {n} item(s) to the shelf.",
  studyNoImageFiles:"No supported images were found in that folder.", studyNoTextFiles:"No supported text files were found.",
  studyNoSearchResults:"No matching books found.", studyTextBatchLimit:"You can import up to 200 text files at once.", studyShelfLimit:"The shelf is limited to 500 books.",
  studyTooMany:"An image album is limited to {max} images and {mb} MB total.", studyFileTooBig:"“{name}” is too large (maximum {mb} MB per file).",
  studyTextTooBig:"“{name}” is too large (maximum {mb} MB per file).", studyDecodeError:"Could not decode “{name}” as text.",
  studyStorageError:"Browser storage failed. Check available device storage.", studyImageLoadError:"Could not load this image. Please import it again.",
  studySafeMode:"Study data is not loaded in safe mode. Open the app normally to use Study.", studyProgressHint:"Move the seek bar to jump to a page.",
  studyBookmarked:"Resumed from bookmark.", studyMemoNeedText:"Notepad editing is available for text books only.", studyFullscreenExit:"Close full screen",
  studyHelp:"❓ Shortcuts", studyHelpTitle:"Study shortcuts", studyHelpClose:"Close",
  studyHelpNav:"→ goes forward and ← goes back (reassignable in Settings). Tapping an image's left/right side follows the binding direction. Text scrolls instead. You can also make the middle mouse button go forward.",
  studyHelpSpace:"Next page. Hold for the page seek bar (images) or to save a bookmark (text).",
  studyHelpPg:"Images: jump to the top / bottom at any zoom, then press again at an edge for the previous / next page (close to the shelf at book ends; closing at the last page can be disabled in Settings). Holding stops at the edge. Settings can switch to direct page turns. Vertical mode, text and images that fit keep their usual behavior. Home / End: first / last.",
  studyHelpZoom:"Zoom in, out, and fit for images (not used in vertical comic mode). Ctrl+wheel and pinch work too; scroll a zoomed image with ↑ / ↓ or the wheel. The step size is in ⚙ Settings (1–25%, 5% by default).",
  studyHelpSearch:"Search inside a text book (Enter = next match, Shift+Enter = previous match).",
  studyHelpBookmark:"B = add or remove a bookmark, M = toggle the bookmark list.",
  studyHelpTv:"T = cycle the TV (top → bottom → hidden), F = full-screen image.",
  studyHelpEsc:"? = this help, Esc = close settings or help / close Study.",
  studySortLabel:"Sort", studySortUpdated:"Recently updated", studySortAdded:"Oldest added first", studySortTitle:"Title",
  studySortType:"Type (images first)", studySortSize:"Largest first", studyMore:"Show {n} more",
  studyFolderCreateHint:"Click or hold to create a new folder", studyCreateFolderPrompt:"Enter a name for the new folder.",
  studyRenameFolderPrompt:"New folder name", studyFolderCreated:"Folder created.", studyFolderDuplicate:"A folder with that name already exists.",
  studyFolderLimit:"You can create up to 200 folders.", studyFolderNameRequired:"Enter a folder name.", studyFolderCount:"{n} books",
  studyFolderBack:"← Back to bookshelf", studyFolderEmpty:"This folder is empty. Drag books here to move them in.", studyFolderOpen:"Open folder",
  studyFolderRename:"Rename folder", studyFolderDelete:"Delete folder (keep its books)",
  studyFolderDeleted:"Folder deleted; its books were moved back to the bookshelf.",
  studyShelfDragHint:"Drag ⋮⋮ to move items. Turn off automatic sorting to reorder; drop an item on a folder to move it.",
  studyKeepShelfVisible:"Keep the bookshelf visible outside full screen.", studyShelfVisibilityHint:"Turn this off to hide the shelf. Use “Show bookshelf” in the header to bring it back at any time.",
  studyShowShelf:"📚 Show bookshelf", studyNextKeyLabel:"Next", studyPreviousKeyLabel:"Previous", studyKeyChange:"Change", studyKeyPressKey:"Press a key · Esc to cancel",
  studyVerticalImageKeys:"Use ↑ / ↓ to navigate image pages", studyKeyAssignmentHint:"Select a button, then press the key to use. Arrows, letters, digits, Page Up / Down, Home and End are supported; built-in shortcut keys cannot be assigned.",
  studyKeyCaptureHint:"Press the key to assign to {action}. Esc cancels.", studyKeyAssigned:"{action} key set to “{key}”.",
  studyKeyInvalid:"That key cannot be assigned. Press a different key.", studyKeyConflict:"Choose different keys for Next and Previous.",
  studyKeyButtonLabel:"The {action} key is {key}. Activate to change it.", studyKeyButtonCaptureLabel:"Assigning the {action} key. Press a key; Esc cancels.",
  studyDragHandle:"Drag to move or reorder", studyShelfMoved:"Bookshelf arrangement updated.",
  studyNoSort:"Disable automatic sorting (arrange manually).", studyFoldersFirst:"Show folders at the top.",
  studyNoDeleteConfirm:"Skip confirmation when deleting.", studyManualOrderHint:"Turn off automatic sorting, then drag folders and books into any order.",
  studyStorageInfo:"{books} books · {images} images · Study {size}", studyStorageFree:"{books} books · {images} images · Study {size} (about {free} free)",
  studyBookmarks:"🔖 Bookmarks", studyBookmarkCount:"{n} bookmarks",
  studyBookmarksEmpty:"No bookmarks yet. While reading, hold Enter (or press the 🔖 button) to add one.",
  studyBookmarksHint:"One bookmark per book; press it to continue from there.",
  studyBookmarkOpenAt:"Open at page {n}", studyBookmarkOpenText:"Open about {n}% from the top",
  studyBookmarkRemove:"Remove bookmark", studyBookmarkRemoved:"Bookmark removed.",
  studyImportCancel:"Cancel", studyImportCancelled:"Import cancelled. The {n} book(s) already saved are kept.",
  studyImportAsk:"{count} book(s) with the same name are already on the shelf. Replace their contents? (Choose Cancel to import only the new books.)",
  studyImportSummary:"Done: {added} added · {kept} kept · {failed} failed",
  studyQuotaError:"Not enough free space on this device. Remove some large albums or books and try again.",
  studyAlbumNestingLabel:"Album splitting", studyAlbumNestingSplit:"One book per subfolder", studyAlbumNestingFlat:"One book for the whole folder",
  studyAlbumNestingHint:"Applies from the next import.",
  studyClearCover:"🗑 Remove cover", studyCoverCleared:"Cover removed.", studyCoverNeedCover:"This song has no Study cover yet.",
  studyCoverSource:"Study cover: {title} (page {n})", studyCoverHoldHint:"Hold an image to make it this song's cover.",
  studyBookSearchPlaceholder:"Search in this book…", studyBookSearchCount:"{n} / {m}", studyBookSearchNone:"No matches",
  studyBookSearchClear:"✕ End search", studyBookSearchPrev:"Previous match", studyBookSearchNext:"Next match",
  studyBookSearchHint:"Enter = next match · Shift+Enter = previous match · Esc = end search",
  studyTextTuneLabel:"Text", studyTextSizeSmall:"S", studyTextSizeNormal:"M", studyTextSizeLarge:"L", studyTextSizeHuge:"XL",
  studyTextSpacingTight:"Tight", studyTextSpacingNormal:"Normal", studyTextSpacingLoose:"Loose",
  studyTextWidthNarrow:"Narrow", studyTextWidthNormal:"Normal", studyTextWidthWide:"Wide",
  studyTextTuneHint:"These also apply to manuscript paper and loose-leaf.",
  studyZoomFit:"Fit", studyZoomValue:"{n}%", studyZoomHint:"Ctrl+wheel and pinch also zoom. Scroll a zoomed image with ↑ / ↓ or the wheel.",
  studyPageKeysTurnPages:"Use PageUp / PageDown to turn pages", studyPageKeysTurnPagesHint:"Off by default: at any zoom level, jump to the top / bottom of an overflowing image. Press again at an edge to open the previous / next page from the far edge; at the ends of the book, leave full screen and return to the shelf (closing at the last page is configurable below). Enable to turn pages directly. Vertical mode, text and images that fit keep their usual behavior.",
  studyCloseOnLastPageDown:"Close the book with PageDown on the last page", studyCloseOnLastPageDownHint:"When using image-edge navigation, press PageDown again at the bottom of the last page to close the book and leave full screen (on by default). Turn off to stop at the bottom. PageUp at the start and the middle-click setting are unchanged.",
  studyMouseClickPages:"Simple PC operation: the left / right click turns pages", studyMouseClickPagesHint:"Left click for the next page, right click for the previous page. Image books only (where you click does not matter).",
  studyMouseClickFlip:"Swap the sides (right click forward, left click back)", studyMouseClickFlipHint:"For trackballs and left-handed use. Only available while the option above is on.",
  studyMiddleClickLabel:"Middle mouse click", studyMiddleClickNone:"Nothing", studyMiddleClickNext:"Next page",
  studyMiddleClickClose:"Close to the shelf (leave full screen)", studyMiddleClickNextHint:"Only for image books (the browser's auto-scroll is suppressed).",
  studyZoomStepLabel:"Zoom step", studyZoomStepOption:"{n}%", studyZoomStepHint:"How much one press of − / ＋, Ctrl+wheel, or a pinch changes the zoom (default 5% = 20 steps from 100% to 200%).",
  studyTvLookLabel:"TV look", studyTvLookPlain:"Plain screen", studyTvLookCrt:"CRT", studyTvLookWood:"Wood frame",
  studyTvLookArcade:"Arcade", studyTvLookProjector:"Projector", studyTvLookAquarium:"Aquarium",
  studyTvSizeLabel:"Size", studyTvSizeSmall:"S", studyTvSizeMedium:"M", studyTvSizeLarge:"L",
  studyTvRatioLabel:"Aspect", studyTvRatio169:"16:9", studyTvRatio43:"4:3", studyTvRatio219:"21:9", studyTvNameToggle:"Show song title",
  studyTextStats:"{chars} chars · {lines} lines", studyImageOrderLabel:"Page order", studyImageOrderNatural:"File name order",
  studyImageOrderReverse:"Reversed (right-binding)", studyOrphanSweep:"Cleaned up {n} unused image(s)."
});
Object.assign(TEXT.zh, {
  studyTitle:"📚 书斋", studyOpenBtn:"📚 书斋", studyOpenBtnHint:"打开书斋（书架、电视和图片阅读器）。长按歌曲列表标题也可以打开", studyLaunchHint:"长按♫歌曲列表打开书斋（键盘聚焦后按 Enter）",
  /* 📂 trk208：共享文件夹并“就地阅读”（不复制） */
  studyShareFolder:"📂 共享文件夹并阅读",
  studyFolderScanning:"📂 正在检查「{name}」… {n}张",
  studyFolderAdded:"📂 已从「{name}」把 {books}本书（{pages}页）放上书架。页面直接从文件夹读取（不复制到设备）。",
  studyFolderDenied:"📂 未获得读取文件夹的许可（取消时不会有任何改变）。",
  studyFolderUnsupported:"此浏览器无法记住文件夹。请使用「🖼 导入图片文件夹」复制导入（Chrome／Edge 可以共享）。",
  studyFolderMissing:"📂 找不到文件夹「{name}」。请用 📂 再次选择同一个文件夹，就能以同一本书阅读。",
  studyFolderPermission:"📂 「{name}」的读取许可已失效。请用 📂 再次选择同一个文件夹。",
  studyFolderPageMissing:"无法读取「{name}」（可能已在文件夹中被移动或删除）。",
  studyLinkedBadge:"📂 {name}（原地阅读）",
  studyClose:"✕ 关闭书斋", studyImportImages:"🖼 导入图片文件夹", studyImportTextFiles:"＋ 添加文本文件",
  studyImportTextFolder:"📄 导入文本文件夹", studyShelf:"书架", studySearch:"搜索标题或文件夹…",
  studyImportArchives:"🗜 导入 CBZ/ZIP", studyArchiveBad:"无法读取“{name}”（可能已损坏或已加密）。", studyArchiveNoImages:"“{name}”中没有受支持的图片。",
  studyImportWithNote:"{summary}（{note}）",
  studyShelfEmpty:"书架为空。请导入图片文件夹或 TXT / MD / JSON。",
  studyWelcomeTitle:"选择要阅读的内容", studyWelcomeHint:"图片按文件夹、文本按文件分别保存在本设备中，不会上传。",
  studyWelcomeHelp:"如果忘记操作，请打开右上角的「❓ 按键说明」。",
  studySupported:"图片: JPG / PNG / WebP / GIF / AVIF / BMP · 文本: TXT / MD / JSON / CSV / HTML / XML 等",
  studyTapHint:"点击图片左侧／→ 下一页 · 点击右侧／← 上一页（🇺🇸模式会反转点击位置） · Space / Enter 下一页 · 长按 Enter 添加书签 · 长按 Space 跳页 · Esc 退出",
  studyVerticalHint:"上下滚动或滑动阅读 · Space / Enter 下一页 · 长按 Enter 书签 · A 自动滚动 · Esc 退出",
  studyAutoScrollStart:"⏩ 自动滚动", studyAutoScrollStop:"⏸ 停止自动滚动",
  studyAutoScrollSpeedLabel:"自动滚动速度",
  studyAutoSpeedSlowest:"最慢", studyAutoSpeedSlow:"较慢", studyAutoSpeedNormal:"普通", studyAutoSpeedFast:"较快", studyAutoSpeedFastest:"最快",
  studyAutoScrollSpeedHint:"纵向阅读模式下“⏩ 自动滚动”的速度（像素/秒）。运行中更改会立即生效。轻触屏幕或按移动键（↑↓、Space、Page Up / Down 等）即可停止。",
  studyAutoScrollStarted:"自动滚动已开始 · 轻触或按 ↑↓ / Space / PageUp·PageDown 停止",
  studyAutoScrollEnd:"已到最后一页 · 自动滚动已停止",
  studyAutoScrollNeedVertical:"自动滚动仅在纵向漫画模式下可用",
  studyHelpAuto:"开始 / 停止纵向阅读的自动滚动（仅纵向漫画模式）",
  studyReadBrightnessLabel:"亮度（阅读）", studyReadContrastLabel:"对比度（阅读）", studyReadSpecialLabel:"特殊滤镜（阅读）",
  studyReadSpecialNone:"无", studyReadSpecialInvert:"反色", studyReadSpecialGrayscale:"灰度", studyReadSpecialSepia:"棕褐",
  studyReadFilterHint:"仅对阅读表面（图片和文字）应用 CSS 滤镜。与全屏适应和缩放倍率无关，书架和菜单不变。默认为 100% / 100% / 无。",
  studyBack:"← 书架", studyFullscreen:"⛶ 图片全屏", studyModeLabel:"图片排列方式", studyModeSingle:"单页（居中）",
  studyModeSpread:"双页（第一页在右）", studyModeVertical:"纵向漫画", studyAmerican:"🇺🇸 美式模式（左右与顺序反转）",
  studyThemeLabel:"文字主题", studyThemePlain:"普通文本", studyThemeDark:"深色模式", studyThemeNeon:"霓虹",
  studyThemeLined:"活页纸", studyThemeGenko:"作文纸（竖排，从右向左）", studyThemeSticky:"便利贴", studyThemeLetter:"信纸", studyThemeDiary:"日记本", studyThemeHaiku:"俳句短笺", studyThemeNewspaper:"报纸版面（分栏线）", studyThemeStaff:"乐谱空白（五线）",
  studyThemeGroupWriter:"✍ 写作与阅读", studyThemeGroupCode:"⌨ 编程",
  studyThemeGroupAi:"◈ AI／提示词风格（仅外观）", studyThemeGroupFree:"✦ 自由创作",
  studyThemePaper:"和纸", studyThemeWarm:"暖奶油纸", studyThemeSepia:"古籍", studyThemeMidnight:"午夜",
  studyThemeTerminal:"终端绿", studyThemeGraphite:"石墨灰", studyThemeBlueprint:"蓝图", studyThemeContrast:"高对比",
  studyThemePrompt:"提示词实验室", studyThemeNeural:"神经网络网格", studyThemeLatent:"潜空间",
  studyThemeMatrix:"Token矩阵", studyThemeSynth:"合成", studyThemeAurora:"极光", studyThemeSunset:"日落",
  studyThemeOcean:"深海", studyThemeMint:"薄荷", studyThemeDream:"梦境", studyThemePrism:"棱镜",
  studyTvToggle:"边阅读边看电视", studyTvPosLabel:"电视位置",
  studyTvTop:"上方", studyTvBottom:"下方", studyTvHidden:"不显示", studyTvEmpty:"此处显示当前视频或歌曲封面。",
  studyTvCaption:"显示当前歌曲或视频，不会另外启动一条音频流。", studyTvHint:"（长按图片可设为这首歌的封面）",
  studyBookmark:"🔖 添加书签", studyBookmarkSaved:"🔖 已保存书签。", studyBookmarkError:"无法保存书签。",
  studyFullscreenFit:"全屏时强制图片适应屏幕", studyFullscreenFitHint:"默认关闭。开启后，全屏时保持宽高比显示完整图片，并禁用缩放操作。双页分别适应，纵向阅读每张图片适应一屏。退出全屏后恢复原来的缩放比例。",
  studySettings:"⚙ 设置", studyMemoEdit:"✎ 编辑副本", studyMemoDone:"结束编辑", studyExportText:"⇩ 导出文本副本",
  studyMemoSaved:"已保存书斋副本。", studyMemoSaveError:"无法保存书斋副本。",
  studyEditorLabel:"文本编辑器", studyEditorSafety:"正在编辑书斋中的本地副本。原文件不会更改；JS / HTML绝不执行，Markdown也不会渲染成格式化内容。Tab缩进 · Ctrl / ⌘+S保存 · Esc返回阅读。",
  studyEditorUnsaved:"有未保存的更改 · 即将自动保存", studyEditorSaving:"正在保存…", studyEditorSaved:"已保存到书斋",
  studyEditorSaveFailed:"保存失败。离开编辑器前，请先导出文本副本。",
  studyEditedTextFolderLabel:"已编辑文本的书架文件夹", studyEditedTextFolderKeep:"不自动移动（保留当前位置）",
  studyEditedTextFolderHint:"选择后，成功保存的文本书籍会整理到此书架文件夹。正文保存在书斋的本地浏览器存储中，原文件不会更改。",
  studyTextFiledInFolder:"已将编辑的书籍整理到“{folder}”。", studyEditedTextFolderSaveFailed:"正文已保存，但无法更新书架文件夹。",
  studyExportFolderLabel:"导出位置（此设备）", studyChooseExportFolder:"选择导出文件夹", studyClearExportFolder:"清除",
  studyExportFolderNone:"未选择（使用浏览器下载）", studyExportFolderSelected:"已选择：{name}（仅本次运行有效）",
  studyExportFolderHint:"将在所选文件夹中新建文件。若文件名已存在，会使用其他名称；绝不覆盖现有文件。不支持此功能的浏览器会改用普通下载。",
  studyExportSavedToFolder:"已将“{name}”导出到“{folder}”。", studyExportFolderSelectError:"无法选择导出文件夹。",
  studyExportFolderFallback:"无法保存到所选文件夹，已改为启动普通下载。",
  studyNext:"◀ 下一页", studyNextRight:"下一页 ▶", studyPrevious:"上一页 ▶", studyPreviousLeft:"◀ 上一页",
  studyNextRightOnly:"下一页 ▶", studyPreviousLeftOnly:"◀ 上一页", studyProgressDone:"完成",
  studyAssignCover:"🖼 将此页设为歌曲封面", studyCoverAssigned:"已设为“{title}”的封面。", studyCoverNeedSong:"请先选择一首歌曲。",
  studyCoverNeedImage:"请先打开图片页面。", studyCoverError:"无法保存封面。", studyDelete:"删除", studyRename:"重命名", studyOpen:"打开",
  studyBookImages:"图片相册", studyBookText:"文本", studyPageCount:"{n} 张图片", studyPagesStatus:"{current} / {total}",
  studyPageRange:"{first}–{last} / {total}", studyPageLabel:"页", studyTextProgress:"{n}%", studyRenamePrompt:"新标题",
  studyRenamed:"已重命名。", studyDeleteConfirm:"要从书架删除“{title}”吗？", studyDeleted:"已从书架删除。", studyReplace:"书架中已有“{title}”。要替换吗？",
  studyImportProgress:"正在导入… {n} / {total}", studyImportDone:"已添加 {n} 项。", studyNoImageFiles:"该文件夹中没有受支持的图片。",
  studyNoTextFiles:"没有找到受支持的文本文件。", studyNoSearchResults:"没有匹配的书籍。", studyTextBatchLimit:"一次最多可导入 200 个文本文件。",
  studyShelfLimit:"书架最多保存 500 本书。", studyTooMany:"每个图片相册最多 {max} 张、总计 {mb} MB。",
  studyFileTooBig:"“{name}”太大（每个文件最多 {mb} MB）。", studyTextTooBig:"“{name}”太大（每个文件最多 {mb} MB）。",
  studyDecodeError:"无法将“{name}”解码为文本。", studyStorageError:"浏览器存储失败，请检查设备可用空间。",
  studyImageLoadError:"无法加载此图片，请重新导入。", studySafeMode:"安全模式下不会读取书斋数据。请正常打开应用。",
  studyProgressHint:"拖动进度条可跳转页面。", studyBookmarked:"已从书签继续阅读。", studyMemoNeedText:"只有文本书籍可以用记事本编辑。",
  studyFullscreenExit:"退出全屏", studyHelp:"❓ 按键说明", studyHelpTitle:"书斋的按键操作", studyHelpClose:"关闭",
  studyHelpNav:"→ 前进，← 后退（可在设置中重新指定）。点击图片左右侧仍按装订方向翻页。文本会滚动。也可以设置用鼠标中键前进。",
  studyHelpSpace:"下一页。长按：图片=页码跳转条，文本=添加书签。",
  studyHelpPg:"图片：无论缩放比例，移到上端／下端，在端点再次按下则翻到上一页／下一页（书的首尾返回书架；可在设置中关闭末页的关闭动作）。长按会停在端点。可在设置中改为直接翻页。纵向阅读、文本和未超出画面的图片保持原有操作。Home / End：最前／最后。",
  studyHelpZoom:"图片的放大、缩小、适应（纵向漫画不使用）。也支持 Ctrl+滚轮和双指缩放；放大的图片可用 ↑ / ↓ 或滚轮滚动。每次幅度在 ⚙ 设置中（1–25%，默认5%）。",
  studyHelpSearch:"在文本书中搜索（Enter=下一个匹配，Shift+Enter=上一个匹配）。",
  studyHelpBookmark:"B=添加或移除书签，M=开关书签列表。",
  studyHelpTv:"T=切换电视显示（上→下→隐藏），F=图片全屏。",
  studyHelpEsc:"?=此说明，Esc=关闭设置或说明／关闭书斋。",
  studySortLabel:"排序", studySortUpdated:"最近更新", studySortAdded:"最早添加", studySortTitle:"名称", studySortType:"按类型（图片优先）",
  studySortSize:"从大到小", studyMore:"再显示 {n} 本",
  studyFolderCreateHint:"点击或长按以创建新文件夹", studyCreateFolderPrompt:"请输入新文件夹名称。",
  studyRenameFolderPrompt:"新文件夹名称", studyFolderCreated:"文件夹已创建。", studyFolderDuplicate:"已存在同名文件夹。",
  studyFolderLimit:"最多可创建 200 个文件夹。", studyFolderNameRequired:"请输入文件夹名称。", studyFolderCount:"{n} 本",
  studyFolderBack:"← 返回书架", studyFolderEmpty:"此文件夹为空。将书籍拖到这里即可移入。", studyFolderOpen:"打开文件夹",
  studyFolderRename:"重命名文件夹", studyFolderDelete:"删除文件夹（保留其中的书籍）",
  studyFolderDeleted:"文件夹已删除，其中的书籍已移回书架。",
  studyShelfDragHint:"拖动 ⋮⋮ 可移动项目。关闭自动排序后可手动排序；拖放到文件夹即可移入。",
  studyKeepShelfVisible:"非全屏时显示书架。", studyShelfVisibilityHint:"取消勾选即可隐藏书架。随时可点击标题栏中的“显示书架”将其恢复。",
  studyShowShelf:"📚 显示书架", studyNextKeyLabel:"下一页", studyPreviousKeyLabel:"上一页", studyKeyChange:"更改", studyKeyPressKey:"请按一个按键 · Esc 取消",
  studyVerticalImageKeys:"使用 ↑ / ↓ 浏览图片页面", studyKeyAssignmentHint:"点击按钮后按下要使用的按键。支持方向键、字母、数字、Page Up / Down、Home 和 End；不能使用内置快捷键。",
  studyKeyCaptureHint:"请按下要分配给“{action}”的按键。Esc 取消。", studyKeyAssigned:"已将“{action}”设为“{key}”。",
  studyKeyInvalid:"无法分配此按键，请按其他按键。", studyKeyConflict:"“下一页”和“上一页”必须使用不同的按键。",
  studyKeyButtonLabel:"“{action}”按键为 {key}。点击可更改。", studyKeyButtonCaptureLabel:"正在设置“{action}”按键。请按键；Esc 取消。",
  studyDragHandle:"拖动以移动或排序", studyShelfMoved:"书架排列已更新。",
  studyNoSort:"不使用自动排序（手动排列）。", studyFoldersFirst:"将文件夹显示在顶部。",
  studyNoDeleteConfirm:"删除时不再确认。", studyManualOrderHint:"关闭自动排序后，可拖动文件夹和书籍自由排列。",
  studyStorageInfo:"{books} 本 · 图片 {images} 张 · 书斋 {size}",
  studyStorageFree:"{books} 本 · 图片 {images} 张 · 书斋 {size}（可用约 {free}）", studyBookmarks:"🔖 书签列表", studyBookmarkCount:"书签 {n} 个",
  studyBookmarksEmpty:"还没有书签。阅读时长按 Enter（或按 🔖 按钮）即可添加。", studyBookmarksHint:"每本书一个书签，点击即从该位置继续阅读。",
  studyBookmarkOpenAt:"从第 {n} 页打开", studyBookmarkOpenText:"从约 {n}% 的位置打开", studyBookmarkRemove:"移除书签", studyBookmarkRemoved:"已移除书签。",
  studyImportCancel:"中止", studyImportCancelled:"已中止导入。已保存的 {n} 本会保留。",
  studyImportAsk:"书架中已有 {count} 本同名书籍。要替换内容吗？（选择“取消”则只导入新书）",
  studyImportSummary:"完成: 新增 {added} 本 · 保留 {kept} 本 · 失败 {failed} 项",
  studyQuotaError:"设备可用空间不足。请删除一些较大的相册或书籍后重试。",
  studyAlbumNestingLabel:"相册拆分方式", studyAlbumNestingSplit:"每个子文件夹一本书", studyAlbumNestingFlat:"整个文件夹一本书",
  studyAlbumNestingHint:"从下次导入开始生效。", studyClearCover:"🗑 移除封面", studyCoverCleared:"已移除封面。",
  studyCoverNeedCover:"这首歌还没有书斋封面。", studyCoverSource:"书斋封面: {title}（第 {n} 页）", studyCoverHoldHint:"长按图片可设为这首歌的封面。",
  studyBookSearchPlaceholder:"在本书中搜索…", studyBookSearchCount:"{n} / {m}", studyBookSearchNone:"未找到",
  studyBookSearchClear:"✕ 结束搜索", studyBookSearchPrev:"上一个匹配", studyBookSearchNext:"下一个匹配",
  studyBookSearchHint:"Enter=下一个 · Shift+Enter=上一个 · Esc=结束搜索",
  studyTextTuneLabel:"文字", studyTextSizeSmall:"小", studyTextSizeNormal:"中", studyTextSizeLarge:"大", studyTextSizeHuge:"特大",
  studyTextSpacingTight:"紧凑", studyTextSpacingNormal:"行距普通", studyTextSpacingLoose:"行距宽松",
  studyTextWidthNarrow:"边距窄", studyTextWidthNormal:"边距普通", studyTextWidthWide:"边距宽",
  studyTextTuneHint:"竖排与活页纸也同样生效。", studyZoomFit:"适应", studyZoomValue:"{n}%", studyZoomHint:"也可用 Ctrl+滚轮和双指缩放。放大的图片可用 ↑ / ↓ 或滚轮滚动。",
  studyPageKeysTurnPages:"用 PageUp / PageDown 翻页", studyPageKeysTurnPagesHint:"默认关闭：无论缩放比例，跳到超出画面的图片上端／下端。在端点再次按下，从另一端打开上一页／下一页；到书的首尾时退出全屏返回书架（末页的关闭动作可在下方设置）。开启后直接翻页。纵向阅读、文本和未超出画面的图片保持原有操作。",
  studyCloseOnLastPageDown:"在最后一页按 PageDown 关闭书籍", studyCloseOnLastPageDownHint:"使用图片端点导航时，在最后一页下端再次按 PageDown 会关闭书籍并退出全屏（默认开启）。关闭此设置则停在下端。首页的 PageUp 和中键设置不变。",
  studyMouseClickPages:"PC 简易操作：左右键点击翻页", studyMouseClickPagesHint:"左键下一页，右键上一页。仅对图片书有效（点击位置不限）。",
  studyMouseClickFlip:"左右互换（右键前进、左键后退）", studyMouseClickFlipHint:"适合轨迹球和左手使用。仅在上面的选项开启时可选。",
  studyMiddleClickLabel:"鼠标中键", studyMiddleClickNone:"什么也不做", studyMiddleClickNext:"下一页",
  studyMiddleClickClose:"关闭并返回书架（退出全屏）", studyMiddleClickNextHint:"仅对图片书有效（会关闭浏览器的自动滚动）。",
  studyZoomStepLabel:"缩放步长", studyZoomStepOption:"{n}%", studyZoomStepHint:"−／＋、Ctrl+滚轮或双指缩放每次的幅度（默认5%＝从100%到200%需20次）。",
  studyTvLookLabel:"电视外观", studyTvLookPlain:"素屏", studyTvLookCrt:"显像管", studyTvLookWood:"木框", studyTvLookArcade:"街机",
  studyTvLookProjector:"投影仪", studyTvLookAquarium:"水族箱", studyTvSizeLabel:"大小", studyTvSizeSmall:"小", studyTvSizeMedium:"中", studyTvSizeLarge:"大",
  studyTvRatioLabel:"画面比", studyTvRatio169:"16:9", studyTvRatio43:"4:3", studyTvRatio219:"21:9", studyTvNameToggle:"显示曲名",
  studyTextStats:"{chars} 字 · {lines} 行", studyImageOrderLabel:"页面顺序", studyImageOrderNatural:"文件名顺序",
  studyImageOrderReverse:"倒序（右开本）", studyOrphanSweep:"已整理 {n} 个未使用的图片数据。"
});
Object.assign(TEXT.ko, {
  studyTitle:"📚 서재", studyOpenBtn:"📚 서재", studyOpenBtnHint:"서재(책장, TV, 이미지 리더)를 엽니다. 곡 목록 제목을 길게 눌러도 열립니다", studyLaunchHint:"♫ 곡 목록을 길게 눌러 서재 열기 (키보드에서는 Enter)",
  /* 📂 trk208: 폴더를 공유해 '폴더 그대로' 읽기(복사 없음) */
  studyShareFolder:"📂 폴더를 공유해서 읽기",
  studyFolderScanning:"📂 '{name}'을(를) 살펴보는 중… {n}장",
  studyFolderAdded:"📂 '{name}'에서 {books}권({pages}쪽)을 책장에 올렸습니다. 페이지는 폴더에서 바로 읽습니다(기기로 복사하지 않음).",
  studyFolderDenied:"📂 폴더 읽기 권한이 허용되지 않았습니다(취소하면 아무것도 바뀌지 않습니다).",
  studyFolderUnsupported:"이 브라우저는 폴더를 기억할 수 없습니다. '🖼 이미지 폴더 가져오기'로 복사해 주세요(Chrome/Edge는 공유 가능).",
  studyFolderMissing:"📂 '{name}' 폴더를 찾을 수 없습니다. 📂로 같은 폴더를 다시 고르면 같은 책으로 읽을 수 있습니다.",
  studyFolderPermission:"📂 '{name}'의 읽기 권한이 만료되었습니다. 📂로 같은 폴더를 다시 골라 주세요.",
  studyFolderPageMissing:"'{name}'을(를) 읽지 못했습니다(폴더 안에서 이동·삭제되었을 수 있습니다).",
  studyLinkedBadge:"📂 {name} (폴더 그대로)",
  studyClose:"✕ 서재 닫기", studyImportImages:"🖼 이미지 폴더 가져오기", studyImportTextFiles:"＋ 텍스트 파일 추가",
  studyImportTextFolder:"📄 텍스트 폴더 가져오기", studyShelf:"책장", studySearch:"제목·폴더 검색…",
  studyImportArchives:"🗜 CBZ/ZIP 가져오기", studyArchiveBad:"“{name}”을(를) 읽을 수 없습니다 (손상되었거나 암호화되었을 수 있습니다).", studyArchiveNoImages:"“{name}”에서 지원되는 이미지를 찾지 못했습니다.",
  studyImportWithNote:"{summary} ({note})",
  studyShelfEmpty:"책장이 비어 있습니다. 이미지 폴더 또는 TXT / MD / JSON을 가져오세요.",
  studyWelcomeTitle:"읽을 항목을 선택하세요", studyWelcomeHint:"이미지는 폴더별로, 텍스트는 파일별로 이 기기에 저장합니다. 업로드하지 않습니다.",
  studyWelcomeHelp:"조작이 헷갈리면 오른쪽 위의 「❓ 키 설명」을 열어 보세요.",
  studySupported:"이미지: JPG / PNG / WebP / GIF / AVIF / BMP · 텍스트: TXT / MD / JSON / CSV / HTML / XML 등",
  studyTapHint:"이미지 왼쪽 누르기／→ 다음 · 오른쪽 누르기／← 이전 (🇺🇸에서는 누르는 위치 반전) · Space / Enter 다음 · Enter 길게 눌러 책갈피 · Space 길게 눌러 이동 · Esc 종료",
  studyVerticalHint:"위아래로 스크롤하거나 밀어서 읽기 · Space / Enter 다음 · Enter 길게 눌러 책갈피 · A 자동 스크롤 · Esc 종료",
  studyAutoScrollStart:"⏩ 자동 스크롤", studyAutoScrollStop:"⏸ 자동 스크롤 중지",
  studyAutoScrollSpeedLabel:"자동 스크롤 속도",
  studyAutoSpeedSlowest:"가장 느림", studyAutoSpeedSlow:"느림", studyAutoSpeedNormal:"보통", studyAutoSpeedFast:"빠름", studyAutoSpeedFastest:"가장 빠름",
  studyAutoScrollSpeedHint:"세로 읽기 모드에서 “⏩ 자동 스크롤”의 속도(초당 픽셀). 실행 중에 바꿔도 바로 적용됩니다. 화면을 터치하거나 이동 키(↑↓, Space, Page Up / Down 등)로 중지할 수 있습니다.",
  studyAutoScrollStarted:"자동 스크롤 시작 · 탭 또는 ↑↓ / Space / PageUp·PageDown으로 중지",
  studyAutoScrollEnd:"마지막 페이지에 도착 · 자동 스크롤을 중지했습니다",
  studyAutoScrollNeedVertical:"자동 스크롤은 세로형 만화 모드에서만 사용할 수 있습니다",
  studyHelpAuto:"세로 읽기 자동 스크롤 시작 / 중지(세로형 만화 모드 전용)",
  studyReadBrightnessLabel:"밝기(독서)", studyReadContrastLabel:"명암 대비(독서)", studyReadSpecialLabel:"특수 필터(독서)",
  studyReadSpecialNone:"없음", studyReadSpecialInvert:"반전", studyReadSpecialGrayscale:"그레이스케일", studyReadSpecialSepia:"세피아",
  studyReadFilterHint:"읽는 화면(이미지와 텍스트)에만 CSS 필터를 적용합니다. 전체 화면 맞춤 및 확대율과는 독립이며 책장과 메뉴는 변하지 않습니다. 기본값은 100% / 100% / 없음.",
  studyBack:"← 책장", studyFullscreen:"⛶ 이미지 전체 화면", studyModeLabel:"이미지 배열", studyModeSingle:"한 페이지 (중앙)",
  studyModeSpread:"두 페이지 (첫 페이지 오른쪽)", studyModeVertical:"세로형 만화", studyAmerican:"🇺🇸 미국식 (좌우와 순서 반전)",
  studyThemeLabel:"텍스트 스킨", studyThemePlain:"일반 텍스트", studyThemeDark:"다크 모드", studyThemeNeon:"네온",
  studyThemeLined:"루즈리프", studyThemeGenko:"원고지 (세로쓰기·오른쪽부터)", studyThemeSticky:"포스트잇", studyThemeLetter:"편지지", studyThemeDiary:"일기장", studyThemeHaiku:"하이쿠 단자쿠", studyThemeNewspaper:"신문 지면 (단 구분선)", studyThemeStaff:"악보 여백 (오선)",
  studyThemeGroupWriter:"✍ 글쓰기와 독서", studyThemeGroupCode:"⌨ 코딩",
  studyThemeGroupAi:"◈ AI·프롬프트 분위기 (외관만)", studyThemeGroupFree:"✦ 자유로운 발상",
  studyThemePaper:"화지", studyThemeWarm:"웜 크림", studyThemeSepia:"앤티크 북", studyThemeMidnight:"미드나이트",
  studyThemeTerminal:"터미널 그린", studyThemeGraphite:"그라파이트", studyThemeBlueprint:"블루프린트", studyThemeContrast:"고대비",
  studyThemePrompt:"프롬프트 랩", studyThemeNeural:"뉴럴 그리드", studyThemeLatent:"잠재 공간",
  studyThemeMatrix:"토큰 매트릭스", studyThemeSynth:"신시시스", studyThemeAurora:"오로라", studyThemeSunset:"선셋",
  studyThemeOcean:"딥 오션", studyThemeMint:"민트", studyThemeDream:"드림", studyThemePrism:"프리즘",
  studyTvToggle:"읽으면서 TV 보기", studyTvPosLabel:"TV 위치",
  studyTvTop:"위", studyTvBottom:"아래", studyTvHidden:"표시 안 함", studyTvEmpty:"현재 영상 또는 곡 커버가 여기에 표시됩니다.",
  studyTvCaption:"현재 곡이나 영상을 표시합니다. 별도의 오디오 스트림을 재생하지 않습니다.", studyTvHint:"(이미지를 길게 누르면 이 곡의 커버로 지정됩니다)",
  studyBookmark:"🔖 책갈피 저장", studyBookmarkSaved:"🔖 책갈피를 저장했습니다.", studyBookmarkError:"책갈피를 저장하지 못했습니다.",
  studyFullscreenFit:"전체 화면에서 이미지를 화면에 강제로 맞추기", studyFullscreenFitHint:"기본 꺼짐. 켜면 전체 화면에서 비율을 유지하며 이미지 전체를 표시하고 확대·축소를 비활성화합니다. 펼침은 좌우 각각, 세로 읽기는 한 장씩 화면에 맞춥니다. 전체 화면을 종료하면 원래 배율로 돌아갑니다.",
  studySettings:"⚙ 설정", studyMemoEdit:"✎ 사본 편집", studyMemoDone:"편집 마치기", studyExportText:"⇩ 텍스트 사본 내보내기",
  studyMemoSaved:"서재 사본을 저장했습니다.", studyMemoSaveError:"서재 사본을 저장하지 못했습니다.",
  studyEditorLabel:"텍스트 편집기", studyEditorSafety:"서재의 로컬 사본을 편집합니다. 원본 파일은 바뀌지 않습니다. JS / HTML은 실행하지 않고 Markdown도 서식으로 렌더링하지 않습니다. Tab 들여쓰기 · Ctrl / ⌘+S 저장 · Esc 읽기로 돌아가기.",
  studyEditorUnsaved:"저장되지 않은 변경 사항 · 자동 저장 대기 중", studyEditorSaving:"저장 중…", studyEditorSaved:"서재에 저장됨",
  studyEditorSaveFailed:"저장하지 못했습니다. 편집기를 나가기 전에 텍스트 사본을 내보내세요.",
  studyEditedTextFolderLabel:"편집한 텍스트를 넣을 책장 폴더", studyEditedTextFolderKeep:"자동 이동 안 함 (현재 위치 유지)",
  studyEditedTextFolderHint:"선택하면 저장된 텍스트 책을 이 책장 폴더로 정리합니다. 내용은 서재의 로컬 브라우저 저장소에 보관하며 원본 파일은 바꾸지 않습니다.",
  studyTextFiledInFolder:"편집한 책을 “{folder}” 폴더에 정리했습니다.", studyEditedTextFolderSaveFailed:"본문은 저장했지만 책장 폴더를 업데이트하지 못했습니다.",
  studyExportFolderLabel:"기기의 내보내기 위치", studyChooseExportFolder:"내보내기 폴더 선택", studyClearExportFolder:"해제",
  studyExportFolderNone:"선택 안 함 (브라우저 다운로드 사용)", studyExportFolderSelected:"선택됨: {name} (이번 실행 중에만)",
  studyExportFolderHint:"선택한 폴더에 새 파일을 만듭니다. 같은 이름이 있으면 다른 이름을 사용하며 기존 파일은 덮어쓰지 않습니다. 미지원 브라우저에서는 일반 다운로드를 사용합니다.",
  studyExportSavedToFolder:"“{name}”을(를) “{folder}”에 내보냈습니다.", studyExportFolderSelectError:"내보내기 폴더를 선택하지 못했습니다.",
  studyExportFolderFallback:"선택한 폴더에 저장하지 못해 일반 다운로드를 시작했습니다.",
  studyNext:"◀ 다음", studyNextRight:"다음 ▶", studyPrevious:"이전 ▶", studyPreviousLeft:"◀ 이전",
  studyNextRightOnly:"다음 ▶", studyPreviousLeftOnly:"◀ 이전", studyProgressDone:"완료",
  studyAssignCover:"🖼 이 페이지를 곡 커버로 지정", studyCoverAssigned:"“{title}”의 커버로 지정했습니다.",
  studyCoverNeedSong:"먼저 곡을 선택하세요.", studyCoverNeedImage:"먼저 이미지 페이지를 여세요.", studyCoverError:"커버를 저장하지 못했습니다.",
  studyDelete:"삭제", studyRename:"이름 변경", studyOpen:"열기", studyBookImages:"이미지 앨범", studyBookText:"텍스트",
  studyPageCount:"이미지 {n}장", studyPagesStatus:"{current} / {total}", studyPageRange:"{first}–{last} / {total}", studyPageLabel:"페이지",
  studyTextProgress:"{n}%", studyRenamePrompt:"새 제목", studyRenamed:"이름을 변경했습니다.",
  studyDeleteConfirm:"“{title}”을(를) 책장에서 삭제할까요?", studyDeleted:"책장에서 삭제했습니다.", studyReplace:"책장에 “{title}”이(가) 있습니다. 바꿀까요?",
  studyImportProgress:"가져오는 중… {n} / {total}", studyImportDone:"{n}개 항목을 책장에 추가했습니다.",
  studyNoImageFiles:"폴더에서 지원되는 이미지를 찾지 못했습니다.", studyNoTextFiles:"지원되는 텍스트 파일을 찾지 못했습니다.",
  studyNoSearchResults:"일치하는 책이 없습니다.", studyTextBatchLimit:"한 번에 최대 200개의 텍스트 파일을 가져올 수 있습니다.",
  studyShelfLimit:"책장은 최대 500권까지 저장할 수 있습니다.", studyTooMany:"이미지 앨범은 최대 {max}장, 총 {mb}MB까지입니다.",
  studyFileTooBig:"“{name}” 파일이 너무 큽니다 (파일당 최대 {mb}MB).", studyTextTooBig:"“{name}” 파일이 너무 큽니다 (파일당 최대 {mb}MB).",
  studyDecodeError:"“{name}”을(를) 텍스트로 디코딩하지 못했습니다.", studyStorageError:"브라우저 저장에 실패했습니다. 기기 여유 공간을 확인하세요.",
  studyImageLoadError:"이미지를 불러오지 못했습니다. 다시 가져오세요.", studySafeMode:"안전 모드에서는 서재 데이터를 읽지 않습니다. 앱을 일반 모드로 여세요.",
  studyProgressHint:"탐색 막대를 움직여 페이지를 이동할 수 있습니다.", studyBookmarked:"책갈피 위치에서 다시 시작했습니다.",
  studyMemoNeedText:"텍스트 책에서만 메모장 편집을 사용할 수 있습니다.", studyFullscreenExit:"전체 화면 닫기",
  studyHelp:"❓ 키 설명", studyHelpTitle:"서재 키 조작", studyHelpClose:"닫기",
  studyHelpNav:"→ 다음, ← 이전 (설정에서 다시 지정할 수 있습니다). 이미지의 좌우를 누르면 제본 방향에 따라 넘깁니다. 텍스트는 스크롤합니다. 마우스 가운데 버튼으로 다음으로 가는 설정도 있습니다.",
  studyHelpSpace:"다음 페이지. 길게 누르면 이미지=페이지 이동 막대, 텍스트=책갈피 저장입니다.",
  studyHelpPg:"이미지: 배율과 관계없이 위끝/아래끝으로 이동하고, 끝에서 다시 누르면 이전/다음 페이지로 이동합니다 (책의 처음/끝에서는 책장으로; 마지막 페이지에서 닫기는 설정에서 끌 수 있습니다). 길게 누르면 끝에서 멈춥니다. 설정에서 바로 페이지 넘기기로 바꿀 수 있습니다. 세로 읽기, 텍스트, 화면에 맞는 이미지는 기존 동작을 유지합니다. Home / End: 처음/마지막.",
  studyHelpZoom:"이미지 확대·축소·맞춤 (세로형 만화에서는 사용하지 않습니다). Ctrl+휠과 핀치도 가능하며, 확대한 이미지는 ↑ / ↓ 또는 휠로 이동합니다. 한 번의 폭은 ⚙ 설정 (1–25%, 기본 5%).",
  studyHelpSearch:"텍스트 책의 본문 검색 (Enter=다음 일치, Shift+Enter=이전 일치).",
  studyHelpBookmark:"B=책갈피 저장·해제, M=책갈피 목록 열기/닫기.",
  studyHelpTv:"T=TV 표시 전환 (위→아래→숨김), F=이미지 전체 화면.",
  studyHelpEsc:"?=이 설명, Esc=설정·설명 닫기/서재 닫기.",
  studySortLabel:"정렬", studySortUpdated:"최근 업데이트순", studySortAdded:"오래된 추가순", studySortTitle:"이름순",
  studySortType:"종류별 (이미지 먼저)", studySortSize:"큰 순", studyMore:"{n}권 더 보기",
  studyFolderCreateHint:"클릭하거나 길게 눌러 새 폴더 만들기", studyCreateFolderPrompt:"새 폴더 이름을 입력하세요.",
  studyRenameFolderPrompt:"새 폴더 이름", studyFolderCreated:"폴더를 만들었습니다.", studyFolderDuplicate:"같은 이름의 폴더가 이미 있습니다.",
  studyFolderLimit:"폴더는 최대 200개까지 만들 수 있습니다.", studyFolderNameRequired:"폴더 이름을 입력하세요.", studyFolderCount:"{n}권",
  studyFolderBack:"← 책장으로 돌아가기", studyFolderEmpty:"폴더가 비어 있습니다. 책을 여기로 끌어 놓아 이동할 수 있습니다.", studyFolderOpen:"폴더 열기",
  studyFolderRename:"폴더 이름 변경", studyFolderDelete:"폴더 삭제 (책은 보관)",
  studyFolderDeleted:"폴더를 삭제하고 책을 책장으로 옮겼습니다.",
  studyShelfDragHint:"⋮⋮를 끌어 항목을 이동하세요. 자동 정렬을 끄면 순서를 바꿀 수 있고, 폴더에 놓으면 폴더로 이동합니다.",
  studyKeepShelfVisible:"전체 화면이 아닐 때 책장 표시", studyShelfVisibilityHint:"선택을 해제하면 책장을 숨깁니다. 제목 표시줄의 ‘책장 표시’를 눌러 언제든 다시 열 수 있습니다.",
  studyShowShelf:"📚 책장 표시", studyNextKeyLabel:"다음", studyPreviousKeyLabel:"이전", studyKeyChange:"변경", studyKeyPressKey:"키를 누르세요 · Esc 취소",
  studyVerticalImageKeys:"이미지 페이지를 ↑ / ↓로 이동", studyKeyAssignmentHint:"버튼을 누른 뒤 사용할 키를 누르세요. 방향키, 영문자, 숫자, Page Up / Down, Home, End를 사용할 수 있으며 기본 단축키는 지정할 수 없습니다.",
  studyKeyCaptureHint:"‘{action}’에 지정할 키를 누르세요. Esc를 누르면 취소됩니다.", studyKeyAssigned:"‘{action}’ 키를 ‘{key}’로 지정했습니다.",
  studyKeyInvalid:"지정할 수 없는 키입니다. 다른 키를 누르세요.", studyKeyConflict:"다음과 이전에는 서로 다른 키를 지정하세요.",
  studyKeyButtonLabel:"{action} 키는 {key}입니다. 눌러서 변경하세요.", studyKeyButtonCaptureLabel:"{action} 키 지정 중입니다. 키를 누르세요. Esc로 취소합니다.",
  studyDragHandle:"끌어서 이동 또는 정렬", studyShelfMoved:"책장 배치를 업데이트했습니다.",
  studyNoSort:"자동 정렬 사용 안 함 (직접 배치).", studyFoldersFirst:"폴더를 위에 표시합니다.",
  studyNoDeleteConfirm:"삭제할 때 확인하지 않습니다.", studyManualOrderHint:"자동 정렬을 끄면 폴더와 책을 끌어서 자유롭게 배치할 수 있습니다.",
  studyStorageInfo:"{books}권 · 이미지 {images}장 · 서재 {size}", studyStorageFree:"{books}권 · 이미지 {images}장 · 서재 {size} (여유 약 {free})",
  studyBookmarks:"🔖 책갈피 목록", studyBookmarkCount:"책갈피 {n}개",
  studyBookmarksEmpty:"책갈피를 저장한 책이 없습니다. 읽으면서 Enter를 길게 누르면(또는 🔖 버튼) 저장됩니다.",
  studyBookmarksHint:"책갈피는 책마다 하나이며, 누르면 그 위치에서 이어 읽습니다.",
  studyBookmarkOpenAt:"{n}페이지부터 열기", studyBookmarkOpenText:"앞에서 약 {n}% 위치부터 열기",
  studyBookmarkRemove:"책갈피 해제", studyBookmarkRemoved:"책갈피를 해제했습니다.",
  studyImportCancel:"중단", studyImportCancelled:"가져오기를 중단했습니다. 저장된 {n}권은 그대로 남습니다.",
  studyImportAsk:"같은 이름의 책이 {count}권 있습니다. 내용을 바꿀까요? (취소하면 새 책만 가져옵니다)",
  studyImportSummary:"완료: {added}권 추가 · {kept}권 유지 · {failed}건 실패",
  studyQuotaError:"기기 여유 공간이 부족합니다. 큰 앨범이나 책을 줄인 뒤 다시 시도해 주세요.",
  studyAlbumNestingLabel:"앨범 분리 방식", studyAlbumNestingSplit:"하위 폴더마다 한 권", studyAlbumNestingFlat:"폴더 전체를 한 권으로",
  studyAlbumNestingHint:"다음 가져오기부터 적용됩니다.",
  studyClearCover:"🗑 커버 해제", studyCoverCleared:"커버를 해제했습니다.", studyCoverNeedCover:"이 곡에는 아직 서재 커버가 없습니다.",
  studyCoverSource:"서재 커버: {title} ({n}페이지)", studyCoverHoldHint:"이미지를 길게 누르면 이 곡의 커버가 됩니다.",
  studyBookSearchPlaceholder:"이 책에서 검색…", studyBookSearchCount:"{n} / {m}", studyBookSearchNone:"찾지 못했습니다",
  studyBookSearchClear:"✕ 검색 종료", studyBookSearchPrev:"이전 일치", studyBookSearchNext:"다음 일치",
  studyBookSearchHint:"Enter=다음 · Shift+Enter=이전 · Esc=검색 종료",
  studyTextTuneLabel:"글자", studyTextSizeSmall:"작게", studyTextSizeNormal:"보통", studyTextSizeLarge:"크게", studyTextSizeHuge:"아주 크게",
  studyTextSpacingTight:"좁게", studyTextSpacingNormal:"줄간격 보통", studyTextSpacingLoose:"줄간격 넓게",
  studyTextWidthNarrow:"여백 좁게", studyTextWidthNormal:"여백 보통", studyTextWidthWide:"여백 넓게",
  studyTextTuneHint:"세로쓰기와 루즈리프에도 함께 적용됩니다.",
  studyZoomFit:"맞춤", studyZoomValue:"{n}%", studyZoomHint:"Ctrl+휠과 핀치로도 확대할 수 있습니다. 확대한 이미지는 ↑ / ↓ 또는 휠로 이동합니다.",
  studyPageKeysTurnPages:"PageUp / PageDown으로 페이지 넘기기", studyPageKeysTurnPagesHint:"기본값은 꺼짐: 배율과 관계없이 화면을 넘는 이미지의 위끝/아래끝으로 이동합니다. 끝에서 다시 누르면 이전/다음 페이지를 반대쪽 끝에서 열고, 책의 처음/끝에서는 전체 화면을 종료하고 책장으로 돌아갑니다 (마지막 페이지에서 닫기는 아래에서 설정). 켜면 바로 페이지를 넘깁니다. 세로 읽기, 텍스트, 화면에 맞는 이미지는 기존 동작을 유지합니다.",
  studyCloseOnLastPageDown:"마지막 페이지에서 PageDown으로 책 닫기", studyCloseOnLastPageDownHint:"이미지 끝으로 이동하는 동작에서, 마지막 페이지 아래끝에서 PageDown을 다시 누르면 책을 닫고 전체 화면을 종료합니다 (기본 켜짐). 끄면 아래끝에서 멈춥니다. 첫 페이지의 PageUp과 가운데 클릭 설정은 바뀌지 않습니다.",
  studyMouseClickPages:"PC 간편 조작: 좌우 클릭으로 페이지 넘기기", studyMouseClickPagesHint:"왼쪽 클릭은 다음 페이지, 오른쪽 클릭은 이전 페이지. 이미지 책에서만 동작합니다 (클릭 위치는 상관없습니다).",
  studyMouseClickFlip:"좌우 반전 (오른쪽 클릭으로 앞으로, 왼쪽 클릭으로 뒤로)", studyMouseClickFlipHint:"트랙볼이나 왼손 사용자용. 위의 옵션이 켜져 있을 때만 고를 수 있습니다.",
  studyMiddleClickLabel:"마우스 가운데 클릭", studyMiddleClickNone:"아무것도 안 함", studyMiddleClickNext:"다음 페이지",
  studyMiddleClickClose:"닫고 책장으로 (전체 화면 종료)", studyMiddleClickNextHint:"이미지 책에서만 동작합니다 (브라우저 자동 스크롤은 막습니다).",
  studyZoomStepLabel:"확대 폭", studyZoomStepOption:"{n}%", studyZoomStepHint:"− / ＋, Ctrl+휠, 핀치 한 번의 폭입니다 (기본 5% = 100%→200%가 20번).",
  studyTvLookLabel:"TV 외형", studyTvLookPlain:"기본 화면", studyTvLookCrt:"브라운관", studyTvLookWood:"나무 프레임",
  studyTvLookArcade:"아케이드", studyTvLookProjector:"프로젝터", studyTvLookAquarium:"수조",
  studyTvSizeLabel:"크기", studyTvSizeSmall:"작게", studyTvSizeMedium:"보통", studyTvSizeLarge:"크게",
  studyTvRatioLabel:"화면비", studyTvRatio169:"16:9", studyTvRatio43:"4:3", studyTvRatio219:"21:9", studyTvNameToggle:"곡명 표시",
  studyTextStats:"{chars}자 · {lines}행", studyImageOrderLabel:"페이지 순서", studyImageOrderNatural:"파일명 순",
  studyImageOrderReverse:"역순 (오른쪽 제본)", studyOrphanSweep:"사용하지 않는 이미지 데이터 {n}개를 정리했습니다."
});

const STUDY_UTIL = window.TrkStudyUtils;
const STUDY_DB_NAME = "trk_study_room_v1";
const STUDY_STORES = ["books", "pages", "covers", "settings"];
const STUDY_IMAGE_MAX_COUNT = 3000, STUDY_IMAGE_MAX_BYTES = 600 * 1024 * 1024, STUDY_IMAGE_FILE_MAX = 100 * 1024 * 1024;
const STUDY_TEXT_FILE_MAX = 12 * 1024 * 1024, STUDY_TEXT_BATCH_MAX = 200, STUDY_BATCH_WRITE = 40;
const STUDY_SHELF_MAX = 500, STUDY_SHELF_PAGE = 60, STUDY_SEARCH_MARK_MAX = 1500;
/* 容量の上限（trk137）：設定「容量の上限を無視」がオンなら、アプリが決めた上限を外す。ブラウザの空き容量は別。 */
function studyCap(max) { return core.storageLimitsIgnored() ? Infinity : max; }
const STUDY_ZOOM_MIN = 0.5, STUDY_ZOOM_MAX = 4;
/* 拡大の送り幅（％）。−／＋・Ctrl+ホイール・ピンチの「1回ぶん」です。
   既定は5%（100%→200%が20回）。1%＝細かく見たいとき〜25%＝大きく変えたいとき。 */
const STUDY_ZOOM_PERCENT_STEPS = [1, 2, 5, 10, 25];
const STUDY_ZOOM_PERCENT_DEFAULT = 5;
function studyZoomPercentStep(value) {
  const number = Math.round(Number(value));
  return STUDY_ZOOM_PERCENT_STEPS.includes(number) ? number : STUDY_ZOOM_PERCENT_DEFAULT;
}
const STUDY_TEXT_SIZE = { small:0.88, normal:1, large:1.18, huge:1.4 };
const STUDY_TEXT_LEADING = { tight:1.6, normal:1.9, loose:2.3 };
const STUDY_TEXT_PAD = { narrow:0.5, normal:1, wide:1.7 };
const STUDY_TV_LOOKS = ["plain", "crt", "wood", "arcade", "projector", "aquarium"];
const STUDY_TV_MAX = { small:"18vh", medium:"26vh", large:"36vh" };
const STUDY_TV_WIDTH = { small:"min(100%,560px)", medium:"100%", large:"100%" };
const STUDY_TV_RATIO = { "16:9":"16 / 9", "4:3":"4 / 3", "21:9":"21 / 9" };
const STUDY_IMAGE_MODES = ["single", "spread", "vertical"];
const STUDY_THEMES = [
  "plain", "paper", "warm", "lined", "genko", "sepia", "sticky", "letter", "diary", "haiku", "newspaper",
  "dark", "midnight", "terminal", "graphite", "blueprint", "contrast",
  "prompt", "neural", "latent", "matrix", "synth",
  "neon", "aurora", "sunset", "ocean", "mint", "dream", "prism", "staff"
];
const STUDY_SORTS = ["updated", "added", "title", "type", "size"];
const STUDY_MIDDLE_CLICK_ACTIONS = ["none", "next", "close"];   /* 中クリックの設定（trk124で選択式に） */
const STUDY_FOLDER_MAX = 200;
const STUDY_DEFAULT_NEXT_KEY = "ArrowRight", STUDY_DEFAULT_PREVIOUS_KEY = "ArrowLeft";
const STUDY_RESERVED_KEYS = new Set(["Escape", "Tab", "Space", "Enter", "NumpadEnter", "KeyA", "KeyB", "KeyM", "KeyT", "KeyF",
  "Equal", "NumpadAdd", "Minus", "NumpadSubtract", "Digit0", "Numpad0", "Slash"]);
/* trk175: 縦読みの自動スクロール（PLAYER-ROADMAP #12）。速度は px/秒の決まった候補だけ。 */
const STUDY_AUTO_SCROLL_SPEEDS = [20, 45, 75, 120, 180], STUDY_AUTO_SCROLL_SPEED_DEFAULT = 75;
/* 押したら自動スクロールを止めるキー（A 自身はトグルなので studyKeyDown で別扱い）。 */
const STUDY_AUTO_SCROLL_STOP_CODES = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", "Space", "Enter", "NumpadEnter"]);
/* trk175-176: 読書用フィルタ（明るさ/コントラスト/反転系）の候補。百分率は 50〜150 にクランプする。 */
const STUDY_READ_SPECIALS = ["none", "invert", "grayscale", "sepia"];
function studyKeyCodeAllowed(code) {
  return typeof code === "string" && !STUDY_RESERVED_KEYS.has(code) &&
    (/^Arrow(?:Left|Right|Up|Down)$/.test(code) || /^Key[A-Z]$/.test(code) || /^Digit[1-9]$/.test(code) ||
      /^Numpad[1-9]$/.test(code) || ["PageUp", "PageDown", "Home", "End"].includes(code));
}
function studyKeyCodeLabel(code) {
  return ({ ArrowLeft:"←", ArrowRight:"→", ArrowUp:"↑", ArrowDown:"↓" })[code] ||
    (/^Key[A-Z]$/.test(code) ? code.slice(3) : /^Digit[1-9]$/.test(code) ? code.slice(5) : /^Numpad[1-9]$/.test(code) ? `Num ${code.slice(6)}` : code);
}

let studyDbPromise = null;
let studyBooks = [], studyCurrentBook = null, studyCurrentPage = 0;
let studyVerticalBookId = "", studyVerticalObserver = null, studyVerticalScrollTimer = 0;
let studyZoomLand = "";   /* ページを移ったあとに開く位置（top／bottom）。画像の高さが決まってから当てる */
let studyMemoSaveTimer = 0, studyProgressTimer = 0, studyRenderToken = 0, studyImageLoadSeq = 0;
let studyRoomOpen = false, studyClosePending = false, studyTVToken = 0, studyTVArtUrl = "", studyTVArtSong = "";
let studyHoldTimer = 0, studyHeldCode = "", studyHoldAction = "", studySuppressTapUntil = 0;
let studyPointerStart = null;
let studyVideoHomeParent = null, studyVideoHomeNext = null, studyVideoHomeStyle = null, studyFullscreenFallback = false;
let studyShelfShown = STUDY_SHELF_PAGE, studyBookmarkMode = false, studySweepBusy = false, studySweepAt = 0;
let studyShelfFolders = [], studyBookFolder = Object.create(null), studyShelfOrder = Object.create(null), studyShelfViewFolder = "";
let studyShelfDragged = null, studyDataReady = false;
let studyKeyCaptureAction = "", studyExportDirectory = null;
let studyPointers = new Map(), studyPinchStart = 0, studyPinchZoom = 1;
let studyLastPointerType = "";   /* 直前の pointerdown の種類（mouse／touch／pen）。PCの簡易操作はマウスだけに効かせる */
let studySearchState = { query:"", marks:[], index:-1, capped:false };
let studyImportState = { active:false, cancelled:false, total:0, added:0, kept:0, failed:0 };
const studyObjectUrls = new Set();
let studyPrefs = { imageMode:"single", imageOrder:"natural", american:false, zoom:1, zoomPercentStep:STUDY_ZOOM_PERCENT_DEFAULT, theme:"plain",
  textSize:"normal", textSpacing:"normal", textWidth:"normal", tvEnabled:false, tvPosition:"top", tvLook:"plain",
  tvSize:"medium", tvRatio:"16:9", tvLabelOn:true, shelfSort:"updated", albumNesting:"split",
  manualShelfOrder:false, foldersFirst:false, skipDeleteConfirm:false, shelfVisible:true, verticalImageKeys:false, studyAutoScrollSpeed:STUDY_AUTO_SCROLL_SPEED_DEFAULT,
  readBrightness:100, readContrast:100, readSpecial:"none",
  fullscreenFit:false, pageKeysTurnPages:false, closeOnLastPageDown:true, mouseClickPages:false, mouseClickFlip:false, middleClickAction:"none", editedTextFolderId:"",
  studyNextKey:STUDY_DEFAULT_NEXT_KEY, studyPreviousKey:STUDY_DEFAULT_PREVIOUS_KEY, helpSeen:false };

/* ============ 保存（IndexedDB） ============ */
function studySafeMode() { return typeof window.TrkSafeMode === "function" && window.TrkSafeMode(); }
function studyDBOpen() {
  if (!window.indexedDB) return Promise.reject(new Error("IndexedDB is unavailable"));
  if (studyDbPromise) return studyDbPromise;
  studyDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(STUDY_DB_NAME, 1);
    request.onupgradeneeded = () => {
      for (const name of STUDY_STORES) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => { studyDbPromise = null; reject(request.error || new Error("Could not open Study storage")); };
    request.onblocked = () => { studyDbPromise = null; reject(new Error("Study storage is blocked")); };
  });
  return studyDbPromise;
}
function studyDBRun(storeName, mode, operation) {
  return studyDBOpen().then(db => new Promise((resolve, reject) => {
    let settled = false, result;
    const tx = db.transaction(storeName, mode);
    const done = (fn, value) => { if (!settled) { settled = true; fn(value); } };
    tx.oncomplete = () => done(resolve, result);
    tx.onerror = () => done(reject, tx.error || new Error("Study storage request failed"));
    tx.onabort = () => done(reject, tx.error || new Error("Study storage transaction was aborted"));
    try {
      const request = operation(tx.objectStore(storeName));
      if (request && typeof request === "object" && "onsuccess" in request) {
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => done(reject, request.error || new Error("Study storage request failed"));
      }
    } catch (error) {
      try { tx.abort(); } catch (_) {}
      done(reject, error);
    }
  }));
}
function studyDBBatch(storeName, entries) {
  return studyDBOpen().then(db => new Promise((resolve, reject) => {
    let settled = false;
    const tx = db.transaction(storeName, "readwrite"), store = tx.objectStore(storeName);
    const done = (fn, value) => { if (!settled) { settled = true; fn(value); } };
    tx.oncomplete = () => done(resolve);
    tx.onerror = () => done(reject, tx.error || new Error("Study storage write failed"));
    tx.onabort = () => done(reject, tx.error || new Error("Study storage write was aborted"));
    try { for (const [key, value] of entries) store.put(value, key); }
    catch (error) { try { tx.abort(); } catch (_) {} done(reject, error); }
  }));
}
function studyDBDeleteMany(storeName, keys) {
  if (!keys || !keys.length) return Promise.resolve();
  return studyDBOpen().then(db => new Promise((resolve, reject) => {
    let settled = false;
    const tx = db.transaction(storeName, "readwrite"), store = tx.objectStore(storeName);
    const done = (fn, value) => { if (!settled) { settled = true; fn(value); } };
    tx.oncomplete = () => done(resolve);
    tx.onerror = () => done(reject, tx.error || new Error("Study storage delete failed"));
    tx.onabort = () => done(reject, tx.error || new Error("Study storage delete was aborted"));
    try { for (const key of keys) store.delete(key); }
    catch (error) { try { tx.abort(); } catch (_) {} done(reject, error); }
  }));
}
function studyDBPairs(storeName) {
  return studyDBOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly"), store = tx.objectStore(storeName);
    const keysRequest = store.getAllKeys(), valuesRequest = store.getAll();
    let keys = [], values = [];
    keysRequest.onsuccess = () => { keys = keysRequest.result || []; };
    valuesRequest.onsuccess = () => { values = valuesRequest.result || []; };
    tx.oncomplete = () => resolve(keys.map((key, i) => [key, values[i]]));
    tx.onerror = tx.onabort = () => reject(tx.error || new Error("Study storage read failed"));
  }));
}
function studyIsQuota(error) {
  return !!error && (error.name === "QuotaExceededError" || /quota/i.test(String(error.message || "")));
}
function studyFail(error, fallbackKey) {
  console.error(error);
  if (studyIsQuota(error)) { studySetStatus("studyQuotaError"); return true; }
  studySetStatus(fallbackKey || "studyStorageError");
  return false;
}

/* ============ 状態表示・設定 ============ */
function studySetStatus(key, vars) { if (typeof setStatus === "function") core.setStatus("studyStatus", key, vars); }
function studyNotify(key, vars) { studySetStatus(key, vars); if (typeof showToast === "function") window.Trk.play.showToast(tr(key, vars)); }
function studyApplyShelfVisibility() {
  const visible = studyPrefs.shelfVisible !== false;
  core.$("studyShelf").hidden = !visible;
  core.$("studyRoom").classList.toggle("study-shelf-hidden", !visible);
  core.$("studyShelfVisible").checked = visible;
  const button = core.$("studyShowShelfBtn");
  button.hidden = visible;
  button.setAttribute("aria-expanded", String(visible));
}
function studySetShelfVisible(visible) {
  studyPrefs.shelfVisible = !!visible;
  studyApplyShelfVisibility(); studySavePrefs();
}
function studySetKeyCapture(action) {
  studyKeyCaptureAction = studyKeyCaptureAction === action ? "" : action;
  studyRefreshKeyAssignments();
  if (studyKeyCaptureAction) studySetStatus("studyKeyCaptureHint", { action:tr(action === "next" ? "studyNextKeyLabel" : "studyPreviousKeyLabel") });
  else studySetStatus(null);
}
function studyRefreshKeyAssignments() {
  for (const action of ["next", "previous"]) {
    const isNext = action === "next", button = core.$(isNext ? "studyNextKeyBtn" : "studyPreviousKeyBtn");
    const value = core.$(isNext ? "studyNextKeyValue" : "studyPreviousKeyValue");
    const actionNode = core.$(isNext ? "studyNextKeyAction" : "studyPreviousKeyAction");
    const code = studyPrefs[isNext ? "studyNextKey" : "studyPreviousKey"];
    const label = tr(isNext ? "studyNextKeyLabel" : "studyPreviousKeyLabel"), capturing = studyKeyCaptureAction === action;
    value.textContent = capturing ? "…" : studyKeyCodeLabel(code);
    actionNode.textContent = tr(capturing ? "studyKeyPressKey" : "studyKeyChange");
    button.setAttribute("aria-pressed", String(capturing));
    button.setAttribute("aria-label", tr(capturing ? "studyKeyButtonCaptureLabel" : "studyKeyButtonLabel",
      capturing ? { action:label } : { action:label, key:studyKeyCodeLabel(code) }));
    button.classList.toggle("study-capture-active", capturing);
  }
}
function studyHandleKeyCapture(event) {
  if (!studyKeyCaptureAction) return false;
  event.preventDefault(); event.stopImmediatePropagation();
  if (event.code === "Escape") {
    studyKeyCaptureAction = ""; studyRefreshKeyAssignments(); studySetStatus(null); return true;
  }
  if (event.repeat || /^(?:Shift|Control|Alt|Meta)/.test(event.code || "")) return true;
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || !studyKeyCodeAllowed(event.code)) {
    studyNotify("studyKeyInvalid"); return true;
  }
  const isNext = studyKeyCaptureAction === "next";
  const property = isNext ? "studyNextKey" : "studyPreviousKey";
  const other = studyPrefs[isNext ? "studyPreviousKey" : "studyNextKey"];
  if (event.code === other) { studyNotify("studyKeyConflict"); return true; }
  studyPrefs[property] = event.code;
  studyKeyCaptureAction = ""; studySavePrefs(); studyRefreshKeyAssignments();
  studyNotify("studyKeyAssigned", { action:tr(isNext ? "studyNextKeyLabel" : "studyPreviousKeyLabel"), key:studyKeyCodeLabel(event.code) });
  return true;
}
function studyReadPrefs(raw) {
  if (!raw || typeof raw !== "object") return;
  studyPrefs.imageMode = STUDY_IMAGE_MODES.includes(raw.imageMode) ? raw.imageMode : "single";
  studyPrefs.imageOrder = raw.imageOrder === "reverse" ? "reverse" : "natural";
  studyPrefs.american = raw.american === true;
  const rawZoom = Number(raw.zoom);
  studyPrefs.zoom = Number.isFinite(rawZoom) ? Math.round(Math.max(STUDY_ZOOM_MIN, Math.min(STUDY_ZOOM_MAX, rawZoom)) * 100) / 100 : 1;
  studyPrefs.zoomPercentStep = studyZoomPercentStep(raw.zoomPercentStep);
  studyPrefs.theme = STUDY_THEMES.includes(raw.theme) ? raw.theme : "plain";
  studyPrefs.textSize = ["small", "normal", "large", "huge"].includes(raw.textSize) ? raw.textSize : "normal";
  studyPrefs.textSpacing = ["tight", "normal", "loose"].includes(raw.textSpacing) ? raw.textSpacing : "normal";
  studyPrefs.textWidth = ["narrow", "normal", "wide"].includes(raw.textWidth) ? raw.textWidth : "normal";
  studyPrefs.tvEnabled = raw.tvEnabled === true;
  studyPrefs.tvPosition = ["top", "bottom", "off"].includes(raw.tvPosition) ? raw.tvPosition : "top";
  if (studyPrefs.tvPosition === "off") studyPrefs.tvEnabled = false;
  studyPrefs.tvLook = STUDY_TV_LOOKS.includes(raw.tvLook) ? raw.tvLook : "plain";
  studyPrefs.tvSize = ["small", "medium", "large"].includes(raw.tvSize) ? raw.tvSize : "medium";
  studyPrefs.tvRatio = Object.keys(STUDY_TV_RATIO).includes(raw.tvRatio) ? raw.tvRatio : "16:9";
  studyPrefs.tvLabelOn = raw.tvLabelOn !== false;
  studyPrefs.shelfSort = STUDY_SORTS.includes(raw.shelfSort) ? raw.shelfSort : "updated";
  studyPrefs.albumNesting = raw.albumNesting === "flat" ? "flat" : "split";
  studyPrefs.manualShelfOrder = raw.manualShelfOrder === true;
  studyPrefs.foldersFirst = raw.foldersFirst === true;
  studyPrefs.skipDeleteConfirm = raw.skipDeleteConfirm === true;
  studyPrefs.shelfVisible = raw.shelfVisible !== false;
  studyPrefs.verticalImageKeys = raw.verticalImageKeys === true;
  const rawAutoSpeed = Number(raw.studyAutoScrollSpeed);
  studyPrefs.studyAutoScrollSpeed = STUDY_AUTO_SCROLL_SPEEDS.includes(rawAutoSpeed) ? rawAutoSpeed : STUDY_AUTO_SCROLL_SPEED_DEFAULT;
  const rawBrightness = Number(raw.readBrightness), rawContrast = Number(raw.readContrast);
  studyPrefs.readBrightness = Number.isFinite(rawBrightness) ? Math.min(150, Math.max(50, Math.round(rawBrightness))) : 100;
  studyPrefs.readContrast = Number.isFinite(rawContrast) ? Math.min(150, Math.max(50, Math.round(rawContrast))) : 100;
  studyPrefs.readSpecial = STUDY_READ_SPECIALS.includes(raw.readSpecial) ? raw.readSpecial : "none";
  /* 旧「画像の端へ送る」をオフにしていた人は、直接ページ送りの選択を引き継ぐ。 */
  studyPrefs.pageKeysTurnPages = typeof raw.pageKeysTurnPages === "boolean" ? raw.pageKeysTurnPages : raw.zoomEdgeKeys === false;
  studyPrefs.fullscreenFit = raw.fullscreenFit === true;
  studyPrefs.closeOnLastPageDown = raw.closeOnLastPageDown !== false;
  studyPrefs.mouseClickPages = raw.mouseClickPages === true;
  studyPrefs.mouseClickFlip = raw.mouseClickFlip === true;
  /* trk123までの「中クリック＝次のページ」は、選択肢の "next" として引き継ぎます。 */
  studyPrefs.middleClickAction = STUDY_MIDDLE_CLICK_ACTIONS.includes(raw.middleClickAction) ? raw.middleClickAction
    : raw.middleClickNext === true ? "next" : "none";
  studyPrefs.editedTextFolderId = typeof raw.editedTextFolderId === "string" && raw.editedTextFolderId.length <= 128 ? raw.editedTextFolderId : "";
  studyPrefs.studyNextKey = studyKeyCodeAllowed(raw.studyNextKey) ? raw.studyNextKey : STUDY_DEFAULT_NEXT_KEY;
  const previousKey = studyKeyCodeAllowed(raw.studyPreviousKey) ? raw.studyPreviousKey : STUDY_DEFAULT_PREVIOUS_KEY;
  studyPrefs.studyPreviousKey = previousKey !== studyPrefs.studyNextKey ? previousKey
    : studyPrefs.studyNextKey !== STUDY_DEFAULT_PREVIOUS_KEY ? STUDY_DEFAULT_PREVIOUS_KEY : STUDY_DEFAULT_NEXT_KEY;
  studyPrefs.helpSeen = raw.helpSeen === true;
}
function studySavePrefs() {
  return studyDBRun("settings", "readwrite", store => store.put({ ...studyPrefs }, "ui"))
    .catch(error => { studyFail(error); });
}
function studyRefreshEditedTextFolderSelect() {
  const select = core.$("studyEditedTextFolder"), previous = studyPrefs.editedTextFolderId;
  select.textContent = "";
  const keep = document.createElement("option"); keep.value = ""; keep.textContent = tr("studyEditedTextFolderKeep"); select.append(keep);
  const folders = [...studyShelfFolders].sort((a, b) => STUDY_UTIL.comparePath(a.name, b.name));
  for (const folder of folders) {
    const option = document.createElement("option"); option.value = folder.id; option.textContent = folder.name; select.append(option);
  }
  if (previous && !folders.some(folder => folder.id === previous)) {
    studyPrefs.editedTextFolderId = ""; studySavePrefs();
  }
  select.value = studyPrefs.editedTextFolderId;
}
function studyCanChooseExportFolder() {
  return !!(window.isSecureContext && window.self === window.top && typeof window.showDirectoryPicker === "function");
}
function studyRefreshExportFolderUI() {
  core.$("studyChooseExportFolderBtn").hidden = !studyCanChooseExportFolder();
  core.$("studyClearExportFolderBtn").hidden = !studyExportDirectory;
  core.$("studyExportFolderName").textContent = studyExportDirectory
    ? tr("studyExportFolderSelected", { name:studyExportDirectory.name }) : tr("studyExportFolderNone");
}
function studyReadShelfMeta(raw) {
  studyShelfFolders = [];
  studyBookFolder = Object.create(null);
  studyShelfOrder = Object.create(null);
  studyShelfOrder.root = [];
  if (!raw || typeof raw !== "object") return;
  const seen = new Set();
  for (const row of Array.isArray(raw.folders) ? raw.folders.slice(0, STUDY_FOLDER_MAX) : []) {
    if (!row || typeof row !== "object") continue;
    const id = String(row.id || "").slice(0, 80), name = String(row.name || "").trim().slice(0, 120);
    if (!/^[a-z0-9_-]{1,80}$/i.test(id) || id === "root" || !name || seen.has(id)) continue;
    seen.add(id);
    studyShelfFolders.push({ id, name, createdAt:Math.max(0, Number(row.createdAt) || Date.now()), updatedAt:Math.max(0, Number(row.updatedAt) || Date.now()) });
    studyShelfOrder[id] = [];
  }
  const folderIds = new Set(studyShelfFolders.map(folder => folder.id));
  if (raw.bookFolder && typeof raw.bookFolder === "object" && !Array.isArray(raw.bookFolder)) {
    for (const [bookId, folderId] of Object.entries(raw.bookFolder).slice(0, studyCap(STUDY_SHELF_MAX))) {
      if (typeof bookId === "string" && bookId.length <= 100 && folderIds.has(String(folderId))) studyBookFolder[bookId] = String(folderId);
    }
  }
  if (raw.orderByFolder && typeof raw.orderByFolder === "object" && !Array.isArray(raw.orderByFolder)) {
    for (const [container, values] of Object.entries(raw.orderByFolder).slice(0, STUDY_FOLDER_MAX + 1)) {
      if (container !== "root" && !folderIds.has(container)) continue;
      if (!Array.isArray(values)) continue;
      const keys = [], used = new Set();
      for (const value of values.slice(0, studyCap(STUDY_SHELF_MAX + STUDY_FOLDER_MAX))) {
        const key = String(value || "").slice(0, 240);
        if (!/^(?:book|folder):/.test(key) || used.has(key)) continue;
        used.add(key); keys.push(key);
      }
      studyShelfOrder[container] = keys;
    }
  }
}
function studyShelfSnapshot() {
  return JSON.stringify({ folders:studyShelfFolders, bookFolder:studyBookFolder, orderByFolder:studyShelfOrder });
}
function studyNormalizeShelfMeta() {
  const before = studyShelfSnapshot();
  const folderIds = new Set(studyShelfFolders.map(folder => folder.id));
  const bookIds = new Set(studyBooks.map(book => book.id));
  for (const id of Object.keys(studyBookFolder)) if (!bookIds.has(id)) delete studyBookFolder[id];
  for (const book of studyBooks) {
    const folderId = studyBookFolder[book.id];
    if (!folderIds.has(folderId)) studyBookFolder[book.id] = "";
  }
  const expected = Object.create(null);
  expected.root = studyShelfFolders.map(folder => `folder:${folder.id}`);
  for (const folder of studyShelfFolders) expected[folder.id] = [];
  for (const book of studyBooks) {
    const folderId = studyBookFolder[book.id] || "";
    expected[folderId || "root"].push(`book:${book.id}`);
  }
  let folderSizes = null;
  const entryForKey = key => {
    const id = key.slice(key.indexOf(":") + 1);
    if (key.startsWith("folder:")) {
      const folder = studyShelfFolders.find(item => item.id === id);
      return folder && { key, itemType:"folder", kind:"folder", title:folder.name, createdAt:folder.createdAt, updatedAt:folder.updatedAt,
        size:(folderSizes || (folderSizes = studyShelfFolderSizes())).get(id) || 0 };
    }
    const book = studyBooks.find(item => item.id === id);
    return book && { key, itemType:"book", kind:book.kind, title:book.title, createdAt:book.createdAt, updatedAt:book.updatedAt,
      size:STUDY_UTIL.bookSize(book) };
  };
  const normalized = Object.create(null);
  for (const [container, keys] of Object.entries(expected)) {
    const valid = new Set(keys), used = new Set();
    const current = Array.isArray(studyShelfOrder[container]) ? studyShelfOrder[container] : [];
    const ordered = current.filter(key => valid.has(key) && !used.has(key) && used.add(key));
    const missing = STUDY_UTIL.sortShelfItems(keys.filter(key => !used.has(key)).map(entryForKey).filter(Boolean),
      { mode:studyPrefs.shelfSort, foldersFirst:studyPrefs.foldersFirst }).map(entry => entry.key);
    normalized[container] = ordered.concat(missing);
  }
  studyShelfOrder = normalized;
  if (studyShelfViewFolder && !folderIds.has(studyShelfViewFolder)) studyShelfViewFolder = "";
  return before !== studyShelfSnapshot();
}
function studySaveShelfMeta() {
  if (studySafeMode()) return Promise.resolve(true);
  const value = { folders:studyShelfFolders, bookFolder:studyBookFolder, orderByFolder:studyShelfOrder };
  return studyDBRun("settings", "readwrite", store => store.put(value, "shelf"))
    .then(() => true).catch(error => { studyFail(error); return false; });
}
function studyShelfContainer(folderId) {
  const key = folderId || "root";
  if (!Array.isArray(studyShelfOrder[key])) studyShelfOrder[key] = [];
  return studyShelfOrder[key];
}
function studyShelfItemKey(type, id) { return `${type === "folder" ? "folder" : "book"}:${id}`; }
function studyFolderById(id) { return studyShelfFolders.find(folder => folder.id === id) || null; }
function studyBookFolderId(bookId) { return studyBookFolder[bookId] || ""; }
async function studyApplyEditedTextFolder(book) {
  const folderId = studyPrefs.editedTextFolderId;
  const folder = folderId && studyFolderById(folderId);
  if (!book || book.kind !== "text" || !folder || studyBookFolderId(book.id) === folderId) return null;
  const previousFolder = studyBookFolderId(book.id);
  studyBookFolder[book.id] = folderId; studyNormalizeShelfMeta();
  if (!await studySaveShelfMeta()) {
    studyBookFolder[book.id] = previousFolder; studyNormalizeShelfMeta(); studyRenderShelf();
    return false;
  }
  studyShelfViewFolder = folderId; studyRenderShelf(); studyNotify("studyTextFiledInFolder", { folder:folder.name });
  return true;
}
function studyShelfFolderSizes() {
  const sizes = new Map(studyShelfFolders.map(folder => [folder.id, 0]));
  for (const book of studyBooks) {
    const folderId = studyBookFolderId(book.id);
    if (sizes.has(folderId)) sizes.set(folderId, sizes.get(folderId) + STUDY_UTIL.bookSize(book));
  }
  return sizes;
}
/* 見た目の設定（TVの枠・文字サイズ・拡大率）をDOMへ反映する。 */
function studySyncLook() {
  /* 局所変数に裸の screen という名前を使わないこと（ブラウザ標準の window.screen と、
     core.screen＝アプリの画面状態のどちらとも取り違えるため。trk100 のTV映像消失と同型） */
  const tvScreen = core.$("studyTvScreen");
  if (tvScreen) {
    tvScreen.dataset.look = studyPrefs.tvLook;
    tvScreen.dataset.size = studyPrefs.tvSize;
    tvScreen.dataset.ratio = studyPrefs.tvRatio;
    tvScreen.style.setProperty("--study-tv-max", STUDY_TV_MAX[studyPrefs.tvSize] || STUDY_TV_MAX.medium);
    tvScreen.style.setProperty("--study-tv-width", STUDY_TV_WIDTH[studyPrefs.tvSize] || "100%");
    tvScreen.style.setProperty("--study-tv-ratio", STUDY_TV_RATIO[studyPrefs.tvRatio] || STUDY_TV_RATIO["16:9"]);
  }
  const label = core.$("studyTvLabel");
  if (label) label.hidden = !studyPrefs.tvLabelOn;
  const stage = core.$("studyTextStage");
  stage.style.setProperty("--study-text-size", String(STUDY_TEXT_SIZE[studyPrefs.textSize] || 1));
  stage.style.setProperty("--study-text-leading", String(STUDY_TEXT_LEADING[studyPrefs.textSpacing] || 1.9));
  stage.style.setProperty("--study-text-pad", String(STUDY_TEXT_PAD[studyPrefs.textWidth] || 1));
  studyApplyZoom(false);
}
function studyRefreshPrefsUI() {
  core.$("studyImageMode").value = studyPrefs.imageMode;
  core.$("studyImageOrder").value = studyPrefs.imageOrder;
  core.$("studyAmerican").checked = studyPrefs.american;
  core.$("studyTheme").value = studyPrefs.theme;
  core.$("studyTextSize").value = studyPrefs.textSize;
  core.$("studyTextSpacing").value = studyPrefs.textSpacing;
  core.$("studyTextWidth").value = studyPrefs.textWidth;
  core.$("studyTvCheck").checked = studyPrefs.tvEnabled;
  core.$("studyTvPosition").value = studyPrefs.tvPosition;
  core.$("studyTvLook").value = studyPrefs.tvLook;
  core.$("studyTvSize").value = studyPrefs.tvSize;
  core.$("studyTvRatio").value = studyPrefs.tvRatio;
  core.$("studyTvLabelOn").checked = studyPrefs.tvLabelOn;
  core.$("studyShelfSort").value = studyPrefs.shelfSort;
  core.$("studyAlbumNesting").value = studyPrefs.albumNesting;
  core.$("studyManualShelfOrder").checked = studyPrefs.manualShelfOrder;
  core.$("studyFoldersFirst").checked = studyPrefs.foldersFirst;
  core.$("studySkipDeleteConfirm").checked = studyPrefs.skipDeleteConfirm;
  core.$("studyVerticalImageKeys").checked = studyPrefs.verticalImageKeys;
  core.$("studyAutoScrollSpeed").value = String(studyPrefs.studyAutoScrollSpeed);
  core.$("studyReadBrightness").value = String(studyPrefs.readBrightness);
  core.$("studyReadContrast").value = String(studyPrefs.readContrast);
  core.$("studyReadSpecial").value = studyPrefs.readSpecial;
  studyApplyReadFilter();
  core.$("studyPageKeysTurnPages").checked = studyPrefs.pageKeysTurnPages;
  core.$("studyFullscreenFit").checked = studyPrefs.fullscreenFit;
  core.$("studyCloseOnLastPageDown").checked = studyPrefs.closeOnLastPageDown;
  core.$("studyMouseClickPages").checked = studyPrefs.mouseClickPages;
  core.$("studyMouseClickFlip").checked = studyPrefs.mouseClickFlip;
  core.$("studyMouseClickFlip").disabled = !studyPrefs.mouseClickPages;
  core.$("studyMiddleClickAction").value = studyPrefs.middleClickAction;
  core.$("studyShelfSort").disabled = studyPrefs.manualShelfOrder;
  studySyncZoomStepRow();
  studyRefreshEditedTextFolderSelect(); studyRefreshExportFolderUI();
  studyApplyShelfVisibility();
  studyRefreshKeyAssignments();
  studySyncLook();
  studySyncCurrentBookControls();
}

/* ============ 本のデータ ============ */
function studyBookClean(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !raw.id || !["image", "text"].includes(raw.kind)) return null;
  const pages = (Array.isArray(raw.pages) ? raw.pages : []).slice(0, studyCap(STUDY_IMAGE_MAX_COUNT)).map(p => {
    if (!p || typeof p !== "object" || typeof p.key !== "string") return null;
    return { key:p.key.slice(0, 240), name:String(p.name || "page").slice(0, 240), path:String(p.path || p.name || "").slice(0, 500),
      size:Math.max(0, Number(p.size) || 0), type:String(p.type || "").slice(0, 100) };
  }).filter(Boolean);
  const bookmark = raw.bookmark && typeof raw.bookmark === "object" ? {
    index:Math.max(0, Math.min(studyCap(STUDY_IMAGE_MAX_COUNT) - 1, Number(raw.bookmark.index) || 0)),
    top:Math.max(0, Number(raw.bookmark.top) || 0), left:Number(raw.bookmark.left) || 0,
    ratio:Math.max(0, Math.min(1, Number(raw.bookmark.ratio) || 0)),
    savedAt:Math.max(0, Number(raw.bookmark.savedAt) || 0)
  } : null;
  return { id:raw.id.slice(0, 100), kind:raw.kind, title:String(raw.title || "Untitled").trim().slice(0, 160) || "Untitled",
    /* 📂 trk208：フォルダーのまま読む本（ページの実体はユーザーのフォルダー側・pages ストアには入れない） */
    linked:raw.linked === true, sharedFolder:raw.linked === true ? String(raw.sharedFolder || "").slice(0, 200) : "",
    sourcePath:String(raw.sourcePath || "").slice(0, 1000), generation:String(raw.generation || "").slice(0, 100),
    pages, content:typeof raw.content === "string" ? raw.content.slice(0, studyCap(STUDY_TEXT_FILE_MAX)) : "",
    extension:String(raw.extension || "").slice(0, 16), bookmark, createdAt:Math.max(0, Number(raw.createdAt) || Date.now()),
    updatedAt:Math.max(0, Number(raw.updatedAt) || Date.now()) };
}
/* ページの並び順（設定で逆順にもできる。栞や現在位置は「表示順」で数える）。 */
function studyPageAt(book, index) {
  if (!book || book.kind !== "image") return null;
  const pages = STUDY_UTIL.orderPages(book.pages, studyPrefs.imageOrder);
  return pages[Math.max(0, Math.min(pages.length - 1, Math.round(Number(index) || 0)))] || null;
}
function studyExistingBook(id) {
  return studyDBRun("books", "readonly", store => store.get(id)).then(raw => raw ? studyBookClean(raw) : null);
}
async function studyRefreshBooks() {
  const rows = await studyDBRun("books", "readonly", store => store.getAll());
  studyBooks = STUDY_UTIL.sortBooks((rows || []).map(studyBookClean).filter(Boolean), studyPrefs.shelfSort);
  if (studyCurrentBook) {
    const fresh = studyBooks.find(book => book.id === studyCurrentBook.id);
    if (fresh) studyCurrentBook = fresh; else studyCurrentBook = null;
  }
  if (studyNormalizeShelfMeta()) studySaveShelfMeta();
  studyRenderShelf(); studyRenderBookmarks(); studyRefreshShelfFoot();
}

/* ============ 本棚 ============ */
function studyShelfEntries(folderId, query) {
  const search = String(query || "").toLocaleLowerCase(), entries = [];
  const folderSizes = folderId ? null : studyShelfFolderSizes();
  if (!folderId) {
    for (const folder of studyShelfFolders) {
      if (search && !folder.name.toLocaleLowerCase().includes(search)) continue;
      entries.push({ key:studyShelfItemKey("folder", folder.id), itemType:"folder", kind:"folder", title:folder.name,
        createdAt:folder.createdAt, updatedAt:folder.updatedAt, size:folderSizes.get(folder.id) || 0, folder });
    }
  }
  for (const book of studyBooks) {
    const parent = studyBookFolderId(book.id);
    if (folderId ? parent !== folderId : !search && parent) continue;
    const folder = studyFolderById(parent);
    const searchable = `${book.title} ${book.sourcePath} ${book.extension} ${folder ? folder.name : ""}`.toLocaleLowerCase();
    if (search && !searchable.includes(search)) continue;
    entries.push({ key:studyShelfItemKey("book", book.id), itemType:"book", kind:book.kind, title:book.title,
      createdAt:book.createdAt, updatedAt:book.updatedAt, size:STUDY_UTIL.bookSize(book), book, folderId:parent });
  }
  let orderKeys = studyShelfContainer(folderId);
  if (!folderId && search) orderKeys = ["root", ...studyShelfFolders.map(folder => folder.id)].flatMap(key => studyShelfContainer(key));
  return STUDY_UTIL.sortShelfItems(entries, { mode:studyPrefs.shelfSort, manual:studyPrefs.manualShelfOrder,
    foldersFirst:studyPrefs.foldersFirst, orderKeys });
}
function studyShelfCanDrop(drag, target) {
  if (!drag || !target) return false;
  if (target.type === "back") return drag.type === "book" && !!drag.sourceFolder;
  if (target.type === "folder") return drag.type === "book" || drag.type === "folder" && studyPrefs.manualShelfOrder;
  if (target.type === "book") {
    if (drag.type === "book") return studyPrefs.manualShelfOrder || drag.sourceFolder !== (target.folderId || "");
    return drag.type === "folder" && studyPrefs.manualShelfOrder && !target.folderId;
  }
  if (target.type === "container") {
    const destination = target.folderId || "";
    if (drag.type === "book") return studyPrefs.manualShelfOrder || drag.sourceFolder !== destination;
    return drag.type === "folder" && studyPrefs.manualShelfOrder && !destination;
  }
  return false;
}
function studyShelfDragOver(event, target, node) {
  if (!studyShelfCanDrop(studyShelfDragged, target)) return;
  event.preventDefault(); event.stopPropagation();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  node.classList.add("study-drop-target");
}
function studyShelfMoveItem(drag, destination, reference, after) {
  if (!drag) return;
  const isFolder = drag.type === "folder", key = studyShelfItemKey(drag.type, drag.id);
  const source = isFolder ? "" : studyBookFolderId(drag.id);
  const targetFolder = isFolder ? "" : (destination || "");
  if (isFolder && !studyPrefs.manualShelfOrder || !isFolder && !studyBooks.some(book => book.id === drag.id)) return;
  if (targetFolder && !studyFolderById(targetFolder)) return;
  if (!studyPrefs.manualShelfOrder && !isFolder && source === targetFolder) return;
  if (reference && reference.key === key) return;
  const from = studyShelfContainer(source), fromIndex = from.indexOf(key);
  if (fromIndex >= 0) from.splice(fromIndex, 1);
  if (!isFolder) studyBookFolder[drag.id] = targetFolder;
  const to = studyShelfContainer(targetFolder);
  let index = to.length;
  if (reference && reference.key) {
    const targetIndex = to.indexOf(reference.key);
    if (targetIndex >= 0) index = targetIndex + (after ? 1 : 0);
  }
  to.splice(index, 0, key);
  const scrollTop = core.$("studyShelfList").scrollTop;
  studySaveShelfMeta(); studyRenderShelf(); core.$("studyShelfList").scrollTop = scrollTop; studySetStatus("studyShelfMoved");
}
function studyShelfDrop(event, target) {
  const drag = studyShelfDragged;
  if (!studyShelfCanDrop(drag, target)) return;
  event.preventDefault(); event.stopPropagation();
  let destination = "", reference = null, after = false;
  if (target.type === "folder") {
    if (drag.type === "book") destination = target.id;
    else { reference = { key:studyShelfItemKey("folder", target.id) }; after = event.clientY > target.node.getBoundingClientRect().top + target.node.getBoundingClientRect().height / 2; }
  } else if (target.type === "book") {
    destination = target.folderId || "";
    reference = { key:studyShelfItemKey("book", target.id) };
    const rect = target.node.getBoundingClientRect(); after = event.clientY > rect.top + rect.height / 2;
  } else if (target.type === "container" && target.folderId) destination = target.folderId;
  studyShelfMoveItem(drag, destination, reference, after);
  studyShelfDragged = null;
  core.$("studyShelfList").classList.remove("study-drop-target");
}
function studyBindShelfDropTarget(node, target) {
  target.node = node;
  node.addEventListener("dragover", event => studyShelfDragOver(event, target, node));
  node.addEventListener("dragleave", event => { if (!node.contains(event.relatedTarget)) node.classList.remove("study-drop-target"); });
  node.addEventListener("drop", event => studyShelfDrop(event, target));
}
function studyShelfTargetAt(x, y) {
  const hit = document.elementFromPoint(x, y);
  if (!hit || typeof hit.closest !== "function") return null;
  const back = hit.closest(".study-shelf-back");
  if (back) return { type:"back", folderId:"", node:back };
  const folder = hit.closest(".study-folder-card");
  if (folder) return { type:"folder", id:folder.dataset.studyItemId, node:folder };
  const book = hit.closest(".study-book-card");
  if (book) return { type:"book", id:book.dataset.studyItemId, folderId:book.dataset.studyFolderId || "", node:book };
  const list = hit.closest("#studyShelfList");
  return list ? { type:"container", folderId:studyShelfViewFolder, node:list } : null;
}
function studyHighlightShelfTarget(x, y) {
  const list = core.$("studyShelfList");
  for (const node of list.querySelectorAll(".study-drop-target")) node.classList.remove("study-drop-target");
  list.classList.remove("study-drop-target");
  const target = studyShelfTargetAt(x, y);
  if (studyShelfCanDrop(studyShelfDragged, target)) (target.node || list).classList.add("study-drop-target");
  return target;
}
function studyShelfDragHandle(type, id, sourceFolder, card) {
  const handle = core.el("button", "study-tool-btn study-drag-handle", "⋮⋮");
  handle.type = "button";
  handle.draggable = type === "folder" ? studyPrefs.manualShelfOrder : studyPrefs.manualShelfOrder || studyShelfFolders.length > 0;
  handle.hidden = !handle.draggable;
  handle.title = tr("studyDragHandle"); handle.setAttribute("aria-label", `${tr("studyDragHandle")}: ${type === "folder" ? (studyFolderById(id) || {}).name || id : (studyBooks.find(book => book.id === id) || {}).title || id}`);
  handle.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" || !handle.draggable) return;
    event.preventDefault();
    const originalDraggable = handle.draggable;
    handle.draggable = false;
    const pointer = { id:event.pointerId, x:event.clientX, y:event.clientY, started:false };
    const startDrag = () => {
      pointer.started = true; studyShelfDragged = { type, id, sourceFolder:sourceFolder || "" };
      card.classList.add("study-dragging");
    };
    const move = moveEvent => {
      if (moveEvent.pointerId !== pointer.id) return;
      if (!pointer.started && Math.hypot(moveEvent.clientX - pointer.x, moveEvent.clientY - pointer.y) < 8) return;
      moveEvent.preventDefault();
      if (!pointer.started) startDrag();
      studyHighlightShelfTarget(moveEvent.clientX, moveEvent.clientY);
    };
    const finish = endEvent => {
      if (endEvent.pointerId !== pointer.id) return;
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", cancel);
      if (pointer.started && endEvent.type === "pointerup") {
        const target = studyHighlightShelfTarget(endEvent.clientX, endEvent.clientY);
        if (studyShelfCanDrop(studyShelfDragged, target)) studyShelfDrop({
          preventDefault() {}, stopPropagation() {}, clientY:endEvent.clientY
        }, target);
      }
      studyShelfDragged = null; handle.draggable = originalDraggable;
      card.classList.remove("study-dragging");
      for (const node of core.$("studyShelfList").querySelectorAll(".study-drop-target")) node.classList.remove("study-drop-target");
      core.$("studyShelfList").classList.remove("study-drop-target");
    };
    const cancel = cancelEvent => finish(cancelEvent);
    document.addEventListener("pointermove", move, { passive:false });
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", cancel);
    try { handle.setPointerCapture(event.pointerId); } catch (_) {}
  });
  handle.addEventListener("dragstart", event => {
    if (type === "folder" && !studyPrefs.manualShelfOrder) { event.preventDefault(); return; }
    studyShelfDragged = { type, id, sourceFolder:sourceFolder || "" };
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      try { event.dataTransfer.setData("text/plain", studyShelfItemKey(type, id)); } catch (_) {}
    }
    card.classList.add("study-dragging");
  });
  handle.addEventListener("dragend", () => {
    studyShelfDragged = null;
    for (const node of core.$("studyShelfList").querySelectorAll(".study-dragging,.study-drop-target")) node.classList.remove("study-dragging", "study-drop-target");
    core.$("studyShelfList").classList.remove("study-drop-target");
  });
  return handle;
}
function studyRenderFolderCard(folder) {
  const card = core.el("article", "study-folder-card");
  card.dataset.studyItemType = "folder"; card.dataset.studyItemId = folder.id;
  const open = core.el("button", "study-folder-open"); open.type = "button";
  const copy = core.el("span", "study-book-copy");
  copy.append(core.el("strong", "study-book-title", folder.name), core.el("span", "study-book-sub", tr("studyFolderCount", { n:studyBooks.filter(book => studyBookFolderId(book.id) === folder.id).length })));
  open.append(core.el("span", "study-folder-icon", "📁"), copy); open.title = tr("studyFolderOpen");
  open.setAttribute("aria-label", `${tr("studyFolderOpen")}: ${folder.name}`);
  open.addEventListener("click", () => {
    studyShelfViewFolder = folder.id; studyShelfShown = STUDY_SHELF_PAGE; core.$("studySearch").value = ""; studyRenderShelf();
    const back = core.$("studyShelfList").querySelector(".study-shelf-back"); if (back) back.focus({ preventScroll:true });
  });
  const tools = core.el("span", "study-book-tools");
  tools.append(studyShelfDragHandle("folder", folder.id, "", card));
  const rename = core.el("button", "study-tool-btn", "✎"); rename.type = "button"; rename.title = tr("studyFolderRename");
  rename.setAttribute("aria-label", `${tr("studyFolderRename")}: ${folder.name}`); rename.addEventListener("click", () => studyRenameFolder(folder));
  const remove = core.el("button", "study-tool-btn study-delete-btn", "×"); remove.type = "button"; remove.title = tr("studyFolderDelete");
  remove.setAttribute("aria-label", `${tr("studyFolderDelete")}: ${folder.name}`); remove.addEventListener("click", () => studyDeleteFolder(folder));
  tools.append(rename, remove); card.append(open, tools);
  studyBindShelfDropTarget(card, { type:"folder", id:folder.id });
  return card;
}
function studyRenderBookCard(book) {
  const card = core.el("article", "study-book-card"), folderId = studyBookFolderId(book.id), folder = studyFolderById(folderId);
  card.dataset.studyItemType = "book"; card.dataset.studyItemId = book.id; card.dataset.studyFolderId = folderId;
  const open = core.el("button", "study-book-open"); open.type = "button";
  const icon = core.el("span", "study-book-icon", book.kind === "image" ? "🖼" : "📄");
  const text = core.el("span", "study-book-copy");
  const title = core.el("strong", "study-book-title", book.title);
  const detail = book.kind === "image" ? `${tr("studyBookImages")} · ${tr("studyPageCount", { n:book.pages.length })}`
    : `${tr("studyBookText")} · ${String(book.extension || "TXT").toUpperCase()} · ${tr("studyTextStats", STUDY_UTIL.textStats(book.content))}`;
  const sub = core.el("span", "study-book-sub", detail + (folder ? ` · 📁 ${folder.name}` : "")
    + (book.linked ? ` · ${tr("studyLinkedBadge", { name:book.sharedFolder })}` : "") + (book.bookmark ? " · 🔖" : ""));
  text.append(title, sub);
  if (book.kind === "text" && book.content) {
    const ratio = book.bookmark && book.bookmark.ratio ? book.bookmark.ratio : 0;
    text.append(core.el("span", "study-book-snippet", STUDY_UTIL.snippetAt(book.content, ratio, 64)));
  }
  open.append(icon, text); open.title = tr("studyOpen"); open.addEventListener("click", () => studyOpenBook(book));
  const tools = core.el("span", "study-book-tools");
  tools.append(studyShelfDragHandle("book", book.id, folderId, card));
  const rename = core.el("button", "study-tool-btn", "✎"); rename.type = "button"; rename.title = tr("studyRename"); rename.setAttribute("aria-label", `${tr("studyRename")}: ${book.title}`);
  rename.addEventListener("click", () => studyRenameBook(book));
  const remove = core.el("button", "study-tool-btn study-delete-btn", "×"); remove.type = "button"; remove.title = tr("studyDelete"); remove.setAttribute("aria-label", `${tr("studyDelete")}: ${book.title}`);
  remove.addEventListener("click", () => studyDeleteBook(book));
  tools.append(rename, remove); card.append(open, tools);
  studyBindShelfDropTarget(card, { type:"book", id:book.id, folderId });
  return card;
}
function studyRenderShelf() {
  const list = core.$("studyShelfList"), query = core.$("studySearch").value.trim();
  list.textContent = "";
  const entries = studyShelfEntries(studyShelfViewFolder, query);
  const bookCount = entries.filter(entry => entry.itemType === "book").length;
  const scopeCount = studyShelfViewFolder ? studyBooks.filter(book => studyBookFolderId(book.id) === studyShelfViewFolder).length : studyBooks.length;
  core.$("studyBookCount").textContent = query || studyShelfViewFolder ? `${bookCount} / ${scopeCount}` : String(studyBooks.length);
  core.$("studyShelfDragHelp").hidden = !(studyPrefs.manualShelfOrder || studyShelfFolders.length);
  studySyncWelcome();
  if (studyShelfViewFolder) {
    const folder = studyFolderById(studyShelfViewFolder);
    const back = core.el("button", "study-shelf-back", `${tr("studyFolderBack")} · ${folder ? folder.name : ""}`); back.type = "button";
    back.setAttribute("aria-label", `${tr("studyFolderBack")}: ${folder ? folder.name : ""}`);
    back.addEventListener("click", () => {
      studyShelfViewFolder = ""; studyShelfShown = STUDY_SHELF_PAGE; core.$("studySearch").value = ""; studyRenderShelf();
      studyShelfTitle.focus({ preventScroll:true });
    });
    studyBindShelfDropTarget(back, { type:"back", folderId:studyShelfViewFolder }); list.append(back);
  }
  if (!entries.length) {
    const key = query ? "studyNoSearchResults" : studyShelfViewFolder ? "studyFolderEmpty" : "studyShelfEmpty";
    list.append(core.el("div", "study-shelf-empty", tr(key)));
    return;
  }
  const visible = entries.slice(0, Math.max(STUDY_SHELF_PAGE, studyShelfShown));
  for (const entry of visible) list.append(entry.itemType === "folder" ? studyRenderFolderCard(entry.folder) : studyRenderBookCard(entry.book));
  if (entries.length > visible.length) {
    const more = core.el("button", "study-more-btn", tr("studyMore", { n:Math.min(STUDY_SHELF_PAGE, entries.length - visible.length) }));
    more.type = "button";
    more.addEventListener("click", () => { studyShelfShown = visible.length + STUDY_SHELF_PAGE; studyRenderShelf(); });
    list.append(more);
  }
}
/* ============ 🔖 栞一覧 ============ */
/* 説明パネルは「本がなくて、読んでもいない」ときだけ出します（本棚に本があるときは邪魔なので隠す）。 */
function studySyncWelcome() {
  const reading = !!studyCurrentBook && !core.$("studyBookView").hidden;
  core.$("studyWelcome").hidden = studyBooks.length > 0 || reading;
}
function studyBookmarkDetail(book) {
  const mark = book.bookmark;
  if (!mark) return "";
  if (book.kind === "image") return tr("studyBookmarkOpenAt", { n:Math.min(book.pages.length, mark.index + 1) });
  return tr("studyBookmarkOpenText", { n:Math.round((mark.ratio || 0) * 100) });
}
function studyRenderBookmarks() {
  const panel = core.$("studyBookmarkPanel"), rows = STUDY_UTIL.bookmarkedBooks(studyBooks);
  const badge = core.$("studyBookmarkCount");
  badge.hidden = !rows.length; badge.textContent = tr("studyBookmarkCount", { n:rows.length });
  core.$("studyBookmarksBtn").setAttribute("aria-pressed", String(studyBookmarkMode));
  if (!studyBookmarkMode) return;
  panel.textContent = "";
  if (!rows.length) { panel.append(core.el("div", "study-shelf-empty", tr("studyBookmarksEmpty"))); return; }
  panel.append(core.el("div", "study-shelf-more", tr("studyBookmarksHint")));
  for (const book of rows) {
    const card = core.el("article", "study-bookmark-card");
    const open = core.el("button", "study-bookmark-open"); open.type = "button"; open.title = tr("studyOpen");
    const copy = core.el("span", "study-bookmark-copy");
    copy.append(core.el("strong", "", book.title), core.el("span", "", studyBookmarkDetail(book)));
    open.append(core.el("span", "study-bookmark-icon", "🔖"), copy);
    if (book.kind === "text" && book.content) copy.append(core.el("span", "", STUDY_UTIL.snippetAt(book.content, (book.bookmark && book.bookmark.ratio) || 0, 56)));
    open.addEventListener("click", () => studyOpenBookmarkEntry(book));
    const unset = core.el("button", "study-bookmark-unset", "🗑"); unset.type = "button"; unset.title = tr("studyBookmarkRemove");
    unset.setAttribute("aria-label", `${tr("studyBookmarkRemove")}: ${book.title}`);
    unset.addEventListener("click", () => studyClearBookmark(book));
    card.append(open, unset); panel.append(card);
  }
}
function studyToggleBookmarkPanel(force) {
  studyBookmarkMode = typeof force === "boolean" ? force : !studyBookmarkMode;
  core.$("studyBookmarkPanel").hidden = !studyBookmarkMode;
  core.$("studyShelfList").hidden = studyBookmarkMode;
  core.$("studyBookmarksBtn").setAttribute("aria-pressed", String(studyBookmarkMode));
  studyRenderBookmarks();
}
async function studyOpenBookmarkEntry(book) {
  studyToggleBookmarkPanel(false);
  await studyOpenBook(book);
  if (book.bookmark) studySetStatus("studyBookmarked");
}
async function studyClearBookmark(book) {
  const target = book || studyCurrentBook;
  if (!target || !target.bookmark) return;
  target.bookmark = null;
  try { await studySaveBook(target); studyNotify("studyBookmarkRemoved"); }
  catch (error) { studyFail(error); }
}
function studyToggleBookmark() {
  if (!studyCurrentBook) return;
  if (studyCurrentBook.bookmark) studyClearBookmark(studyCurrentBook); else studySaveBookmark();
}
/* ============ 使用量の表示 ============ */
async function studyRefreshShelfFoot() {
  const foot = core.$("studyShelfFoot");
  const books = studyBooks.length, images = studyBooks.reduce((sum, book) => sum + book.pages.length, 0);
  const size = STUDY_UTIL.formatBytes(studyBooks.reduce((sum, book) => sum + STUDY_UTIL.bookSize(book), 0));
  let free = "";
  try {
    if (navigator.storage && typeof navigator.storage.estimate === "function") {
      const estimate = await navigator.storage.estimate();
      if (estimate && estimate.quota) free = STUDY_UTIL.formatBytes(Math.max(0, estimate.quota - (estimate.usage || 0)));
    }
  } catch (_) {}
  foot.textContent = free ? tr("studyStorageFree", { books, images, size, free }) : tr("studyStorageInfo", { books, images, size });
}
/* 取り込み中に落ちた・中止した場合などに残る、参照されていない画像データを片づける。 */
async function studySweepOrphans() {
  if (studySafeMode() || studyImportState.active || studySweepBusy) return 0;
  if (Date.now() - studySweepAt < 60000) return 0;
  studySweepBusy = true;
  try {
    const keys = await studyDBRun("pages", "readonly", store => store.getAllKeys());
    const alive = new Set();
    for (const book of studyBooks) for (const page of book.pages) alive.add(page.key);
    for (const [, art] of await studyDBPairs("covers")) if (art && typeof art.pageKey === "string") alive.add(art.pageKey);
    const dead = (keys || []).filter(key => !alive.has(key));
    if (dead.length) await studyDBDeleteMany("pages", dead);
    return dead.length;
  } catch (_) { return 0; } finally { studySweepBusy = false; studySweepAt = Date.now(); }
}

/* ============ 取り込み ============ */
function studyImportStart(total) {
  studyImportState = { active:true, cancelled:false, total, added:0, kept:0, failed:0 };
  /* 書斎の取り込みでも保存の固定を求める（trk136）。取り込みは待たせない */
  if (core.requestStoragePersist) core.requestStoragePersist().then(core.renderStoragePersist).catch(() => {});
  core.$("studyImportWrap").hidden = false; core.$("studyImportFill").style.width = "0%";
  core.$("studyImportCancelBtn").disabled = false;
  core.$("studyImportLabel").textContent = tr("studyImportProgress", { n:0, total });
  studySetStatus(null);
}
function studyImportTick(done, total) {
  const percent = total ? Math.max(0, Math.min(100, Math.round(done / total * 100))) : 0;
  core.$("studyImportFill").style.width = `${percent}%`;
  core.$("studyImportLabel").textContent = tr("studyImportProgress", { n:Math.min(done, total), total });
}
function studyImportEnd(key, vars) {
  studyImportState.active = false;
  core.$("studyImportWrap").hidden = true;
  if (key) studyNotify(key, vars);
}
function studyCancelImport() {
  if (!studyImportState.active) return;
  studyImportState.cancelled = true;
  core.$("studyImportCancelBtn").disabled = true;
  core.$("studyImportLabel").textContent = tr("studyImportCancel");
}
async function studyImportSummary() {
  const state = studyImportState, added = state.added, kept = state.kept, failed = state.failed;
  studyImportEnd();
  if (!added && !kept && !failed) return;
  if (!kept && !failed) { studyNotify("studyImportDone", { n:added }); return; }
  /* 1冊も入らなかったときは「大きすぎる」などの具体的な理由を消さないようにします。 */
  if (!added && !kept) { if (typeof showToast === "function") window.Trk.play.showToast(tr("studyImportSummary", { added, kept, failed })); return; }
  studyNotify("studyImportSummary", { added, kept, failed });
}
/* 画像の本を保存する（置き換えのときは、表紙の付け替えと古いページの削除も行う）。フォルダ取り込みと CBZ/ZIP で共用（trk138）。 */
async function studyWriteImageRecord(id, record, old, refs) {
  await studyDBRun("books", "readwrite", store => store.put(record, id));
  if (!old) return;
  try {
    const changed = [];
    for (const [songKey, art] of await studyDBPairs("covers")) if (art && art.bookId === id) {
      const pageIndex = Math.max(0, Math.floor(Number(art.pageIndex) || 0));
      if (pageIndex < refs.length) await studyDBRun("covers", "readwrite", store => store.put({ ...art, pageKey:refs[pageIndex].key, pageIndex, title:record.title, updatedAt:Date.now(),
        ...(art.linked ? { path:refs[pageIndex].path } : {}) }, songKey));
      else await studyDBRun("covers", "readwrite", store => store.delete(songKey));
      changed.push(songKey);
    }
    for (const songKey of changed) core.emit("studyCoverChanged", songKey);
  } catch (error) { console.warn("Study covers could not be rebound after replacing an album", error); }
  if (old.pages.length) studyDBDeleteMany("pages", old.pages.map(page => page.key)).catch(() => {});
}
async function studyImportImageGroup(group, id, position, total) {
  const old = await studyExistingBook(id);
  const generation = studyNewGeneration(), refs = [], entries = [];
  for (let index = 0; index < group.files.length; index++) {
    const { file, path } = group.files[index], key = `page:${id}:${generation}:${index}`;
    refs.push({ key, name:String(file.name || path).slice(0, 240), path:String(path || file.name).slice(0, 500), size:Number(file.size) || 0, type:String(file.type || "").slice(0, 100) });
    entries.push([key, file.slice(0, file.size, file.type || "application/octet-stream")]);
  }
  try {
    for (let i = 0; i < entries.length; i += STUDY_BATCH_WRITE) {
      if (studyImportState.cancelled) throw Object.assign(new Error("Study import cancelled"), { studyCancelled:true });
      await studyDBBatch("pages", entries.slice(i, i + STUDY_BATCH_WRITE));
      studyImportTick(position + Math.min(i + STUDY_BATCH_WRITE, entries.length), total);
    }
    const now = Date.now();
    const record = { id, kind:"image", title:String(group.title || tr("studyBookImages")).slice(0, 160), sourcePath:group.sourcePath,
      generation, pages:refs, content:"", extension:"", bookmark:old && old.bookmark ? old.bookmark : null,
      createdAt:old ? old.createdAt : now, updatedAt:now };
    await studyWriteImageRecord(id, record, old, refs);
    return "ok";
  } catch (error) {
    studyDBDeleteMany("pages", refs.map(page => page.key)).catch(() => {});
    if (error && error.studyCancelled) return "cancelled";
    studyFail(error);
    return "error";
  }
}
/* アルバム（1冊）のアプリ上限（trk139）。archive の1ページ上限は圧縮爆弾対策として常に固定する。 */
function studyAlbumLimits({ archive = false } = {}) {
  return { count:studyCap(STUDY_IMAGE_MAX_COUNT), bytes:studyCap(STUDY_IMAGE_MAX_BYTES),
    file:archive ? STUDY_IMAGE_FILE_MAX : studyCap(STUDY_IMAGE_FILE_MAX) };
}
/* 上限で止めた理由の文言（{key, vars}）。取り込みの開始で状態欄が消えるため、集計のあとに出す。 */
function studyAlbumMessage(problem) {
  if (problem.kind === "file") return { key:"studyFileTooBig", vars:{ name:problem.name, mb:Math.round(problem.max / 1048576) } };
  return { key:"studyTooMany", vars:{ max:STUDY_IMAGE_MAX_COUNT, mb:Math.round(STUDY_IMAGE_MAX_BYTES / 1048576) } };
}
/* 止めた理由を状態欄に出す。1冊も入らなかったときは最初の理由だけ。途中まで入ったときは、集計に理由を添える（trk139）。 */
function studyShowNotes(notes) {
  if (!notes.length) return;
  const st = studyImportState;
  if (!st.added && !st.kept) { studySetStatus(notes[0].key, notes[0].vars); return; }
  const note = notes.slice(0, 2).map(item => tr(item.key, item.vars)).join(" / ") + (notes.length > 2 ? " …" : "");
  studySetStatus("studyImportWithNote", { summary:tr("studyImportSummary", { added:st.added, kept:st.kept, failed:st.failed }), note });
}
async function studyImportImages(files) {
  if (studySafeMode()) { studyNotify("studySafeMode"); return; }
  if (studyImportState.active) return;
  const groups = STUDY_UTIL.groupImageFiles(files, studyPrefs.albumNesting);
  if (!groups.length) { studyNotify("studyNoImageFiles"); return; }
  const limits = studyAlbumLimits(), accepted = [], notes = [];
  let rejected = 0;
  for (const group of groups) {
    const problem = STUDY_UTIL.albumProblem(group.files.map(item => ({ name:item.file.name || item.path, size:item.file.size })), limits);
    if (problem) { notes.push(studyAlbumMessage(problem)); rejected++; continue; }
    accepted.push(group);
  }
  const tasks = accepted.map(group => ({ group, id:STUDY_UTIL.stableId("image", group.sourcePath) }));
  const known = new Set(studyBooks.map(book => book.id));
  const replaceCount = tasks.filter(task => known.has(task.id)).length;
  const replace = !replaceCount || confirm(tr("studyImportAsk", { count:replaceCount }));
  const total = tasks.reduce((sum, task) => sum + task.group.files.length, 0);
  let position = 0, lastId = "";
  studyImportStart(total);
  studyImportState.failed += rejected;
  try {
    for (const task of tasks) {
      if (studyImportState.cancelled) break;
      if (!known.has(task.id) && known.size >= studyCap(STUDY_SHELF_MAX)) { studyImportState.failed++; studySetStatus("studyShelfLimit"); position += task.group.files.length; studyImportTick(position, total); continue; }
      if (!replace && known.has(task.id)) { studyImportState.kept++; position += task.group.files.length; studyImportTick(position, total); continue; }
      const result = await studyImportImageGroup(task.group, task.id, position, total);
      if (result === "ok") { studyImportState.added++; known.add(task.id); lastId = task.id; }
      else if (result === "error") studyImportState.failed++;
      else break;
      position += task.group.files.length;
      studyImportTick(position, total);
    }
    await studyRefreshBooks();
  } catch (error) { studyImportEnd(); studyFail(error); return; }
  const cancelled = studyImportState.cancelled;
  if (cancelled) { const added = studyImportState.added; studyImportEnd("studyImportCancelled", { n:added }); }
  else await studyImportSummary();
  if (lastId && !cancelled) { const newest = studyBooks.find(book => book.id === lastId); if (newest) studyOpenBook(newest); }
  if (!cancelled) studyShowNotes(notes);   /* 本を開くと状態欄が消えるので、開いたあとに出す */
}
/* ============ 📂 共有フォルダー（フォルダのまま読む本）・trk208 ============
   これまでの画像の取り込みは「端末の中へコピーする」方式だったので、何千枚もあるフォルダーでは
   容量を大きく食っていた。ここでは**フォルダーを1回選んで覚える**だけにして、ページは開くたびに
   そのフォルダーから読む（＝本棚には「目次」だけを置く）。
   ・ハンドルは shadow_taiko_library の kv（"studyFolders"）へ構造化複製で保存 → 次回も同じフォルダー
   ・本の id は「フォルダー名＋フォルダー内のパス」から作るので、端末が変わっても同じ本として扱える
   ・pages ストアには何も入れない（バックアップにも実体は入らない＝容量を食わない）
   ・許可が切れていたら、📂 からもう一度選んでもらう（読み取り専用。フォルダーは書き換えない）
   ⚠ 画像は端末の外へ送りません（読むだけ）。 */
let studySharedFolders = [];   /* [{ id, name, handle, addedAt }] */
let studySharedLoaded = false, studySharedKV = null;
function studySharedStore() { return studySharedKV || (studySharedKV = core.idbStore("shadow_taiko_library", "kv")); }
function studyCanPickFolder() {
  return typeof window.showDirectoryPicker === "function" && window.isSecureContext && window.self === window.top;
}
async function studySharedFoldersLoad() {
  if (studySafeMode()) { studySharedFolders = []; studySharedLoaded = true; return []; }
  let list = [];
  try { list = await studySharedStore().get("studyFolders") || []; } catch (_) { list = []; }
  const kept = [];
  for (const item of Array.isArray(list) ? list : []) {
    const handle = item && item.handle;
    if (!handle || handle.kind !== "directory" || typeof item.name !== "string" || !item.name) continue;
    kept.push({ id:String(item.id || item.name).slice(0, 200), name:String(item.name).slice(0, 200),
      handle, addedAt:Math.max(0, Number(item.addedAt) || 0) });
  }
  studySharedFolders = kept; studySharedLoaded = true;
  return kept;
}
async function studySharedFoldersSave() {
  try { await studySharedStore().put("studyFolders", studySharedFolders); return true; }
  catch (error) { console.warn("Study shared folders could not be saved", error); return false; }
}
function studySharedFolderByName(name) {
  const want = String(name || "");
  return want ? studySharedFolders.find(folder => folder.name === want) || null : null;
}
/* 許可が生きているか確かめる。prompt のときは**クリックの中**でだけ確認を出す（force） */
async function studySharedFolderPermission(entry, force) {
  if (!entry || !entry.handle) return "denied";
  let permission = await entry.handle.queryPermission({ mode:"read" }).catch(() => "prompt");
  if (permission === "prompt" && force) permission = await entry.handle.requestPermission({ mode:"read" }).catch(() => "denied");
  return permission;
}
/* 開くときに呼ぶ。許可が切れていれば、その場で1回だけ確認を出す */
async function studySharedFolderEnsure(book) {
  const entry = studySharedFolderByName(book && book.sharedFolder);
  if (!entry) { studySetStatus("studyFolderMissing", { name:String(book && book.sharedFolder || "") }); return null; }
  const permission = await studySharedFolderPermission(entry, true);
  if (permission !== "granted") { studySetStatus("studyFolderPermission", { name:entry.name }); return null; }
  return entry;
}
/* 1ページをフォルダーから読む（読めなければ null＝表示側が理由を出す） */
async function studySharedPageBlob(book, page) {
  if (!book || !book.linked || !page) return null;
  const entry = studySharedFolderByName(book.sharedFolder);
  if (!entry || !TrkSharedFolders) return null;
  try {
    if (await studySharedFolderPermission(entry, false) !== "granted") return null;
    return await TrkSharedFolders.readFileAt(entry.handle, page.path);
  } catch (_) { return null; }
}
/* 📂 フォルダーを選んで、フォルダのまま読む本として本棚に並べる */
async function studyShareImageFolder() {
  if (studySafeMode()) { studyNotify("studySafeMode"); return; }
  if (studyImportState.active) return;
  if (!studyCanPickFolder()) { studyNotify("studyFolderUnsupported"); core.$("studyImageFolderInput").click(); return; }
  let handle = null;
  try { handle = await window.showDirectoryPicker({ id:"trk-study-folder", mode:"read", startIn:"pictures" }); }
  catch (error) {
    if (error && error.name === "AbortError") return;   /* キャンセルは何もしない */
    studySetStatus("studyFolderDenied"); return;
  }
  await studyImportSharedFolder(handle);
}
/* 📂 trk210：同じ名前の**別の**フォルダー（D:\\Manga と E:\\Manga など）を選んだときに、
   前のフォルダーの本を「フォルダーから消えた本」として外してしまわないよう、別の名前で並べる。
   isSameEntry で同じフォルダーだと分かったとき（許可が切れて選び直したときなど）は今までどおり同じ名前。 */
async function studySharedFolderNameFor(handle) {
  const base = String(handle && handle.name || "Folder").slice(0, 190);
  if (!studySharedLoaded) await studySharedFoldersLoad();
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? base : `${base} (${n})`;
    const existing = studySharedFolderByName(candidate);
    if (!existing) return candidate;
    let same = true;   /* isSameEntry が無い環境では今までどおり（名前で同じとみなす） */
    try { if (typeof existing.handle.isSameEntry === "function") same = await existing.handle.isSameEntry(handle); } catch (_) {}
    if (same) return candidate;
  }
  return base;
}
/* 📂 trk210：本棚からリンク本が全部消えたフォルダーは、覚えているハンドルも外す。
   （本を消してもフォルダーの記録だけ残る、を防ぐ。1冊でも残っていれば何もしない） */
async function studySharedFoldersPrune() {
  if (!studySharedFolders.length) return;
  const inUse = new Set(STUDY_UTIL.sharedFoldersInUse(studyBooks));
  const kept = studySharedFolders.filter(folder => inUse.has(folder.name));
  if (kept.length === studySharedFolders.length) return;
  studySharedFolders = kept;
  await studySharedFoldersSave();
}
async function studyImportSharedFolder(handle) {
  const name = await studySharedFolderNameFor(handle);
  const entry = { id:`study:${name}`, name, handle, addedAt:Date.now() };
  if (await studySharedFolderPermission(entry, true) !== "granted") { studySetStatus("studyFolderDenied"); return; }
  studySetStatus("studyFolderScanning", { name, n:0 });
  let walked = { entries:[], skipped:0 };
  try {
    walked = await TrkSharedFolders.walk(handle, { read:false, maxFiles:TrkSharedFolders.MAX_IMAGES,
      accept:leaf => STUDY_UTIL.isImageFile({ name:leaf }),
      onProgress:n => studySetStatus("studyFolderScanning", { name, n }) });
  } catch (error) { studyFail(error, "studyFolderDenied"); return; }
  const groups = STUDY_UTIL.folderBookGroups(walked.entries, studyPrefs.albumNesting);
  if (!groups.length) { studySetStatus("studyNoImageFiles"); return; }
  if (!studySharedLoaded) await studySharedFoldersLoad();
  const known = new Set(studyBooks.map(book => book.id)), now = Date.now();
  const items = groups.map(group => ({ group, id:STUDY_UTIL.stableId("link", `${name}:${group.sourcePath}`) }));
  let added = 0, replaced = 0, pages = 0, full = 0;
  const ids = new Set();
  for (const item of items) {
    if (!known.has(item.id) && known.size >= studyCap(STUDY_SHELF_MAX)) { full++; continue; }
    const old = await studyExistingBook(item.id);
    const refs = item.group.pages.map((page, index) => ({
      key:`link:${item.id}:${index}`,
      name:String(page.name || "page").slice(0, 240), path:String(page.path || page.name).slice(0, 500),
      size:Math.max(0, Number(page.size) || 0), type:String(STUDY_UTIL.mimeOf(page.name) || "").slice(0, 100)
    }));
    const record = { id:item.id, kind:"image", linked:true, sharedFolder:name,
      title:String(item.group.title || tr("studyBookImages")).slice(0, 160),
      sourcePath:String(item.group.sourcePath || "").slice(0, 1000), generation:"", pages:refs,
      content:"", extension:"", bookmark:old && old.bookmark ? old.bookmark : null,
      createdAt:old ? old.createdAt : now, updatedAt:now };
    /* 保存の口は画像の本と同じ（ジャケットの付け替え・古い参照の掃除もここで揃う）。
       📂 の本は pages に実体が無いので、消すものは何も無い。 */
    try { await studyWriteImageRecord(item.id, record, old, refs); }
    catch (error) { studyFail(error); return; }
    ids.add(item.id); pages += refs.length;
    if (known.has(item.id)) replaced++; else { added++; known.add(item.id); }
  }
  /* フォルダーから消えた本（このフォルダーのリンク本だけ）は本棚から外す。保存した実体は無いので消すものは無い */
  const gone = studyBooks.filter(book => book.linked && book.sharedFolder === name && !ids.has(book.id));
  for (const book of gone) {
    try { await studyDBRun("books", "readwrite", store => store.delete(book.id)); } catch (_) {}
    for (const [songKey, art] of await studyDBPairs("covers")) if (art && art.bookId === book.id) {
      try { await studyDBRun("covers", "readwrite", store => store.delete(songKey)); core.emit("studyCoverChanged", songKey); } catch (_) {}
    }
  }
  const stored = studySharedFolderByName(name);
  if (stored) { stored.handle = handle; stored.addedAt = now; }
  else studySharedFolders.push(entry);
  await studySharedFoldersSave();
  await studyRefreshBooks();
  studySetStatus("studyFolderAdded", { name, books:added + replaced, pages, gone:gone.length, skipped:walked.skipped, full });
}

/* CBZ／ZIP（trk138）。1ファイル＝1冊。中の画像を自然順のページにし、1枚ずつ解凍して CRC を確かめ、バッチで保存する。 */
async function studyImportArchiveBook(job, position, total) {
  const { file, zip, pages, id } = job;
  const old = await studyExistingBook(id);
  const generation = studyNewGeneration(), refs = [];
  const zipIO = window.Trk.zipIO, pageMax = STUDY_IMAGE_FILE_MAX;   /* 圧縮爆弾対策の展開上限は「無視」設定でも残す */
  try {
    for (let i = 0; i < pages.length; i += STUDY_BATCH_WRITE) {
      if (studyImportState.cancelled) throw Object.assign(new Error("Study import cancelled"), { studyCancelled:true });
      const batch = [];
      for (let j = i; j < Math.min(i + STUDY_BATCH_WRITE, pages.length); j++) {
        const entry = pages[j], key = `page:${id}:${generation}:${j}`, type = STUDY_UTIL.mimeOf(entry.name);
        const blob = await zipIO.zipEntryBlob(zip, entry, pageMax, true);
        if (blob.size !== entry.usize) throw new zipIO.ZipIOError("zipCorrupt");
        refs.push({ key, name:String(entry.name).split("/").pop().slice(0, 240), path:String(entry.name).slice(0, 500), size:entry.usize, type });
        batch.push([key, new Blob([blob], { type })]);
      }
      await studyDBBatch("pages", batch);
      studyImportTick(position + Math.min(i + STUDY_BATCH_WRITE, pages.length), total);
    }
    const now = Date.now();
    const record = { id, kind:"image", title:STUDY_UTIL.baseName(file.name).slice(0, 160), sourcePath:`archive:${file.name}`.slice(0, 1000),
      generation, pages:refs, content:"", extension:"", bookmark:old && old.bookmark ? old.bookmark : null,
      createdAt:old ? old.createdAt : now, updatedAt:now };
    await studyWriteImageRecord(id, record, old, refs);
    return "ok";
  } catch (error) {
    studyDBDeleteMany("pages", refs.map(page => page.key)).catch(() => {});
    if (error && error.studyCancelled) return "cancelled";
    if (error instanceof zipIO.ZipIOError) { studySetStatus("studyArchiveBad", { name:file.name }); return "error"; }
    studyFail(error);
    return "error";
  }
}
async function studyImportArchives(files) {
  if (studySafeMode()) { studyNotify("studySafeMode"); return; }
  if (studyImportState.active) return;
  const zipIO = window.Trk.zipIO;
  const jobs = [], notes = [];
  let listFailed = 0;
  const limits = studyAlbumLimits({ archive:true });   /* 展開後の1ページ上限だけは常に固定 */
  for (const file of files) {
    try {
      const zip = await zipIO.zipOpen(file);
      const pages = STUDY_UTIL.archivePages(zip.entries);
      if (!pages.length) { notes.push({ key:"studyArchiveNoImages", vars:{ name:file.name } }); listFailed++; continue; }
      const problem = STUDY_UTIL.albumProblem(pages.map(entry => ({ name:entry.name, size:entry.usize })), limits);
      if (problem) { notes.push(studyAlbumMessage(problem)); listFailed++; continue; }
      jobs.push({ file, zip, pages, id:STUDY_UTIL.stableId("archive", file.name) });
    } catch (error) {
      if (error instanceof zipIO.ZipIOError) notes.push({ key:"studyArchiveBad", vars:{ name:file.name } });
      else { console.error(error); notes.push({ key:"studyStorageError" }); }
      listFailed++;
    }
  }
  if (!jobs.length && !listFailed) return;
  const known = new Set(studyBooks.map(book => book.id));
  const replaceCount = jobs.filter(job => known.has(job.id)).length;
  const replace = !replaceCount || confirm(tr("studyImportAsk", { count:replaceCount }));
  const total = jobs.reduce((sum, job) => sum + job.pages.length, 0);
  let position = 0, lastId = "";
  studyImportStart(total);
  studyImportState.failed += listFailed;
  try {
    for (const job of jobs) {
      if (studyImportState.cancelled) break;
      if (!known.has(job.id) && known.size >= studyCap(STUDY_SHELF_MAX)) { studyImportState.failed++; studySetStatus("studyShelfLimit"); position += job.pages.length; studyImportTick(position, total); continue; }
      if (!replace && known.has(job.id)) { studyImportState.kept++; position += job.pages.length; studyImportTick(position, total); continue; }
      const result = await studyImportArchiveBook(job, position, total);
      if (result === "ok") { studyImportState.added++; known.add(job.id); lastId = job.id; }
      else if (result === "error") studyImportState.failed++;
      else break;
      position += job.pages.length;
      studyImportTick(position, total);
    }
    await studyRefreshBooks();
  } catch (error) { studyImportEnd(); studyFail(error); return; }
  const cancelled = studyImportState.cancelled;
  if (cancelled) { const added = studyImportState.added; studyImportEnd("studyImportCancelled", { n:added }); }
  else await studyImportSummary();
  if (lastId && !cancelled) { const newest = studyBooks.find(book => book.id === lastId); if (newest) studyOpenBook(newest); }
  if (!cancelled) studyShowNotes(notes);   /* 本を開くと状態欄が消えるので、開いたあとに出す */
}
async function studyImportTextEntry(entry, id, position, total) {
  const file = entry.file, size = Number(file.size) || 0;
  if (size > studyCap(STUDY_TEXT_FILE_MAX)) { studySetStatus("studyTextTooBig", { name:file.name, mb:Math.round(STUDY_TEXT_FILE_MAX / 1048576) }); return "error"; }
  if (studyCurrentBook && studyCurrentBook.id === id && !core.$("studyMemoEditor").hidden) {
    if (!await studyFlushMemo(true)) return "error";
    core.$("studyMemoEditor").readOnly = false; core.$("studyMemoEditor").hidden = true;
    core.$("studyEditorNotice").hidden = true; core.$("studyTextPage").hidden = false;
    core.$("studyMemoBtn").textContent = tr("studyMemoEdit"); core.$("studyMemoExportBtn").hidden = false;
    studyRenderTextContent(studyCurrentBook); studySyncTextProgress();
  }
  let old = null;
  try { old = await studyExistingBook(id); }
  catch (error) { studyFail(error); return "error"; }
  let content;
  try { content = STUDY_UTIL.decodeTextBuffer(await file.arrayBuffer()); }
  catch (error) { console.error(error); studySetStatus("studyDecodeError", { name:file.name }); return "error"; }
  try {
    const now = Date.now();
    const record = { id, kind:"text", title:String(entry.title || STUDY_UTIL.baseName(file.name)).slice(0, 160), sourcePath:entry.path,
      generation:"", pages:[], content, extension:STUDY_UTIL.extension(file.name), bookmark:old && old.bookmark ? old.bookmark : null,
      createdAt:old ? old.createdAt : now, updatedAt:now };
    await studyDBRun("books", "readwrite", store => store.put(record, id));
    studyImportTick(position + 1, total);
    return "ok";
  } catch (error) { studyFail(error); return "error"; }
}
async function studyImportTexts(files) {
  if (studySafeMode()) { studyNotify("studySafeMode"); return; }
  if (studyImportState.active) return;
  const entries = STUDY_UTIL.listTextFiles(files);
  if (!entries.length) { studyNotify("studyNoTextFiles"); return; }
  if (entries.length > studyCap(STUDY_TEXT_BATCH_MAX)) { studySetStatus("studyTextBatchLimit"); return; }
  const tasks = entries.map(entry => ({ entry, id:STUDY_UTIL.stableId("text", entry.path) }));
  const known = new Set(studyBooks.map(book => book.id));
  const replaceCount = tasks.filter(task => known.has(task.id)).length;
  const replace = !replaceCount || confirm(tr("studyImportAsk", { count:replaceCount }));
  let lastId = "";
  studyImportStart(entries.length);
  try {
    for (let i = 0; i < tasks.length; i++) {
      if (studyImportState.cancelled) break;
      const task = tasks[i];
      if (!known.has(task.id) && known.size >= studyCap(STUDY_SHELF_MAX)) { studyImportState.failed++; studySetStatus("studyShelfLimit"); continue; }
      if (!replace && known.has(task.id)) { studyImportState.kept++; studyImportTick(i + 1, entries.length); continue; }
      const result = await studyImportTextEntry(task.entry, task.id, i, entries.length);
      if (result === "ok") { studyImportState.added++; known.add(task.id); lastId = task.id; }
      else if (result === "error") studyImportState.failed++;
      else break;
    }
    await studyRefreshBooks();
  } catch (error) { studyImportEnd(); studyFail(error); return; }
  const cancelled = studyImportState.cancelled;
  if (cancelled) { const added = studyImportState.added; studyImportEnd("studyImportCancelled", { n:added }); }
  else await studyImportSummary();
  if (lastId && !cancelled) { const newest = studyBooks.find(book => book.id === lastId); if (newest) studyOpenBook(newest); }
}
function studyNewGeneration() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }

/* ============ 画像の表示 ============ */
/* 保存済みの値が Blob かどうかは、別の実行環境で作られた Blob でも通るように型名ではなく形で判断します。 */
function studyIsBlob(value) {
  return !!value && typeof value === "object" && typeof value.size === "number" && typeof value.slice === "function";
}
/* 画像の URL は見えているページの分だけ作り、離れたらすぐ解放します（縦読みの長い本で特に大事）。 */
function studyClearImage(img) {
  const url = img && img.dataset.studyObjectUrl;
  if (url) {
    try { if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url); } catch (_) {}
    studyObjectUrls.delete(url); delete img.dataset.studyObjectUrl;
  }
  if (img) { delete img.dataset.studyLoadToken; img.removeAttribute("src"); img.hidden = true; }
}
function studySetImage(img, blob, alt) {
  studyClearImage(img);
  if (!img || !studyIsBlob(blob) || typeof URL.createObjectURL !== "function") return false;
  let url = "";
  try { url = URL.createObjectURL(blob); } catch (_) { return false; }
  studyObjectUrls.add(url); img.dataset.studyObjectUrl = url; img.alt = alt || ""; img.src = url; img.hidden = false;
  return true;
}
/* 画像の高さが決まるまで待ちます（拡大中の「続きの端から開く」ため。失敗・2秒で先へ進む）。 */
function studyImageReady(img) {
  if (!img || !img.src || (img.complete && img.naturalWidth > 0)) return Promise.resolve();
  return new Promise(resolve => {
    let settled = false;
    const finish = () => { if (settled) return; settled = true; clearTimeout(timer); resolve(); };
    const timer = setTimeout(finish, 2000);
    img.addEventListener("load", finish, { once:true });
    img.addEventListener("error", finish, { once:true });
  });
}
function studyClearVerticalPages() {
  if (studyVerticalObserver) { studyVerticalObserver.disconnect(); studyVerticalObserver = null; }
  const box = core.$("studyVerticalPages");
  for (const img of box.querySelectorAll("img")) studyClearImage(img);
  box.textContent = ""; studyVerticalBookId = "";
}
function studyClearPageImages() {
  studyRenderToken++;
  for (const id of ["studyPageSingle", "studyPageLeft", "studyPageRight"]) studyClearImage(core.$(id));
  studyClearVerticalPages();
}
async function studyLoadPageImage(img, index, book = studyCurrentBook) {
  const page = book && book.kind === "image" ? studyPageAt(book, index) : null;
  if (!page) { studyClearImage(img); return; }
  const renderToken = studyRenderToken, loadToken = String(++studyImageLoadSeq);
  img.dataset.studyLoadToken = loadToken;
  try {
    /* 📂 trk208：フォルダーのまま読む本は、保存せずに毎回フォルダーから読む */
    const blob = book.linked ? await studySharedPageBlob(book, page) : await studyDBRun("pages", "readonly", store => store.get(page.key));
    if (img.dataset.studyLoadToken !== loadToken || book !== studyCurrentBook || renderToken !== studyRenderToken) return;
    if (!studyIsBlob(blob)) {
      studyClearImage(img);
      if (book.linked) studySetStatus("studyFolderPageMissing", { name:page.name }); else studySetStatus("studyImageLoadError");
      return;
    }
    if (!studySetImage(img, blob, `${book.title} — ${page.name} (${index + 1})`)) studySetStatus("studyImageLoadError");
    await studyImageReady(img);
  } catch (error) {
    if (img.dataset.studyLoadToken === loadToken) { studyClearImage(img); studyFail(error, "studyImageLoadError"); }
  }
}
function studySyncPageCount() {
  const book = studyCurrentBook;
  if (!book || book.kind !== "image") return;
  const total = book.pages.length;
  const progress = core.$("studyProgress"), mode = studyPrefs.imageMode;
  progress.max = String(Math.max(0, total - 1)); progress.step = mode === "spread" ? "2" : "1";
  progress.value = String(Math.max(0, Math.min(total - 1, studyCurrentPage)));
  let label = tr("studyPagesStatus", { current:Math.min(total, studyCurrentPage + 1), total });
  if (mode === "spread" && total) label = tr("studyPageRange", { first:studyCurrentPage + 1, last:Math.min(total, studyCurrentPage + 2), total });
  core.$("studyPageCount").textContent = label;
  core.$("studyImageHint").textContent = tr(mode === "vertical" ? "studyVerticalHint" : "studyTapHint");
  const canPrev = studyCurrentPage > 0;
  const canNext = mode === "vertical" ? true : studyCurrentPage < total - 1;
  core.$("studyPrevBtn").disabled = !canPrev;
  core.$("studyNextBtn").disabled = !canNext;
  const american = studyPrefs.american;
  core.$("studyNextBtn").textContent = tr(american ? "studyNextRightOnly" : "studyNext");
  core.$("studyPrevBtn").textContent = tr(american ? "studyPreviousLeftOnly" : "studyPrevious");
  studyRefreshCoverButtons();
}
function studyNormalizePage(page) {
  if (!studyCurrentBook || studyCurrentBook.kind !== "image") return 0;
  const last = Math.max(0, studyCurrentBook.pages.length - 1);
  let index = Math.max(0, Math.min(last, Math.round(Number(page) || 0)));
  if (studyPrefs.imageMode === "spread") index = Math.min(last, Math.floor(index / 2) * 2);
  return index;
}
function studyJumpToPage(page, restoreVertical = false) {
  if (!studyCurrentBook || studyCurrentBook.kind !== "image") return;
  studyCurrentPage = studyNormalizePage(page);
  studySyncPageCount();
  if (studyPrefs.imageMode === "vertical") {
    const target = core.$("studyVerticalPages").querySelector(`[data-page-index="${studyCurrentPage}"]`);
    if (target && typeof target.scrollIntoView === "function") target.scrollIntoView({ block:restoreVertical ? "start" : "center", behavior:restoreVertical ? "auto" : "smooth" });
    else if (!target) core.$("studyImageStage").scrollTop = 0;
    return;
  }
  studyRenderImagePage();
}
async function studyRenderImagePage() {
  const book = studyCurrentBook;
  if (!book || book.kind !== "image") return;
  core.$("studyImageStage").dataset.mode = studyPrefs.imageMode;
  if (studyPrefs.imageMode === "vertical") {
    for (const id of ["studyPageSingle", "studyPageLeft", "studyPageRight"]) studyClearImage(core.$(id));
    core.$("studySingleWrap").hidden = true; core.$("studySpreadWrap").hidden = true; core.$("studyVerticalPages").hidden = false;
    studyBuildVerticalPages();
    const target = core.$("studyVerticalPages").children[studyCurrentPage];
    if (target && typeof target.scrollIntoView === "function") requestAnimationFrame(() => { target.scrollIntoView({ block:"start", behavior:"auto" }); studyVerticalScroll(); });
    else studyVerticalScroll();
    studyZoomLand = ""; studySyncPageCount(); studyApplyZoom(false); return;
  }
  studyClearVerticalPages();
  core.$("studyVerticalPages").hidden = true;
  const token = ++studyRenderToken;
  if (studyPrefs.imageMode === "spread") {
    studyClearImage(core.$("studyPageLeft")); studyClearImage(core.$("studyPageRight"));
    core.$("studySingleWrap").hidden = true; core.$("studySpreadWrap").hidden = false;
    const leftIndex = studyPrefs.american ? studyCurrentPage : studyCurrentPage + 1;
    const rightIndex = studyPrefs.american ? studyCurrentPage + 1 : studyCurrentPage;
    await Promise.all([studyLoadPageImage(core.$("studyPageLeft"), leftIndex, book), studyLoadPageImage(core.$("studyPageRight"), rightIndex, book)]);
  } else {
    studyClearImage(core.$("studyPageSingle"));
    core.$("studySingleWrap").hidden = false; core.$("studySpreadWrap").hidden = true;
    await studyLoadPageImage(core.$("studyPageSingle"), studyCurrentPage, book);
  }
  if (token === studyRenderToken) { studySyncPageCount(); studyApplyZoom(false); studyApplyZoomLand(); }
}
function studyBuildVerticalPages() {
  const book = studyCurrentBook, box = core.$("studyVerticalPages");
  const cacheKey = book ? `${book.id}:${book.generation}:${studyPrefs.imageOrder}` : "";
  if (!book || studyVerticalBookId === cacheKey) return;
  studyClearVerticalPages();
  studyVerticalBookId = cacheKey;
  for (let index = 0; index < book.pages.length; index++) {
    const page = studyPageAt(book, index);
    const item = core.el("div", "study-vertical-item"); item.dataset.pageIndex = String(index);
    const img = core.el("img", "study-page-image study-vertical-image"); img.alt = `${book.title} — ${page ? page.name : index + 1} (${index + 1})`;
    img.loading = "lazy"; img.draggable = false; item.append(img); box.append(item);
  }
  if ("IntersectionObserver" in window) {
    studyVerticalObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const img = entry.target.querySelector("img"), index = Number(entry.target.dataset.pageIndex);
        if (entry.isIntersecting) {
          if (!img.dataset.studyObjectUrl) studyLoadPageImage(img, index, book);
          const r = entry.target.getBoundingClientRect(), stageRect = core.$("studyImageStage").getBoundingClientRect();
          if (r.top <= stageRect.top + stageRect.height * .55 && r.bottom >= stageRect.top + stageRect.height * .18) {
            studyCurrentPage = index; studySyncPageCount();
          }
        } else studyClearImage(img);
      }
    }, { root:core.$("studyImageStage"), rootMargin:"120% 0px" });
    for (const item of box.children) studyVerticalObserver.observe(item);
  } else studyVerticalScroll();
}

/* ============ 画像の拡大 ============ */
function studyZoomStepPercent() { return studyZoomPercentStep(studyPrefs.zoomPercentStep); }
/* いまの倍率を、選んだ送り幅（％）の刻みに丸めます。ピンチの終わりなどに使います。 */
function studySnapZoom(value) {
  const step = studyZoomStepPercent();
  const percent = Math.round((Number(value) || 1) * 100);
  const zoom = Math.round(Math.max(STUDY_ZOOM_MIN * 100, Math.min(STUDY_ZOOM_MAX * 100, Math.round(percent / step) * step))) / 100;
  return Math.round(zoom * 100) / 100;
}
/* 全画面中だけの表示制約。保存済みの zoom を上書きしない。CSSの確定した枠で
   object-fit:contain を使う（倍率を1にするだけでは巨大画像の固有サイズではみ出す）。 */
function studyFullscreenFitActive() {
  return studyPrefs.fullscreenFit && core.$("studyRoom").classList.contains("study-fullimage");
}
function studyApplyZoomValue(value) {
  const zoom = Math.max(STUDY_ZOOM_MIN, Math.min(STUDY_ZOOM_MAX, Number(value) || 1));
  const fit = studyFullscreenFitActive();
  if (!fit) studyPrefs.zoom = Math.round(zoom * 100) / 100;
  const displayZoom = fit ? 1 : studyPrefs.zoom;
  const stage = core.$("studyImageStage");
  stage.style.setProperty("--study-zoom", String(displayZoom));
  stage.dataset.fullscreenFit = fit ? "1" : "0";
  stage.dataset.zoomed = displayZoom > 1 ? "1" : "0";
  stage.dataset.zoomActive = !fit && Math.abs(displayZoom - 1) > .001 ? "1" : "0";
  const label = fit ? tr("studyZoomFit") : tr("studyZoomValue", { n:Math.round(displayZoom * 100) });
  core.$("studyZoomLabel").textContent = label; core.$("studyZoomChip").textContent = label;
  core.$("studyZoomOut").disabled = fit || studyPrefs.zoom <= STUDY_ZOOM_MIN + .001;
  core.$("studyZoomIn").disabled = fit || studyPrefs.zoom >= STUDY_ZOOM_MAX - .001;
}
function studyApplyZoom(notify) {
  studyApplyZoomValue(studyPrefs.zoom);
  if (notify && !studyFullscreenFitActive() && Math.abs(studyPrefs.zoom - 1) > .001) studySetStatus("studyZoomHint");
}
function studyStepZoom(direction) {
  const step = studyZoomStepPercent();
  const percent = Math.round(studyPrefs.zoom * 100);
  /* いまの倍率が刻みに乗っていなければ、進む向きの次の目盛りへ（ピンチのあとの半端な倍率からも自然につながるように）。 */
  const next = direction > 0 ? (Math.floor(percent / step) + 1) * step : Math.ceil(percent / step - 1) * step;
  studySetZoom(Math.max(STUDY_ZOOM_MIN * 100, Math.min(STUDY_ZOOM_MAX * 100, next)) / 100, true);
}
/* ⚙の送り幅セレクト：選択肢の文字は言語ごとに作り直します（数字だけなので辞書は {n}% の1つ）。 */
function studySyncZoomStepRow() {
  const select = core.$("studyZoomPercentStep");
  for (const option of select.options) option.textContent = tr("studyZoomStepOption", { n:studyZoomPercentStep(option.value) });
  select.value = String(studyZoomStepPercent());
}
function studySetZoom(value, save = true) {
  if (studyFullscreenFitActive()) return studyPrefs.zoom;
  studyApplyZoomValue(value);
  if (save) studySavePrefs();
  return studyPrefs.zoom;
}
function studyZoomReset() { studySetZoom(1, true); studySetStatus("studyZoomHint"); }
function studySyncZoomRow() {
  const visible = !!studyCurrentBook && studyCurrentBook.kind === "image" && studyPrefs.imageMode !== "vertical";
  core.$("studyZoomGroup").hidden = !visible;
  studyApplyZoomValue(studyPrefs.zoom);
}
/* 拡大してはみ出した画像を ↑ / ↓ で送る（マウスホイールが動かすのと同じ場所）。
   縦読みは台紙（studyImageStage）そのものがスクロールするので対象外。端まで来たら false を返し、
   下の「↑ / ↓でページを移動する」設定やページ送りにゆずります。
   1回押し＝表示高の84%、押しっぱなし（キーリピート）＝6%ずつ。滑らせずにその場で動かします
   （連打や長押しでも、押した回数どおりに進むように）。 */
function studyZoomScrollNodes(includeUnzoomed = false) {
  if (!studyCurrentBook || studyCurrentBook.kind !== "image") return null;
  if (studyPrefs.imageMode === "vertical" || (!includeUnzoomed && studyPrefs.zoom <= 1.001)) return null;
  if (studyPrefs.imageMode === "spread") return [...core.$("studySpreadWrap").querySelectorAll(".study-spread-page")];
  return [core.$("studySingleWrap")];
}
function studyScrollZoomedImage(direction, held) {
  const nodes = studyZoomScrollNodes();
  if (!nodes) return false;
  let moved = false;
  for (const node of nodes) {
    if (!node) continue;
    const extent = node.scrollHeight - node.clientHeight;
    if (extent <= 1) continue;
    const step = held ? Math.max(24, node.clientHeight * .06) : Math.max(48, node.clientHeight * .84);
    const next = Math.max(0, Math.min(extent, node.scrollTop + direction * step));
    if (next === node.scrollTop) continue;
    moved = true;
    node.scrollTop = next;
  }
  return moved;
}
/* 倍率に関係なく、はみ出した画像を、PageDown＝下端／PageUp＝上端へ一度に送ります。
   もう端に着いていたときは、次の／前のページへ移り、続きの端から開きます
   （PageDown＝次のページの上端、PageUp＝前のページの下端）。
   本の端では閉じる動作＝全画面を終了して本棚へ。最終ページの下端だけは設定で停止にもできます。
   送り先が無いときは false を返し、ページ送りにゆずります。
   キーリピート（repeat＝押しっぱなし）のときは、端まで送ったところで止まります。
   次のページへの送り・本を閉じる動作は押し直したときだけで、押しっぱなしでは届きません。
   次のページを描画している間（scrollHeightがまだ0）も、ページ送りに落とさずに止まります。 */
function studyJumpZoomEdge(direction, repeat = false) {
  const nodes = studyZoomScrollNodes(true);
  if (!nodes) return false;
  const targets = nodes.filter(node => node && node.scrollHeight - node.clientHeight > 1);
  /* はみ出していない（画面に収まる・全画面フィット中）なら、押しっぱなしでも従来どおりページ送りへゆずる。
     止めるのは、次のページを描画している間（端からの送りの着地 studyZoomLand が残っている・台紙の高さがまだ0）だけ。
     trk135 で倍率に関係なく端へ送るようにしたとき、収まる画像でも repeat を握りつぶし、長押しで1ページしか進まなくなっていた（trk136） */
  if (!targets.length) return !!repeat && (!!studyZoomLand || nodes.some(node => !node || node.scrollHeight === 0));
  const atEdge = targets.every(node => direction > 0 ? node.scrollTop >= node.scrollHeight - node.clientHeight - 1 : node.scrollTop <= 1);
  if (!atEdge) {
    let moved = false;
    for (const node of targets) {
      const extent = node.scrollHeight - node.clientHeight;
      const next = direction > 0 ? extent : 0;
      if (next === node.scrollTop) continue;
      moved = true;
      node.scrollTop = next;
    }
    return moved;
  }
  if (repeat) return true;   /* 端での「次の／前のページ」と「閉じる」は、押し直したときだけ（キーリピートでは端で止まる） */
  const step = studyPrefs.imageMode === "spread" ? 2 : 1;
  const target = studyNormalizePage(studyCurrentPage + direction * step);
  if (target !== studyCurrentPage) {
    studyZoomLand = direction > 0 ? "top" : "bottom";
    studyJumpToPage(target);
    return true;
  }
  if (direction < 0 || studyPrefs.closeOnLastPageDown) studyCloseToShelf();
  return true;   /* 最後で閉じない設定でもキーを処理済みにし、ページ送りに落とさない */
}
/* 画像の全画面を終了して、本棚（書斎のメニュー）へ戻ります。
   本の端でさらに押したとき（trk123）と、中クリックの「閉じて本棚へ」（trk124）で使います。 */
function studyCloseToShelf() {
  const room = core.$("studyRoom");
  if (room.classList.contains("study-fullimage")) {
    studyFullscreenFallback = false;
    room.classList.remove("study-fullimage");
    if (document.fullscreenElement === room && document.exitFullscreen) {
      try { const done = document.exitFullscreen(); if (done && typeof done.catch === "function") done.catch(() => {}); } catch (_) {}
    }
    studySyncCurrentBookControls(); studySyncFindRow();
  }
  studyBackToShelf();
}
/* ページを移ったあとに開く位置（top＝上端／bottom＝下端）。画像の高さが決まってから当てます。 */
function studyApplyZoomLand() {
  const land = studyZoomLand;
  studyZoomLand = "";
  if (!land) return;
  const nodes = studyZoomScrollNodes(true);
  if (!nodes) return;
  for (const node of nodes) {
    if (!node) continue;
    const extent = node.scrollHeight - node.clientHeight;
    if (extent <= 1) continue;
    node.scrollTop = land === "bottom" ? extent : 0;
  }
}

/* ============ 文章の表示 ============ */
function studySegments(book) { return STUDY_UTIL.aozoraSegments(book && book.content || ""); }
/* 表示に使う文字列（ルビの読みは含めない）。検索位置はこの文字列を基準に数える。 */
function studySearchText(book) { return studySegments(book).map(part => part.ruby || part.text).join(""); }
function studyRenderTextContent(book) {
  const target = core.$("studyTextPage");
  target.textContent = "";
  const frag = document.createDocumentFragment();
  for (const part of studySegments(book)) {
    if (part.ruby) {
      const ruby = document.createElement("ruby"); ruby.append(document.createTextNode(part.ruby));
      const rt = document.createElement("rt"); rt.textContent = part.reading; ruby.append(rt); frag.append(ruby);
    } else frag.append(document.createTextNode(part.text));
  }
  target.append(frag);
}
function studySyncTextProgress() {
  if (!studyCurrentBook || studyCurrentBook.kind !== "text" || core.$("studyMemoEditor").hidden === false) return;
  const node = core.$("studyTextPage"), genko = studyPrefs.theme === "genko";
  const extent = genko ? node.scrollWidth - node.clientWidth : node.scrollHeight - node.clientHeight;
  const offset = genko ? Math.abs(node.scrollLeft) : node.scrollTop;
  const percent = extent > 0 ? Math.max(0, Math.min(100, Math.round(offset / extent * 100))) : 0;
  const stats = STUDY_UTIL.textStats(studyCurrentBook.content);
  core.$("studyTextProgress").hidden = false; core.$("studyTextProgress").textContent = tr("studyTextProgress", { n:percent });
  core.$("studyTextStats").hidden = false; core.$("studyTextStats").textContent = tr("studyTextStats", stats);
}
function studyScrollText(direction) {
  if (!studyCurrentBook || studyCurrentBook.kind !== "text" || !core.$("studyMemoEditor").hidden) return;
  const node = core.$("studyTextPage"), genko = studyPrefs.theme === "genko", step = direction * Math.max(160, (genko ? node.clientWidth : node.clientHeight) * .82);
  /* 古い WebView には scrollBy/scrollTo が無いことがあるので、その場合は直接動かします。 */
  if (typeof node.scrollBy === "function") {
    if (genko) node.scrollBy({ left:-step, behavior:"smooth" });
    else node.scrollBy({ top:step, behavior:"smooth" });
  } else if (genko) node.scrollLeft -= step;
  else node.scrollTop += step;
  setTimeout(studySyncTextProgress, 250);
}
function studyTextEdges(edge) {
  if (!studyCurrentBook || studyCurrentBook.kind !== "text" || !core.$("studyMemoEditor").hidden) return;
  const node = core.$("studyTextPage"), genko = studyPrefs.theme === "genko";
  const target = edge === "start" ? 0 : (genko ? node.scrollWidth : node.scrollHeight);
  if (typeof node.scrollTo === "function") node.scrollTo(genko ? { left:target, behavior:"smooth" } : { top:target, behavior:"smooth" });
  else if (genko) node.scrollLeft = target;
  else node.scrollTop = target;
  setTimeout(studySyncTextProgress, 250);
}

/* ============ 本文の検索 ============ */
function studySyncFindRow() {
  const book = studyCurrentBook;
  const visible = !!book && book.kind === "text" && core.$("studyMemoEditor").hidden;
  core.$("studyFindRow").hidden = !visible || core.$("studyRoom").classList.contains("study-fullimage");
}
function studyUpdateSearchCount() {
  const node = core.$("studyFindCount"), state = studySearchState;
  if (!state.query) { node.textContent = ""; node.dataset.state = ""; return; }
  if (!state.marks.length) { node.textContent = tr("studyBookSearchNone"); node.dataset.state = "none"; return; }
  node.dataset.state = "";
  node.textContent = tr("studyBookSearchCount", { n:state.index + 1, m:state.marks.length }) + (state.capped ? "+" : "");
}
/* ひとつのテキストノードの中だけで一致を着色する（ルビをまたぐ一致は着色しない）。 */
function studyHighlightMatchesInNode(node, query, budget) {
  const positions = STUDY_UTIL.findMatches(node.nodeValue, query, budget);
  let count = 0;
  for (let i = positions.length - 1; i >= 0; i--) {
    const start = positions[i], end = start + query.length;
    if (end > node.nodeValue.length) continue;
    const tail = node.splitText(start);
    tail.splitText(end - start);
    const mark = document.createElement("mark");
    mark.className = "study-search-hit";
    if (tail.parentNode) { tail.parentNode.insertBefore(mark, tail); mark.append(tail); count++; }
  }
  return count;
}
function studyClearSearchMarks() {
  const page = core.$("studyTextPage");
  for (const mark of [...page.querySelectorAll("mark.study-search-hit")]) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }
}
function studyRunSearch(query) {
  const page = core.$("studyTextPage"), text = String(query || "");
  studyClearSearchMarks();
  studySearchState = { query:text, marks:[], index:-1, capped:false };
  if (text) {
    const needle = text.toLocaleLowerCase(), walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || !node.nodeValue) return NodeFilter.FILTER_REJECT;
        if (parent.tagName === "RT") return NodeFilter.FILTER_REJECT;
        if (typeof parent.closest === "function" && parent.closest("mark.study-search-hit")) return NodeFilter.FILTER_REJECT;
        return node.nodeValue.toLocaleLowerCase().includes(needle) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    let total = 0;
    for (const textNode of nodes) {
      if (total >= STUDY_SEARCH_MARK_MAX) { studySearchState.capped = true; break; }
      total += studyHighlightMatchesInNode(textNode, text, STUDY_SEARCH_MARK_MAX - total);
    }
    studySearchState.marks = [...page.querySelectorAll("mark.study-search-hit")];
    studySearchState.index = studySearchState.marks.length ? 0 : -1;
    if (studySearchState.index >= 0) studySearchGo(0, true);
  }
  studyUpdateSearchCount();
}
function studySearchGo(index, quiet) {
  const marks = studySearchState.marks;
  if (!marks.length) { studyUpdateSearchCount(); return; }
  studySearchState.index = ((index % marks.length) + marks.length) % marks.length;
  marks.forEach((mark, i) => { if (i === studySearchState.index) mark.dataset.current = "1"; else delete mark.dataset.current; });
  const current = marks[studySearchState.index];
  /* 作文用紙スキンは横スクロールなので、縦横どちらでも近づくようにしておきます。 */
  if (!quiet && current && typeof current.scrollIntoView === "function") current.scrollIntoView({ block:"center", inline:"center", behavior:"smooth" });
  studyUpdateSearchCount();
}
function studyEndSearch() {
  studyClearSearchMarks();
  studySearchState = { query:"", marks:[], index:-1, capped:false };
  core.$("studyFindInput").value = ""; studyUpdateSearchCount();
  if (studyCurrentBook && studyCurrentBook.kind === "text" && core.$("studyMemoEditor").hidden) core.$("studyTextPage").focus({ preventScroll:true });
}
function studyFocusSearch() {
  const book = studyCurrentBook;
  if (!book || book.kind !== "text" || !core.$("studyMemoEditor").hidden) { studyNotify("studyMemoNeedText"); return; }
  core.$("studyFindRow").hidden = false;
  core.$("studyFindInput").focus({ preventScroll:true }); core.$("studyFindInput").select();
  studySetStatus("studyBookSearchHint");
}

/* ============ 本を開く・閉じる ============ */
function studyRenderCurrentBook() {
  const book = studyCurrentBook;
  if (!book) return;
  studyStopAutoScroll();
  studyClearPageImages(); studyEndSearch();
  const isImage = book.kind === "image";
  core.$("studyImageStage").hidden = !isImage; core.$("studyTextStage").hidden = isImage;
  core.$("studyImageModeRow").hidden = !isImage; core.$("studyImageOrderRow").hidden = !isImage;
  core.$("studyAmericanRow").hidden = !isImage; core.$("studyThemeRow").hidden = isImage;
  core.$("studyTextTuneRow").hidden = isImage; core.$("studyProgressWrap").hidden = !isImage;
  core.$("studyTextProgress").hidden = isImage; core.$("studyTextStats").hidden = isImage;
  core.$("studyAssignCoverBtn").hidden = !isImage; core.$("studyFullscreenBtn").hidden = !isImage;
  core.$("studyCurrentTitle").textContent = book.title;
  core.$("studyCurrentMeta").textContent = isImage ? `${tr("studyBookImages")} · ${tr("studyPageCount", { n:book.pages.length })}`
    : `${tr("studyBookText")} · ${String(book.extension || "TXT").toUpperCase()}`;
  core.$("studyMemoBtn").hidden = isImage;
  core.$("studyMemoExportBtn").hidden = isImage;
  core.$("studyTextStage").dataset.theme = studyPrefs.theme;
  core.$("studyMemoEditor").hidden = true; core.$("studyMemoEditor").readOnly = false;
  core.$("studyTextPage").hidden = false; core.$("studyEditorNotice").hidden = true;
  core.$("studyMemoBtn").textContent = tr("studyMemoEdit");
  if (isImage) {
    studyCurrentPage = studyNormalizePage(book.bookmark ? book.bookmark.index : 0);
    studyRenderImagePage();
  } else {
    studyRenderTextContent(book);
    const bookmark = book.bookmark;
    requestAnimationFrame(() => {
      const node = core.$("studyTextPage");
      if (bookmark) { node.scrollTop = bookmark.top || 0; node.scrollLeft = bookmark.left || 0; }
      studySyncTextProgress();
    });
  }
  studySyncCurrentBookControls(); studySyncFindRow(); studyApplyTVLayout(); studyApplyZoom(false);
}
function studySyncCurrentBookControls() {
  const book = studyCurrentBook;
  core.$("studyImageMode").value = studyPrefs.imageMode;
  core.$("studyImageOrder").value = studyPrefs.imageOrder;
  core.$("studyAmerican").checked = studyPrefs.american;
  core.$("studyTheme").value = studyPrefs.theme;
  core.$("studyTvCheck").checked = studyPrefs.tvEnabled;
  core.$("studyTvPosition").value = studyPrefs.tvPosition;
  core.$("studyMemoBtn").hidden = !book || book.kind !== "text";
  core.$("studyFullscreenBtn").textContent = tr(core.$("studyRoom").classList.contains("study-fullimage") ? "studyFullscreenExit" : "studyFullscreen");
  core.$("studyFullscreenBtn").hidden = !book || book.kind !== "image";
  studySyncAutoScrollBtn();
  studySyncZoomRow();
  if (book && book.kind === "image") studySyncPageCount();
}
async function studyOpenBook(book) {
  if (!book || studyClosePending) return;
  if (studyCurrentBook && !core.$("studyMemoEditor").hidden) {
    if (studyCurrentBook.id === book.id) return;
    if (!await studyFlushMemo(true)) { core.$("studyMemoEditor").focus({ preventScroll:true }); return; }
  }
  /* 📂 trk208：フォルダーのまま読む本は、開く操作の中で許可を確かめる（ブラウザーはクリックの中でしか確認を出せない）。
     確かめられなかったときは、下の studySetStatus(null) で理由を消さない。 */
  const sharedReady = book.linked ? !!(await studySharedFolderEnsure(book)) : true;
  studyCurrentBook = book;
  core.$("studyBookView").hidden = false; studySyncWelcome();
  studyRenderCurrentBook();
  (book.kind === "image" ? core.$("studyImageStage") : core.$("studyTextPage")).focus({ preventScroll:true });
  if (sharedReady) studySetStatus(null);
}
async function studyBackToShelf() {
  if (studyClosePending) return false;
  if (!core.$("studyMemoEditor").hidden) {
    if (!await studyFlushMemo(true)) { core.$("studyMemoEditor").focus({ preventScroll:true }); return false; }
    core.$("studyMemoEditor").readOnly = false; core.$("studyMemoEditor").hidden = true;
    core.$("studyEditorNotice").hidden = true; core.$("studyTextPage").hidden = false; core.$("studyMemoExportBtn").hidden = true;
    core.$("studyMemoBtn").textContent = tr("studyMemoEdit");
  }
  studyEndSearch(); studyCurrentBook = null; studyClearPageImages();
  studyStopAutoScroll();
  core.$("studyBookView").hidden = true;
  studySyncWelcome();
  studyApplyTVLayout();
  return true;
}
function studySaveBook(book) {
  if (!book) return Promise.resolve();
  book.updatedAt = Date.now();
  return studyDBRun("books", "readwrite", store => store.put(book, book.id)).then(studyRefreshBooks);
}
function studyBookmarkData() {
  const book = studyCurrentBook;
  if (!book) return null;
  if (book.kind === "image") return { index:studyCurrentPage, top:0, left:0, ratio:0, savedAt:Date.now() };
  if (!core.$("studyMemoEditor").hidden) return { index:0, top:0, left:0, ratio:0, savedAt:Date.now() };
  const node = core.$("studyTextPage"), genko = studyPrefs.theme === "genko";
  const extent = genko ? node.scrollWidth - node.clientWidth : node.scrollHeight - node.clientHeight;
  const offset = genko ? Math.abs(node.scrollLeft) : node.scrollTop;
  return { index:0, top:Math.max(0, node.scrollTop), left:node.scrollLeft, ratio:extent > 0 ? Math.max(0, Math.min(1, offset / extent)) : 0, savedAt:Date.now() };
}
async function studySaveBookmark() {
  if (!studyCurrentBook) return;
  studyCurrentBook.bookmark = studyBookmarkData();
  try { await studySaveBook(studyCurrentBook); studyNotify("studyBookmarkSaved"); }
  catch (error) { studyFail(error, "studyBookmarkError"); }
}
function studyStep(direction) {
  if (!studyCurrentBook) return;
  if (studyCurrentBook.kind === "text") { studyScrollText(direction); return; }
  if (studyPrefs.imageMode === "vertical") {
    const stage = core.$("studyImageStage"), amount = direction * Math.max(240, stage.clientHeight * .84);
    if (typeof stage.scrollBy === "function") stage.scrollBy({ top:amount, behavior:"smooth" });
    else stage.scrollTop += amount;
    return;
  }
  const step = studyPrefs.imageMode === "spread" ? 2 : 1;
  studyJumpToPage(studyCurrentPage + direction * step);
}
function studyStepPhysical(side) {
  const left = side === "left", american = studyPrefs.american && studyCurrentBook && studyCurrentBook.kind === "image";
  const next = american ? !left : left;
  studyStep(next ? 1 : -1);
}
function studyJumpFromSlider() {
  if (!studyCurrentBook || studyCurrentBook.kind !== "image") return;
  studyJumpToPage(Number(core.$("studyProgress").value), true);
}
function studyShowProgress() {
  if (!studyCurrentBook || studyCurrentBook.kind !== "image") return;
  core.$("studyProgressWrap").hidden = false; core.$("studyRoom").classList.add("study-progress-visible");
  core.$("studyProgress").focus({ preventScroll:true }); studySetStatus("studyProgressHint");
}
function studyHideProgress() {
  core.$("studyProgressWrap").hidden = true; core.$("studyRoom").classList.remove("study-progress-visible");
  if (studyRoomOpen && studyCurrentBook && studyCurrentBook.kind === "image") core.$("studyImageStage").focus({ preventScroll:true });
  studySetStatus(null);
}

/* ============ TVペイン（今の曲を流し見する） ============ */
function studySaveVideoHome() {
  if (studyVideoHomeParent && studyVideoHomeParent.isConnected && !core.$("studyTvScreen").contains(core.video)) return;
  studyVideoHomeParent = core.video.parentNode && core.video.parentNode.nodeType === 1 ? core.video.parentNode : document.body;
  studyVideoHomeNext = core.video.nextSibling; studyVideoHomeStyle = core.video.getAttribute("style");
}
function studyMoveVideoToTV() {
  if (!core.video || !core.$("studyTvScreen")) return;
  studySaveVideoHome();
  if (core.video.parentNode !== core.$("studyTvScreen")) core.$("studyTvScreen").insertBefore(core.video, core.$("studyTvArt"));
  core.video.classList.add("study-tv-video-visible");
  try { if (typeof newVideoFilter === "function") core.video.style.filter = newVideoFilter(); } catch (_) {}
}
function studyRestoreVideoHome() {
  if (!core.video) return;
  const home = studyVideoHomeParent && studyVideoHomeParent.isConnected ? studyVideoHomeParent : document.body;
  if (core.video.parentNode !== home) {
    const before = studyVideoHomeNext && studyVideoHomeNext.parentNode === home ? studyVideoHomeNext : null;
    home.insertBefore(core.video, before);
  }
  core.video.classList.remove("study-tv-video-visible", "study-tv-video-hidden");
  if (studyVideoHomeStyle == null) core.video.removeAttribute("style"); else core.video.setAttribute("style", studyVideoHomeStyle);
  /* 次に開くときは、そのときの置き場所をもう一度調べ直す（TVドックが作り直されていても迷子にならない）。 */
  studyVideoHomeParent = null; studyVideoHomeNext = null; studyVideoHomeStyle = null;
}
function studyApplyTVLayout() {
  const active = studyRoomOpen && !!studyCurrentBook && !core.$("studyBookView").hidden && studyPrefs.tvEnabled && studyPrefs.tvPosition !== "off";
  const pane = core.$("studyTvPane"), panels = core.$("studyPanels"), content = core.$("studyContentPane");
  pane.hidden = !active;
  if (!active) { studyRestoreVideoHome(); return; }
  if (studyPrefs.tvPosition === "top") panels.insertBefore(pane, content);
  else if (content.nextElementSibling !== pane) panels.insertBefore(pane, content.nextElementSibling);
  studyMoveVideoToTV(); studyRefreshTV();
}
function studySetTVVisible(hasVideo, hasImage) {
  core.video.classList.toggle("study-tv-video-hidden", !hasVideo);
  core.$("studyTvArt").hidden = !hasImage;
  core.$("studyTvEmpty").hidden = hasVideo || hasImage;
}
async function studyRefreshTV() {
  const token = ++studyTVToken;
  if (!studyRoomOpen || !studyCurrentBook || !studyPrefs.tvEnabled || studyPrefs.tvPosition === "off") return;
  const song = core.currentSong;
  core.$("studyTvLabel").textContent = song ? (song.title || song.key) : "";
  const hasVideo = !!(core.videoReady && core.video.videoWidth > 0 && core.video.videoHeight > 0 && core.settings.videoStyle !== "off");
  if (hasVideo) { studySetTVVisible(true, false); return; }
  let blob = null;
  if (song && window.TrkStudyRoom) blob = await studyGetSongCoverBlob(song.key);
  if (!studyIsBlob(blob) && song && song.bgBlob) blob = song.bgBlob;
  if (!studyIsBlob(blob) && song && song.artBlob) blob = song.artBlob;
  if (!studyIsBlob(blob)) blob = null;
  if (token !== studyTVToken || !studyRoomOpen) return;
  const artKey = song && song.key || "";
  if (blob) {
    if (studyTVArtSong !== artKey || !studyTVArtUrl) {
      studyClearImage(core.$("studyTvArt"));
      studyTVArtUrl = studySetImage(core.$("studyTvArt"), blob, song ? (song.title || song.key) : "") ? (core.$("studyTvArt").dataset.studyObjectUrl || "") : "";
    }
    studyTVArtSong = artKey; studySetTVVisible(false, true);
  } else {
    studyClearImage(core.$("studyTvArt")); studyTVArtUrl = "";
    studyTVArtSong = artKey; studySetTVVisible(false, false);
  }
}
function studySyncTVDirection() {
  let position = core.$("studyTvPosition").value, enabled = core.$("studyTvCheck").checked;
  if (enabled && position === "off") { position = "top"; core.$("studyTvPosition").value = position; }
  if (position === "off") enabled = false;
  studyPrefs.tvEnabled = enabled; studyPrefs.tvPosition = position;
  core.$("studyTvCheck").checked = enabled; studySavePrefs(); studyApplyTVLayout();
}
function studyCycleTV() {
  const enabled = studyPrefs.tvEnabled, position = studyPrefs.tvPosition;
  if (!enabled || position === "off") { studyPrefs.tvEnabled = true; studyPrefs.tvPosition = "top"; }
  else if (position === "top") studyPrefs.tvPosition = "bottom";
  else { studyPrefs.tvEnabled = false; studyPrefs.tvPosition = "off"; }
  core.$("studyTvCheck").checked = studyPrefs.tvEnabled; core.$("studyTvPosition").value = studyPrefs.tvPosition;
  studySavePrefs(); studyApplyTVLayout();
}

/* ============ 曲のジャケット ============ */
async function studyAssignCurrentCover() {
  const book = studyCurrentBook;
  if (!book || book.kind !== "image" || !book.pages.length) { studyNotify("studyCoverNeedImage"); return; }
  if (!core.currentSong) { studyNotify("studyCoverNeedSong"); return; }
  const songKey = core.currentSong.key, songTitle = typeof songDisplayTitle === "function" ? songDisplayTitle(core.currentSong) : core.currentSong.title || core.currentSong.key;
  const index = Math.max(0, Math.min(book.pages.length - 1, studyCurrentPage)), page = studyPageAt(book, index);
  if (!page) { studyNotify("studyCoverNeedImage"); return; }
  try {
    const blob = book.linked ? await studySharedPageBlob(book, page) : await studyDBRun("pages", "readonly", store => store.get(page.key));
    if (!blob) throw new Error("Missing Study image");
    /* 📂 trk208：フォルダーのまま読む本のジャケットは、どのフォルダーのどのパスかも覚える（pages に実体が無いため） */
    const art = { bookId:book.id, pageKey:page.key, pageIndex:index, title:book.title, updatedAt:Date.now() };
    if (book.linked) { art.linked = true; art.sharedFolder = book.sharedFolder; art.path = page.path; }
    await studyDBRun("covers", "readwrite", store => store.put(art, songKey));
    core.emit("studyCoverChanged", songKey);
    studyNotify("studyCoverAssigned", { title:songTitle });
    studyRefreshTV(); studyRefreshCoverButtons();
  } catch (error) { studyFail(error, "studyCoverError"); }
}
async function studyGetSongCoverInfo(songKey) {
  if (studySafeMode() || typeof songKey !== "string" || !songKey || songKey.length > 512) return null;
  try {
    const art = await studyDBRun("covers", "readonly", store => store.get(songKey));
    if (!art || typeof art.pageKey !== "string") return null;
    return { bookId:String(art.bookId || ""), pageKey:art.pageKey, pageIndex:Math.max(0, Number(art.pageIndex) || 0),
      title:String(art.title || ""), updatedAt:Math.max(0, Number(art.updatedAt) || 0) };
  } catch (_) { return null; }
}
async function studyGetSongCoverBlob(songKey) {
  if (studySafeMode() || typeof songKey !== "string" || !songKey || songKey.length > 512) return null;
  try {
    const art = await studyDBRun("covers", "readonly", store => store.get(songKey));
    if (!art || typeof art.pageKey !== "string") return null;
    /* 📂 trk208：フォルダーのまま読む本のジャケット（許可が切れていれば、静かに出さない） */
    if (art.linked) {
      const entry = studySharedFolderByName(art.sharedFolder);
      if (!entry) return null;
      const permission = await entry.handle.queryPermission({ mode:"read" }).catch(() => "prompt");
      if (permission !== "granted") return null;
      const file = await TrkSharedFolders.readFileAt(entry.handle, String(art.path || ""));
      return studyIsBlob(file) ? file : null;
    }
    const page = await studyDBRun("pages", "readonly", store => store.get(art.pageKey));
    return studyIsBlob(page) ? page : null;
  } catch (_) { return null; }
}
async function studyClearSongCover(songKey) {
  const key = typeof songKey === "string" && songKey ? songKey : core.currentSong && core.currentSong.key;
  if (!key) { studyNotify("studyCoverNeedSong"); return false; }
  try {
    const info = await studyGetSongCoverInfo(key);
    if (!info) { studyNotify("studyCoverNeedCover"); return false; }
    await studyDBRun("covers", "readwrite", store => store.delete(key));
    core.emit("studyCoverChanged", key);
    studyNotify("studyCoverCleared");
    studyRefreshTV(); studyRefreshCoverButtons();
    return true;
  } catch (error) { studyFail(error, "studyCoverError"); return false; }
}
async function studyRefreshCoverButtons() {
  const song = core.currentSong, assign = core.$("studyAssignCoverBtn"), clear = core.$("studyClearCoverBtn");
  assign.disabled = !song;
  assign.title = song ? tr("studyAssignCover") : tr("studyCoverNeedSong");
  clear.hidden = true;
  if (!song || !studyRoomOpen) return;
  const info = await studyGetSongCoverInfo(song.key);
  if (!core.currentSong || core.currentSong.key !== song.key) return;
  if (info) {
    clear.hidden = false;
    clear.title = tr("studyCoverSource", { title:info.title || "?", n:info.pageIndex + 1 });
  }
}
function studyCreateFolder() {
  if (!studyDataReady) { studyReadyPromise.then(() => { if (studyDataReady) studyCreateFolder(); }); return; }
  if (studyShelfFolders.length >= STUDY_FOLDER_MAX) { studyNotify("studyFolderLimit"); return; }
  const value = prompt(tr("studyCreateFolderPrompt"), "");
  if (value == null) return;
  const name = String(value).trim().slice(0, 120);
  if (!name) { studyNotify("studyFolderNameRequired"); return; }
  if (studyShelfFolders.some(folder => folder.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { studyNotify("studyFolderDuplicate"); return; }
  let id = `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  while (studyFolderById(id)) id = `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const now = Date.now();
  const folder = { id, name, createdAt:now, updatedAt:now };
  studyShelfFolders.push(folder); studyShelfContainer("").push(studyShelfItemKey("folder", id));
  studyShelfViewFolder = ""; studyShelfShown = STUDY_SHELF_PAGE; core.$("studySearch").value = "";
  studyRefreshEditedTextFolderSelect(); studySaveShelfMeta(); studyRenderShelf(); studyNotify("studyFolderCreated");
}
function studyRenameFolder(folder) {
  if (!folder) return;
  const value = prompt(tr("studyRenameFolderPrompt"), folder.name);
  if (value == null) return;
  const name = String(value).trim().slice(0, 120);
  if (!name) { studyNotify("studyFolderNameRequired"); return; }
  if (studyShelfFolders.some(item => item.id !== folder.id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    studyNotify("studyFolderDuplicate"); return;
  }
  folder.name = name; folder.updatedAt = Date.now();
  studyRefreshEditedTextFolderSelect(); studySaveShelfMeta(); studyRenderShelf(); studyNotify("studyRenamed");
}
function studyDeleteFolder(folder) {
  if (!folder) return;
  const root = studyShelfContainer(""), inside = studyShelfContainer(folder.id).slice();
  for (const key of inside) {
    if (!key.startsWith("book:")) continue;
    const bookId = key.slice(5);
    if (!studyBooks.some(book => book.id === bookId)) continue;
    studyBookFolder[bookId] = "";
    if (!root.includes(key)) root.push(key);
  }
  const folderKey = studyShelfItemKey("folder", folder.id), folderIndex = root.indexOf(folderKey);
  if (folderIndex >= 0) root.splice(folderIndex, 1);
  studyShelfFolders = studyShelfFolders.filter(item => item.id !== folder.id);
  delete studyShelfOrder[folder.id];
  if (studyShelfViewFolder === folder.id) studyShelfViewFolder = "";
  studyRefreshEditedTextFolderSelect(); studySaveShelfMeta(); studyRenderShelf(); studyNotify("studyFolderDeleted");
}
async function studyRenameBook(book) {
  const next = prompt(tr("studyRenamePrompt"), book.title);
  if (next == null) return;
  const title = String(next).trim().slice(0, 160);
  if (!title) return;
  book.title = title;
  if (studyCurrentBook && studyCurrentBook.id === book.id) core.$("studyCurrentTitle").textContent = title;
  try { await studySaveBook(book); studyNotify("studyRenamed"); }
  catch (error) { studyFail(error); }
}
async function studyDeleteBook(book) {
  if (!studyPrefs.skipDeleteConfirm && !confirm(tr("studyDeleteConfirm", { title:book.title }))) return;
  try {
    if (studyCurrentBook && studyCurrentBook.id === book.id && !await studyBackToShelf()) return;
    await studyDBRun("books", "readwrite", store => store.delete(book.id));
    const pageKeys = book.pages.map(page => page.key);
    if (pageKeys.length) await studyDBDeleteMany("pages", pageKeys);
    const removedSongs = [];
    for (const [songKey, art] of await studyDBPairs("covers")) if (art && art.bookId === book.id) {
      removedSongs.push(songKey); await studyDBRun("covers", "readwrite", store => store.delete(songKey));
    }
    await studyRefreshBooks();
    await studySharedFoldersPrune();   /* trk210：リンク本が無くなったフォルダーの記録を外す */
    for (const songKey of removedSongs) core.emit("studyCoverChanged", songKey);
    studyNotify("studyDeleted");
  } catch (error) { studyFail(error); }
}

/* ============ テキスト編集と書き出し ============ */
function studySetEditorStatus(key, force = false) {
  const status = core.$("studyEditorSaveStatus");
  if (!force && status.dataset.state === key) return;
  status.dataset.state = key; status.textContent = tr(key);
}
function studyUpdateEditorStats() {
  if (!studyCurrentBook || studyCurrentBook.kind !== "text") return;
  const text = core.$("studyMemoEditor").hidden ? studyCurrentBook.content : core.$("studyMemoEditor").value;
  core.$("studyEditorStats").textContent = tr("studyTextStats", STUDY_UTIL.textStats(text));
}
async function studyFlushMemo(seal = false) {
  clearTimeout(studyMemoSaveTimer); studyMemoSaveTimer = 0;
  if (!studyCurrentBook || studyCurrentBook.kind !== "text" || core.$("studyMemoEditor").hidden) return true;
  const editor = core.$("studyMemoEditor"), book = studyCurrentBook;
  if (seal) editor.readOnly = true;
  const content = editor.value;
  book.content = content;
  studySetEditorStatus("studyEditorSaving");
  try {
    await studySaveBook(book);
    const filed = await studyApplyEditedTextFolder(book);
    if (editor.value !== content) {
      studySetEditorStatus("studyEditorUnsaved"); studyUpdateEditorStats();
      return true;
    }
    studySetEditorStatus("studyEditorSaved"); studyUpdateEditorStats();
    studySetStatus(filed === false ? "studyEditedTextFolderSaveFailed" : "studyMemoSaved");
    return true;
  } catch (error) {
    if (seal) editor.readOnly = false;
    studySetEditorStatus("studyEditorSaveFailed"); studyFail(error, "studyMemoSaveError");
    return false;
  }
}
function studyMemoInput() {
  if (!studyCurrentBook || studyCurrentBook.kind !== "text") return;
  studyCurrentBook.content = core.$("studyMemoEditor").value;
  studySetEditorStatus("studyEditorUnsaved");
  clearTimeout(studyMemoSaveTimer); studyMemoSaveTimer = setTimeout(studyFlushMemo, 800);
}
function studyToggleMemo() {
  if (studyClosePending) return;
  const book = studyCurrentBook;
  if (!book || book.kind !== "text") { studyNotify("studyMemoNeedText"); return; }
  const editor = core.$("studyMemoEditor"), editing = editor.hidden, button = core.$("studyMemoBtn");
  if (editing) {
    studyEndSearch();
    editor.value = book.content || "";
    editor.spellcheck = ["txt", "md", "markdown"].includes(String(book.extension || "").toLowerCase());
    editor.readOnly = false; editor.hidden = false;
    core.$("studyEditorNotice").hidden = false; core.$("studyTextPage").hidden = true;
    button.textContent = tr("studyMemoDone"); core.$("studyMemoExportBtn").hidden = false;
    studySetEditorStatus("studyEditorSaved", true); studyUpdateEditorStats(); studySyncFindRow();
    editor.focus({ preventScroll:true });
  } else {
    button.disabled = true;
    studyFlushMemo(true).then(saved => {
      button.disabled = false;
      if (!saved) { editor.focus({ preventScroll:true }); return; }
      editor.readOnly = false; editor.hidden = true; core.$("studyEditorNotice").hidden = true; core.$("studyTextPage").hidden = false;
      button.textContent = tr("studyMemoEdit"); core.$("studyMemoExportBtn").hidden = false;
      studyRenderTextContent(book); studySyncTextProgress(); studySyncFindRow();
    });
  }
}
async function studyWriteExportCopy(directory, blob, title, extension) {
  const safeTitle = String(title || "notes").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim().slice(0, 80) || "notes";
  const rawExtension = String(extension || "txt").toLowerCase();
  const ext = /^[a-z0-9]{1,16}$/.test(rawExtension) ? rawExtension : "txt";
  const token = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  const stem = `${safeTitle} - edited-${Date.now().toString(36)}-${token}`;
  let filename = "", available = false;
  for (let index = 1; index <= 1000; index++) {
    const candidate = `${stem}${index === 1 ? "" : ` (${index})`}.${ext}`;
    try { await directory.getFileHandle(candidate); }
    catch (error) {
      if (!error || error.name !== "NotFoundError") throw error;
      filename = candidate; available = true; break;
    }
  }
  if (!available) throw new Error("Could not find an unused export filename");
  const fileHandle = await directory.getFileHandle(filename, { create:true });
  const writable = await fileHandle.createWritable();
  try { await writable.write(blob); await writable.close(); }
  catch (error) { if (typeof writable.abort === "function") { try { await writable.abort(); } catch (_) {} } throw error; }
  return filename;
}
async function studyChooseExportDirectory() {
  if (!studyCanChooseExportFolder()) { studyRefreshExportFolderUI(); return; }
  try {
    studyExportDirectory = await window.showDirectoryPicker({ id:"trk-study-text-export", mode:"readwrite" });
    studyRefreshExportFolderUI();
  } catch (error) {
    if (error && error.name === "AbortError") return;
    studyFail(error, "studyExportFolderSelectError");
  }
}
async function studyExportText() {
  if (!studyCurrentBook || studyCurrentBook.kind !== "text") return;
  const book = studyCurrentBook;
  const text = core.$("studyMemoEditor").hidden ? book.content : core.$("studyMemoEditor").value;
  const title = String(book.title || "notes").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim().slice(0, 80) || "notes";
  const rawExtension = String(book.extension || "txt").toLowerCase();
  const ext = /^[a-z0-9]{1,16}$/.test(rawExtension) ? rawExtension : "txt";
  const blob = new Blob([text], { type:"text/plain;charset=utf-8" });
  let fallback = false;
  if (studyExportDirectory) {
    try {
      const name = await studyWriteExportCopy(studyExportDirectory, blob, title, ext);
      studyNotify("studyExportSavedToFolder", { name, folder:studyExportDirectory.name }); return;
    } catch (error) { console.warn(error); fallback = true; }
  }
  if (typeof downloadBlob === "function") {
    core.downloadBlob(blob, `${title} - edited.${ext}`);
    if (fallback) studyNotify("studyExportFolderFallback");
  } else if (fallback) studyNotify("studyExportFolderFallback");
}

/* ============ ⚙ 設定（本棚を隠していても読書中に開ける） ============ */
let studySettingsReturnFocus = null;
function studySettingsOpen(event) {
  if (!studyRoomOpen || !core.$("studySettings").hidden) return;
  if (!core.$("studyHelp").hidden) studyCloseHelp();
  studySettingsReturnFocus = event && event.currentTarget || document.activeElement;
  clearTimeout(studyHoldTimer); studyHoldTimer = 0; studyHeldCode = "";
  studyKeyCaptureAction = "";
  studyRefreshPrefsUI();
  core.$("studySettings").hidden = false;
  core.$("studyRoom").querySelector(".study-shell").inert = true;
  core.$("studySettingsCloseBtn").focus({ preventScroll:true });
}
function studyCloseSettings(restoreFocus = true) {
  if (core.$("studySettings").hidden) return false;
  studyKeyCaptureAction = ""; studyRefreshKeyAssignments();
  core.$("studySettings").hidden = true;
  core.$("studyRoom").querySelector(".study-shell").inert = false;
  if (restoreFocus) {
    /* 本棚の入口から開いて本棚を隠した場合は、まだ見える入口へ戻す。 */
    const target = [studySettingsReturnFocus, core.$("studySettingsBtn"), core.$("studyHeaderSettingsBtn"), core.$("studyShowShelfBtn"), core.$("studyCloseBtn")]
      .find(node => node && !node.hidden && !node.disabled && node.getClientRects().length);
    if (target) target.focus({ preventScroll:true });
  }
  studySettingsReturnFocus = null;
  return true;
}

/* ============ ❓ キーの説明 ============ */
function studyHelpOpen() {
  if (!studyRoomOpen || !core.$("studyHelp").hidden) return;
  studyCloseSettings(false);
  if (studyKeyCaptureAction) { studyKeyCaptureAction = ""; studyRefreshKeyAssignments(); }
  core.$("studyHelp").hidden = false;
  core.$("studyHelpCloseBtn").focus({ preventScroll:true });
}
function studyCloseHelp() {
  if (core.$("studyHelp").hidden) return false;
  core.$("studyHelp").hidden = true;
  studyPrefs.helpSeen = true; studySavePrefs();
  const target = studyCurrentBook && studyCurrentBook.kind === "image" ? core.$("studyImageStage")
    : studyCurrentBook ? core.$("studyTextPage") : core.$("studyCloseBtn");
  if (target) target.focus({ preventScroll:true });
  return true;
}
function studyToggleHelp() { if (core.$("studyHelp").hidden) studyHelpOpen(); else studyCloseHelp(); }

/* ============ キー操作 ============ */
/* 文字を打つ場所では、書斎のキー操作を止めます（入力の邪魔をしない）。 */
function studyTypingTarget(target) {
  return !!(target && typeof target.closest === "function" && target.closest("input,select,textarea,[contenteditable='true']"));
}
/* Space / Enter は、ボタンなどに焦点があるときはその要素の操作に譲ります。 */
function studyActivateTarget(target) {
  return !!(target && typeof target.closest === "function" && target.closest("button,summary,a[href],[role='button'],[role='link']"));
}
function studyEditorHandleTab(event) {
  const editor = event.target;
  if (event.code !== "Tab" || !editor || editor.id !== "studyMemoEditor") return false;
  event.preventDefault(); event.stopImmediatePropagation();
  const start = editor.selectionStart, end = editor.selectionEnd, text = editor.value;
  let changed = false;
  if (!event.shiftKey && start === end) {
    if (typeof editor.setRangeText === "function") editor.setRangeText("\t", start, end, "end");
    else { editor.value = `${text.slice(0, start)}\t${text.slice(end)}`; editor.setSelectionRange(start + 1, start + 1); }
    changed = true;
  } else {
    const firstLineStart = text.lastIndexOf("\n", start - 1) + 1;
    const lastSelectedPosition = Math.max(start, end - 1);
    const nextLineBreak = text.indexOf("\n", lastSelectedPosition);
    const blockEnd = nextLineBreak < 0 ? text.length : nextLineBreak;
    const lines = text.slice(firstLineStart, blockEnd).split("\n");
    const replaceLines = replacement => {
      if (typeof editor.setRangeText === "function") editor.setRangeText(replacement, firstLineStart, blockEnd, "preserve");
      else editor.value = `${text.slice(0, firstLineStart)}${replacement}${text.slice(blockEnd)}`;
    };
    if (!event.shiftKey) {
      replaceLines(lines.map(line => `\t${line}`).join("\n"));
      editor.setSelectionRange(start + 1, end + lines.length); changed = true;
    } else {
      const removed = lines.map(line => (line.match(/^(?:\t| {1,4})/) || [""])[0].length);
      if (removed.some(length => length > 0)) {
        replaceLines(lines.map((line, index) => line.slice(removed[index])).join("\n"));
        const lastLineStart = firstLineStart + lines.slice(0, -1).reduce((length, line) => length + line.length + 1, 0);
        const startRemoved = Math.min(removed[0], start - firstLineStart);
        const endRemoved = removed.slice(0, -1).reduce((sum, length) => sum + length, 0) +
          Math.min(removed[removed.length - 1], Math.max(0, end - lastLineStart));
        editor.setSelectionRange(start - startRemoved, end - endRemoved); changed = true;
      }
    }
  }
  if (changed) editor.dispatchEvent(new Event("input", { bubbles:true }));
  return true;
}
function studyKeyDown(event) {
  if (!studyRoomOpen) return;
  if (studyHandleKeyCapture(event)) return;
  if (event.code === "Escape" && event.target && event.target.id === "studyMemoEditor") {
    event.preventDefault(); event.stopImmediatePropagation();
    core.$("studyMemoEditor").blur(); studyToggleMemo(); return;
  }
  if (event.target && event.target.id === "studyMemoEditor" && !event.shiftKey && (event.ctrlKey || event.metaKey) && event.code === "KeyS") {
    event.preventDefault(); event.stopImmediatePropagation(); studyFlushMemo(); return;
  }
  if (studyEditorHandleTab(event)) return;
  const helpOpen = !core.$("studyHelp").hidden;
  const settingsOpen = !core.$("studySettings").hidden;
  if (helpOpen || settingsOpen) {
    if (event.code === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); if (settingsOpen) studyCloseSettings(); else studyCloseHelp(); return; }
    if (event.code === "Tab") {
      const card = core.$(settingsOpen ? "studySettings" : "studyHelp").querySelector(".study-help-card");
      const focusable = [...card.querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex='-1'])")]
        .filter(node => !node.hidden && node.getClientRects().length);
      const index = focusable.indexOf(document.activeElement);
      if (!focusable.length) { event.preventDefault(); core.$(settingsOpen ? "studySettingsCloseBtn" : "studyHelpCloseBtn").focus(); event.stopImmediatePropagation(); return; }
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
      else if (!event.shiftKey && (index < 0 || index === focusable.length - 1)) { event.preventDefault(); focusable[0].focus(); }
      event.stopImmediatePropagation(); return;
    }
    event.stopImmediatePropagation(); return;
  }
  if (event.code === "Escape") {
    event.preventDefault(); event.stopImmediatePropagation(); studyCloseRoom(); return;
  }
  if (event.code === "Tab") {
    const focusable = [...studyRoom.querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex='-1'])")]
      .filter(node => !node.hidden && node.getClientRects().length);
    if (!focusable.length) { event.preventDefault(); core.$("studyCloseBtn").focus(); event.stopImmediatePropagation(); return; }
    const index = focusable.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
    else if (!event.shiftKey && (index < 0 || index === focusable.length - 1)) { event.preventDefault(); focusable[0].focus(); }
    event.stopImmediatePropagation(); return;
  }
  if (studyTypingTarget(event.target)) { event.stopImmediatePropagation(); return; }
  const key = event.key || "";
  if ((event.ctrlKey || event.metaKey) && event.code === "KeyF") { event.preventDefault(); event.stopImmediatePropagation(); studyFocusSearch(); return; }
  if (key === "?" || (event.code === "Slash" && event.shiftKey)) { event.preventDefault(); event.stopImmediatePropagation(); studyToggleHelp(); return; }
  /* 自動スクロール中：A でトグル、移動キー（↑↓・Space・PageUp/Down・Home/End・次へ/前へ）はまず停止だけする。 */
  if (studyAutoScrollActive()) {
    if (event.code === "KeyA") { event.preventDefault(); event.stopImmediatePropagation(); studyToggleAutoScroll(); return; }
    if (STUDY_AUTO_SCROLL_STOP_CODES.has(event.code) || event.code === studyPrefs.studyNextKey || event.code === studyPrefs.studyPreviousKey) {
      event.preventDefault(); event.stopImmediatePropagation(); studyStopAutoScroll(); return;
    }
  }
  if (event.code === studyPrefs.studyNextKey || event.code === studyPrefs.studyPreviousKey) {
    event.preventDefault(); event.stopImmediatePropagation(); studyStep(event.code === studyPrefs.studyNextKey ? 1 : -1); return;
  }
  /* 拡大した画像は、まず ↑ / ↓ で送ります（端に着いたときだけ、下のページ送りへゆずります）。 */
  if ((event.code === "ArrowUp" || event.code === "ArrowDown") && studyScrollZoomedImage(event.code === "ArrowDown" ? 1 : -1, event.repeat)) {
    event.preventDefault(); event.stopImmediatePropagation(); return;
  }
  if (studyPrefs.verticalImageKeys && studyCurrentBook && studyCurrentBook.kind === "image" &&
      (event.code === "ArrowUp" || event.code === "ArrowDown")) {
    event.preventDefault(); event.stopImmediatePropagation(); studyStep(event.code === "ArrowDown" ? 1 : -1); return;
  }
  /* 既定は倍率に関係なく画像の端へ。直接ページ送りの設定がオンなら下へ。 */
  if (!studyPrefs.pageKeysTurnPages && (event.code === "PageDown" || event.code === "PageUp") &&
      studyJumpZoomEdge(event.code === "PageDown" ? 1 : -1, event.repeat)) {
    event.preventDefault(); event.stopImmediatePropagation(); return;
  }
  if (event.code === "PageDown") { event.preventDefault(); event.stopImmediatePropagation(); studyStep(1); return; }
  if (event.code === "PageUp") { event.preventDefault(); event.stopImmediatePropagation(); studyStep(-1); return; }
  if (event.code === "Home" || event.code === "End") {
    event.preventDefault(); event.stopImmediatePropagation();
    if (studyCurrentBook && studyCurrentBook.kind === "image") studyJumpToPage(event.code === "Home" ? 0 : Math.max(0, studyCurrentBook.pages.length - 1), true);
    else studyTextEdges(event.code === "Home" ? "start" : "end");
    return;
  }
  if (event.code === "Equal" || event.code === "NumpadAdd") { event.preventDefault(); event.stopImmediatePropagation(); studyStepZoom(1); return; }
  if (event.code === "Minus" || event.code === "NumpadSubtract") { event.preventDefault(); event.stopImmediatePropagation(); studyStepZoom(-1); return; }
  if (event.code === "Digit0" || event.code === "Numpad0") { event.preventDefault(); event.stopImmediatePropagation(); studyZoomReset(); return; }
  if (event.repeat) { event.stopImmediatePropagation(); return; }
  if (event.code === "KeyA") { event.preventDefault(); event.stopImmediatePropagation(); studyToggleAutoScroll(); return; }
  if (event.code === "KeyB") { event.preventDefault(); event.stopImmediatePropagation(); studyToggleBookmark(); return; }
  if (event.code === "KeyM") { event.preventDefault(); event.stopImmediatePropagation(); studyToggleBookmarkPanel(); return; }
  if (event.code === "KeyT") { event.preventDefault(); event.stopImmediatePropagation(); studyCycleTV(); return; }
  if (event.code === "KeyF") {
    event.preventDefault(); event.stopImmediatePropagation();
    if (studyCurrentBook && studyCurrentBook.kind === "image") studyToggleFullscreen();
    return;
  }
  if (event.code !== "Space" && event.code !== "Enter" && event.code !== "NumpadEnter") { event.stopImmediatePropagation(); return; }
  if (studyActivateTarget(event.target)) { event.stopImmediatePropagation(); return; }
  event.preventDefault(); event.stopImmediatePropagation();
  if (studyHeldCode) return;
  studyHeldCode = event.code; studyHoldAction = "";
  studyHoldTimer = setTimeout(() => {
    if (!studyRoomOpen || studyHeldCode !== event.code) return;
    if (event.code === "Space") {
      studyHoldAction = "held";
      if (studyCurrentBook && studyCurrentBook.kind === "image") studyShowProgress();
    } else {
      studyHoldAction = "bookmark"; studySaveBookmark();
    }
  }, 520);
}
function studyKeyUp(event) {
  if (!studyRoomOpen) return;
  event.stopImmediatePropagation();
  if (!studyHeldCode || event.code !== studyHeldCode) return;
  clearTimeout(studyHoldTimer); studyHoldTimer = 0;
  const action = studyHoldAction; studyHeldCode = ""; studyHoldAction = "";
  event.preventDefault(); event.stopImmediatePropagation();
  if (!action) studyStep(1);
}

/* ============ ポインタ（タップ／スワイプ／長押し／ピンチ／拡大中の見回し） ============ */
function studyImagePointerDown(event) {
  studyStopAutoScroll();   /* タップ＝自動スクロール停止（縦読み以外ではもともと動いていない） */
  if (event.pointerType) studyLastPointerType = event.pointerType;
  if (!studyRoomOpen || !studyCurrentBook || studyCurrentBook.kind !== "image" || (event.button != null && event.button !== 0)) return;
  studyPointers.set(event.pointerId, { x:event.clientX, y:event.clientY });
  try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
  if (studyPointers.size >= 2) {
    clearTimeout(studyHoldTimer); studyHoldTimer = 0; studyPointerStart = null; studySuppressTapUntil = Date.now() + 400;
    const [a, b] = [...studyPointers.values()];
    studyPinchStart = Math.hypot(a.x - b.x, a.y - b.y); studyPinchZoom = studyPrefs.zoom;
    return;
  }
  const verticalItem = event.target && typeof event.target.closest === "function" ? event.target.closest(".study-vertical-item") : null;
  if (studyPrefs.imageMode === "vertical" && verticalItem) { studyCurrentPage = Number(verticalItem.dataset.pageIndex) || 0; studySyncPageCount(); }
  studyPointerStart = { x:event.clientX, y:event.clientY, id:event.pointerId, held:false, panning:false };
  clearTimeout(studyHoldTimer);
  studyHoldTimer = setTimeout(() => {
    if (!studyPointerStart || studyPointerStart.id !== event.pointerId) return;
    studyPointerStart.held = true; studySuppressTapUntil = Date.now() + 900; studyAssignCurrentCover();
  }, 680);
}
function studyImagePointerMove(event) {
  const tracked = studyPointers.get(event.pointerId);
  if (tracked) { tracked.x = event.clientX; tracked.y = event.clientY; }
  if (studyPointers.size >= 2 && studyPinchStart > 0) {
    const [a, b] = [...studyPointers.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (distance > 0) studyApplyZoomValue(studyPinchZoom * distance / studyPinchStart);
    return;
  }
  if (!studyPointerStart || studyPointerStart.id !== event.pointerId) return;
  const dx = event.clientX - studyPointerStart.x, dy = event.clientY - studyPointerStart.y;
  if (!studyFullscreenFitActive() && studyPrefs.zoom > 1.001 && studyPrefs.imageMode !== "vertical") {
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      clearTimeout(studyHoldTimer); studyHoldTimer = 0;
      studyPointerStart.panning = true;
      const nodes = studyPrefs.imageMode === "spread" ? [...core.$("studySpreadWrap").querySelectorAll(".study-spread-page")] : [core.$("studySingleWrap")];
      for (const node of nodes) { if (!node) continue; node.scrollLeft -= dx; node.scrollTop -= dy; }
      studyPointerStart.x = event.clientX; studyPointerStart.y = event.clientY;
      core.$("studyImageStage").dataset.panning = "1";
      return;
    }
  }
  if (Math.abs(dx) > 18 || Math.abs(dy) > 18) { clearTimeout(studyHoldTimer); studyHoldTimer = 0; }
}
function studyImagePointerEnd(event) {
  studyPointers.delete(event.pointerId);
  if (studyPointers.size < 2 && studyPinchStart > 0) {
    studyPinchStart = 0; studySetZoom(studySnapZoom(studyPrefs.zoom), true);
    if (!studyFullscreenFitActive() && Math.abs(studyPrefs.zoom - 1) > .001) studySetStatus("studyZoomHint");
  }
  delete core.$("studyImageStage").dataset.panning;
  if (!studyPointerStart || studyPointerStart.id !== event.pointerId) return;
  clearTimeout(studyHoldTimer); studyHoldTimer = 0;
  const start = studyPointerStart; studyPointerStart = null;
  if (start.held) { studySuppressTapUntil = Date.now() + 700; return; }
  if (start.panning) { studySuppressTapUntil = Date.now() + 500; return; }
  if (event.type === "pointercancel") return;
  const dx = event.clientX - start.x, dy = event.clientY - start.y;
  if (studyPrefs.imageMode !== "vertical" && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
    studySuppressTapUntil = Date.now() + 700;
    studyStepPhysical(dx < 0 ? "left" : "right");
  }
}
function studyImageTap(event) {
  if (event.button) return;
  if (Date.now() < studySuppressTapUntil || (event.target && typeof event.target.closest === "function" && event.target.closest("button"))) return;
  if (!studyCurrentBook || studyCurrentBook.kind !== "image" || studyPrefs.imageMode === "vertical") return;
  /* 設定がオンでマウスの左クリックなら、位置に関係なくページを送ります（反転で前のページ）。 */
  if (studyMouseClickPage(0)) return;
  const rect = core.$("studyImageStage").getBoundingClientRect();
  studyStepPhysical(event.clientX < rect.left + rect.width / 2 ? "left" : "right");
}
/* PCの簡易操作（設定）：マウスの左クリック＝次のページ／右クリック＝前のページ（反転の設定で入れ替え）。
   pointerdown で覚えた種類を見て、マウス以外（指・ペン）のタップはこれまでどおり左右の半分で送ります。
   button＝0 が左、2 が右。実際に送ったときだけ true を返します。 */
function studyMouseClickPage(button) {
  const pointerType = studyLastPointerType;
  studyLastPointerType = "";
  if (pointerType !== "mouse") return false;
  if (!studyPrefs.mouseClickPages || studyPrefs.imageMode === "vertical") return false;
  if (!studyRoomOpen || !studyCurrentBook || studyCurrentBook.kind !== "image") return false;
  const forward = (button === 0) !== studyPrefs.mouseClickFlip;
  studyStep(forward ? 1 : -1);
  return true;
}
/* マウスの中クリック（⚙で「次のページへ」か「閉じて本棚へ」を選ぶ。画像の本のときだけ）。
   act=false は mousedown 用で、ブラウザの自動スクロールだけを止めます（実際の動作は auxclick で1回）。 */
function studyMiddleClick(event, act) {
  if (event.button !== 1 || studyPrefs.middleClickAction === "none") return false;
  if (!studyRoomOpen || !studyCurrentBook || studyCurrentBook.kind !== "image") return false;
  event.preventDefault();
  if (!act) return true;
  if (studyPrefs.middleClickAction === "close") studyCloseToShelf();
  else studyStep(1);
  return true;
}
function studyVerticalScroll() {
  clearTimeout(studyVerticalScrollTimer);
  studyVerticalScrollTimer = setTimeout(() => {
    const box = core.$("studyVerticalPages"), rect = core.$("studyImageStage").getBoundingClientRect(), targetY = rect.top + rect.height * .35;
    const items = [...box.children]; let best = null, bestDist = Infinity;
    for (const item of items) {
      const r = item.getBoundingClientRect(), img = item.querySelector("img"), index = Number(item.dataset.pageIndex);
      const near = r.bottom > rect.top - rect.height && r.top < rect.bottom + rect.height;
      if (!studyVerticalObserver) {
        if (near && !img.dataset.studyObjectUrl && !img.dataset.studyLoadToken) studyLoadPageImage(img, index);
        else if (!near && (img.dataset.studyObjectUrl || img.dataset.studyLoadToken)) studyClearImage(img);
      }
      if (r.bottom < rect.top || r.top > rect.bottom) continue;
      const dist = Math.abs((r.top + r.bottom) / 2 - targetY);
      if (dist < bestDist) { best = item; bestDist = dist; }
    }
    if (best) { studyCurrentPage = Number(best.dataset.pageIndex) || 0; studySyncPageCount(); }
  }, 90);
}

/* ============ 自動スクロール（ハンズフリー縦読み・trk175） ============ */
/* 縦読み漫画モードだけ。等速（px/秒）で台紙を scrollTop させ、タップ・ホイール・移動キーで止まる。
   最後のページ（下端）に着いたら自分で止まり、栞や位置の保存には触らない＝表示だけの機能。 */
let studyAutoScrollRaf = 0, studyAutoScrollLast = 0, studyAutoScrollCarry = 0;
function studyAutoScrollSpeedValue(value) {
  const speed = Number(value);
  return STUDY_AUTO_SCROLL_SPEEDS.includes(speed) ? speed : STUDY_AUTO_SCROLL_SPEED_DEFAULT;
}
function studyAutoScrollActive() { return studyAutoScrollRaf !== 0; }
function studyAutoScrollEligible() {
  return studyRoomOpen && !!studyCurrentBook && studyCurrentBook.kind === "image" && studyPrefs.imageMode === "vertical";
}
/* rAF を止めて状態だけをリセット（通知・ボタン同期は呼び出し側）。何回呼んでも安全。 */
function studyAutoScrollHalt() {
  if (studyAutoScrollRaf) cancelAnimationFrame(studyAutoScrollRaf);
  studyAutoScrollRaf = 0; studyAutoScrollLast = 0; studyAutoScrollCarry = 0;
}
function studySyncAutoScrollBtn() {
  const btn = core.$("studyAutoScrollBtn"); if (!btn) return;
  const eligible = studyAutoScrollEligible();
  if (!eligible) studyAutoScrollHalt();   /* 縦読みをやめた・本を閉じた＝静かに止まる */
  const active = studyAutoScrollActive();
  btn.hidden = !eligible;
  if (typeof btn.setAttribute === "function") btn.setAttribute("aria-pressed", String(active));
  const key = active ? "studyAutoScrollStop" : "studyAutoScrollStart";
  btn.dataset.i18n = key; btn.textContent = tr(key);
}
function studyAutoScrollFrame(now) {
  studyAutoScrollRaf = 0;
  const stage = core.$("studyImageStage");
  if (!studyAutoScrollEligible() || !stage) { studySyncAutoScrollBtn(); return; }
  const last = studyAutoScrollLast || now;
  const dt = Math.min(Math.max(now - last, 0), 100);   /* タブ復帰などの大きな差は 100ms までに丸める */
  studyAutoScrollLast = now;
  studyAutoScrollCarry += studyPrefs.studyAutoScrollSpeed * dt / 1000;
  const px = Math.floor(studyAutoScrollCarry);
  if (px > 0) { studyAutoScrollCarry -= px; stage.scrollTop += px; }
  if (stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 1) {
    studyAutoScrollHalt(); studySyncAutoScrollBtn(); studyNotify("studyAutoScrollEnd"); return;
  }
  studyAutoScrollRaf = requestAnimationFrame(studyAutoScrollFrame);
}
function studyStartAutoScroll() {
  if (studyAutoScrollActive()) return;
  if (!studyAutoScrollEligible()) { studyNotify("studyAutoScrollNeedVertical"); return; }
  studyAutoScrollLast = 0; studyAutoScrollCarry = 0;
  studyAutoScrollRaf = requestAnimationFrame(studyAutoScrollFrame);
  studySyncAutoScrollBtn(); studyNotify("studyAutoScrollStarted");
}
/* 停止そのものは通知しない（スクロールが止まること自体が目印）。下端到達だけ studyAutoScrollFrame が通知する。 */
function studyStopAutoScroll() {
  if (!studyAutoScrollActive()) return;
  studyAutoScrollHalt(); studySyncAutoScrollBtn();
}
function studyToggleAutoScroll() {
  if (studyAutoScrollActive()) studyStopAutoScroll();
  else studyStartAutoScroll();
}

/* ============ 読書用フィルタ（明るさ/コントラスト/反転系・trk176） ============ */
/* 読書面（.study-image-stage / .study-text-stage）だけに CSS filter を当てる。全画面フィット・拡大率とは独立。
   初期値（100/100/なし）では "none" を入れるので、ふつうは見た目のコストゼロ。本棚やメニューは変わらない。 */
function studyReadFilterPercent(value) {
  const percent = Math.round(Number(value));
  return Number.isFinite(percent) ? Math.min(150, Math.max(50, percent)) : 100;
}
function studyReadFilterCss() {
  if (studyPrefs.readBrightness === 100 && studyPrefs.readContrast === 100 && studyPrefs.readSpecial === "none") return "none";
  let css = `brightness(${studyPrefs.readBrightness}%) contrast(${studyPrefs.readContrast}%)`;
  if (studyPrefs.readSpecial === "invert") css += " invert(1)";
  else if (studyPrefs.readSpecial === "grayscale") css += " grayscale(1)";
  else if (studyPrefs.readSpecial === "sepia") css += " sepia(.8)";
  return css;
}
function studyApplyReadFilter() {
  const room = core.$("studyRoom");
  if (room && room.style && typeof room.style.setProperty === "function") room.style.setProperty("--study-read-filter", studyReadFilterCss());
  core.$("studyReadBrightnessValue").textContent = `${studyPrefs.readBrightness}%`;
  core.$("studyReadContrastValue").textContent = `${studyPrefs.readContrast}%`;
}

/* ============ 開く・閉じる ============ */
function studyOpenRoom() {
  if (studySafeMode()) { studyNotify("studySafeMode"); return; }
  if (studyRoomOpen) return;
  studyRoomOpen = true; window.Trk.overlay.set("study", true);
  core.$("studyRoom").hidden = false; document.body.classList.add("study-room-open");
  core.emit("studyOpen");   /* 🧭 スタンプ「書斎に行った」 */
  studyRefreshPrefsUI();
  studyReadyPromise.then(() => {
    studyRenderShelf(); studyRenderBookmarks(); studyRefreshShelfFoot();
    if (studyCurrentBook) { core.$("studyBookView").hidden = false; studySyncWelcome(); studyApplyTVLayout(); }
    studySweepOrphans().then(cleaned => { if (cleaned) studySetStatus("studyOrphanSweep", { n:cleaned }); });
  }).catch(studyFail);
  if (!studyCurrentBook) { core.$("studyBookView").hidden = true; studySyncWelcome(); studyApplyTVLayout(); }
  core.$("studyCloseBtn").focus({ preventScroll:true });
  if (!studyPrefs.helpSeen) { studyPrefs.helpSeen = true; studySavePrefs(); studyHelpOpen(); }
}
async function studyCloseRoom() {
  if (!studyRoomOpen || studyClosePending) return;
  studyClosePending = true;
  studyKeyCaptureAction = ""; studyRefreshKeyAssignments();
  const editor = core.$("studyMemoEditor");
  if (!editor.hidden && !await studyFlushMemo(true)) {
    studyClosePending = false; editor.focus({ preventScroll:true }); return;
  }
  editor.readOnly = false;
  clearTimeout(studyHoldTimer); studyHoldTimer = 0; studyHeldCode = ""; studyPointerStart = null;
  studyStopAutoScroll();
  studyShelfHold.cancel();
  studyPointers.clear(); studyPinchStart = 0;
  studyCloseSettings(false);
  if (!core.$("studyHelp").hidden) core.$("studyHelp").hidden = true;
  studyEndSearch();
  studyRoomOpen = false; window.Trk.overlay.set("study", false);
  core.$("studyProgressWrap").hidden = true; core.$("studyRoom").classList.remove("study-progress-visible");
  if (document.fullscreenElement === core.$("studyRoom") && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  studyFullscreenFallback = false; core.$("studyRoom").classList.remove("study-fullimage");
  studyRoom.hidden = true; document.body.classList.remove("study-room-open");
  studyTVToken++; studyRestoreVideoHome();
  studyClearImage(core.$("studyTvArt")); studyTVArtUrl = ""; studyTVArtSong = "";
  const title = document.querySelector("#libPanel .libHead .study-launch-title"); if (title) title.focus({ preventScroll:true });
  core.emit("studyClose");   /* 🧭 スタンプ「書斎から戻った」 */
  studyClosePending = false;
}
async function studyToggleFullscreen() {
  if (!studyCurrentBook || studyCurrentBook.kind !== "image") return;
  const room = core.$("studyRoom");
  if (room.classList.contains("study-fullimage")) {
    if (document.fullscreenElement === room && document.exitFullscreen) { try { await document.exitFullscreen(); } catch (_) {} }
    room.classList.remove("study-fullimage"); studyFullscreenFallback = false; studySyncCurrentBookControls(); studySyncFindRow(); return;
  }
  if (room.requestFullscreen) {
    try { await room.requestFullscreen(); studyFullscreenFallback = false; room.classList.add("study-fullimage"); studySyncCurrentBookControls(); studySyncFindRow(); return; }
    catch (_) { /* embedded webviews can reject fullscreen; keep a CSS-only image focus mode */ }
  }
  studyFullscreenFallback = true; room.classList.add("study-fullimage");
  studySyncCurrentBookControls(); studySyncFindRow();
}

/* ============ 配線 ============ */
const studyRoom = core.$("studyRoom");
function studyTranslateNodes() {
  for (const node of studyRoom.querySelectorAll("[data-i18n]")) {
    const translated = tr(node.dataset.i18n);
    if (node.tagName === "OPTGROUP") node.label = translated;
    else node.textContent = translated;
  }
}
studyTranslateNodes();
core.$("studySearch").placeholder = tr("studySearch");
core.$("studyFindInput").placeholder = tr("studyBookSearchPlaceholder");
/* 長押し（指・マウス）をまとめて扱います。ブラウザが自前の長押しやスクロールで pointercancel を出しても、
   ポインタが動いていなければ取り消しません（Androidなどで長押しが効かなくなるのを防ぐ）。押したまま650msで発火し、
   離したときに長押しぶん経っていればそこでも発火します（タイマーが遅れても開くように）。 */
const STUDY_HOLD_MS = 650, STUDY_HOLD_MOVE_MAX = 14;
function studyBindHoldPress(node, action) {
  let timer = 0, start = null, moved = false, fired = false;
  const clear = () => { clearTimeout(timer); timer = 0; start = null; };
  const fire = () => { clear(); fired = true; setTimeout(() => { fired = false; }, 1200); action(); };
  node.addEventListener("pointerdown", event => {
    if (event.button != null && event.button !== 0) return;
    clearTimeout(timer); fired = false; moved = false;
    start = { x:event.clientX, y:event.clientY, at:Date.now() };
    timer = setTimeout(() => { timer = 0; if (!start || moved) return; fire(); }, STUDY_HOLD_MS);
  });
  node.addEventListener("pointermove", event => {
    if (!start || moved) return;
    if (Math.abs(event.clientX - start.x) > STUDY_HOLD_MOVE_MAX || Math.abs(event.clientY - start.y) > STUDY_HOLD_MOVE_MAX) {
      moved = true; clear();
    }
  });
  /* ブラウザ都合の取り消し（pointercancel）は、動いたときだけ受け入れます。 */
  node.addEventListener("pointercancel", event => {
    if (!start) return;
    const farX = Math.abs((event.clientX || start.x) - start.x), farY = Math.abs((event.clientY || start.y) - start.y);
    if (moved || farX > STUDY_HOLD_MOVE_MAX || farY > STUDY_HOLD_MOVE_MAX) { moved = true; clear(); }
  });
  node.addEventListener("pointerleave", event => { if (start && event.pointerType === "mouse") { moved = true; clear(); } });
  node.addEventListener("pointerup", () => {
    if (!start) return;
    const held = !moved && Date.now() - start.at >= STUDY_HOLD_MS;
    if (held) fire(); else clear();
  });
  node.addEventListener("contextmenu", event => event.preventDefault());
  return { fired:() => fired, reset:() => { fired = false; }, cancel:() => { clear(); fired = false; } };
}
const studyShelfTitle = core.$("studyShelfCreateFolder");
function studySyncShelfTitleHint() {
  studyShelfTitle.title = tr("studyFolderCreateHint");
  studyShelfTitle.setAttribute("aria-label", `${tr("studyShelf")}. ${tr("studyFolderCreateHint")}`);
}
studySyncShelfTitleHint();
const studyShelfHold = studyBindHoldPress(studyShelfTitle, studyCreateFolder);
studyShelfTitle.addEventListener("click", event => {
  if (studyShelfHold.fired()) { studyShelfHold.reset(); event.preventDefault(); event.stopPropagation(); return; }
  studyCreateFolder();
});
core.$("studyShowShelfBtn").addEventListener("click", () => {
  studySetShelfVisible(true); core.$("studyShelfCreateFolder").focus({ preventScroll:true });
});
core.$("studyNextKeyBtn").addEventListener("click", () => studySetKeyCapture("next"));
core.$("studyPreviousKeyBtn").addEventListener("click", () => studySetKeyCapture("previous"));
core.$("studyCloseBtn").addEventListener("click", studyCloseRoom);
core.$("studyBackBtn").addEventListener("click", studyBackToShelf);
core.$("studyFullscreenBtn").addEventListener("click", studyToggleFullscreen);
core.$("studyImportCancelBtn").addEventListener("click", studyCancelImport);
core.$("studyBookmarksBtn").addEventListener("click", () => studyToggleBookmarkPanel());
core.$("studyHeaderSettingsBtn").addEventListener("click", studySettingsOpen);
core.$("studySettingsBtn").addEventListener("click", studySettingsOpen);
core.$("studyShelfSettingsBtn").addEventListener("click", studySettingsOpen);
core.$("studySettingsCloseBtn").addEventListener("click", () => studyCloseSettings());
core.$("studySettings").addEventListener("click", event => { if (event.target === core.$("studySettings")) studyCloseSettings(); });
core.$("studyHelpBtn").addEventListener("click", studyToggleHelp);
core.$("studyHelpCloseBtn").addEventListener("click", studyCloseHelp);
core.$("studyHelp").addEventListener("click", event => { if (event.target === core.$("studyHelp")) studyCloseHelp(); });
core.$("studyZoomIn").addEventListener("click", () => studyStepZoom(1));
core.$("studyZoomOut").addEventListener("click", () => studyStepZoom(-1));
core.$("studyZoomFit").addEventListener("click", studyZoomReset);
core.$("studyNextBtn").addEventListener("click", () => studyStep(1));
core.$("studyPrevBtn").addEventListener("click", () => studyStep(-1));
core.$("studyBookmarkBtn").addEventListener("click", studyToggleBookmark);
core.$("studyAssignCoverBtn").addEventListener("click", studyAssignCurrentCover);
core.$("studyClearCoverBtn").addEventListener("click", () => studyClearSongCover());
core.$("studyMemoBtn").addEventListener("click", studyToggleMemo);
core.$("studyMemoExportBtn").addEventListener("click", studyExportText);
core.$("studyChooseExportFolderBtn").addEventListener("click", studyChooseExportDirectory);
core.$("studyClearExportFolderBtn").addEventListener("click", () => { studyExportDirectory = null; studyRefreshExportFolderUI(); });
core.$("studyMemoEditor").addEventListener("input", studyMemoInput);
core.$("studyProgress").addEventListener("change", studyJumpFromSlider);
core.$("studyProgressDoneBtn").addEventListener("click", studyHideProgress);
core.$("studySearch").addEventListener("input", () => { studyShelfShown = STUDY_SHELF_PAGE; studyRenderShelf(); });
const studyShelfList = core.$("studyShelfList");
studyShelfList.addEventListener("dragover", event => studyShelfDragOver(event, { type:"container", folderId:studyShelfViewFolder }, studyShelfList));
studyShelfList.addEventListener("dragleave", event => { if (!studyShelfList.contains(event.relatedTarget)) studyShelfList.classList.remove("study-drop-target"); });
studyShelfList.addEventListener("drop", event => studyShelfDrop(event, { type:"container", folderId:studyShelfViewFolder }));
/* 📂 trk208：フォルダーを共有して、フォルダのまま読む（コピーしない）。許可は1回だけ・読むだけ。 */
core.$("studyShareFolderBtn").addEventListener("click", () => { void studyShareImageFolder(); });
core.$("studyImageFolderInput").addEventListener("change", event => {
  const files = Array.from(event.target.files || []); event.target.value = ""; if (files.length) studyImportImages(files);
});
core.$("studyArchiveInput").addEventListener("change", event => {
  const files = Array.from(event.target.files || []); event.target.value = ""; if (files.length) studyImportArchives(files);
});
for (const id of ["studyTextFilesInput", "studyTextFolderInput"]) core.$(id).addEventListener("change", event => {
  const files = Array.from(event.target.files || []); event.target.value = ""; if (files.length) studyImportTexts(files);
});
/* 設定の選択（文字列・チェックボックス）をまとめて結びつける。 */
function studyBindPref(id, key, onChange) {
  const node = core.$(id);
  node.addEventListener("change", () => {
    studyPrefs[key] = node.type === "checkbox" ? node.checked : node.value;
    studySavePrefs();
    if (onChange) onChange(node);
  });
}
function studySyncBookOrder() {
  if (studyCurrentBook && studyCurrentBook.kind === "image") {
    studyCurrentPage = studyNormalizePage(studyCurrentPage);
    studyClearPageImages(); studyRenderImagePage();
  }
  studySyncCurrentBookControls();
}
studyBindPref("studyImageMode", "imageMode", studySyncBookOrder);
studyBindPref("studyImageOrder", "imageOrder", studySyncBookOrder);
studyBindPref("studyAmerican", "american", () => { if (studyCurrentBook && studyCurrentBook.kind === "image" && studyPrefs.imageMode !== "vertical") studyRenderImagePage(); studySyncCurrentBookControls(); });
studyBindPref("studyTheme", "theme", () => { core.$("studyTextStage").dataset.theme = studyPrefs.theme; studySyncTextProgress(); });
studyBindPref("studyTextSize", "textSize", studySyncLook);
studyBindPref("studyTextSpacing", "textSpacing", studySyncLook);
studyBindPref("studyTextWidth", "textWidth", studySyncLook);
studyBindPref("studyTvCheck", "tvEnabled", studySyncTVDirection);
studyBindPref("studyTvPosition", "tvPosition", studySyncTVDirection);
studyBindPref("studyTvLook", "tvLook", studySyncLook);
studyBindPref("studyTvSize", "tvSize", studySyncLook);
studyBindPref("studyTvRatio", "tvRatio", studySyncLook);
studyBindPref("studyTvLabelOn", "tvLabelOn", studySyncLook);
studyBindPref("studyShelfSort", "shelfSort", () => studyRefreshBooks());
studyBindPref("studyManualShelfOrder", "manualShelfOrder", () => {
  core.$("studyShelfSort").disabled = studyPrefs.manualShelfOrder; studyShelfShown = STUDY_SHELF_PAGE; studyRenderShelf();
});
studyBindPref("studyFoldersFirst", "foldersFirst", () => { studyShelfShown = STUDY_SHELF_PAGE; studyRenderShelf(); });
studyBindPref("studySkipDeleteConfirm", "skipDeleteConfirm");
studyBindPref("studyShelfVisible", "shelfVisible", () => {
  studyApplyShelfVisibility();
  if (!studyPrefs.shelfVisible && core.$("studySettings").hidden) core.$("studyShowShelfBtn").focus({ preventScroll:true });
});
studyBindPref("studyVerticalImageKeys", "verticalImageKeys");
studyBindPref("studyAutoScrollSpeed", "studyAutoScrollSpeed", node => {
  studyPrefs.studyAutoScrollSpeed = studyAutoScrollSpeedValue(node.value);
  node.value = String(studyPrefs.studyAutoScrollSpeed);   /* 保存も走る（studyBindPref 共通）。動いていれば次のコマから新速度 */
});
core.$("studyAutoScrollBtn").addEventListener("click", studyToggleAutoScroll);
studyBindPref("studyReadSpecial", "readSpecial", () => studyApplyReadFilter());
for (const [id, key] of [["studyReadBrightness", "readBrightness"], ["studyReadContrast", "readContrast"]]) {
  const node = core.$(id);
  node.addEventListener("input", () => {   /* ドラッグ中は保存せず、見た目だけ生かす */
    studyPrefs[key] = studyReadFilterPercent(node.value);
    node.value = String(studyPrefs[key]); studyApplyReadFilter();
  });
  node.addEventListener("change", () => { studyPrefs[key] = studyReadFilterPercent(node.value); studySavePrefs(); studyApplyReadFilter(); });
}
studyBindPref("studyFullscreenFit", "fullscreenFit", () => studyApplyZoom(false));
studyBindPref("studyPageKeysTurnPages", "pageKeysTurnPages");
studyBindPref("studyCloseOnLastPageDown", "closeOnLastPageDown");
studyBindPref("studyMouseClickPages", "mouseClickPages", () => { core.$("studyMouseClickFlip").disabled = !studyPrefs.mouseClickPages; });
studyBindPref("studyMouseClickFlip", "mouseClickFlip");
studyBindPref("studyMiddleClickAction", "middleClickAction");
studyBindPref("studyZoomPercentStep", "zoomPercentStep", node => {
  studyPrefs.zoomPercentStep = studyZoomPercentStep(node.value);
  node.value = String(studyPrefs.zoomPercentStep);
  if (studyCurrentBook && studyCurrentBook.kind === "image" && studyPrefs.imageMode !== "vertical") studySetZoom(studySnapZoom(studyPrefs.zoom), true);
});
studyBindPref("studyAlbumNesting", "albumNesting", () => studySetStatus("studyAlbumNestingHint"));
studyBindPref("studyEditedTextFolder", "editedTextFolderId", () => {
  if (studyCurrentBook && studyCurrentBook.kind === "text" && !core.$("studyMemoEditor").hidden) studyFlushMemo();
});
core.$("studyFindInput").addEventListener("input", () => studyRunSearch(core.$("studyFindInput").value));
core.$("studyFindInput").addEventListener("keydown", event => {
  if (event.code === "Enter") { event.preventDefault(); studySearchGo(studySearchState.index + (event.shiftKey ? -1 : 1)); }
  else if (event.code === "Escape") { event.preventDefault(); studyEndSearch(); }
  else if (event.code === "ArrowUp" || event.code === "ArrowDown") event.stopPropagation();
});
core.$("studyFindNext").addEventListener("click", () => studySearchGo(studySearchState.index + 1));
core.$("studyFindPrev").addEventListener("click", () => studySearchGo(studySearchState.index - 1));
core.$("studyFindClear").addEventListener("click", studyEndSearch);
core.$("studyImageStage").addEventListener("click", studyImageTap);
core.$("studyImageStage").addEventListener("pointerdown", studyImagePointerDown);
core.$("studyImageStage").addEventListener("pointermove", studyImagePointerMove);
core.$("studyImageStage").addEventListener("pointerup", studyImagePointerEnd);
core.$("studyImageStage").addEventListener("pointercancel", studyImagePointerEnd);
core.$("studyImageStage").addEventListener("contextmenu", event => {
  event.preventDefault();
  studyMouseClickPage(2);
});
core.$("studyImageStage").addEventListener("mousedown", event => { studyMiddleClick(event, false); });
core.$("studyImageStage").addEventListener("auxclick", event => { studyMiddleClick(event, true); });
core.$("studyImageStage").addEventListener("scroll", studyVerticalScroll, { passive:true });
core.$("studyImageStage").addEventListener("wheel", event => {
  studyStopAutoScroll();   /* ホイール＝手動で読む意思表示なので止める（Ctrl+ホイールの拡大はそのまま続く） */
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  studyStepZoom(event.deltaY > 0 ? -1 : 1);
}, { passive:false });
core.$("studyTextPage").addEventListener("scroll", () => { clearTimeout(studyProgressTimer); studyProgressTimer = setTimeout(studySyncTextProgress, 80); }, { passive:true });
core.$("studyTextStage").addEventListener("scroll", studySyncTextProgress, { passive:true });
document.addEventListener("keydown", studyKeyDown, true);
document.addEventListener("keyup", studyKeyUp, true);
addEventListener("blur", () => {
  clearTimeout(studyHoldTimer); studyHeldCode = ""; studyPointerStart = null;
  studyPointers.clear(); studyPinchStart = 0;
});
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && !studyFullscreenFallback) core.$("studyRoom").classList.remove("study-fullimage");
  studySyncCurrentBookControls(); studySyncFindRow();
});
core.video.addEventListener("loadedmetadata", studyRefreshTV); core.video.addEventListener("loadeddata", studyRefreshTV);
core.video.addEventListener("resize", studyRefreshTV);
core.on("songSelected", () => { studyRefreshTV(); studyRefreshCoverButtons(); });
core.on("songArtwork", () => studyRefreshTV());
core.on("mediaReady", () => { studyRefreshTV(); studyRefreshCoverButtons(); });
core.on("studyCoverChanged", key => {
  if (!key || core.currentSong && key === core.currentSong.key) { studyTVArtSong = ""; studyRefreshTV(); studyRefreshCoverButtons(); }
});
core.on("phase", p => { if (p !== "title") studyCloseRoom(); else { studyRefreshTV(); studyRefreshCoverButtons(); } });
core.on("language", () => {
  studyTranslateNodes();
  core.$("studySearch").placeholder = tr("studySearch");
  core.$("studyFindInput").placeholder = tr("studyBookSearchPlaceholder");
  studySyncShelfTitleHint(); studyApplyShelfVisibility(); studyRefreshKeyAssignments();
  studyRefreshEditedTextFolderSelect(); studyRefreshExportFolderUI();
  core.$("studyMemoBtn").textContent = tr(core.$("studyMemoEditor").hidden ? "studyMemoEdit" : "studyMemoDone");
  studySetEditorStatus(core.$("studyEditorSaveStatus").dataset.state || "studyEditorSaved", true); studyUpdateEditorStats();
  studyRenderShelf(); studyRenderBookmarks();
  studySyncZoomRow(); studySyncZoomStepRow(); studySyncLook();
  if (studyCurrentBook) {
    core.$("studyCurrentTitle").textContent = studyCurrentBook.title;
    core.$("studyCurrentMeta").textContent = studyCurrentBook.kind === "image" ? `${tr("studyBookImages")} · ${tr("studyPageCount", { n:studyCurrentBook.pages.length })}`
      : `${tr("studyBookText")} · ${String(studyCurrentBook.extension || "TXT").toUpperCase()}`;
    core.$("studyMemoBtn").textContent = core.$("studyMemoEditor").hidden ? tr("studyMemoEdit") : tr("studyMemoDone");
    core.$("studyMemoExportBtn").hidden = studyCurrentBook.kind !== "text";
    studySyncPageCount(); studySyncCurrentBookControls(); studySyncTextProgress(); studyUpdateSearchCount();
  }
});

/* 起動の長押し（曲リストの見出し。650ms） */
const studyLaunchTitle = document.querySelector("#libPanel .libHead .study-launch-title");
const studyLaunchPress = studyLaunchTitle ? studyBindHoldPress(studyLaunchTitle, studyOpenRoom) : null;
if (studyLaunchTitle) {
  /* 見出し(h2)の中の本物の <button>。role も tabindex も要らず、読み上げでは「ボタン」と分かります */
  studyLaunchTitle.title = tr("studyLaunchHint"); studyLaunchTitle.setAttribute("aria-label", `${tr("libTitle")}. ${tr("studyLaunchHint")}`);
  studyLaunchTitle.addEventListener("click", event => {
    if (studyLaunchPress.fired()) { studyLaunchPress.reset(); event.preventDefault(); event.stopPropagation(); return; }
    /* 指やマウスのタップでは開かず、キーボードや読み上げの click（detail 0）だけで開きます。 */
    if (event.detail === 0) { event.preventDefault(); studyOpenRoom(); }
  });
  studyLaunchTitle.addEventListener("keydown", event => {
    if (event.code === "Enter" || event.code === "Space") { event.preventDefault(); studyOpenRoom(); }
  });
}
/* 📚 書斎を開くボタン（曲リストの右側。長押しに気づかなくても入れるように、設定に関係なく常に出します） */
const studyOpenBtn = document.getElementById("studyOpenBtn");
function studySyncOpenBtn() {
  if (!studyOpenBtn) return;
  studyOpenBtn.textContent = tr("studyOpenBtn");
  studyOpenBtn.title = tr("studyOpenBtnHint");
}
if (studyOpenBtn) { studySyncOpenBtn(); studyOpenBtn.addEventListener("click", () => studyOpenRoom()); }
core.on("language", () => {
  studySyncOpenBtn();
  if (!studyLaunchTitle) return;
  studyLaunchTitle.title = tr("studyLaunchHint");
  studyLaunchTitle.setAttribute("aria-label", `${tr("libTitle")}. ${tr("studyLaunchHint")}`);
});

/* ============ 起動 ============ */
let studyReadyPromise = Promise.resolve();
async function studyInit() {
  if (studySafeMode()) return;
  try {
    const [saved, shelf] = await Promise.all([
      studyDBRun("settings", "readonly", store => store.get("ui")),
      studyDBRun("settings", "readonly", store => store.get("shelf"))
    ]);
    studyReadPrefs(saved); studyReadShelfMeta(shelf); studyRefreshPrefsUI();
    await studySharedFoldersLoad();   /* 📂 trk208：覚えている共有フォルダー（フォルダのまま読む本） */
    await studyRefreshBooks();
    studyDataReady = true;
    const cleaned = await studySweepOrphans();
    if (cleaned) studySetStatus("studyOrphanSweep", { n:cleaned });
  } catch (error) { studyFail(error); }
}
studyReadyPromise = studyInit();

window.TrkStudyRoom = Object.freeze({
  open:studyOpenRoom,
  close:studyCloseRoom,
  toggle:() => { if (studyRoomOpen) studyCloseRoom(); else studyOpenRoom(); },
  isOpen:() => studyRoomOpen,
  importArchives:studyImportArchives,   /* 📥 OS共有（js/share-inbox.js）からも同じ検証経路へ合流させる（trk165） */
  refreshTV:studyRefreshTV,
  assignCover:studyAssignCurrentCover,
  sweepOrphans:studySweepOrphans,
  getSongCoverBlob:studyGetSongCoverBlob,
  getSongCoverInfo:studyGetSongCoverInfo,
  clearSongCover:studyClearSongCover,
  books:() => studyBooks.map(book => ({ id:book.id, title:book.title, kind:book.kind, pages:book.pages.length, bookmarked:!!book.bookmark })),
  stats:() => ({ books:studyBooks.length, images:studyBooks.reduce((n, book) => n + book.pages.length, 0),
    bytes:studyBooks.reduce((n, book) => n + STUDY_UTIL.bookSize(book), 0), bookmarks:STUDY_UTIL.bookmarkedBooks(studyBooks).length })
});
/* 領域（window.Trk.study）：書斎の公開面は凍結の window.TrkStudyRoom。同じ参照を領域の名前でも出す（旧名は残す） */
window.Trk = window.Trk || {};
window.Trk.study = window.TrkStudyRoom;
/* 書斎の上限の値（trk137）。復元の事前確認（backup.js）が同じ数字で判定するために公開する */
window.Trk.studyLimits = Object.freeze({ shelf:STUDY_SHELF_MAX, pages:STUDY_IMAGE_MAX_COUNT, imageBytes:STUDY_IMAGE_MAX_BYTES,
  imageFileBytes:STUDY_IMAGE_FILE_MAX, textBytes:STUDY_TEXT_FILE_MAX });
})();
