import logging
import re
import os
import shutil
import zipfile
from pathlib import Path

from init import MODS_DIR
from prepare import prepare_translation
from provider import provide_log_directory
from mod import get_mod_name_from_jar

def translate_patchouli():
    for filename in os.listdir(MODS_DIR):
        if filename.endswith('.jar'):
            process_jar_file(os.path.join(MODS_DIR, filename))

def process_jar_file(jar_path):
    mod_name = get_mod_name_from_jar(jar_path)
    if mod_name is None:
        return

    # パスの定義
    lang_path_in_jar = f'assets/{mod_name}/patchouli_books/guidebook'
    en_us_path = f'{lang_path_in_jar}/en_us/'
    ja_jp_path = f'{lang_path_in_jar}/ja_jp/'

    print(en_us_path)
    print(ja_jp_path)

    try:
        with zipfile.ZipFile(jar_path, 'r') as jar:

            en_us_exists = any(en_us_path in item.filename for item in jar.infolist())
            ja_jp_exists = any(ja_jp_path in item.filename for item in jar.infolist())

            if not en_us_exists:
                return {}
            if ja_jp_exists:
                return {}

            logging.info(f"Translate Patchouli in {jar_path}")

            with zipfile.ZipFile(jar_path + '.new', 'w') as new_jar:
                for item in jar.infolist():
                    data = jar.read(item.filename)
                    new_jar.writestr(item, data)  # すべての元のファイルをコピー
                    if item.filename.startswith(en_us_path) and not item.is_dir():
                        new_filename = item.filename.replace(en_us_path, ja_jp_path)

                        # 翻訳処理
                        if item.filename.endswith('.json'):
                            content = data.decode('utf-8')
                            matches = re.findall(r'"(name|description|title)":\s*"(.*?)(?<!\\)"', content)
                            extracted_strings = [match[1] for match in matches]
                            translated_map = prepare_translation(extracted_strings)
                            for original, translated in translated_map.items():
                                content = content.replace(f'"{original}"', f'"{translated}"')
                            new_jar.writestr(new_filename, content.encode('utf-8'))

        # 新しい.jarファイルで古いファイルを置き換え
        os.replace(jar_path + '.new', jar_path)

    except zipfile.BadZipFile:
        logging.error("Failed to read or write to the jar file.")