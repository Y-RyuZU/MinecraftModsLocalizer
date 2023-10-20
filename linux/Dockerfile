# Linux build stage
FROM python:3.12.0-slim as linux-build

# Set the working directory
WORKDIR /src

# Install system dependencies required for our build
RUN apt-get update && apt-get install -y --no-install-recommends binutils

# Copy code and install Python dependencies
COPY ./src /src
RUN pip install --no-cache-dir pyzipper requests pyinstaller PySimpleGUI