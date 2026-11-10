import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { initDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { decryptSecret, encryptSecret, getEncryptionKeyPath } from '../src/services/secretCrypto.js';
import { calculateCostUsd, rememberModelPricing } from '../src/services/aiPricing.js';
import { clearModelCache } from '../src/services/openRouterService.js';

const secret = 'sk-or-v1-test-key-value-123456';

let db;
let app;
let tempDbPath;
let keyPath;

before(() => {
  tempDbPath = path.join(os.tmpdir(), `applyai-ai-${process.pid}-${Date.now()}.db`);
  process.env.DATABASE_PATH = tempDbPath;
  db = initDatabase();
  app = createApp(db);
  keyPath = getEncryptionKeyPath();
});

after(() => {
  db.close();
  for (const file of [tempDbPath, `${tempDbPath}-wal`, `${tempDbPath}-shm`, keyPath]) {
    if (file && fs.existsSync(file)) fs.unlinkSync(file);
  }
});

describe('AI configuration', { concurrency: false }, () => {
test('encrypts and decrypts a secret with the local key', () => {
  const encrypted = encryptSecret(secret);
  assert.equal(encrypted.startsWith('enc:v1:'), true);
  assert.equal(encrypted.includes(secret), false);
  assert.equal(decryptSecret(encrypted), secret);
  assert.equal(fs.existsSync(keyPath), true);
});

test('saves the OpenRouter credential encrypted and never returns it', async () => {
  const saved = await request(app)
    .patch('/api/settings/ai')
    .send({ model: 'openai/gpt-4o-mini', apiKey: secret });

  assert.equal(saved.status, 200);
  assert.equal(saved.body.ai.provider, 'openrouter');
  assert.equal(saved.body.ai.model, 'openai/gpt-4o-mini');
  assert.equal(saved.body.ai.configured, true);
  assert.equal(saved.body.ai.keyHint, '••••3456');
  assert.equal(JSON.stringify(saved.body).includes(secret), false);
  assert.equal(Object.hasOwn(saved.body.ai, 'apiKey'), false);

  const stored = db.prepare("SELECT value FROM settings WHERE key = 'ai_api_key'").get().value;
  assert.equal(stored.startsWith('enc:v1:'), true);
  assert.equal(stored.includes(secret), false);
  assert.equal(decryptSecret(stored), secret);

  const kept = await request(app)
    .patch('/api/settings/ai')
    .send({ model: 'google/gemini-2.5-flash' });
  assert.equal(kept.status, 200);
  assert.equal(kept.body.ai.model, 'google/gemini-2.5-flash');
  assert.equal(
    decryptSecret(db.prepare("SELECT value FROM settings WHERE key = 'ai_api_key'").get().value),
    secret
  );

  const invalid = await request(app).patch('/api/settings/ai').send({ model: 'gpt-4o-mini' });
  assert.equal(invalid.status, 400);

  const cleared = await request(app).patch('/api/settings/ai').send({ clearApiKey: true });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.ai.configured, false);
  assert.equal(cleared.body.ai.keyHint, null);

  db.prepare(
    "INSERT INTO jobs (title, company, url, score_overall) VALUES ('Dev', 'Co', ?, 80)"
  ).run(`https://example.com/ai-${Date.now()}`);
  const job = db.prepare('SELECT id FROM jobs ORDER BY id DESC LIMIT 1').get();
  const generated = await request(app).post(`/api/jobs/${job.id}/generate-cv`).send({ language: 'pt-BR' });
  assert.equal(generated.status, 503);
  assert.match(generated.body.error, /OpenRouter/);
});

test('lists OpenRouter models and falls back when the catalog is offline', async () => {
  const originalFetch = globalThis.fetch;

  clearModelCache();
  globalThis.fetch = async (url) => {
    assert.match(String(url), /openrouter\.ai\/api\/v1\/models/);
    return {
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'openai/gpt-4o-mini',
            name: 'OpenAI: GPT-4o-mini',
            context_length: 128000,
            architecture: { modality: 'text->text', output_modalities: ['text'] },
            pricing: { prompt: '0.00000015', completion: '0.0000006' },
          },
          {
            id: '~openai/gpt-latest',
            name: 'alias',
            architecture: { modality: 'text->text', output_modalities: ['text'] },
            pricing: { prompt: '0', completion: '0' },
          },
          {
            id: 'openai/gpt-4o-mini:batch',
            name: 'batch',
            architecture: { modality: 'text->text', output_modalities: ['text'] },
            pricing: { prompt: '0', completion: '0' },
          },
        ],
      }),
    };
  };

  try {
    const live = await request(app).get('/api/ai/models');
    assert.equal(live.status, 200);
    assert.equal(live.body.source, 'openrouter');
    assert.deepEqual(
      live.body.models.map((item) => item.id),
      ['openai/gpt-4o-mini']
    );

    clearModelCache();
    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    const fallback = await request(app).get('/api/ai/models');
    assert.equal(fallback.status, 200);
    assert.equal(fallback.body.source, 'fallback');
    assert.ok(fallback.body.warning);
    assert.ok(fallback.body.models.some((item) => item.id === 'anthropic/claude-sonnet-4.5'));
  } finally {
    globalThis.fetch = originalFetch;
    clearModelCache();
  }
});

test('tests the OpenRouter connection without storing the typed key', async () => {
  const originalFetch = globalThis.fetch;
  const probeKey = 'sk-or-v1-connection-test-key';

  const missing = await request(app).post('/api/settings/ai/test').send({ apiKey: probeKey });
  assert.equal(missing.status, 400);

  globalThis.fetch = async (url, init) => {
    const href = String(url);
    assert.match(href, /\/chat\/completions$/);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('authorization'), `Bearer ${probeKey}`);
    return new Response(
      JSON.stringify({
        choices: [{ message: { role: 'assistant', content: 'ok' } }],
        usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5, cost: 0.00001 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  };

  try {
    const ok = await request(app)
      .post('/api/settings/ai/test')
      .send({ model: 'openai/gpt-4o-mini', apiKey: probeKey });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.ok, true);
    assert.match(ok.body.message, /Conexão confirmada/);
    assert.equal(JSON.stringify(ok.body).includes(probeKey), false);
    assert.equal(db.prepare("SELECT value FROM settings WHERE key = 'ai_api_key'").get(), undefined);

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { message: 'User not found.' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    const denied = await request(app)
      .post('/api/settings/ai/test')
      .send({ model: 'openai/gpt-4o-mini', apiKey: probeKey });
    assert.equal(denied.status, 401);
    assert.match(denied.body.error, /recusou a credencial/);
    assert.equal(JSON.stringify(denied.body).includes(probeKey), false);

    const openaiKey = `sk-proj-${'a'.repeat(24)}`;
    const foreign = await request(app)
      .post('/api/settings/ai/test')
      .send({ model: 'openai/gpt-4o-mini', apiKey: openaiKey });
    assert.equal(foreign.status, 400);
    assert.match(foreign.body.error, /é da OpenAI/);

    await request(app)
      .patch('/api/settings/ai')
      .send({ model: 'openai/gpt-4o-mini', apiKey: probeKey });
    globalThis.fetch = async (_url, init) => {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('authorization'), `Bearer ${probeKey}`);
      return new Response(
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'ok' } }],
          usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5, cost: 0.00001 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    };
    const savedKey = await request(app).post('/api/settings/ai/test').send({ model: 'openai/gpt-4o-mini' });
    assert.equal(savedKey.status, 200);
    assert.match(savedKey.body.message, /chave já salva/);
    await request(app).patch('/api/settings/ai').send({ clearApiKey: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('prices a model from the OpenRouter per-token rate', () => {
  rememberModelPricing([
    { id: 'test/model', pricing: { prompt: 0.000002, completion: 0.000004 } },
  ]);
  assert.ok(Math.abs(calculateCostUsd('test/model', 1000, 1000) - 0.006) < 1e-12);
});
});
