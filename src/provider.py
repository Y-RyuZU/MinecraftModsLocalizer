API_KEY = None
CHUNK_SIZE = 1
MODEL = 'gpt-4o-mini-2024-07-18'
API_BASE = None  # OpenAI互換APIのベースURL
TEMPERATURE = 1.0  # デフォルト値として1.0を設定
REQUEST_INTERVAL = 0.0  # APIリクエスト間隔（秒）- デフォルトは0秒（間隔なし）
PROMPT = """You are a professional translator. Please translate the following English text into Japanese, one line at a time, step by step, in order
Make sure that the number of lines of text before and after translation is the same. Never add or subtract extra lines.

# The number of lines of text to pass: {line_count}

# Pay attention to the details below
- Never include any greeting other than the translation result!
- **Translate line by line, step by step, in order.**
- **Make sure that the number of lines of text before and after translation is the same. Never add or subtract extra lines.**
- **The meaning of the sentences before and after may be connected by chance, but if the lines are different, they are different sentences, so do not mix them up!**
- **If multiple sentences are written on a single line, please translate as is, with all sentences on a single line.**
- Proper nouns may be included and can be written in Katakana.
- The backslash may be used as an escape character. Please maintain.
- There might be programming variable characters such as %s, 1, or \\"; please retain these.
- Do not edit any other characters that may look like special symbols.

# Example

### input
§6Checks for ore behind the
§6walls, floors or ceilings.
Whether or not mining fatigue is applied to players in the temple
if it has not yet been cleared.

### incorrect output
§6壁、床、または天井の後ろにある鉱石をチェックします。
まだクリアされていない場合、寺院内のプレイヤーにマイニング疲労が適用されるかどうか。

### correct output
§6後ろにある鉱石をチェックします。
§6壁、床、または天井
寺院内のプレイヤーにマイニング疲労が適用されるかどうか。
もしクリアされていない場合


### input
Add a new requirement group.Requirement groups can hold multiplerequirements and basicallymake them one big requirement.Requirement groups have two modes.In §zAND §rmode, all requirements needto return TRUE (which means "Yes, load!"),but in §zOR §rmode, only one requirementneeds to return TRUE.

### incorrect output
新しい要件グループを追加します。
要件グループは複数の要件を保持でき、基本的にそれらを1つの大きな要件にまとめます。要件グループには2つのモードがあります。
§zAND §rモードでは、すべての要件がTRUE（「はい、ロードする！」を意味します）を返す必要がありますが、§zOR §rモードでは、1つの要件だけがTRUEを返す必要があります。

### correct output
新しい要件グループを追加します。要件グループは複数の要件を保持でき、基本的にそれらを1つの大きな要件にまとめます。要件グループには2つのモードがあります。§zAND §rモードでは、すべての要件がTRUE（「はい、ロードする！」を意味します）を返す必要がありますが、§zOR §rモードでは、1つの要件だけがTRUEを返す必要があります。"""


LOG_DIRECTORY = None


def provide_api_key():
    global API_KEY

    return API_KEY


def set_api_key(api_key):
    global API_KEY

    API_KEY = api_key


def provide_api_base():
    global API_BASE

    return API_BASE


def set_api_base(api_base):
    global API_BASE

    API_BASE = api_base


def provide_chunk_size():
    global CHUNK_SIZE

    return CHUNK_SIZE


def set_chunk_size(chunk_size):
    global CHUNK_SIZE

    CHUNK_SIZE = chunk_size


def provide_model():
    global MODEL

    return MODEL


def set_model(model):
    global MODEL

    MODEL = model


def provide_prompt():
    global PROMPT

    return PROMPT


def set_prompt(prompt):
    global PROMPT

    PROMPT = prompt


def provide_log_directory():
    global LOG_DIRECTORY

    return LOG_DIRECTORY


def set_log_directory(log_directory):
    global LOG_DIRECTORY

    LOG_DIRECTORY = log_directory


def provide_temperature():
    global TEMPERATURE

    return TEMPERATURE


def set_temperature(temperature):
    global TEMPERATURE

    TEMPERATURE = temperature


def provide_request_interval():
    global REQUEST_INTERVAL

    return REQUEST_INTERVAL


def set_request_interval(interval):
    global REQUEST_INTERVAL

    REQUEST_INTERVAL = interval