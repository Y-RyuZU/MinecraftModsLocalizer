# MinecraftModsLocalizer ユーザーガイド

このドキュメントでは、MinecraftModsLocalizerの使用方法について詳しく説明します。このツールは、MinecraftのModとModPackのQuestsを日本語に翻訳するためのものです。

## 目次

1. [概要](#概要)
2. [インストール前の要件](#インストール前の要件)
3. [インストール方法](#インストール方法)
4. [使い方](#使い方)
5. [ファイル構造](#ファイル構造)
6. [翻訳のカスタマイズ](#翻訳のカスタマイズ)
7. [ログとバックアップ](#ログとバックアップ)
8. [注意事項](#注意事項)
9. [内部実装について](#内部実装について)
10. [将来のアップデートと余談](#将来のアップデートと余談)

## 概要

**ソフト名:** MinecraftModsLocalizer

このソフトウェアは、DEEPL翻訳を使用して、MinecraftのMod本体とftbquestsのQuestを日本語に翻訳する機能を提供します。

ModPackなどの一括翻訳などにご利用ください

**動作環境:**
- Windows
- Mac
- Linux

**テスト済み環境:**
- Windows
- ATM9 (Forge)
- Create Astral (Fabric)

## インストール前の要件

- DEEPL翻訳のAPI_KEY（認証キー）が必要です。

## インストール方法

実行ファイル（例: main.exe）は、Minecraftのメインディレクトリ内、`mods`、`resourcepacks`、`config`、`logs`フォルダが存在する場所に配置してください。

以下にWindows環境のディレクトリツリーの例を示します。

```
構成ファイル/
│
|── main.exe
├── config/
├── kubejs/
├── mods/
└── logs/
    └── localizer/
        └── {日付}/
├── resourcepacks/
```

## 使い方

1. DEEPLのAPI_KEYを取得し、ソフトウェアにキーを提供します。
2. ソフトウェアを起動し、指示に従ってModまたはQuestsの翻訳を開始します。

特定のmod(.jar)やquestファイル(.snbt)のみを翻訳したい場合は、それらのファイルを取り除いてください。

- modは`mods`フォルダ内にあります。
- questsは`config/ftbquests/quests/chapters`の中にあります。

## 出力ファイル

- mod本体の翻訳は、リソースパックとして出力され、`resourcepacks/japanese`に保存されます。
- questsの翻訳は、kubejs/assets/kubejs/lang/en_us.jsonが存在するか調べます
- 存在する場合kubejs/assets/kubejs/lang/ja_jp.json と kubejs/assets/ftbquests/lang/ja_jp.jsonを作成し、そこに翻訳を追加します。
- 存在しない場合直接config/ftbquests/quests/chapters/ファイル(.snbt)を書き換え翻訳します。

## ログとバックアップ

- 実行ログは`logs/localizer/{日付}`内に保存されます。これには、コンソールログと翻訳前ファイルのバックアップが含まれます。

## 注意事項

- **API料金には十分注意してください無料枠を超えないよう分割翻訳を行うことを推奨します。**
- DEEPL翻訳を使用しているため、翻訳の精度は非常に高いと思われますが、"%s"などの変数を含む文字列の場合、挙動に問題が生じる可能性があります。不自然または誤った翻訳を見つけた場合、ファイルを直接編集することで修正してください。
- Mod本体の翻訳に関して、リソースパックのpack.mcmetaがインデントが崩れている場合、正常に読み込まれない可能性があります。リソースパックに候補が出てこない場合は、pack.mcmetaを確認してください。

## 内部実装について

- **mod本体翻訳:** modファイル(.jar)から`assets/{mod名}/lang/ja_jp.json` または `assets/{mod名}/lang/en_us.json`を抽出し、その中で日本語の値を持たないものを翻訳し、リソースパックを作成します。
- リソースパックのpack.mcmetaは最初に見つけたjarファイルのものを使用します。descriptionなどはお好みで変更してください。
- **quests翻訳:** kubejs/assets/kubejs/lang/en_us.jsonが存在するか調べます
- 存在する場合kubejs/assets/kubejs/lang/en_us.jsonを読み込み翻訳を行います
- 存在しない場合直接config/ftbquests/quests/chapters/ファイル(.snbt)を書き換え翻訳します。
- また、kubejs/assets/kubejs/lang/en_us.jsonに本来jsonとして無効なコメントが含まれている場合消し飛ばします(Create Astralで確認)。

## 将来のアップデートと余談

- 完璧な翻訳を求める場合、将来的にはGPT-4のAPIを使用することが最善の選択かもしれません。GPT-4の対応は、開発者の意向やコスト面の変化に応じて実施される可能性があります。
- コミュニティ内でAPIコストを分担し、翻訳ファイルを共有する方法がコストパフォーマンスの観点から有効であると考えられます。
- 一日で作った手抜きソフトなのでテスト不足、バグも散見され、コードも汚いと思いますが、ご了承ください。Github Issuesにバグ報告や機能要望を投稿していただけると幸いです。