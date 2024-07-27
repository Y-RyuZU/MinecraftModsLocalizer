# MinecraftModsLocalizer ユーザーガイド


# **New!! 翻訳に使用するAIをChatGPTに変更しました！API料金が大幅に安くなり(ATM9で05ドル以下)、精度も格段に良くなりました！ファイル構造の崩壊、特殊文字無視とはバイバイ！**
あとBetterQuestingに対応しました。RLCraftとかする人はどうぞ


このツールは、MinecraftのModとModPackのQuestsを日本語に翻訳するためのものです。
## 注意事項はより良い翻訳のために読むことを推奨します

## 目次

1. [概要](#概要)
2. [インストール前の要件](#インストール前の要件)
3. [インストール方法](#インストール方法)
4. [使い方](#使い方)
5. [出力ファイル](#出力ファイル)
6. [翻訳のカスタマイズ](#翻訳のカスタマイズ)
7. [ログとバックアップ](#ログとバックアップ)
8. [注意事項](#注意事項)
9. [内部実装について](#内部実装について)
10. [将来のアップデートと余談](#将来のアップデートと余談)

## 概要

**ソフト名:** MinecraftModsLocalizer

このソフトウェアは、ChatGPTを使用して、MinecraftのMod本体とBetterQuestingまたはftbquestsのQuestを日本語に翻訳する機能を提供します。

ModPackなどの一括翻訳などにご利用ください

**動作環境:**
- Windows
- Mac
- Linux

**テスト済み環境:**
- Windows

**テスト済みModPack:**
- DawnCraft (Forge)
- ATM9 (Forge)
- Create Astral (Fabric)
- RLCraft (Forge)

## インストール前の要件

- OpenAIのAPI_KEYが必要です。

## インストール方法

実行ファイル（例: minecraft-mods-localizer-windows.exe）は、Minecraftのメインディレクトリ内、`mods`、`resourcepacks`、`config`、`logs`フォルダが存在する場所に配置してください。

以下にWindows環境のディレクトリツリーの例を示します。

```
構成ファイル/
│
├── minecraft-mods-localizer-windows.exe
├── config/
├── kubejs/
├── resources/
├── mods/
└── logs/
    └── localizer/
        └── {日付}/
├── resourcepacks/
```

## 使い方

1. OpenAIのAPI KEYを取得し、ソフトウェアに提供します(ググると取得方法はいっぱい出ると思います)。
2. ソフトウェアを起動し、指示に従ってModまたはQuestsの翻訳を開始します。

**超巨大なModPack(ATM9のような)でも0.5ドル以下で翻訳できると思います。本当に安くなった。**

特定のmod(.jar)やquestファイル(.snbt)のみを翻訳したい場合は、それらのファイルを取り除いてください。

- modは`mods`フォルダ内にあります。
- questsは`kubejs/assets/kubejs/lang/`または`config/ftbquests/quests/chapters`(両方ある場合はlangの方が翻訳元になります)の中にあります。

### 各項目について
- **Translate Target:** 翻訳対象を選択します。
- **OpenAI API KEY:** OpenAIのAPI_KEYを入力してください。
- **Chunk Size** ファイルを分割して翻訳するため、一つあたりの行数を指定します。下げると翻訳速度が低下しますが精度が上昇します。また、下げると翻訳失敗時に翻訳されなかった部分が減ります。単体mod翻訳やクエストのみの翻訳では1、ModPackで大量のModを一括で翻訳するときは100くらいまで上げることをお勧めします(翻訳時間がすごいことになります)
- **Model** 弄らないことをお勧めします。OpenAIからより良いモデルが出たときは変更してもよいかもしれません。
- **Prompt** 知識のある方はプロンプトを弄るとさらなる精度向上が見込めるかもしれません。特にどうしても一部翻訳が正常に成功しないことがあり、成功しなかった場合はチャンクを丸ごと翻訳しないことになります。

## 出力ファイル

- mod本体の翻訳は、リソースパックとして出力され、`resourcepacks/japanese`に保存されます。
- questsの翻訳は、`kubejs/assets/kubejs/lang/en_us.json`が存在するか調べます(BetterQuestingの場合`recourses/betterquesting/lang`)
- 存在する場合`kubejs/assets/kubejs/lang/ja_jp.json` と `kubejs/assets/ftbquests/lang/ja_jp.json`を作成し、そこに翻訳を追加します。
- 存在しない場合直接`config/ftbquests/quests/chapters/ファイル(.snbt)`を書き換え翻訳します。

## ログとバックアップ

- 実行ログは`logs/localizer/{日付}`内に保存されます。これには、コンソールログと翻訳前ファイルのバックアップが含まれます。

## 注意事項

- **Chunk Sizeは単体mod翻訳やクエストのみの翻訳では1、ModPackで大量のModを一括で翻訳するときは100くらいまで上げることをお勧めします(翻訳時間がすごいことになります)**
- OpenAIのAPI_KEYの取り扱いには十分注意してください。
- GPT4o miniにモデルを変更したことによってAPI料金は気にしなくてもいいレベルで安くなりましたが、代償として翻訳が超遅くなりました。気長に待ってください
- Mod本体の翻訳に関して、リソースパックのpack.mcmetaがインデントが崩れている場合、正常に読み込まれない可能性があります。リソースパックに候補が出てこない場合は、pack.mcmetaを確認してください。
- どうしても翻訳が失敗してしまうことがあるので、気になる方は
- Mod: `logs/localizer/error`から手動でjsonを編集し、`resourcepacks/japanese/lang/ja_jp.json`に追記してください
- Quest: `logs/localizer/error`から手動でjsonを編集し、`/kubejs/assets/kubejs/lang/ja_jp.json`に追記してください
- ※なお、Questの場合snbtファイルに直書き形式であった場合errorディレクトリに記録が残りません。

## 内部実装について

- **mod本体翻訳:** modファイル(.jar)から`assets/{mod名}/lang/ja_jp.json` または `assets/{mod名}/lang/en_us.json`を抽出し、その中で日本語の値を持たないものを翻訳し、リソースパックを作成します。
- リソースパックのpack.mcmetaは最初に見つけたjarファイルのものを使用します。descriptionなどはお好みで変更してください。
- **quests翻訳:** `kubejs/assets/kubejs/lang/en_us.json`が存在するか調べます
- 存在する場合`kubejs/assets/kubejs/lang/en_us.json`を読み込み翻訳を行います
- 存在しない場合直接`config/ftbquests/quests/chapters/ファイル(.snbt)`を書き換え翻訳します。
- また、`kubejs/assets/kubejs/lang/en_us.json`に本来jsonとして無効なコメントが含まれている場合、改行コード(\n)がクエスト内容に存在する場合消し飛ばします(Create Astralで確認)。扱いめんどくさかった。許して❤
- 翻訳前と後の行数が異なる場合最大5回までもう一度翻訳を試みます。それでもダメな場合はそのチャンクは翻訳されません。

## 将来のアップデートと余談

- コード綺麗にしました。forkなども大歓迎です。init.pyを弄ればだいたいのパラメーターは弄れます。プロンプトが気に入らないときはどうぞ
- Github Issuesにバグ報告や機能要望を投稿していただけると幸いです。