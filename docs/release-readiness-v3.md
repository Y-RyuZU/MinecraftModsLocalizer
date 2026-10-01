# v3.0.0 リリース判定と作業順

## 統合版のローカル検証（2026年10月1日）

`tauri` と `chore/modernize-and-issues` の未コミット変更をそれぞれ保存用コミットに固定し、両方の履歴を親に持つマージで統合した。元の作業ツリーは保持する。

- 保存用ブランチ：`codex/preserve-release-20261001`（`970753ad`）、`codex/preserve-tauri-20261001`（`b1d68837`）。
- OpenAI・Anthropic・Gemini の Batch API とプロバイダー別設定を統合。カスタムファイル経由の `startJob` も Batch 設定を尊重するよう修正した。
- OS言語の初期選択、10言語のUI、NSISの言語設定を維持。旧形式クエストの上書き確認と追加設定項目も10言語に揃えた。
- APIキーのOS資格情報ストア保存と、翻訳・更新設定の保存を両立。保存失敗が画面側に伝わるよう修正した。
- 長文のトークン分割で架空の `_part_` キーが作られる問題を修正。ゲームが参照する元キーを維持する。
- TauriのRust側とJavaScript側を同じバージョン系列に揃え、Rust側も明示的に固定した。
- 自動テスト：Bun 192件、Jest 164件、Vitest 97件、Rust 44件、リリースツールPython 5件が成功。計502件。以前から無効化されていたBunの2件はスキップのまま。
- 型検査、ESLint、10言語のi18n検査、Rust整形、Clippy、Next.js静的出力を検証した。
- Windows x64のデバッグ版NSISインストーラーを生成した。署名と更新用成果物は無効にした検証ビルドであり、公開用成果物ではない。

Batchの送信済みジョブをアプリ再起動後に再開する機能は未対応。結果保存までアプリを開いたままにする。過去の別セッションにはGPT-6 LunaでSilent Gearの1,191キー／12リクエストを処理した記録があるが、今回の統合検証では実APIを呼んでいない。

**公開前に残る確認：** 統合版のクロスプラットフォームCI、署名付き配布物、更新インストール、実ゲームでの代表例の再確認。以下は統合前に集めた検証記録であり、統合版の成功を示すものではない。

## 統合前の調査記録

## 確認した状態

- 作業ブランチは`chore/modernize-and-issues`。開始時のHEADとGitHub mainはともに`f4e36f5fd3b692a4f1cff6616a3869fbdbf8811b`。`git ls-remote`とGitHub APIで確認した。
- 開始時から32個の追跡済みファイルに変更があり、8言語のUI辞書・画像・FTB SNBT処理とテストなども未追跡だった。これらは既存作業として保持した。reset、checkout、clean、破棄はしていない。
- 公開最新版は[v2.1.3](https://github.com/Y-RyuZU/MinecraftModsLocalizer/releases/tag/v2.1.3)。2024年8月19日公開で、Tauriの`latest.json`はない。
- [CI run 36724279907](https://github.com/Y-RyuZU/MinecraftModsLocalizer/actions/runs/36724279907)は2026年9月30日のmainを対象にTestと4ビルドが成功。Create Releaseはスキップされている。未コミット変更の検証結果ではない。
- `TAURI_PRIVATE_KEY`と`TAURI_KEY_PASSWORD`のSecret名が登録済み。秘密値は読み取っていない。
- 依存関係の更新中に開発サーバーが停止したため、ポート3000で再起動した。現在の画面を再取得済み。

## CI成功だけでは公開できない理由

上記runのログに`Unexpected input(s) 'target'`があり、Intel Mac用ジョブでも`minecraft-mods-localizer_3.0.0_aarch64.dmg`が生成されている。実際にダウンロードした両macOS成果物にもARM版DMGしかなく、更新用の`.app.tar.gz`と署名がない。

WindowsのMSI/EXE、LinuxのAppImage/DEBの4署名は、設定中の公開鍵に対してNode標準cryptoによるEd25519検証とtrusted comment検証が成功した。検証対象メッセージを1バイト変えると拒否された。これは取得した旧CI成果物の署名一致の証拠であり、修正後ビルドやTauri経由の更新インストールの成功を意味しない。

## 開発作業の順序と完了条件

| 順序 | 状態 | 作業と完了条件 |
| --- | --- | --- |
| 1 | ローカル修正済み | `package.json`の1.0.0を3.0.0へ揃えた。Tauri、Cargo.toml、Cargo.lockのapp版とタグを検査する。 |
| 2 | ローカル修正済み | `tauri-action`に`args: --target`でCPUを渡し、macOSは`app,dmg`を生成。ターゲット別出力先からアップロードし、空なら失敗させる。 |
| 3 | ローカル検証済み | `scripts/prepare-release.py`で必要成果物・macOS CPU・版・署名形式を確認し、一意の名前とmanifest、SHA256SUMSを作る。5件の回帰テストが成功。旧CI成果物はmacOS更新用ファイル不足で拒否された。 |
| 4 | 修正後CI待ち | main/手動ビルドでも成果物検査を実行する構成へ変更。対象コミットを承認・push後、4環境と検査ジョブがすべて通り、Intel/ARMを実物で再確認できれば完了。 |
| 5 | 解決・検証済み | Bun・Jest・Vitestへ実際のimportに従って割り当て、古い契約を検査していたテストを修正。Bunはファイルごとに隔離してmockの干渉を防止。全スイート成功。 |
| 6 | 修正済み・実API未成功 | 既定モデルとキー検証を更新。旧既定値のみ、独自エンドポイントがなければ移行する。Googleのadapter選択、設定変更後のキー再利用、設定保存時の項目欠落も修正。Geminiへ2文字列を1回送信したがHTTP 402。 |
| 7 | 実機待ち | Windows、Intel Mac、Apple Silicon Mac、Linuxの導入→起動→1件翻訳→ゲーム内反映。修正後の同じ候補コミット・成果物で行う。 |
| 8 | 未検証 | 同一公開鍵を持つ旧Tauri版からの更新、再起動、改ざん拒否を専用のテスト取得先で確認する。v2.1.3からの移行は手動導入として確認する。 |

ユーザーが指定した1Password項目をCLIで読み取り、Geminiで2文字列の実API確認を1回だけ行った。HTTP 402で終了し、追加リクエストや翻訳結果の生成はない。キーを検証ファイルやログへ保存していない。Prismの許可された2パックは入力ファイルだけコピーして解析した。[配置と確認手順](ja/pack-verification.md)を参照。

## issueの再確認

対象6件は確認時点ですべてopen、コメントはなかった。**#15は指示どおり対象外**。

| issue | 現在の証拠 | 完了条件 |
| --- | --- | --- |
| [#10 Craft to Exile 2](https://github.com/Y-RyuZU/MinecraftModsLocalizer/issues/10) | 導入方法の質問。今回の初回ガイドでプロファイル選択とリソースパック有効化を説明。パック固有の実機成功は未確認。 | 対象パック版で導入から反映まで確認した手順を用意する。 |
| [#11 BetterQuest DefaultQuests.lang](https://github.com/Y-RyuZU/MinecraftModsLocalizer/issues/11) | 検出・解析コードとテストはあるが、`quests-tab.tsx`は`DefaultQuests.<言語>.lang`を出力する。元の固定ファイル名しか読まないという報告の問題は残り得る。 | バックアップを保ち、パックが実際に読み込むファイルへ安全に適用できることを確認する。 |
| [#13 旧.lang](https://github.com/Y-RyuZU/MinecraftModsLocalizer/issues/13) | RustでJARの`.lang`抽出・翻訳検出を実装。Rustライブラリテストは成功。 | Minecraft 1.12.2の実Modで書き出しとゲーム内反映を確認する。 |
| [#14 Gemini](https://github.com/Y-RyuZU/MinecraftModsLocalizer/issues/14) | Google adapter選択・既定モデル・キー変更反映を修正し単体検証。実APIはHTTP 402。 | 利用可能なアカウント設定で少量翻訳が成功する。 |
| [#16 FTB 1.21](https://github.com/Y-RyuZU/MinecraftModsLocalizer/issues/16) | ATM10SKY実入力は`config/ftbquests/quests/lang/en_us.snbt`。6,103エントリーの解析・再出力一致と日本語出力パスを確認。 | 翻訳成功とゲーム内反映を確認する。 |
| [#17 Create Astral](https://github.com/Y-RyuZU/MinecraftModsLocalizer/issues/17) | 実入力2,934文字列とLoad My Resourcesの`resources/`設定を確認。`ja_jp.json`へコピーする[手順](ja/pack-verification.md)を追加。 | 翻訳成功とゲーム内反映を確認する。 |

対応コードがあることと、報告者のパックで成功したことは区別する。対象範囲を縮めて公開する場合は、未対応事項をRelease本文・ガイドに明記した上でメンテナーが判断する。

## 非開発作業の順序と完了条件

1. **導入導線：作成済み。** README冒頭からダウンロード→APIキー→[日本語の初回翻訳](ja/getting-started.md)／[English guide](getting-started.md)→トラブル対処へ移動できる。公開v2と開発v3の違いを明記した。
2. **画面素材：作成済み。** 現行UIの日本語・英語メイン画面と設定画面を追加。デスクトップI/O成功の証拠とは扱っていない。
3. **短いチュートリアル：文章版完成。** 1つのModを選ぶ→翻訳→Minecraft内で確認する手順。動画の45秒台本は[告知素材](launch-v3.md)に記載。完了動画・ゲーム内の前後画像は実機検証後に制作する。
4. **Release本文：ローカル案作成済み。** [v3.0.0本文](releases/v3.0.0.md)。対象コミットの内容と受入結果で見直してからドラフトへ使用する。
5. **発見性・告知：案作成済み。** GitHubの既存description/topicsは用途を説明している。Xの日本語・英語文案、画像、代替テキスト、公開順序、公開後の確認方法を用意。外部変更はしていない。
6. **初回成功：未計測。** 少人数の初回利用でどの段階につまずくかを確認する案を用意。ダウンロード数だけを成功率とせず、テレメトリーも追加していない。

## ローカル検証結果

| 検査 | 結果 |
| --- | --- |
| `bun run typecheck` | 成功 |
| `bun run lint` | 成功。既存JSON parserの未使用引数と全呼び出しを整理した。 |
| `bun run test` | 18スイート・117テスト成功 |
| `python -m unittest discover -s scripts -p 'test_*.py'` | 5件成功 |
| Rustライブラリ・書式 | 27テスト成功、`cargo fmt --check`成功 |
| `bun run test:jest --runInBand` | 17スイート・165テスト成功 |
| `bun run test:vitest` | 9スイート・97テスト成功 |
| i18n | 10辞書のキー・補間・静的参照検査成功。ブラウザーで10言語の設定・ボタン・閉じるラベルを確認 |
| Windows候補ビルド | 現行フロントエンドとRustでNSIS EXEを生成。署名とupdater成果物を無効にしたローカル検証用。インストール試験は未実施 |
| インストール・ゲーム内表示 | 未検証。Windows候補生成の成功だけでは完了としない |
| `bun run build` | 別の一時ディレクトリへソースをコピーして成功。稼働中devの`.next`を上書きしていない。 |
| GitHub workflow YAML | 2ファイルとも`js-yaml`で構文解析成功。GitHub上の修正後実行は未検証。 |
| 署名 | 取得した旧CIのWindows/Linux 4成果物で公開鍵一致・trusted comment・改変拒否を確認。macOS署名は存在せず未検証。 |
| `git diff --check` | 成功 |

取得成果物・ローカル検証ログはgitignore対象の`.release-audit/`に保存している。既存の秘密情報を保存したものではない。新規スクリプトの単体テストは合成データなので、実インストール試験を代替しない。

## 公開判定時に揃えるもの

- [ ] リリース対象コミットと含める未コミット作業のレビューが完了。
- [ ] 意図したテストスイート、lint、型検査、Rust検査、4環境ビルド、成果物検査が同じコミットで成功。
- [ ] 新規API設定からゲーム内反映までの実機記録がある。
- [ ] 対象issueの完了条件を満たす、または対象範囲と既知制限を明示して受け入れる。
- [ ] 更新のインストール・署名拒否・再起動と、v2からの手動導入を確認。
- [ ] 各ダウンロード、署名、manifest、checksum、Release本文、画像が一致。
- [ ] 最初の利用者がガイドだけで成功できることを確認。
- [ ] メンテナーがpush・タグ・ドラフト作成・公開・告知を必要な段階で明示承認。

アプリは保存済みの言語選択を優先し、未設定時はOSの優先言語から対応言語を選ぶ。NSISは10言語を同梱し、OS言語による選択を設定済み。インストーラーの実画面は未検証。
