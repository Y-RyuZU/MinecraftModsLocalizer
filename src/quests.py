import json
import logging
import os
import re
import shutil

from init import FTBQUESTS_DIR1, FTBQUESTS_DIR2, FTBQUESTS_DIR3, FTBQUESTS_DIR4, BETTERQUESTING_DIR
from provider import provide_log_directory
from prepare import extract_map_from_lang, extract_map_from_json, prepare_translation


def translate_betterquesting_from_json(file_path):
    clean_json_file(file_path)
    targets = extract_map_from_lang(file_path)

    translated_map = prepare_translation(list(targets.values()))

    translated_targets = {lang_key: translated_map[original] for lang_key, original in targets.items() if original in translated_map}

    untranslated_items = {lang_key: original for lang_key, original in targets.items() if original not in translated_map}

    with open(os.path.join(BETTERQUESTING_DIR / 'ja_jp.lang'), 'w', encoding="utf-8") as f:
        # 翻訳された項目の書き込み
        for lang_key, translated in translated_targets.items():
            f.write(f'{lang_key}={translated}\n')
        # 翻訳されなかった項目の書き込み（原文のまま）
        for lang_key, original in untranslated_items.items():
            f.write(f'{lang_key}={original}\n')


def translate_ftbquests_from_json(file_path):
    clean_json_file(file_path)
    targets = extract_map_from_json(file_path)

    translated_map = prepare_translation(list(targets.values()))

    translated_targets = {json_key: translated_map[original] for json_key, original in targets.items() if original in translated_map}

    untranslated_items = {json_key: original for json_key, original in targets.items() if original not in translated_map}

    with open(os.path.join(FTBQUESTS_DIR1 / 'ja_jp.json'), 'w', encoding="utf-8") as f:
        json.dump(dict(sorted(translated_targets.items())), f, ensure_ascii=False, indent=4)
    with open(os.path.join(FTBQUESTS_DIR2 / 'ja_jp.json'), 'w', encoding="utf-8") as f:
        json.dump(dict(sorted(translated_targets.items())), f, ensure_ascii=False, indent=4)

    error_directory = os.path.join(provide_log_directory(), 'error')

    if not os.path.exists(error_directory):
        os.makedirs(error_directory)

    with open(os.path.join(error_directory, 'quests_en_us.json'), 'w', encoding="utf-8") as f:
        json.dump(dict(sorted(untranslated_items.items())), f, ensure_ascii=False, indent=4)


def translate_ftbquests_from_snbt(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    logging.info(f"Translating {file_path}...")

    extracted_strings = []

    # Extract description strings
    description_pattern = r'description: \[\s*([\s\S]*?)\s*\]'
    description_matches = re.findall(description_pattern, content)
    for match in description_matches:
        for inner_match in re.findall(r'(?<!\\)"(.*?)(?<!\\)"', match):
            if inner_match:  # Non-empty strings
                extracted_strings.append(inner_match)

    # Extract title and subtitle strings
    title_and_subtitle_pattern = r'(title|subtitle): "(.*?)"'
    title_and_subtitle_matches = re.findall(title_and_subtitle_pattern, content)
    for _, inner_match in title_and_subtitle_matches:
        if inner_match:  # Non-empty strings
            extracted_strings.append(inner_match)

    if len(extracted_strings) == 0:
        logging.info("No strings found. Skipping...")
        return

    # Translate the content of tmp.txt and get the translated values
    translated_map = prepare_translation(extracted_strings)

    # Substitute back the translated content
    for original, translated in translated_map.items():
        content = content.replace(f'"{original}"', f'"{translated}"', 1)

    # Save the content back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)


def translate_ftbquests():
    # バックアップ用のディレクトリを作成
    backup_directory = provide_log_directory() / 'quests'
    backup_directory.mkdir(parents=True, exist_ok=True)

    logging.info("translating snbt files...")
    json_path = os.path.join(FTBQUESTS_DIR1, 'en_us.json')

    if os.path.exists(json_path):
        logging.info(f"en_us.json found in {FTBQUESTS_DIR1}, translating from json...")
        shutil.copy(json_path, backup_directory)
        translate_ftbquests_from_json(json_path)
    else:
        logging.info(f"en_us.json not found in {FTBQUESTS_DIR1}, translating snbt files in directory...")
        nbt_files = list(FTBQUESTS_DIR3.glob('*.snbt'))

        backup_file = backup_directory / FTBQUESTS_DIR4.name
        shutil.copy(FTBQUESTS_DIR4, backup_file)
        translate_ftbquests_from_snbt(FTBQUESTS_DIR4)

        for file in nbt_files:
            backup_file = backup_directory / file.name
            shutil.copy(file, backup_file)
            translate_ftbquests_from_snbt(file)

    logging.info("Translate snbt files Done!")


def translate_betterquesting():
    # バックアップ用のディレクトリを作成
    backup_directory = provide_log_directory() / 'quests'
    backup_directory.mkdir(parents=True, exist_ok=True)

    logging.info("translating snbt files...")
    json_path = os.path.join(BETTERQUESTING_DIR, 'en_us.lang')

    if os.path.exists(json_path):
        logging.info(f"en_us.json found in {BETTERQUESTING_DIR}, translating from json...")
        shutil.copy(json_path, backup_directory)
        translate_betterquesting_from_json(json_path)
    else:
        logging.error(f"en_us.json not found in {BETTERQUESTING_DIR}.")

    logging.info("Translate snbt files Done!")


def clean_json_file(json_path):
    # コメントおよび空白行のパターンを正規表現で定義します。
    comment_pattern = re.compile(r'^\s*//.*$', re.MULTILINE)
    blank_lines_pattern = re.compile(r'\n\s*\n', re.MULTILINE)

    with open(json_path, 'r', encoding='utf-8') as file:
        content = file.read()

    # コメントを削除します。
    content_without_comments = re.sub(comment_pattern, '', content)

    # 空白行を削除します。
    cleaned_content = re.sub(blank_lines_pattern, '\n', content_without_comments)

    # 不要な内容が削除されたJSONを新しいファイルに書き出します。
    with open(json_path, 'w', encoding='utf-8') as file:
        file.write(cleaned_content.strip())
