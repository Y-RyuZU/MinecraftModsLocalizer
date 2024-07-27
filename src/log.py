import logging
import os
import sys


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
