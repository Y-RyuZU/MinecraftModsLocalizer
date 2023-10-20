# Linux build stage
FROM python:3.12.0-slim as linux-build

# Set the working directory
WORKDIR /src

# Install system dependencies required for our build
RUN apt-get update && apt-get install -y --no-install-recommends \
    binutils \
    tk-dev

# Clean up the cache data from package installations
# This reduces the image size
RUN rm -rf /var/lib/apt/lists/*

# Copy code and install Python dependencies
COPY ./src /src
RUN pip install --no-cache-dir pyzipper requests pyinstaller PySimpleGUI