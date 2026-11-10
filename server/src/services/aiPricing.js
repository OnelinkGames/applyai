const MODEL_PRICING_USD_PER_1M = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
};

const DEFAULT_PRICING = { input: 0.15, output: 0.6 };
const dynamicPerToken = new Map();

export function rememberModelPricing(models) {
  for (const model of models || []) {
    const prompt = Number(model?.pricing?.prompt);
    const completion = Number(model?.pricing?.completion);
    if (!model?.id || !Number.isFinite(prompt) || !Number.isFinite(completion)) continue;
    dynamicPerToken.set(model.id, { prompt, completion });
  }
}

export function getModelPricing(model) {
  if (!model) return DEFAULT_PRICING;
  if (MODEL_PRICING_USD_PER_1M[model]) return MODEL_PRICING_USD_PER_1M[model];

  const match = Object.keys(MODEL_PRICING_USD_PER_1M).find((key) => model.startsWith(key));
  return match ? MODEL_PRICING_USD_PER_1M[match] : DEFAULT_PRICING;
}

export function calculateCostUsd(model, promptTokens, completionTokens) {
  const perToken = dynamicPerToken.get(model);
  if (perToken) {
    return promptTokens * perToken.prompt + completionTokens * perToken.completion;
  }

  const pricing = getModelPricing(model);
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}
