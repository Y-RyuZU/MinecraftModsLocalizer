import logging
import re
import time
from openai import OpenAI

from provider import provide_api_key, provide_model, provide_prompt, provide_api_base, provide_temperature


def translate_with_chatgpt(split_target, timeout):
    start_time = time.time()
    result = []

    # 改行を削除(翻訳時扱いがめんどくさいため)
    split_target = [line.replace('\\n', '').replace('\n', '') for line in split_target] if len(split_target) > 1 else split_target

    # APIキーとクライアントの初期化
    api_params = {"api_key": provide_api_key()}
    
    # APIベースURLが設定されている場合は追加
    api_base = provide_api_base()
    if api_base:
        api_params["base_url"] = api_base
    
    client = OpenAI(**api_params)

    try:
        # ChatGPTを用いて翻訳を行う
        response = client.chat.completions.create(
            model=provide_model(),
            temperature=provide_temperature(),
            messages=[
                {
                    "role": "system",
                    "content": [
                        {"type": "text", "text": provide_prompt().replace('{line_count}', str(len(split_target)))}]
                },
                {
                    "role": "user",
                    "content": [{"type": "text", "text": '\n'.join(split_target)}]
                }
            ],
        )

        # 翻訳結果を取得
        if response.choices and response.choices[0].message:
            translated_text = response.choices[0].message.content
            result = translated_text.splitlines() if len(split_target) > 1 else [translated_text.replace('\n', '')]
            result = [re.sub(r'(?<!\\)"', r'\\"', line) for line in result]
        else:
            logging.error("Failed to get a valid response from the ChatGPT model.")

    except Exception as e:
        elapsed_time = time.time() - start_time
        if elapsed_time > timeout:
            logging.error("Timeout reached while waiting for translation.")
        logging.error(f"Error during translation: {str(e)}")

    return result
