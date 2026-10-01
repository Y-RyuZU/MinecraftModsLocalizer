# Tauri Updaterとリリース署名

デスクトップアプリはTauriの署名付きUpdaterを使用します。設定済みの取得先は、GitHubで最新の**公開済み**Releaseにある`latest.json`です。インストール前に、`src-tauri/tauri.conf.json`内の公開鍵で更新ファイルの署名を検証します。

## 必須の署名設定

`src-tauri/tauri.conf.json`では`bundle.createUpdaterArtifacts`を有効にし、Updaterの**公開鍵**を設定しています。対になる秘密鍵をリポジトリへコミットしたり、アプリに同梱したりしてはいけません。Release workflowでは次のGitHub Actions secretsを使います。

- `TAURI_PRIVATE_KEY`: Tauri Updaterの署名秘密鍵の内容。ローカルファイルのパスを使う場合、そのファイルがGitHub Actions runner上にも存在する必要があります。
- `TAURI_KEY_PASSWORD`: 鍵のパスワード。パスワードなしの鍵なら空値

署名鍵を紛失・変更すると、古い公開鍵を信頼しているインストール済みアプリは新しい鍵の更新を受け入れません。安全なバックアップを保管し、安易に鍵をローテーションしないでください。

このリポジトリには`tauri.conf.json`へUpdater公開鍵がすでに設定されています。通常のリリースで新しい鍵を生成・差し替えないでください。secretsに登録する秘密鍵は、この公開鍵と対になるものです。新しいアプリ・鍵の系統を始める場合は`bunx tauri signer generate -w <private-key-file>`で鍵ペアを生成し、生成した公開鍵をTauriへ設定します。このリポジトリの公開鍵を変更するのは、利用者の移行を伴う作業です。

## リリース手順

1. `package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`内のappのバージョンを揃え、`python scripts/prepare-release.py --check-version`で確認します（Python 3.11以降）。
2. `v*`形式のタグをpushします。GitHub Actionsが署名用secretsを使い、各OSのインストーラーとUpdater署名を生成・収集します。
3. Release jobが成果物から`latest.json`を作ります。`.sig`ファイルへのURLではなく、`.sig`の中身をJSONに埋め込み、各OS/CPUに対応するキーへ関連付けます。
4. ドラフトReleaseに各OSのインストーラー、Updaterファイル・署名、`latest.json`が揃っていることを確認してから公開します。

更新確認先は最新の公開済みReleaseのため、ドラフト中は利用者に配信されません。Windowsは署名付きMSI、macOSは署名付き`.app.tar.gz`、Linuxは署名付きAppImageをUpdaterに使います。通常のインストーラーも同じReleaseに掲載します。

アプリ内の更新通知は、Tauri実行時にはインストール済みアプリのバージョンをTauriから取得します。開発用・ブラウザー実行ではフロントエンドのバージョンを代替として使い、Tauriデバッグモードでは自動インストールを無効にします。

## 公開前の検証

CIは`args: --target ...`でCPUを指定し、macOSでは`app,dmg`を生成します。成果物検査はタグ以外のビルドでも実行し、署名付き更新ファイル・インストーラー・`latest.json`・`SHA256SUMS.txt`を`release-assets`としてまとめます。空の署名を生成していた旧スクリプトは廃止しました。

```sh
gh run download <run-id> --dir artifacts
python scripts/prepare-release.py --tag v3.0.0 --artifacts artifacts --output release-assets
python -m unittest discover -s scripts -p 'test_*.py'
```

検査はバージョン、必要ファイル、macOS実行ファイルのCPU、署名の形式を確認します。署名形式の確認だけでは暗号学的な正当性は証明できません。同じ公開鍵を使う旧Tauriビルドからの更新、改ざんした更新ファイルの拒否、各OSでの起動・少量翻訳まで確認してください。ドラフトReleaseは公開Updaterから取得できないため、更新試験には専用のテスト取得先とビルドを使います。

v2.1.3にはTauriの`latest.json`がなく、自動移行は未検証です。手動インストーラーでの導入を案内してください。Tauriの更新署名とOSのコード署名・notarizationは別です。

詳しい[checksum確認コマンド](../updater.md#verify-downloads)と[リリース判定表](../release-readiness-v3.md)を参照してください。Release本文は`docs/releases/<タグ>.md`から取り込みます。この準備作業では公開、push、workflow実行、外部告知にはメンテナーの明示承認が必要です。
