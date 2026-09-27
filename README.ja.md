# Minecraft Mods Localizer

[English](README.md) | [日本語](README.ja.md)

AIを使ってMinecraftのModやModpackを翻訳する、Windows・macOS・Linux対応のデスクトップアプリです。Modの言語ファイル、FTB Quests、Patchouliのガイドブック、対応するJSON/SNBTファイルを日本語などの任意の言語へ翻訳します。Tauri、Rust、TypeScriptで開発しています。

## 主な機能

- Modの言語ファイルから翻訳リソースパックを作成
- FTB Quests、Better Quest、Patchouliガイドブック、JSON/SNBTに対応
- OpenAI、Anthropic、Google Geminiから翻訳モデルを選択
- 進捗表示、キャンセル、バッチ処理
- Tauriによる署名検証付きアップデート
- 日本語、簡体字中国語、韓国語、ドイツ語、フランス語、スペイン語、イタリア語、ブラジルポルトガル語、ロシア語を標準搭載。Minecraftの言語IDを指定して独自言語も設定可能

アプリの表示言語は現在、英語と日本語です。翻訳先は表示言語に限定されず、標準の言語や独自の言語IDを選べます。

## インストールと使い方

[Releases](https://github.com/Y-RyuZU/MinecraftModsLocalizer/releases)から、お使いのOS向けインストーラーをダウンロードしてください。

AI翻訳を使うには、プロバイダーのAPIキーが必要です。**Settings → LLM Settings**（設定 → LLM設定）からプロバイダーを選び、キーを入力して保存します。

- [OpenAI APIキーの取得・設定ガイド（日本語）](docs/ja/api-key-setup.md)
- [OpenAI API key setup (English)](docs/api-key-setup.md)
- [Tauri Updaterとリリース署名の管理（日本語）](docs/ja/updater.md)
- [Updater and release signing (English)](docs/updater.md)

API利用料は各プロバイダーから請求され、ChatGPTのサブスクリプションとは別です。APIキーをアプリへ共通埋め込みすることはありません。現在のバージョンでは、設定に入力したキーはOSの資格情報ストアで暗号化されず、ローカルのアプリ設定`config.json`に保存されます。PCのユーザーアカウントを保護し、このファイルを共有・同期しないでください。

## 開発

必要なもの：Rust 1.90以降、Node.js 24 LTS、Bun。依存関係を入れて起動します。

```sh
git clone https://github.com/Y-RyuZU/MinecraftModsLocalizer.git
cd MinecraftModsLocalizer
bun install
bun run tauri dev
```

テストは`bun run test:jest`、ビルドは`bun run tauri build`です。リリース手順は英語版の[Updater guide](docs/updater.md)も参照してください。

## 翻訳への協力

世界中の利用者が使いやすくなるよう、READMEやアプリ表示の翻訳を歓迎します。表示文言の原文は`public/locales/en/common.json`、日本語版は`public/locales/ja/common.json`です。Pull Requestでご協力ください。

## ライセンス

[MIT License](LICENSE)
