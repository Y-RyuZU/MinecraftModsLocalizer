/**
 * Realistic Minecraft Directory Structure Mock
 * Creates temporary directories that mimic actual Minecraft profile structure
 */

import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface MinecraftTestStructure {
  basePath: string;
  modsPath: string;
  configPath: string;
  resourcepacksPath: string;
  cleanup: () => void;
}

/**
 * Create a realistic Minecraft directory structure for testing
 */
export function createMinecraftTestDirectory(): MinecraftTestStructure {
  const basePath = join(tmpdir(), `minecraft-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  const modsPath = join(basePath, 'mods');
  const configPath = join(basePath, 'config');
  const resourcepacksPath = join(basePath, 'resourcepacks');
  
  // Create directory structure
  mkdirSync(basePath, { recursive: true });
  mkdirSync(modsPath, { recursive: true });
  mkdirSync(configPath, { recursive: true });
  mkdirSync(resourcepacksPath, { recursive: true });
  
  // Create FTB Quests structure
  const ftbQuestsPath = join(configPath, 'ftbquests');
  const questsPath = join(ftbQuestsPath, 'quests');
  const chaptersPath = join(questsPath, 'chapters');
  const rewardTablesPath = join(questsPath, 'reward_tables');
  
  mkdirSync(ftbQuestsPath, { recursive: true });
  mkdirSync(questsPath, { recursive: true });
  mkdirSync(chaptersPath, { recursive: true });
  mkdirSync(rewardTablesPath, { recursive: true });
  
  // Create KubeJS structure
  const kubejsPath = join(basePath, 'kubejs');
  const kubejsAssetsPath = join(kubejsPath, 'assets', 'kubejs', 'lang');
  mkdirSync(kubejsAssetsPath, { recursive: true });
  
  // Create realistic mod files
  const modFiles = [
    'jei_1.20.1-15.2.0.27.jar',
    'thermal_expansion_1.20.1-10.0.0.jar',
    'iron_chests_1.20.1-14.4.4.jar',
    'waystones_1.20.1-14.1.3.jar',
    'ftb_quests_1.20.1-2001.3.6.jar'
  ];
  
  modFiles.forEach(modFile => {
    writeFileSync(join(modsPath, modFile), 'dummy mod content');
  });
  
  // Create realistic SNBT quest files
  const questFiles = [
    { name: 'getting_started.snbt', content: createRealisticQuestSNBT('Getting Started', 'Welcome to the modpack!') },
    { name: 'mining_chapter.snbt', content: createRealisticQuestSNBT('Mining Adventures', 'Time to dig deep!') },
    { name: 'tech_progression.snbt', content: createRealisticQuestSNBT('Tech Progression', 'Build amazing machines!') },
    { name: 'exploration.snbt', content: createRealisticQuestSNBT('Exploration', 'Discover new biomes!') }
  ];
  
  questFiles.forEach(quest => {
    writeFileSync(join(chaptersPath, quest.name), quest.content);
  });
  
  // Create reward tables
  const rewardFiles = [
    { name: 'starter_rewards.snbt', content: createRealisticRewardSNBT('Starter Pack') },
    { name: 'mining_rewards.snbt', content: createRealisticRewardSNBT('Mining Rewards') }
  ];
  
  rewardFiles.forEach(reward => {
    writeFileSync(join(rewardTablesPath, reward.name), reward.content);
  });
  
  // Create KubeJS lang file
  const kubejsLangContent = {
    "ftbquests.chapter.getting_started.title": "Getting Started Guide",
    "ftbquests.chapter.mining.title": "Mining and Excavation", 
    "ftbquests.quest.first_steps.title": "First Steps in the World",
    "ftbquests.quest.craft_pickaxe.title": "Craft Your First Pickaxe",
    "item.thermal.machine_frame": "Machine Frame",
    "block.iron_chests.iron_chest": "Iron Chest"
  };
  
  writeFileSync(join(kubejsAssetsPath, 'en_us.json'), JSON.stringify(kubejsLangContent, null, 2));
  
  // Create Better Questing structure (alternative quest mod)
  const betterQuestingPath = join(configPath, 'betterquesting');
  const defaultQuestsPath = join(betterQuestingPath, 'DefaultQuests');
  mkdirSync(defaultQuestsPath, { recursive: true });
  
  // Create DefaultQuests.lang file
  const defaultQuestsContent = [
    'betterquesting.title.quest_lines=Quest Lines',
    'betterquesting.quest.getting_started=Getting Started with Better Questing',
    'betterquesting.quest.basic_tools=Craft Basic Tools',
    'betterquesting.reward.starter_kit=Starter Kit Reward'
  ].join('\n');
  
  writeFileSync(join(defaultQuestsPath, 'DefaultQuests.lang'), defaultQuestsContent);
  
  // Cleanup function
  const cleanup = () => {
    if (existsSync(basePath)) {
      rmSync(basePath, { recursive: true, force: true });
    }
  };
  
  return {
    basePath,
    modsPath,
    configPath,
    resourcepacksPath,
    cleanup
  };
}

/**
 * Create realistic SNBT content for quest files
 */
function createRealisticQuestSNBT(title: string, description: string): string {
  return `{
\tid: "${generateRandomId()}"
\tgroup: ""
\torder_index: 0
\tfilename: "${title.toLowerCase().replace(/\s+/g, '_')}"
\ttitle: "${title}"
\ticon: "minecraft:book"
\tdefault_quest_shape: ""
\tdefault_hide_dependency_lines: false
\tquests: [{
\t\ttitle: "${title} Quest"
\t\tx: 0.0d
\t\ty: 0.0d
\t\tshape: "default"
\t\tdescription: [
\t\t\t"${description}"
\t\t\t""
\t\t\t"Complete this quest to progress further!"
\t\t]
\t\tdependencies: []
\t\tid: "${generateRandomId()}"
\t\ttasks: [{
\t\t\tid: "${generateRandomId()}"
\t\t\ttype: "item"
\t\t\titem: "minecraft:dirt"
\t\t\tcount: 1L
\t\t}]
\t\trewards: [{
\t\t\tid: "${generateRandomId()}"
\t\t\ttype: "item"
\t\t\titem: "minecraft:bread"
\t\t\tcount: 3
\t\t}]
\t}]
}`;
}

/**
 * Create realistic SNBT content for reward tables
 */
function createRealisticRewardSNBT(title: string): string {
  return `{
\tid: "${generateRandomId()}"
\ttitle: "${title}"
\ticon: "minecraft:chest"
\tloot_size: 1
\tweight: 10.0f
\tuse_title: true
\trewards: [{
\t\tid: "${generateRandomId()}"
\t\ttype: "item"
\t\titem: "minecraft:diamond"
\t\tcount: 1
\t}, {
\t\tid: "${generateRandomId()}"
\t\ttype: "item"
\t\titem: "minecraft:emerald"
\t\tcount: 2
\t}]
}`;
}

/**
 * Generate random ID for SNBT files (mimics FTB Quests format)
 */
function generateRandomId(): string {
  return Array.from({ length: 16 }, () => 
    Math.floor(Math.random() * 16).toString(16).toUpperCase()
  ).join('');
}

/**
 * Add realistic translated files to the test structure
 */
export function addTranslatedFiles(structure: MinecraftTestStructure, language: string = 'ja_jp'): void {
  // Add translated KubeJS lang file
  const kubejsLangPath = join(structure.basePath, 'kubejs', 'assets', 'kubejs', 'lang');
  const translatedLangContent = {
    "ftbquests.chapter.getting_started.title": "入門ガイド",
    "ftbquests.chapter.mining.title": "採掘と発掘",
    "ftbquests.quest.first_steps.title": "世界での最初の一歩",
    "ftbquests.quest.craft_pickaxe.title": "最初のピッケルを作る",
    "item.thermal.machine_frame": "マシンフレーム",
    "block.iron_chests.iron_chest": "鉄のチェスト"
  };
  
  writeFileSync(
    join(kubejsLangPath, `${language}.json`), 
    JSON.stringify(translatedLangContent, null, 2)
  );
  
  // Add translated DefaultQuests.lang file
  const betterQuestingPath = join(structure.configPath, 'betterquesting', 'DefaultQuests');
  const translatedDefaultQuestsContent = [
    'betterquesting.title.quest_lines=クエストライン',
    'betterquesting.quest.getting_started=Better Questingを始める',
    'betterquesting.quest.basic_tools=基本的なツールを作る',
    'betterquesting.reward.starter_kit=スターターキット報酬'
  ].join('\n');
  
  writeFileSync(
    join(betterQuestingPath, `DefaultQuests.${language}.lang`), 
    translatedDefaultQuestsContent
  );
}