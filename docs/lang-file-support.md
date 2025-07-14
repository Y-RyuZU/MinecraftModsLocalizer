# Legacy .lang File Support

MinecraftModsLocalizer now supports both modern JSON language files (Minecraft 1.13+) and legacy .lang files (Minecraft 1.12.2 and earlier).

## Format Detection

The application automatically detects the source language file format when scanning mods:

- **JSON format**: Used in Minecraft 1.13 and later
  - File extension: `.json`
  - Structure: JSON key-value pairs
  
- **Lang format**: Used in Minecraft 1.12.2 and earlier
  - File extension: `.lang`
  - Structure: Simple `key=value` lines

## Visual Indicators

When scanning mods, the application displays a format badge in the mod table:
- **JSON**: Blue badge indicating modern format
- **LANG**: Amber badge indicating legacy format

## Resource Pack Output

The application automatically outputs language files in the same format as the source:
- Mods with `.json` source files → `.json` output files
- Mods with `.lang` source files → `.lang` output files

This ensures maximum compatibility with different Minecraft versions.

## Technical Details

### Lang File Format
```properties
# Comments start with #
item.example.name=Example Item
block.example.stone=Example Stone
tooltip.example.info=This is an example tooltip
```

### JSON File Format
```json
{
  "item.example.name": "Example Item",
  "block.example.stone": "Example Stone",
  "tooltip.example.info": "This is an example tooltip"
}
```

Both formats are fully supported for reading and writing, ensuring compatibility with mods from all Minecraft versions.