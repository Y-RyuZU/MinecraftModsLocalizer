FROM mcr.microsoft.com/devcontainers/python:1-3.12-bullseye

RUN apt-get update && apt-get install -y --no-install-recommends \
    binutils \
    tk-dev

RUN pip install --no-cache-dir pyzipper requests pyinstaller TkEasyGUI openai