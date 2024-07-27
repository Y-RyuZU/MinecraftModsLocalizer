import TkEasyGUI as sg
from pathlib import Path
import logging
from datetime import datetime

from provider import set_api_key, set_chunk_size, provide_chunk_size, set_model, provide_model, set_prompt, provide_prompt, set_log_directory
from jar import translate_from_jar
from log import setup_logging
from quests import translate_ftbquests, translate_betterquesting
from update import check_version


if __name__ == '__main__':
    # レイアウトの定義
    layout = [
        [sg.Text("Translate Target")],
        [sg.Radio('Mod', key='target1', group_id=1, default=True), sg.Radio('FtbQuests', key='target2', group_id=1), sg.Radio('BetterQuesting', key='target3', group_id=1)],
        [sg.Text("OpenAI API KEY")],
        [sg.InputText(key='OPENAI_API_KEY', expand_x=True)],
        [sg.Text("Chunk Size")],
        [sg.Text("単体mod翻訳やクエストのみの翻訳では1\nModPackで大量のModを一括で翻訳するときは100くらいまで上げることをお勧めします(1だと翻訳時間がすごいことになります)")],
        [sg.Slider(range=(1, 200), key='CHUNK_SIZE', default_value=provide_chunk_size(), expand_x=True)],
        [sg.Text("Model")],
        [sg.InputText(key='MODEL', default_text=provide_model(), expand_x=True)],
        [sg.Text("Prompt")],
        [sg.Multiline(key='PROMPT', default_text=provide_prompt(), expand_x=True)],
        [sg.Button("Translate", key='translate')]
    ]

    # ウィンドウの作成
    window = sg.Window('MinecraftModLocalizer', layout, size=(900, 500))

    # 現在の日時を取得
    now = datetime.now()

    # ファイル名として安全な形式に日時を整形
    # 例：2023-10-15_17-30-29
    current_time = now.strftime("%Y-%m-%d_%H-%M-%S")

    # ログを保存するディレクトリを指定
    log_directory = Path(f"./logs/localizer/{current_time}")

    # ログの設定
    setup_logging(log_directory)
    set_log_directory(log_directory)

    # イベントループ
    while True:
        event, values = window.read()

        # ウィンドウのクローズボタンが押された場合
        if event == sg.WIN_CLOSED:
            break

        # 送信ボタンが押された場合
        if event == 'translate':
            # 入力された値を取得
            set_api_key(values['OPENAI_API_KEY'])
            set_chunk_size(int(values['CHUNK_SIZE']))
            set_model(values['MODEL'])
            set_prompt(values['PROMPT'])

            # バージョンチェック
            if not check_version():
                sg.popup('最新バージョンがあるよ。バージョンアップしてね！')
                break

            try:
                if values['target1']:
                    translate_from_jar()
                elif values['target2']:
                    translate_ftbquests()
                elif values['target3']:
                    translate_betterquesting()
            except Exception as e:
                logging.error(e)
                sg.popup('翻訳失敗')
                break

            sg.popup('翻訳成功！')
            break
