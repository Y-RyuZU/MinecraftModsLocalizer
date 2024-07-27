import itertools
import json
import logging
import os
import re

from init import MAX_ATTEMPTS
from chatgpt import translate_with_chatgpt
from provider import provide_chunk_size


def extract_map_from_json(file_path):
    collected_map = {}

    if os.path.exists(file_path):
        logging.info(f"Extract keys in en_us.json(or ja_jp.json) in {file_path}")
        try:
            with open(file_path, 'r', encoding="utf-8") as f:
                content = json.load(f)

            # 値が英語でコメント以外のキーのみを保存します。
            for key, value in content.items():
                if not key.startswith("_comment") and not re.search('[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]', value):
                    collected_map[key] = value

        except json.JSONDecodeError:
            logging.info(
                f"Failed to load or process JSON from {file_path}. Skipping this mod for translation. Please check the file for syntax errors.")
    else:
        logging.info(f"Could not find {file_path}. Skipping this mod for translation.")

    return collected_map


def split_list(big_list):
    # 分割されたリストを格納するリスト
    list_of_chunks = []

    # 元のリストの要素を順に処理し、指定のサイズごとに分割
    for i in range(0, len(big_list), provide_chunk_size()):
        # 現在の位置から最大要素数だけを新しいリストに切り出し
        chunk = big_list[i:i + provide_chunk_size()]
        # 新しいリストをリストに追加
        list_of_chunks.append(chunk)

    return list_of_chunks


def create_map_with_none_filling(split_target, translated_split_target):
    # 辞書を作成し、zip_longestを使用してリストの長さが異なる場合にNoneで埋める
    result_map = {}
    for key, value in itertools.zip_longest(split_target, translated_split_target):
        # valueが空白文字の場合、空文字列に置換する（Noneは置換しない）
        if value == '':
            value = None
        result_map[key] = value

    return result_map


def prepare_translation(targets):
    split_targets = split_list(targets)  # ファイルを適切なサイズのチャンクに分割する関数
    result_map = {}
    timeout = 60 * 3  # 3分のタイムアウト

    logging.info(f"The file contains {len(targets)} lines")
    logging.info(f"Splitting the file into {len(split_targets)} chunks for translation...")

    for index, split_target in enumerate(split_targets, 1):
        logging.info(f"Translating chunk {index}/{len(split_targets)}...")

        attempts = 0
        while attempts < MAX_ATTEMPTS:  # 最大5回まで試行
            translated_split_target = translate_with_chatgpt(split_target, timeout)
            # 翻訳後の行数が一致すれば、マッピングしてループを抜ける
            if len(split_target) == len(translated_split_target):
                for key, value in zip(split_target, translated_split_target):
                    result_map[key] = value
                break
            else:
                filtered_split_target = [item for item in split_target if item.strip()]
                filtered_translated_split_target = [item for item in translated_split_target if item.strip()]
                if len(filtered_split_target) == len(filtered_translated_split_target):
                    for key, value in zip(split_target, translated_split_target):
                        result_map[key] = value
                    break

            if attempts == MAX_ATTEMPTS - 1:
                logging.error(f"Failed to properly translate the segment: {index}/{len(split_targets)}")
                logging.error(f"Original: {split_target}")
                logging.error(f"Result: {translated_split_target}")
                logging.error(f"The number of lines before and after translation does not match before: {len(split_target)}, after:{len(translated_split_target)}")


            attempts += 1

    logging.info(f"Translation completed!")
    return result_map
