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

import zipfile
import os
import re
import logging


def process_jar_file(jar_path):
    mod_name = get_mod_name_from_jar(jar_path)
    if mod_name is None:
        return

    # Base path in the jar
    base_path_in_jar = f'assets/{mod_name}/patchouli_books/'

    try:
        with zipfile.ZipFile(jar_path, 'r') as jar:
            # Get list of directories under patchouli_books
            dirs_in_patchouli = {item.filename.split('/')[3] for item in jar.infolist()
                                 if item.filename.startswith(base_path_in_jar) and item.is_dir()}

            modification_needed = False

            with zipfile.ZipFile(jar_path + '.new', 'w') as new_jar:
                for item in jar.infolist():
                    data = jar.read(item.filename)
                    new_jar.writestr(item, data)  # Copy all original files

                    if item.filename.startswith(base_path_in_jar) and not item.is_dir():
                        # Check for en_us and translate to ja_jp for each directory under patchouli_books
                        for subdir in dirs_in_patchouli:
                            en_us_path = f'{base_path_in_jar}{subdir}/en_us/'
                            ja_jp_path = f'{base_path_in_jar}{subdir}/ja_jp/'

                            en_us_exists = any(en_us_path in item.filename for item in jar.infolist())
                            ja_jp_exists = any(ja_jp_path in item.filename for item in jar.infolist())

                            if en_us_exists and not ja_jp_exists:
                                modification_needed = True

                                if item.filename.startswith(en_us_path):
                                    new_filename = item.filename.replace(en_us_path, ja_jp_path)

                                    # Translation processing
                                    if item.filename.endswith('.json'):
                                        logging.info(f"Translating Patchouli for {item.filename} in {jar_path}")

                                        content = data.decode('utf-8')
                                        matches = re.findall(r'"(name|description|title|text)":\s*"(.*?)(?<!\\)"', content)
                                        extracted_strings = [match[1] for match in matches]
                                        translated_map = prepare_translation(extracted_strings)
                                        for original, translated in translated_map.items():
                                            content = content.replace(f'"{original}"', f'"{translated}"')
                                        new_jar.writestr(new_filename, content.encode('utf-8'))

    except zipfile.BadZipFile:
        logging.error("Failed to read or write to the jar file.")

    finally:
        if modification_needed:
            os.replace(jar_path + '.new', jar_path)
        else:
            os.remove(jar_path + '.new')