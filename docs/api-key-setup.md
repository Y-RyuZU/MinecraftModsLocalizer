# API key setup and safety

Minecraft Mods Localizer sends translation text directly from your app to the AI provider you select. You use your own provider account and pay that provider for API usage. A ChatGPT subscription does not include OpenAI API usage; API billing is managed separately.

## Create an OpenAI API key

1. Sign in to the [OpenAI API Platform](https://platform.openai.com/).
2. Open the [API keys page](https://platform.openai.com/api-keys) and create a new secret key. Copy it when it is shown; the full secret may not be shown again.
3. Configure API billing separately from ChatGPT if the API Platform asks you to. Check usage and project limits before translating a large pack.
4. In Minecraft Mods Localizer, open **Settings → LLM Settings**, choose **OpenAI**, paste the key, then select **Save Settings**.

The same flow applies to Anthropic and Google Gemini: create a key in that provider's official developer console and enter it under the matching provider in the app.

## Where the key is stored

The app does **not** contain a shared API key. A key embedded in an installer or frontend bundle could be extracted and used by anyone, potentially creating charges on the key owner's account.

In the current version, a key entered in Settings is stored as plain text in the app's local `config.json` (under the operating system's application-config directory). It is not encrypted with Windows Credential Manager, macOS Keychain, or a Linux secret service. Protect your OS account, avoid sharing or syncing this file, and revoke the key in the provider console if you suspect it was exposed. OS credential-store integration would be a future security improvement.

For OpenAI's official guidance, see [Where do I find my API key?](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key) and [Best practices for API key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety).
