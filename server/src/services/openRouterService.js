import OpenAI from 'openai';
import { rememberModelPricing } from './aiPricing.js';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MODELS_URL = `${OPENROUTER_BASE_URL}/models`;

const PROVIDER_LABELS = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  'meta-llama': 'Meta',
  mistralai: 'Mistral',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  'x-ai': 'xAI',
  nvidia: 'NVIDIA',
  moonshotai: 'Moonshot',
  cohere: 'Cohere',
  perplexity: 'Perplexity',
};

const PROVIDER_ORDER = [
  'openai',
  'anthropic',
  'google',
  'meta-llama',
  'mistralai',
  'deepseek',
  'qwen',
  'x-ai',
];

const FALLBACK_MODELS = [
  model('openai/gpt-4o-mini', 'OpenAI: GPT-4o-mini', 128000, '0.00000015', '0.0000006'),
  model('openai/gpt-4o', 'OpenAI: GPT-4o', 128000, '0.0000025', '0.00001'),
  model('openai/gpt-4.1-mini', 'OpenAI: GPT-4.1 Mini', 1047576, '0.0000004', '0.0000016'),
  model('anthropic/claude-sonnet-4.5', 'Anthropic: Claude Sonnet 4.5', 1000000, '0.000003', '0.000015'),
  model('google/gemini-2.5-flash', 'Google: Gemini 2.5 Flash', 1048576, '0.0000003', '0.0000025'),
  model('google/gemini-2.5-pro', 'Google: Gemini 2.5 Pro', 1048576, '0.00000125', '0.00001'),
  model('google/gemini-2.5-flash-lite', 'Google: Gemini 2.5 Flash Lite', 1048576, '0.0000001', '0.0000004'),
  model('deepseek/deepseek-chat', 'DeepSeek: DeepSeek V3', 163840, '0.00000032', '0.00000089'),
  model('meta-llama/llama-3.3-70b-instruct', 'Meta: Llama 3.3 70B Instruct', 131072, '0.00000059', '0.00000079'),
  model('mistralai/mistral-small-3.2-24b-instruct', 'Mistral: Mistral Small 3.2 24B', 256000, '0.000000075', '0.0000002'),
  model('qwen/qwen-2.5-72b-instruct', 'Qwen2.5 72B Instruct', 32768, '0.00000036', '0.0000004'),
];

let cache = null;

rememberModelPricing(FALLBACK_MODELS);

function model(id, name, contextLength, prompt, completion) {
  const provider = id.slice(0, id.indexOf('/'));
  return {
    id,
    name,
    provider,
    providerLabel: providerLabel(provider),
    contextLength,
    pricing: { prompt: Number(prompt), completion: Number(completion) },
  };
}

export function providerLabel(provider) {
  if (PROVIDER_LABELS[provider]) return PROVIDER_LABELS[provider];
  return String(provider || 'Outros')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function providerRank(provider) {
  const index = PROVIDER_ORDER.indexOf(provider);
  return index === -1 ? PROVIDER_ORDER.length : index;
}

function compareModels(a, b) {
  const rank = providerRank(a.provider) - providerRank(b.provider);
  if (rank !== 0) return rank;
  const byProvider = a.provider.localeCompare(b.provider);
  if (byProvider !== 0) return byProvider;
  return a.name.localeCompare(b.name, 'pt');
}

function isChatModel(raw) {
  const id = String(raw?.id || '').trim();
  if (!id.includes('/') || id.startsWith('~') || id.endsWith(':batch')) return false;
  const outputs = raw.architecture?.output_modalities || [];
  if (outputs.length > 0 && !outputs.includes('text')) return false;
  const modality = raw.architecture?.modality || '';
  if (modality && !modality.includes('->text')) return false;
  return true;
}

function normalizeModel(raw) {
  if (!isChatModel(raw)) return null;
  const id = String(raw.id).trim();
  const provider = id.slice(0, id.indexOf('/'));
  const prompt = Number(raw.pricing?.prompt);
  const completion = Number(raw.pricing?.completion);
  return {
    id,
    name: raw.name || id,
    provider,
    providerLabel: providerLabel(provider),
    contextLength: Number(raw.context_length) || null,
    pricing:
      Number.isFinite(prompt) && Number.isFinite(completion) ? { prompt, completion } : null,
  };
}

function publicCatalog(entry) {
  return {
    provider: 'openrouter',
    source: entry.source,
    warning: entry.warning,
    models: entry.models,
  };
}

export function clearModelCache() {
  cache = null;
}

export async function listAiModels() {
  if (cache && cache.expiresAt > Date.now()) {
    return publicCatalog(cache);
  }

  try {
    const response = await fetch(MODELS_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new Error(`OpenRouter respondeu ${response.status}`);
    }
    const body = await response.json();
    const models = (body.data || []).map(normalizeModel).filter(Boolean).sort(compareModels);
    if (models.length === 0) {
      throw new Error('Catálogo do OpenRouter veio vazio');
    }
    rememberModelPricing(models);
    cache = {
      expiresAt: Date.now() + 60 * 60 * 1000,
      source: 'openrouter',
      warning: null,
      models,
    };
    return publicCatalog(cache);
  } catch {
    cache = {
      expiresAt: Date.now() + 60 * 1000,
      source: 'fallback',
      warning:
        'Não foi possível consultar o catálogo do OpenRouter agora. A lista local de modelos está em uso.',
      models: [...FALLBACK_MODELS].sort(compareModels),
    };
    return publicCatalog(cache);
  }
}

export function toSafeAiError(error) {
  const status = Number(error?.status || error?.statusCode || 502);
  const raw = String(error?.error?.message || error?.message || '');
  const leaked = /sk-|bearer\s+|api[_ -]?key/i.test(raw);
  let message = 'Falha ao chamar o modelo no OpenRouter.';

  if (status === 401 || status === 403) {
    message = 'O OpenRouter recusou a credencial. Confira a chave em Configurações.';
  } else if (status === 402) {
    message = 'O OpenRouter recusou a chamada por falta de crédito.';
  } else if (status === 404) {
    message = 'O modelo selecionado não está disponível no OpenRouter.';
  } else if (!leaked && raw && raw.length < 300) {
    message = raw;
  }

  const wrapped = new Error(message);
  wrapped.status = status >= 400 && status < 600 ? status : 502;
  return wrapped;
}

export function usageFromResponse(response, model) {
  const promptTokens = response?.usage?.prompt_tokens ?? 0;
  const completionTokens = response?.usage?.completion_tokens ?? 0;
  const reported = Number(response?.usage?.cost);
  return {
    model,
    promptTokens,
    completionTokens,
    totalTokens: response?.usage?.total_tokens ?? promptTokens + completionTokens,
    costUsd: Number.isFinite(reported) ? reported : undefined,
  };
}

export async function createChatCompletion({ apiKey, model, messages, temperature, maxTokens, json }) {
  const client = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer': process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      'X-Title': 'ApplyAI',
    },
  });

  try {
    return await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      usage: { include: true },
    });
  } catch (error) {
    throw toSafeAiError(error);
  }
}

export async function testOpenRouterConnection({ apiKey, model }) {
  const response = await createChatCompletion({
    apiKey,
    model,
    temperature: 0,
    maxTokens: 16,
    messages: [{ role: 'user', content: 'Reply with the single word ok.' }],
  });
  const reply = response.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    const error = new Error('O modelo não retornou conteúdo.');
    error.status = 502;
    throw error;
  }

  return {
    ok: true,
    model,
    message: `Conexão confirmada com ${model}.`,
    usage: usageFromResponse(response, model),
  };
}
