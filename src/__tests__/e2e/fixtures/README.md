# E2E Test Fixtures Documentation

This directory contains realistic mock data based on analysis of actual Minecraft modpacks (DawnCraft, craft2exile, etc.).

## Common Patterns Found

### 1. Mod Language Files (en_us.json)
- Located in: `assets/{modid}/lang/en_us.json`
- Key patterns:
  - `itemGroup.{modid}`: Creative tab names
  - `item.{modid}.{item_name}`: Item names
  - `item.{modid}.{item_name}.tooltip`: Item tooltips
  - `block.{modid}.{block_name}`: Block names
  - `entity.{modid}.{entity_name}`: Entity/mob names
  - `gui.{modid}.{element}`: GUI text elements
  - `message.{modid}.{type}`: Chat messages
  - `advancement.{modid}.{id}`: Achievement names
  - `config.{modid}.{setting}`: Configuration options

### 2. Formatting Codes and Placeholders
- **Color codes**: `§0-9a-f` (e.g., `§e` for yellow, `§c` for red)
- **Formatting**: `§l` (bold), `§o` (italic), `§r` (reset)
- **Placeholders**:
  - `%s`: String replacement
  - `%d`: Integer replacement
  - `%f`: Float replacement
  - `%1$s`, `%2$d`: Indexed placeholders
- **Common patterns**:
  - Damage values: `"Damage: %d"`
  - Energy storage: `"Stores %s RF"`
  - Requirements: `"§eRequires Level %d§r"`

### 3. FTB Quests Format (.snbt)
- Structure:
  ```snbt
  {
    id: "HEX_STRING"
    title: "Quest Title"
    description: ["Line 1", "Line 2", ""]
    x: 0.0d
    y: 0.0d
    dependencies: ["QUEST_ID"]
    tasks: [{
      id: "TASK_ID"
      type: "item|kill|advancement|stat"
      // type-specific fields
    }]
    rewards: [{
      id: "REWARD_ID" 
      type: "item|xp|loot"
      // type-specific fields
    }]
  }
  ```
- Special fields:
  - `shape`: "circle", "square", "hexagon", etc.
  - `size`: 1.0d to 2.0d (visual size)
  - `hide`: true/false (visibility)
  - `subtitle`: Additional quest text

### 4. Technical Mod Patterns
- Energy systems: RF (Redstone Flux), FE (Forge Energy)
- Common GUIs:
  - Energy display: `"Energy: %s / %s RF"`
  - Progress bars: `"Progress: %d%%"`
  - Temperature: `"Temperature: %d°C"`
- Side configuration for machines
- Upgrade systems with speed/efficiency/capacity

### 5. RPG Mod Patterns
- Character stats (Level, HP, MP, etc.)
- Class systems
- Skill descriptions with mana costs
- Equipment with multiple stat lines
- Experience and leveling messages

### 6. Edge Cases and Special Formatting
- **Multi-line tooltips**: Using `\n` for line breaks
- **JSON in NBT**: Item tags with complex data
- **Nested color codes**: `"§6§lGolden Bold Text§r"`
- **Dynamic values**: Using multiple placeholders in one string
- **Conditional text**: Different messages based on state

### 7. Best Practices for Translation
- Preserve all formatting codes exactly
- Keep placeholder order consistent
- Don't translate technical terms (RF, NBT, etc.)
- Maintain line breaks in multi-line descriptions
- Be careful with color-coded text (meaning often tied to color)

## Test Data Organization
- `/mods/`: Contains mod language files
  - `realistic-rpg-mod/`: RPG mechanics and progression
  - `tech-automation-mod/`: Technical/automation content
  - `sample-mod/`: Basic mod structure
  - `complex-mod/`: Advanced formatting examples
- `/quests/`: Quest definitions
  - `ftb/`: FTB Quests format (.snbt)
  - `better/`: Better Questing format (.json)

## Notes
- All mock data follows actual mod conventions found in popular modpacks
- File paths and structures match real mod organization
- Content is original but follows realistic patterns
- Includes common edge cases and formatting challenges