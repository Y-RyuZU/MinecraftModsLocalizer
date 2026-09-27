# APIキーの取得と安全な取り扱い

Minecraft Mods Localizerは、翻訳するテキストを選択したAIプロバイダーへアプリから直接送信します。プロバイダーのアカウントとAPIキーは利用者自身のものを使い、API利用料もプロバイダーから請求されます。ChatGPTのサブスクリプションにOpenAI API利用料は含まれず、API側で別途管理します。

## OpenAI APIキーを作成する

1. [OpenAI API Platform](https://platform.openai.com/)にサインインします。
2. [API keysページ](https://platform.openai.com/api-keys)で新しいシークレットキーを作成し、表示中にコピーします。完全なキーは後から再表示できない場合があります。
3. API Platformから求められた場合は、ChatGPTとは別にAPIの支払い設定を行います。Modpack全体を翻訳する前に利用状況やプロジェクトの上限を確認してください。
4. Minecraft Mods Localizerで**Settings → LLM Settings**を開き、**OpenAI**を選択してキーを貼り付け、**Save Settings**を押します。

AnthropicやGoogle Geminiも同様に、各社の公式開発者コンソールでキーを作成し、アプリで同じプロバイダーを選んで入力します。

## キーの保存場所

アプリに共通APIキーは埋め込みません。インストーラーやフロントエンドへ埋め込んだキーは取り出せてしまい、第三者に使われるとキーの所有者へ利用料が請求されるおそれがあります。

現在のバージョンでは、設定画面に入力したキーはOSの資格情報ストア（Windows Credential Manager、macOS Keychain、Linux Secret Service）では暗号化されず、OSのアプリ設定ディレクトリにある`config.json`へ平文で保存されます。OSアカウントを保護し、このファイルを共有・同期しないでください。漏えいが疑われる場合は、プロバイダーの管理画面でキーを失効させてください。OSの資格情報ストアを使う仕組みは今後のセキュリティ改善候補です。

OpenAI公式情報：[APIキーの確認・作成方法](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key) · [APIキーを安全に扱うベストプラクティス](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)
