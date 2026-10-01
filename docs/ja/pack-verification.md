# ATM10SKY・Create: Astralの確認手順

2026年10月1日、許可されたPrism Launcherインスタンスから入力ファイルだけをコピーして検証しました。元ファイルは変更していません。以下は配置の確認結果と操作手順で、ゲーム内表示の成功記録ではありません。

## ATM10SKY

Prismでインスタンスのフォルダーを開き、`minecraft`をMMLの対象フォルダーにします。クエストの英語入力は`config/ftbquests/quests/lang/en_us.snbt`です。このインスタンスでは`ftb_quests`ではなく`ftbquests`でした。

コピーした入力の6,103エントリーを解析し、書き出して再解析しても内容が一致しました。日本語の出力先は同じ`lang`フォルダーの`ja_jp.snbt`です。実際に翻訳する際はインスタンスをバックアップし、少量から始め、Minecraftの言語を日本語にしてクエスト画面を確認してください。

## Create: Astral

確認したMinecraft 1.18.2のインスタンスでは、Load My Resourcesの設定が`resources/`を読み込みます。

1. インスタンスをバックアップします。
2. MMLのカスタムファイルで`minecraft/resources/createastral/lang`を選びます。
3. `en_us.json`だけを選んで日本語へ翻訳します。同じ場所の他言語ファイルを一緒に選ばないでください。
4. 現在のカスタムファイル出力は`translated/ja_jp_en_us.json`です。既存の日本語ファイルがあれば退避し、翻訳結果を`minecraft/resources/createastral/lang/ja_jp.json`へコピーします。
5. Minecraftの言語を日本語にし、必要なら再起動してクエスト表示を確認します。

英語JSONの2,934文字列を読み取れることと、読み込み設定・配置先を確認しました。自動配置とゲーム内表示は未検証です。

## 実APIの結果

指定の1Password項目をCLIから読み取り、Geminiへ2文字列を1回だけ送信しました。HTTP 402で終了したため、翻訳結果は生成されていません。追加リクエストは行っていません。キーは検証用ファイルやログへ保存していません。

[初回翻訳ガイド](getting-started.md) · [リリース判定](../release-readiness-v3.md)
