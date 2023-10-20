import os
import json
import re
import shutil
import time
import zipfile
import requests
import PySimpleGUI as sg

RESOURCE_DIR = './resourcepacks/japanese'
MODS_DIR = './mods'
DEEPL_API_URL = 'https://api.deepl.com/v2/translate'
UPLOAD_URL = "https://api.deepl.com/v2/document"
CHECK_STATUS_URL_TEMPLATE = "https://api.deepl.com/v2/document/{}"
DOWNLOAD_URL_TEMPLATE = "https://api.deepl.com/v2/document/{}/result"

def extract_specific_file(zip_filepath, file_name, dest_dir):
    with zipfile.ZipFile(zip_filepath, 'r') as zip_ref:
        if file_name in zip_ref.namelist():
            zip_ref.extract(file_name, dest_dir)
        else:
            print(f"The file {file_name} was not found in the ZIP archive.")


def get_mod_name_from_jar(jar_path):
    with zipfile.ZipFile(jar_path, 'r') as zip_ref:
        asset_dirs_with_lang = set()
        for name in zip_ref.namelist():
            parts = name.split('/')
            if len(parts) > 2 and parts[0] == 'assets' and parts[2] == 'lang':
                asset_dirs_with_lang.add(parts[1])
        if asset_dirs_with_lang:
            return list(asset_dirs_with_lang)[0]
    return None


def split_file(file_path, max_size=800000):  # max_size is 1MB by default
    """Split file into smaller parts of max_size bytes."""
    parts = []
    with open(file_path, 'rb', encoding="utf-8") as f:
        chunk = f.read(max_size)
        count = 1
        while chunk:
            part_name = f"tmp{count}.txt"
            with open(part_name, 'wb', encoding="utf-8") as chunk_file:
                chunk_file.write(chunk)
            parts.append(part_name)
            chunk = f.read(max_size)
            count += 1
    return parts


def translate_batch(file_path):
    chunks = split_file(file_path)
    translated_parts = []
    translated_values_dict = {}  # This will store the key and its translated value
    timeout = 60 * 10

    for part in chunks:
        start_time = time.time()

        # Get original keys for this part
        with open(part, 'r', encoding='utf-8') as f:
            part_keys = [line.strip() for line in f]

        for key in part_keys:
            translated_values_dict[key] = None  # Initialize to None

        with open(part, 'rb', encoding="utf-8") as f:
            response = requests.post(
                UPLOAD_URL,
                headers={
                    'Authorization': f'DeepL-Auth-Key {API_KEY}'
                },
                data={
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
            print(response.status_code)
            print(response.text)
            print(f"Failed to translate {part}. Skipping...")
            continue

        print(f"Translating {part}...")

        while True:
            elapsed_time = time.time() - start_time
            if elapsed_time > timeout:
                print("Timeout reached while waiting for translation.")
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
                print(f"Translation for {part} completed!")
                break
            else:
                print(status_data)
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
        with open(part_translated, 'wb', encoding="utf-8") as f:
            f.write(download_response.content)

        # Update translated values for this part
        with open(part_translated, 'r', encoding='utf-8') as f:
            part_translated_values = [line.strip() for line in f]

        for key, translated_value in zip(part_keys, part_translated_values):
            translated_values_dict[key] = translated_value

        translated_parts.append(part_translated)

    # Merge all translated parts
    final_output = 'translated_final.txt'
    with open(final_output, 'wb', encoding="utf-8") as fout:
        for part in translated_parts:
            with open(part, 'rb', encoding="utf-8") as fin:
                fout.write(fin.read())

    # Cleanup
    for part in chunks:
        os.remove(part)
    for part in translated_parts:
        os.remove(part)

    return translated_values_dict


def process_jar_file(jar_path, collected_keys, collected_values):
    mod_name = get_mod_name_from_jar(jar_path)
    if mod_name is None:
        print(f"Could not determine mod name for {jar_path}")
        return

    lang_path_in_jar = f'assets/{mod_name}/lang/'
    ja_jp_path_in_jar = os.path.join(lang_path_in_jar, 'ja_jp.json')
    en_us_path_in_jar = os.path.join(lang_path_in_jar, 'en_us.json')

    if ja_jp_path_in_jar in zipfile.ZipFile(jar_path).namelist():
        extract_specific_file(jar_path, ja_jp_path_in_jar, MODS_DIR)
    elif en_us_path_in_jar in zipfile.ZipFile(jar_path).namelist():
        extract_specific_file(jar_path, en_us_path_in_jar, MODS_DIR)
        os.rename(os.path.join(MODS_DIR, en_us_path_in_jar), os.path.join(MODS_DIR, ja_jp_path_in_jar))

    ja_jp_path = os.path.join(MODS_DIR, ja_jp_path_in_jar)
    if os.path.exists(ja_jp_path):
        print(f"Processing {ja_jp_path}")
        try:
            with open(ja_jp_path, 'r', encoding="utf-8") as f:
                content = json.load(f)

            # Collect English values to translate and store their keys
            english_keys = [key for key, value in content.items() if not key.startswith("_comment") and not re.search(
                '[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]', value)]
            english_values = [content[key] for key in english_keys]

            collected_values.extend(english_values)
            collected_keys.extend(english_keys)
        except json.JSONDecodeError:
            print(f"Failed to load or process JSON from {ja_jp_path}. Skipping this mod for translation.")


def translate_snbt(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    print(f"Translating {file_path}...")

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
        print("No strings found. Skipping...")
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

def translate_from_jar():
    if not os.path.exists(RESOURCE_DIR):
        os.makedirs(os.path.join(RESOURCE_DIR, 'assets', 'japanese', 'lang'))

    collected_values = []
    collected_keys = []

    for filename in os.listdir(MODS_DIR):
        if filename.endswith('.jar'):
            # Extract pack.mcmeta if it exists in the jar
            extract_specific_file(os.path.join(MODS_DIR, filename), 'pack.mcmeta', RESOURCE_DIR)

            process_jar_file(os.path.join(MODS_DIR, filename), collected_keys, collected_values)

    with open('tmp.txt', 'w', encoding='utf-8') as f:
        for value in collected_values:
            f.write(value + '\n')

    translated_map = translate_batch('tmp.txt')

    content = {}
    failed_translated_values_count = 0
    collected_map = dict(zip(collected_values, collected_keys))

    for original_value, translated_value in translated_map.items():
        if original_value not in collected_map:
            print(f"Could not find key for {original_value}. Skipping...")
            failed_translated_values_count += 1
            continue
        lang_key = collected_map[original_value]
        content[lang_key] = translated_value

    with open(os.path.join(RESOURCE_DIR, 'assets', 'japanese', 'lang', 'ja_jp.json'), 'w', encoding="utf-8") as f:
        json.dump(dict(sorted(content.items())), f, ensure_ascii=False, indent=4)

    assets_dir_path = os.path.join(MODS_DIR, 'assets')
    if os.path.exists(assets_dir_path):
        shutil.rmtree(assets_dir_path)

def translate_quests():
    print("translating snbt files...")
    # translate_snbt_files()
    directory = "config/ftbquests/quests/chapters"
    nbt_files = [os.path.join(directory, f) for f in os.listdir(directory) if f.endswith('.snbt')]
    print(f"the number of snbt files: {len(nbt_files)}")

    for file in nbt_files:
        translate_snbt(file)

if __name__ == '__main__':
    # セレクトボックスのオプション
    select_options = ['Mod', 'Quests', 'Both']

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
                translate_from_jar()
            elif target == select_options[1]:
                translate_quests()
            elif target == select_options[2]:
                translate_from_jar()
                translate_quests()