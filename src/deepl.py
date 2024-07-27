import logging
import time
from io import BytesIO
import requests

from main import API_KEY

# DEEPL_API_URL = f'https://api{suffix}.deepl.com/v2/translate'
# UPLOAD_URL = f"https://api{suffix}.deepl.com/v2/document"
# CHECK_STATUS_URL_TEMPLATE = f"https://api{suffix}.deepl.com/v2/document/{{}}"
# DOWNLOAD_URL_TEMPLATE = f"https://api{suffix}.deepl.com/v2/document/{{}}/result"

# def translate_with_deepl(part, timeout):
#     start_time = time.time()
#     part_values = []
#
#     with open(part, 'rb') as f:
#         response = requests.post(
#             UPLOAD_URL,
#             headers={'Authorization': f'DeepL-Auth-Key {API_KEY}'},
#             data={'source_lang': 'EN', 'target_lang': 'JA'},
#             files={'file': f}
#         )
#     response_data = response.json()
#     document_id = response_data.get('document_id')
#     document_key = response_data.get('document_key')
#
#     while True:
#         elapsed_time = time.time() - start_time
#         if elapsed_time > timeout:
#             logging.error(f"Timeout reached while waiting for translation.")
#             break
#
#         status_response = requests.post(
#             CHECK_STATUS_URL_TEMPLATE.format(document_id),
#             headers={'Authorization': f'DeepL-Auth-Key {API_KEY}', 'Content-Type': 'application/json'},
#             json={'document_key': document_key}
#         )
#         status_data = status_response.json()
#
#         if status_data['status'] == "done":
#             download_response = requests.post(
#                 DOWNLOAD_URL_TEMPLATE.format(document_id),
#                 headers={'Authorization': f'DeepL-Auth-Key {API_KEY}', 'Content-Type': 'application/json'},
#                 json={'document_key': document_key}
#             )
#             buffer = BytesIO(download_response.content)
#             buffer.seek(0)
#             text_data = buffer.read().decode('utf-8')
#             part_values.extend(text_data.splitlines())
#             buffer.close()
#             break
#         else:
#             time.sleep(10)  # DeepL APIの翻訳状態をポーリング
#
#     return part_values

