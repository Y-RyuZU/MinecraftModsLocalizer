import json
import logging
import os
import re
import zipfile
from pathlib import Path

from src.init import RESOURCE_DIR, MODS_DIR
from src.provider import provide_log_directory
from src.prepare import extract_map_from_json, prepare_translation


def process_jar_file(jar_path):
    mod_name = get_mod_name_from_jar(jar_path)
    if mod_name is None:
        logging.info(f"Could not determine mod name for {jar_path}")
        return {}

    lang_path_in_jar = Path(f'assets/{mod_name}/lang/')
    ja_jp_path_in_jar = os.path.join(lang_path_in_jar, 'ja_jp.json')
    en_us_path_in_jar = os.path.join(lang_path_in_jar, 'en_us.json')
    ja_jp_path_in_jar_str = str(ja_jp_path_in_jar).replace('\\', '/')
    en_us_path_in_jar_str = str(en_us_path_in_jar).replace('\\', '/')

    logging.info(f"Extract en_us.json or ja_jp.json in {jar_path / lang_path_in_jar}")
    with zipfile.ZipFile(jar_path, 'r') as zip_ref:
        if en_us_path_in_jar_str in zip_ref.namelist():
            extract_specific_file(jar_path, en_us_path_in_jar_str, provide_log_directory())
        if ja_jp_path_in_jar_str in zip_ref.namelist():
            extract_specific_file(jar_path, ja_jp_path_in_jar_str, provide_log_directory())

    en_us_path = os.path.join(provide_log_directory(), en_us_path_in_jar)
    ja_jp_path = os.path.join(provide_log_directory(), ja_jp_path_in_jar)

    return extract_map_from_json(ja_jp_path) if os.path.exists(ja_jp_path) else extract_map_from_json(en_us_path)


def translate_from_jar():
    if not os.path.exists(RESOURCE_DIR):
        os.makedirs(os.path.join(RESOURCE_DIR, 'assets', 'japanese', 'lang'))

    targets = {}

    extracted_pack_mcmeta = False
    for filename in os.listdir(MODS_DIR):
        if filename.endswith('.jar'):
            # Extract pack.mcmeta if it exists in the jar
            if not extracted_pack_mcmeta:
                extracted_pack_mcmeta = extract_specific_file(os.path.join(MODS_DIR, filename), 'pack.mcmeta',
                                                              RESOURCE_DIR)
                update_resourcepack_description(os.path.join(RESOURCE_DIR, 'pack.mcmeta'), '日本語化パック')

            targets.update(process_jar_file(os.path.join(MODS_DIR, filename)))

    translated_map = prepare_translation(list(targets.values()))

    translated_targets = {json_key: translated_map[original] for json_key, original in targets.items() if
                          original in translated_map}

    untranslated_items = {json_key: original for json_key, original in targets.items() if
                          original not in translated_map}

    with open(os.path.join(RESOURCE_DIR, 'assets', 'japanese', 'lang', 'ja_jp.json'), 'w', encoding="utf-8") as f:
        json.dump(dict(sorted(translated_targets.items())), f, ensure_ascii=False, indent=4)

    error_directory = os.path.join(provide_log_directory(), 'error')

    if not os.path.exists(error_directory):
        os.makedirs(error_directory)

    with open(os.path.join(error_directory, 'mod_ja_jp.json'), 'w', encoding="utf-8") as f:
        json.dump(dict(sorted(untranslated_items.items())), f, ensure_ascii=False, indent=4)


def update_resourcepack_description(file_path, new_description):
    # ファイルが存在するか確認
    if not os.path.exists(file_path):
        return

    with open(file_path, 'r', encoding='utf-8') as file:
        try:
            data = json.load(file)
        except json.JSONDecodeError as e:
            return

    # 'description'の'text'を新しい値に更新
    try:
        if 'pack' in data and 'description' in data['pack'] and 'text' in data['pack']['description']:
            data['pack']['description']['text'] = new_description
        else:
            return
    except Exception as e:
        return

    # 変更を加えたデータを同じファイルに書き戻す
    with open(file_path, 'w', encoding='utf-8') as file:
        try:
            json.dump(data, file, ensure_ascii=False, indent=2)  # JSONを整形して書き込み
        except Exception as e:
            return


def get_mod_name_from_jar(jar_path):
    with zipfile.ZipFile(jar_path, 'r') as zip_ref:
        asset_dirs_with_lang = set()
        for name in zip_ref.namelist():
            parts = name.split('/')
            if len(parts) > 3 and parts[0] == 'assets' and parts[2] == 'lang' and parts[1] != 'minecraft':
                asset_dirs_with_lang.add(parts[1])
        if asset_dirs_with_lang:
            return list(asset_dirs_with_lang)[0]
    return None


def extract_specific_file(zip_filepath, file_name, dest_dir):
    with zipfile.ZipFile(zip_filepath, 'r') as zip_ref:
        if file_name in zip_ref.namelist():
            zip_ref.extract(file_name, dest_dir)
            return True
        else:
            logging.info(f"The file {file_name} in {zip_filepath} was not found in the ZIP archive.")
    return False
