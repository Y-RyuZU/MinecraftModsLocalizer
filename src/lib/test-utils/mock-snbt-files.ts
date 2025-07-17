/**
 * Mock SNBT files for testing
 * Contains real-world examples of both direct text and JSON key reference patterns
 */

export const mockSNBTFiles = {
  // Direct text content - should be translated in-place
  directText: {
    'starter_quest.snbt': `{
	id: "0000000000000001"
	group: ""
	order_index: 0
	filename: "starter_quest"
	title: "Welcome to the Adventure"
	icon: "minecraft:grass_block"
	default_quest_shape: ""
	default_hide_dependency_lines: false
	quests: [{
		x: 0.0d
		y: 0.0d
		description: [
			"Welcome to this amazing modpack!"
			""
			"Complete this quest to get started on your journey."
			""
			"You'll receive some basic items to help you begin."
		]
		dependencies: []
		id: "1A2B3C4D5E6F7890"
		tasks: [{
			id: "2B3C4D5E6F789012"
			type: "item"
			item: "minecraft:dirt"
			count: 16L
		}]
		rewards: [{
			id: "3C4D5E6F78901234"
			type: "item"
			item: "minecraft:bread"
			count: 8
		}]
	}]
}`,
    'mining_chapter.snbt': `{
	id: "0000000000000002"
	group: "mining"
	order_index: 1
	filename: "mining_chapter"
	title: "Mining and Resources"
	icon: "minecraft:iron_pickaxe"
	default_quest_shape: ""
	default_hide_dependency_lines: false
	quests: [{
		title: "First Pickaxe"
		x: 2.0d
		y: 0.0d
		subtitle: "Craft your mining tool"
		description: [
			"Time to start mining!"
			""
			"Craft a wooden pickaxe to begin collecting stone and ores."
			"This will be your first step into the mining world."
		]
		dependencies: ["1A2B3C4D5E6F7890"]
		id: "4D5E6F7890123456"
		tasks: [{
			id: "5E6F789012345678"
			type: "item"
			title: "Craft a Pickaxe"
			item: "minecraft:wooden_pickaxe"
			count: 1L
		}]
		rewards: [{
			id: "6F78901234567890"
			type: "item"
			item: "minecraft:stone"
			count: 32
		}]
	}]
}`,
    'building_quest.snbt': `{
	x: 4.0d
	y: 2.0d
	shape: "square"
	description: [
		"Now that you have resources, it's time to build!"
		""
		"Create a simple house to protect yourself from monsters."
		"Use any blocks you like - creativity is key!"
	]
	dependencies: ["4D5E6F7890123456"]
	id: "7890123456789ABC"
	tasks: [{
		id: "890123456789ABCD"
		type: "structure"
		title: "Build a House"
		structure: "custom:simple_house"
		ignore_nbt: true
	}]
	rewards: [{
		id: "90123456789ABCDE"
		type: "item"
		item: "minecraft:bed"
		count: 1
		nbt: "{display:{Name:'{\"text\":\"Comfortable Bed\",\"color\":\"blue\"}'}}"
	}]
}`
  },

  // JSON key references - should create language-suffixed files
  jsonKeys: {
    'localized_quest.snbt': `{
	id: "0000000000000003"
	group: "tutorial"
	order_index: 0
	filename: "localized_quest"
	title: "ftbquests.chapter.tutorial.title"
	icon: "minecraft:book"
	default_quest_shape: ""
	default_hide_dependency_lines: false
	quests: [{
		title: "ftbquests.quest.tutorial.first.title"
		x: 0.0d
		y: 0.0d
		subtitle: "ftbquests.quest.tutorial.first.subtitle"
		description: [
			"ftbquests.quest.tutorial.first.desc.line1"
			""
			"ftbquests.quest.tutorial.first.desc.line2"
			""
			"ftbquests.quest.tutorial.first.desc.line3"
		]
		dependencies: []
		id: "ABC123DEF456789"
		tasks: [{
			id: "BCD234EFG567890"
			type: "item"
			title: "ftbquests.task.collect.dirt.title"
			item: "minecraft:dirt"
			count: 64L
		}]
		rewards: [{
			id: "CDE345FGH678901"
			type: "item"
			item: "minecraft:diamond"
			count: 1
		}]
	}]
}`,
    'modded_items_quest.snbt': `{
	id: "0000000000000004"
	group: "modded"
	order_index: 2
	filename: "modded_items_quest"
	title: "ftbquests.chapter.modded.title"
	icon: "thermal:machine_frame"
	default_quest_shape: ""
	default_hide_dependency_lines: false
	quests: [{
		title: "ftbquests.quest.modded.machines.title"
		x: 6.0d
		y: 0.0d
		subtitle: "ftbquests.quest.modded.machines.subtitle"
		description: [
			"ftbquests.quest.modded.machines.desc.intro"
			""
			"ftbquests.quest.modded.machines.desc.instructions"
		]
		dependencies: ["ABC123DEF456789"]
		id: "DEF456GHI789012"
		tasks: [{
			id: "EFG567HIJ890123"
			type: "item"
			title: "ftbquests.task.craft.machine.title"
			item: "thermal:machine_frame"
			count: 1L
		}, {
			id: "FGH678IJK901234"
			type: "item"
			title: "ftbquests.task.craft.furnace.title"
			item: "thermal:machine_furnace"
			count: 1L
		}]
		rewards: [{
			id: "GHI789JKL012345"
			type: "item"
			item: "thermal:energy_cell"
			count: 1
		}]
	}]
}`,
    'mixed_content_quest.snbt': `{
	x: 8.0d
	y: 4.0d
	shape: "diamond"
	title: "ftbquests.quest.mixed.automation.title"
	subtitle: "ftbquests.quest.mixed.automation.subtitle"
	description: [
		"ftbquests.quest.mixed.automation.desc.line1"
		""
		"item.thermal.machine_pulverizer"
		"block.minecraft.redstone_ore"
		""
		"ftbquests.quest.mixed.automation.desc.line2"
	]
	dependencies: ["DEF456GHI789012"]
	id: "HIJ890KLM123456"
	tasks: [{
		id: "IJK901LMN234567"
		type: "item"
		title: "ftbquests.task.automate.processing.title"
		item: "thermal:machine_pulverizer"
		count: 1L
	}]
	rewards: [{
		id: "JKL012MNO345678"
		type: "command"
		title: "ftbquests.reward.experience.title"
		command: "/xp add @p 100 levels"
		player_command: false
	}]
}`
  },

  // KubeJS lang files
  kubejsLang: {
    'en_us.json': `{
  "ftbquests.chapter.tutorial.title": "Getting Started Tutorial",
  "ftbquests.quest.tutorial.first.title": "Collect Basic Resources",
  "ftbquests.quest.tutorial.first.subtitle": "Gather materials to begin",
  "ftbquests.quest.tutorial.first.desc.line1": "Welcome to this modpack! Your adventure begins here.",
  "ftbquests.quest.tutorial.first.desc.line2": "Start by collecting some basic dirt blocks.",
  "ftbquests.quest.tutorial.first.desc.line3": "These will be useful for building and crafting.",
  "ftbquests.task.collect.dirt.title": "Collect 64 Dirt",
  
  "ftbquests.chapter.modded.title": "Modded Machinery",
  "ftbquests.quest.modded.machines.title": "Industrial Revolution",
  "ftbquests.quest.modded.machines.subtitle": "Enter the age of automation",
  "ftbquests.quest.modded.machines.desc.intro": "Time to upgrade from vanilla tools to modded machinery!",
  "ftbquests.quest.modded.machines.desc.instructions": "Craft the basic machine frame and your first thermal machine.",
  "ftbquests.task.craft.machine.title": "Craft Machine Frame",
  "ftbquests.task.craft.furnace.title": "Craft Redstone Furnace",
  
  "ftbquests.quest.mixed.automation.title": "Advanced Automation",
  "ftbquests.quest.mixed.automation.subtitle": "Setup ore processing",
  "ftbquests.quest.mixed.automation.desc.line1": "Now let's automate ore processing for efficiency.",
  "ftbquests.quest.mixed.automation.desc.line2": "This machine will double your ore output!",
  "ftbquests.task.automate.processing.title": "Craft Pulverizer",
  "ftbquests.reward.experience.title": "Experience Boost"
}`
  }
};

export const expectedTranslations = {
  ja_jp: {
    // Expected Japanese translations for direct text
    directText: {
      'Welcome to the Adventure': 'アドベンチャーへようこそ',
      'Welcome to this amazing modpack!': 'この素晴らしいモッドパックへようこそ！',
      'Complete this quest to get started on your journey.': 'この冒険を始めるためにこのクエストを完了してください。',
      'You\'ll receive some basic items to help you begin.': '開始するための基本的なアイテムを受け取ります。',
      'Mining and Resources': '採掘と資源',
      'First Pickaxe': '最初のピッケル',
      'Craft your mining tool': '採掘ツールを作る',
      'Time to start mining!': '採掘を始める時間です！',
      'Craft a wooden pickaxe to begin collecting stone and ores.': '石と鉱石を集め始めるために木のピッケルを作ってください。',
      'This will be your first step into the mining world.': 'これが採掘の世界への最初の一歩になります。',
      'Craft a Pickaxe': 'ピッケルを作る',
      'Now that you have resources, it\'s time to build!': 'リソースが手に入ったので、建築の時間です！',
      'Create a simple house to protect yourself from monsters.': 'モンスターから身を守るためにシンプルな家を作ってください。',
      'Use any blocks you like - creativity is key!': '好きなブロックを使ってください - 創造性が鍵です！',
      'Build a House': '家を建てる'
    },
    
    // Expected Japanese translations for KubeJS lang file
    kubejsLang: {
      'Getting Started Tutorial': '入門チュートリアル',
      'Collect Basic Resources': '基本的な資源を集める',
      'Gather materials to begin': '始めるための材料を集める',
      'Welcome to this modpack! Your adventure begins here.': 'このモッドパックへようこそ！あなたの冒険はここから始まります。',
      'Start by collecting some basic dirt blocks.': '基本的な土ブロックを集めることから始めてください。',
      'These will be useful for building and crafting.': 'これらは建築やクラフトに役立ちます。',
      'Collect 64 Dirt': '土を64個集める',
      'Modded Machinery': 'モッド機械',
      'Industrial Revolution': '産業革命',
      'Enter the age of automation': '自動化の時代へ',
      'Time to upgrade from vanilla tools to modded machinery!': 'バニラツールからモッド機械にアップグレードする時間です！',
      'Craft the basic machine frame and your first thermal machine.': '基本的なマシンフレームと最初のサーマルマシンを作ってください。',
      'Craft Machine Frame': 'マシンフレームを作る',
      'Craft Redstone Furnace': 'レッドストーンかまどを作る',
      'Advanced Automation': '高度な自動化',
      'Setup ore processing': '鉱石処理のセットアップ',
      'Now let\'s automate ore processing for efficiency.': '効率のために鉱石処理を自動化しましょう。',
      'This machine will double your ore output!': 'このマシンは鉱石の出力を2倍にします！',
      'Craft Pulverizer': '粉砕機を作る',
      'Experience Boost': '経験値ブースト'
    }
  }
};

export const mockFileStructure = {
  '/test/modpack/kubejs/assets/kubejs/lang/en_us.json': mockSNBTFiles.kubejsLang['en_us.json'],
  '/test/modpack/config/ftbquests/quests/chapters/starter_quest.snbt': mockSNBTFiles.directText['starter_quest.snbt'],
  '/test/modpack/config/ftbquests/quests/chapters/mining_chapter.snbt': mockSNBTFiles.directText['mining_chapter.snbt'],
  '/test/modpack/config/ftbquests/quests/chapters/building_quest.snbt': mockSNBTFiles.directText['building_quest.snbt'],
  '/test/modpack/config/ftbquests/quests/chapters/localized_quest.snbt': mockSNBTFiles.jsonKeys['localized_quest.snbt'],
  '/test/modpack/config/ftbquests/quests/chapters/modded_items_quest.snbt': mockSNBTFiles.jsonKeys['modded_items_quest.snbt'],
  '/test/modpack/config/ftbquests/quests/chapters/mixed_content_quest.snbt': mockSNBTFiles.jsonKeys['mixed_content_quest.snbt']
};