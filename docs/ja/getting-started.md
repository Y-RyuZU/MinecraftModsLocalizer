# 3ステップでクエストを日本語に

[ダウンロード](https://github.com/Y-RyuZU/MinecraftModsLocalizer/releases/latest) · [English](../getting-started.md)

## 1. APIキーを設定する

右上の歯車 → **LLM設定**で、プロバイダー・APIキー・モデルを選び、**設定を保存**。
APIキーがなければ[取得方法はこちら](api-key-setup.md)。翻訳にはプロバイダーのAPI利用料がかかります。

![プロバイダー・APIキー・モデルを設定する画面](../assets/v3-tutorial-settings-ja.jpg)

## 2. クエストを選んで翻訳する

**クエスト** → **プロファイルを選択**でModpackのゲームフォルダー（`mods`と`config`がある場所）を選びます。
**日本語**を選んで**スキャン** → 対象にチェック → **翻訳**。

![ATM10 SKYのクエストを選択した画面](../assets/v3-tutorial-quests-ja.jpg)

すぐ読みたいなら**通常API**、まとめて安く翻訳したいなら**Batch**を選んで開始。Batchは最大24時間かかる場合があります。

## 3. Minecraftで読む

翻訳が終わったらMinecraftを起動し、ゲームの言語を**日本語**に。同じクエストを開けば読めます。
起動中だった場合は再起動してください。

<img src="../assets/v3-tutorial-result-ja.png" alt="ATM10 SKYの「ふるいとメッシュ」が日本語で読めるゲーム画面" width="540">

---

**アイテム名や説明も翻訳したい？** **Mod**タブで同じ操作をし、ゲームで生成されたリソースパックを有効にします。説明書は**ガイドブック**タブから翻訳できます。

[Batchの再開・翻訳が反映されないとき](translation-help.md) · [APIキーの取得](api-key-setup.md)
