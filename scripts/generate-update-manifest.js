#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Read package.json to get the version
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const version = packageJson.version;

// This is a template for the update manifest
// In a real scenario, you would calculate the actual signature of your release files
const updateManifest = {
  version: `v${version}`,
  notes: "See the release notes on GitHub for more information.",
  pub_date: new Date().toISOString(),
  platforms: {
    "darwin-x86_64": {
      signature: "",
      url: `https://github.com/Y-RyuZU/MinecraftModsLocalizer/releases/download/v${version}/MinecraftModsLocalizer_${version}_x64.app.tar.gz`
    },
    "darwin-aarch64": {
      signature: "",
      url: `https://github.com/Y-RyuZU/MinecraftModsLocalizer/releases/download/v${version}/MinecraftModsLocalizer_${version}_aarch64.app.tar.gz`
    },
    "linux-x86_64": {
      signature: "",
      url: `https://github.com/Y-RyuZU/MinecraftModsLocalizer/releases/download/v${version}/minecraft-mods-localizer_${version}_amd64.AppImage.tar.gz`
    },
    "windows-x86_64": {
      signature: "",
      url: `https://github.com/Y-RyuZU/MinecraftModsLocalizer/releases/download/v${version}/MinecraftModsLocalizer_${version}_x64-setup.nsis.zip`
    }
  }
};

// Write the manifest to a file
const manifestPath = path.join(__dirname, '../latest.json');
fs.writeFileSync(manifestPath, JSON.stringify(updateManifest, null, 2));

console.log(`Update manifest generated at: ${manifestPath}`);
console.log(`Version: ${version}`);