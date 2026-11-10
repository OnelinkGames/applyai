import { getSetting, setSetting } from './importService.js';
import { decryptSecret, encryptSecret, maskSecret } from './secretCrypto.js';

const MODEL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,120}\/[a-zA-Z0-9][a-zA-Z0-9._:-]{0,160}$/;
const AI_MODEL_KEY = 'ai_model';
const AI_API_KEY = 'ai_api_key';

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function readStoredKey(db) {
  const stored = getSetting(db, AI_API_KEY, '');
  if (!stored) return { apiKey: null, unreadable: false };
  try {
    return { apiKey: decryptSecret(stored), unreadable: false };
  } catch {
    return { apiKey: null, unreadable: true };
  }
}

export function classifyApiKey(apiKey) {
  if (!apiKey) return null;
  if (apiKey.startsWith('sk-or-')) return 'openrouter';
  if (apiKey.startsWith('sk-')) return 'openai';
  return 'unknown';
}

function rejectForeignKey(apiKey, source) {
  const format = classifyApiKey(apiKey);
  if (format === 'openrouter') return;

  const saved = source === 'saved';
  const message =
    format === 'openai'
      ? saved
        ? 'A chave salva é uma chave da OpenAI. O teste leu essa chave, mas o OpenRouter só aceita uma chave criada em https://openrouter.ai/keys.'
        : 'Essa chave é da OpenAI. Cole uma chave criada em https://openrouter.ai/keys.'
      : saved
        ? 'A chave salva não é uma chave do OpenRouter. O teste leu essa chave. Cole uma chave criada em https://openrouter.ai/keys.'
        : 'A chave informada não é uma chave do OpenRouter. Cole uma chave criada em https://openrouter.ai/keys.';
  throw httpError(message, 400);
}

export function getPublicAiSettings(db) {
  const model = getSetting(db, AI_MODEL_KEY, '').trim() || null;
  const { apiKey, unreadable } = readStoredKey(db);
  const keyFormat = classifyApiKey(apiKey);
  return {
    provider: 'openrouter',
    providerLabel: 'OpenRouter',
    model,
    configured: Boolean(model && keyFormat === 'openrouter'),
    keyHint: apiKey ? maskSecret(apiKey) : null,
    keyFormat,
    keyUnreadable: unreadable,
  };
}

export function resolveTestCredentials(db, input = {}) {
  const model = String(input.model || '').trim();
  if (!MODEL_ID.test(model)) {
    throw httpError('Selecione um modelo válido do OpenRouter.', 400);
  }

  const typedKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : '';
  const source = typedKey ? 'typed' : 'saved';
  let apiKey = typedKey;
  if (!apiKey) {
    const stored = readStoredKey(db);
    if (stored.unreadable) {
      throw httpError('A chave salva não pôde ser lida. Informe a chave novamente.', 400);
    }
    apiKey = stored.apiKey || '';
  }
  if (!apiKey) {
    throw httpError('Informe a chave do OpenRouter para testar a conexão.', 400);
  }
  if (apiKey.length < 20 || apiKey.length > 500) {
    throw httpError('A chave do OpenRouter parece inválida.', 400);
  }
  rejectForeignKey(apiKey, source);

  return { model, apiKey, source };
}

export function getAiCredentials(db) {
  const model = getSetting(db, AI_MODEL_KEY, '').trim();
  const { apiKey } = readStoredKey(db);
  if (!model || !apiKey) return null;
  return { provider: 'openrouter', model, apiKey };
}

export function saveAiSettings(db, input = {}) {
  const clearApiKey = Boolean(input.clearApiKey);
  const hasModel = Object.prototype.hasOwnProperty.call(input, 'model');
  const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : '';

  if (!clearApiKey && !hasModel && !apiKey) {
    throw httpError('Informe o modelo ou a chave para salvar.', 400);
  }

  if (hasModel && !clearApiKey) {
    const model = String(input.model || '').trim();
    if (!MODEL_ID.test(model)) {
      throw httpError('Selecione um modelo válido do OpenRouter.', 400);
    }
    setSetting(db, AI_MODEL_KEY, model);
  }

  if (clearApiKey) {
    db.prepare('DELETE FROM settings WHERE key = ?').run(AI_API_KEY);
  } else if (apiKey) {
    if (apiKey.length < 20 || apiKey.length > 500) {
      throw httpError('A chave do OpenRouter parece inválida.', 400);
    }
    setSetting(db, AI_API_KEY, encryptSecret(apiKey));
  }

  return getPublicAiSettings(db);
}
