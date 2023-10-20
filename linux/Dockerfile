# Linux build stage
FROM python:3.12.0-slim as linux-build

# ホストマシンのコードをコンテナにコピー
COPY ./src /src
WORKDIR /src

# Install Python dependencies
RUN pip install --no-cache-dir pyzipper requests pyinstaller PySimpleGUI