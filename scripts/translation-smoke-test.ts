import { LLMAdapterFactory } from "../src/lib/adapters/llm-adapter-factory";
import { DEFAULT_MODELS, normalizeProvider, PROVIDER_DEFINITIONS } from "../src/lib/types/config";

const provider = normalizeProvider(process.env.MML_PROVIDER || "openai");
const providerDefinition = PROVIDER_DEFINITIONS[provider];
const apiKey = process.env.MML_API_KEY || process.env[providerDefinition.environmentVariable];
const model = process.env.MML_MODEL || DEFAULT_MODELS[provider];
const targetLanguage = process.env.MML_TARGET_LANGUAGE || "ja_jp";

if (!apiKey) {
  console.error(`Missing ${providerDefinition.environmentVariable}.`);
  console.error("Set MML_API_KEY or the provider-specific environment variable, then run this command again.");
  process.exit(2);
}

const adapter = LLMAdapterFactory.getAdapter({
  provider,
  apiKey,
  model,
  maxRetries: 0,
  temperature: 0.2
});

const source = {
  "item.example.name": "Copper Pickaxe",
  "item.example.description": "A durable tool for mining."
};

try {
  const response = await adapter.translate({
    content: source,
    targetLanguage
  });

  const keys = Object.keys(response.content);
  if (keys.length !== Object.keys(source).length || keys.some((key) => !response.content[key]?.trim())) {
    throw new Error(`Unexpected translation shape: ${JSON.stringify(response.content)}`);
  }

  console.log(JSON.stringify({ provider, model, targetLanguage, result: response.content }, null, 2));
} catch (error) {
  console.error(`Translation smoke test failed for ${provider}/${model}:`, error instanceof Error ? error.message : error);
  process.exit(1);
}
