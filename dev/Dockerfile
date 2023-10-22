# Pythonイメージの指定
FROM python:3.12.0-slim

# コンテナ内で作業するディレクトリを指定
WORKDIR /src

# Install system dependencies required for our build
RUN apt-get update && apt-get install -y --no-install-recommends \
    binutils \
    tk-dev

# 必要なファイルをコンテナにコピー
# これは、このDockerfileがあるディレクトリにあるすべてのファイルをコンテナにコピーします。
# もし特定のファイルやフォルダのみをコピーしたい場合は、パスを調整してください。
COPY . /src

# 必要なPythonパッケージをインストール
RUN pip install --no-cache-dir pyzipper requests pyinstaller PySimpleGUI