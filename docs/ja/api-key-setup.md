# APIキーの取得と安全な取り扱い

[日本語](api-key-setup.md) | [English](../api-key-setup.md) | [最初の翻訳](getting-started.md)

Minecraft Mods Localizerは、翻訳するテキストを選択したAIプロバイダーへアプリから直接送信します。プロバイダーのアカウントとAPIキーは利用者自身のものを使い、API利用料もプロバイダーから請求されます。ChatGPTのサブスクリプションにOpenAI API利用料は含まれず、API側で別途管理します。

## OpenAI APIキーを作成する

1. [OpenAI API Platform](https://platform.openai.com/)にサインインします。
2. [API keysページ](https://platform.openai.com/api-keys)で新しいシークレットキーを作成し、表示中にコピーします。完全なキーは後から再表示できない場合があります。
3. API Platformから求められた場合は、ChatGPTとは別にAPIの支払い設定を行います。Modpack全体を翻訳する前に利用状況やプロジェクトの上限を確認してください。
4. Minecraft Mods Localizerで**設定 → LLM設定**を開き、**OpenAI**を選択してキーを貼り付け、**設定を保存**を押します。

AnthropicやGoogle Geminiも、各社の公式コンソールでキーを作成し、アプリで同じプロバイダーを選んで入力します：[Anthropic Console](https://console.anthropic.com/) · [Google AI StudioのAPI keys](https://aistudio.google.com/app/apikey)。OpenAIのキーは[OpenAI API keysページ](https://platform.openai.com/api-keys)で管理します。各社の最新の課金・キー管理案内を確認してください。GeminiについてはGoogleの[APIキーガイド](https://ai.google.dev/gemini-api/docs/api-key)も参照してください。

## モデルと最初のリクエストを確認する

![v3のプロバイダー・APIキー・モデル設定](../assets/v3-settings-ja.png)

現行フロントエンドの設定位置を示すプレビューです。キー欄は空で、API接続の成功を示す画像ではありません。

設定の**モデル**には、プロバイダーの現在のモデルIDを入力します。[OpenAI](https://developers.openai.com/api/docs/models)・[Anthropic](https://platform.claude.com/docs/en/about-claude/models/overview)・[Gemini](https://ai.google.dev/gemini-api/docs/models)の公式一覧で、アカウントから利用できるものを確認してください。旧版で使えた名前も提供終了後には使えません。例えば旧既定値のClaude 3.5 Haikuは[2026年2月19日に提供終了](https://platform.claude.com/docs/en/about-claude/model-deprecations)しています。

v3の既定値は`gpt-4o-mini`、`claude-haiku-4-5-20251001`、`gemini-3.5-flash-lite`です。[Anthropicの終了案内](https://platform.claude.com/docs/en/about-claude/model-deprecations)と[Geminiのモデル案内](https://ai.google.dev/gemini-api/docs/deprecations)を参照してください。独自エンドポイントが未設定で、以前のAnthropic／Google既定値と完全一致する場合だけ自動移行します。独自モデルは保持します。

**設定を保存**してもテスト翻訳は送信されません。[最初の翻訳ガイド](getting-started.md)に沿って小さなModで試し、ログとゲーム内表示を確認します。認証エラーはキーとプロバイダーの組み合わせ、利用枠エラーは請求・利用量、モデルエラーはモデルIDとアカウントのアクセス権を確認してください。

## キーの保存場所

アプリに共通APIキーは埋め込みません。インストーラーやフロントエンドへ埋め込んだキーは取り出せてしまい、第三者に使われるとキーの所有者へ利用料が請求されるおそれがあります。

現在のバージョンでは、設定画面に入力したキーはOSの資格情報ストア（Windows Credential Manager、macOS Keychain、Linux Secret Service）では暗号化されず、OSのアプリ設定ディレクトリにある`config.json`へ平文で保存されます。OSアカウントを保護し、このファイルを共有・同期しないでください。漏えいが疑われる場合は、プロバイダーの管理画面でキーを失効させてください。OSの資格情報ストアを使う仕組みは今後のセキュリティ改善候補です。

OpenAI公式情報：[APIキーの確認・作成方法](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key) · [APIキーを安全に扱うベストプラクティス](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)
