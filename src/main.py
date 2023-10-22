import os
import json
import re
import shutil
import time
import zipfile
import requests
import PySimpleGUI as sg
from pathlib import Path
import logging
from datetime import datetime

RESOURCE_DIR = Path('./resourcepacks/japanese')
MODS_DIR = Path('./mods')
QUESTS_DIR1 = Path('./kubejs/assets/kubejs/lang')
QUESTS_DIR2 = Path('./kubejs/assets/ftbquests/lang')
QUESTS_DIR3 = Path('./config/ftbquests/quests/chapters')
DEEPL_API_URL = 'https://api.deepl.com/v2/translate'
UPLOAD_URL = "https://api.deepl.com/v2/document"
CHECK_STATUS_URL_TEMPLATE = "https://api.deepl.com/v2/document/{}"
DOWNLOAD_URL_TEMPLATE = "https://api.deepl.com/v2/document/{}/result"

def extract_specific_file(zip_filepath, file_name, dest_dir):
    with zipfile.ZipFile(zip_filepath, 'r') as zip_ref:
        if file_name in zip_ref.namelist():
            zip_ref.extract(file_name, dest_dir)
            return True
        else:
            logging.info(f"The file {file_name} in {zip_filepath} was not found in the ZIP archive.")
    return False

def extract_map_from_json(file_path, collected_map):
    if os.path.exists(file_path):
        logging.info(f"Extract keys in en_us.json(or ja_jp.json) in {file_path}")
        try:
            with open(file_path, 'r', encoding="utf-8") as f:
                content = json.load(f)

            # 値が英語でコメント以外のキーのみを保存します。
            for key, value in content.items():
                if not key.startswith("_comment") and not re.search('[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]', value):
                    collected_map[key] = value  # 辞書にキーと値を追加します。

        except json.JSONDecodeError:
            logging.info(f"Failed to load or process JSON from {file_path}. Skipping this mod for translation. Please check the file for syntax errors.")
    else:
        logging.info(f"Could not find {file_path}. Skipping this mod for translation.")

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

def split_file(file_path, max_size=800000):  # max_size in bytes
    """Split text file into smaller parts based on line endings, keeping the file size below max_size bytes."""
    parts = []
    part_count = 1

    with open(file_path, 'r', encoding='utf-8') as f:
        current_part = []
        current_size = 0

        for line in f:
            line_size = len(line.encode('utf-8'))  # Calculate the size of the line in bytes

            if current_size + line_size > max_size and current_part:
                # If adding the line exceeds the maximum size, write the current part to a file
                part_name = f"tmp{part_count}.txt"
                with open(part_name, 'w', encoding='utf-8') as part_file:
                    part_file.writelines(current_part)
                parts.append(part_name)

                # Prepare for the next part
                current_part = []
                current_size = 0
                part_count += 1

            current_part.append(line)
            current_size += line_size

        # Save the last part if there's any content left
        if current_part:
            part_name = f"tmp{part_count}.txt"
            with open(part_name, 'w', encoding='utf-8') as part_file:
                part_file.writelines(current_part)
            parts.append(part_name)

    return parts



def translate_batch(file_path, translated_map=None):
    chunks = split_file(file_path)
    translated_parts_value = []
    translated_parts_keys = []
    timeout = 60 * 10

    if translated_map is None:
        with open(part, 'r', encoding='utf-8') as f:
            translated_map = {line.rstrip('\n'): line.rstrip('\n') for line in f}

    for part in chunks:
        start_time = time.time()

        # Get original keys for this part
        with open(part, 'r', encoding='utf-8') as f:
            for line in f:
                translated_parts_keys.append(line.rstrip('\n'))

        with open(part, 'rb') as f:
            response = requests.post(
                UPLOAD_URL,
                headers={
                    'Authorization': f'DeepL-Auth-Key {API_KEY}'
                },
                data={
                    'source_lang': 'EN',
                    'target_lang': 'JA'
                },
                files={
                    'file': f
                }
            )

        response_data = response.json()
        document_id = response_data.get('document_id')
        document_key = response_data.get('document_key')

        if not document_id or not document_key:
            logging.info(response.status_code)
            logging.info(response.text)
            logging.error(f"Failed to translate {part} in {file_path}. Skipping...")
            continue

        logging.info(f"Translating {part} in {file_path}...")

        while True:
            elapsed_time = time.time() - start_time
            if elapsed_time > timeout:
                logging.error(f"Timeout reached while waiting for translation for {part} in {file_path}.")
                break

            status_response = requests.post(
                CHECK_STATUS_URL_TEMPLATE.format(document_id),
                headers={
                    'Authorization': f'DeepL-Auth-Key {API_KEY}',
                    'Content-Type': 'application/json'
                },
                json={
                    'document_key': document_key
                }
            )
            status_data = status_response.json()

            if status_data['status'] == "done":
                logging.info(f"Translation for {part} in {file_path} completed!")
                break
            else:
                logging.info(status_data)
                time.sleep(10)

        download_response = requests.post(
            DOWNLOAD_URL_TEMPLATE.format(document_id),
            headers={
                'Authorization': f'DeepL-Auth-Key {API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'document_key': document_key
            }
        )

        part_translated = f"translated_{part}"
        with open(part_translated, 'wb') as f:
            f.write(download_response.content)

        with open(part_translated, 'r', encoding='utf-8') as f:
            for line in f:
                translated_parts_value.append(line.rstrip('\n'))

    # Read the final output and update the translated map
    result_map = {}
    for before, after in zip(translated_parts_keys, translated_parts_value):
        for key, value in translated_map.items():
            if value == before:
                result_map[key] = after

    # Cleanup
    for part in chunks:
        os.remove(part)
    for part in translated_parts_value:
        os.remove(part)

    logging.info(f"Translation for {file_path} completed!")
    logging.info(f"Found {len(translated_map)} strings.")
    logging.info(f"Translated {len(result_map)} strings.")
    return result_map

def process_jar_file(log_directory, jar_path, collected_map):
    mod_name = get_mod_name_from_jar(jar_path)
    if mod_name is None:
        logging.info(f"Could not determine mod name for {jar_path}")
        return

    lang_path_in_jar = Path(f'assets/{mod_name}/lang/')
    ja_jp_path_in_jar = os.path.join(lang_path_in_jar, 'ja_jp.json')
    en_us_path_in_jar = os.path.join(lang_path_in_jar, 'en_us.json')
    ja_jp_path_in_jar_str = str(ja_jp_path_in_jar).replace('\\', '/')
    en_us_path_in_jar_str = str(en_us_path_in_jar).replace('\\', '/')

    logging.info(f"Extract en_us.json or ja_jp.json in {jar_path / lang_path_in_jar}")
    with zipfile.ZipFile(jar_path, 'r') as zip_ref:
        if ja_jp_path_in_jar_str in zip_ref.namelist():
            extract_specific_file(jar_path, ja_jp_path_in_jar_str, log_directory)
        elif en_us_path_in_jar_str in zip_ref.namelist():
            extract_specific_file(jar_path, en_us_path_in_jar_str, log_directory)
            os.rename(os.path.join(log_directory, en_us_path_in_jar), os.path.join(log_directory, ja_jp_path_in_jar))

    ja_jp_path = os.path.join(log_directory, ja_jp_path_in_jar)
    extract_map_from_json(ja_jp_path, collected_map)

def translate_from_jar(log_directory):
    if not os.path.exists(RESOURCE_DIR):
        os.makedirs(os.path.join(RESOURCE_DIR, 'assets', 'japanese', 'lang'))

    collected_map = {}

    extracted_pack_mcmeta = False
    for filename in os.listdir(MODS_DIR):
        if filename.endswith('.jar'):
            # Extract pack.mcmeta if it exists in the jar
            if not extracted_pack_mcmeta:
                extracted_pack_mcmeta = extract_specific_file(os.path.join(MODS_DIR, filename), 'pack.mcmeta', RESOURCE_DIR)
                update_description(os.path.join(RESOURCE_DIR, 'pack.mcmeta'), '日本語化パック')

            process_jar_file(log_directory, os.path.join(MODS_DIR, filename), collected_map)

    # 変数代入部分が消されないようDEEPL翻訳に送る前にクオートで囲みます。
    pattern = re.compile(r'%[dscf]')
    with open('tmp.txt', 'w', encoding='utf-8') as f:
        for value in collected_map.values():
            quoted_value = pattern.sub(lambda match: f'\'{match.group()}\'', value)
            f.write(quoted_value + '\n')

    translated_map = translate_batch('tmp.txt', collected_map)

    # クオートで囲まれた書式指定子を見つけ、クオートを取り除きます。
    pattern = re.compile(r"['\"](%[dscf])['\"]")
    for key, value in translated_map.items():
        unquoted_value = pattern.sub(lambda match: match.group(1), value)
        translated_map[key] = unquoted_value

    with open(os.path.join(RESOURCE_DIR, 'assets', 'japanese', 'lang', 'ja_jp.json'), 'w', encoding="utf-8") as f:
        json.dump(dict(sorted(translated_map.items())), f, ensure_ascii=False, indent=4)

def translate_quests_from_json(file_path):
    collected_map = {}

    clean_json_file(file_path)
    extract_map_from_json(file_path, collected_map)

    # Write the extracted strings to tmp.txt
    with open('tmp.txt', 'w', encoding='utf-8') as f:
        for value in collected_map.values():
            f.write(value + '\n')

    translated_map = translate_batch('tmp.txt', collected_map)

    with open(os.path.join(QUESTS_DIR1 / 'ja_jp.json'), 'w', encoding="utf-8") as f:
        json.dump(dict(sorted(translated_map.items())), f, ensure_ascii=False, indent=4)
    with open(os.path.join(QUESTS_DIR2 / 'ja_jp.json'), 'w', encoding="utf-8") as f:
        json.dump(dict(sorted(translated_map.items())), f, ensure_ascii=False, indent=4)

def translate_quests_from_snbt(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    logging.info(f"Translating {file_path}...")

    extracted_strings = []

    # Extract description strings
    description_pattern = r'description: \[\s*([\s\S]*?)\s*\]'
    description_matches = re.findall(description_pattern, content)
    for match in description_matches:
        for inner_match in re.findall(r'"(.*?)"', match):
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

    # Write the extracted strings to tmp.txt
    with open('tmp.txt', 'w', encoding='utf-8') as f:
        for s in extracted_strings:
            f.write(s + "\n")

    # Translate the content of tmp.txt and get the translated values
    translated_map = translate_batch('tmp.txt')

    # Substitute back the translated content
    for original, translated in translated_map.items():
        content = content.replace(f'"{original}"', f'"{translated}"', 1)

    # Save the content back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

def translate_quests(log_directory):
    # バックアップ用のディレクトリを作成
    backup_directory = log_directory / 'quests'
    backup_directory.mkdir(parents=True, exist_ok=True)

    logging.info("translating snbt files...")
    json_path = os.path.join(QUESTS_DIR1, 'en_us.json')

    if os.path.exists(json_path):
        logging.info(f"en_us.json found in {QUESTS_DIR1}, translating from json...")
        shutil.copy(json_path, backup_directory)
        translate_quests_from_json(json_path)
    else:
        logging.info(f"en_us.json not found in {QUESTS_DIR1}, translating snbt files in directory...")
        nbt_files = list(QUESTS_DIR3.glob('*.snbt'))

        for file in nbt_files:
            backup_file = backup_directory / file.name
            shutil.copy(file, backup_file)
            translate_quests_from_snbt(file)

    logging.info("Traslate snbt files Done!")

def update_description(file_path, new_description):
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

def setup_logging(directory):

    log_file = "translate.log"

    # ディレクトリが存在しない場合は作成
    if not os.path.exists(directory):
        os.makedirs(directory)

    # ログファイルのフルパス
    log_path = os.path.join(directory, log_file)

    # ロガーの設定
    logging.basicConfig(
        level=logging.INFO,  # INFOレベル以上のログを取得
        format='%(asctime)s %(levelname)s %(message)s',  # ログのフォーマット
        handlers=[
            logging.FileHandler(log_path),  # ログをファイルに出力
            logging.StreamHandler(sys.stdout)  # ログをコンソールに出力
        ]
    )

if __name__ == '__main__':
    # セレクトボックスのオプション
    select_options = ['Mod', 'Quests', 'All']

    # レイアウトの定義
    layout = [
        [sg.Text("Translate Target")],
        [sg.Combo(select_options, default_value=select_options[2], key='target', size=(20, 1))],
        [sg.Text("DEEPL API KEY")],
        [sg.InputText(key='DEEPL_API_KEY')],
        [sg.Button("Translate", key='translate')]
    ]

    # ウィンドウの作成
    window = sg.Window('MinecraftModLocalizer', layout)

    # 現在の日時を取得
    now = datetime.now()

    # ファイル名として安全な形式に日時を整形
    # 例：2023-10-15_17-30-29
    current_time = now.strftime("%Y-%m-%d_%H-%M-%S")

    # ログを保存するディレクトリを指定
    log_directory = Path(f"./logs/localizer/{current_time}")

    # ログの設定
    setup_logging(log_directory)

    # イベントループ
    while True:
        event, values = window.read()

        # ウィンドウのクローズボタンが押された場合
        if event == sg.WIN_CLOSED:
            break

        # 送信ボタンが押された場合
        if event == 'translate':
            # 入力された値を取得
            target = values['target']
            API_KEY = values['DEEPL_API_KEY']

            if target == select_options[0]:
                translate_from_jar(log_directory)
            elif target == select_options[1]:
                translate_quests(log_directory)
            elif target == select_options[2]:
                translate_from_jar(log_directory)
                translate_quests(log_directory)

            sg.popup('Translate Done!')
            break