import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { initDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';

const importPayload = {
  searchCriteria: { position: 'Developer', technologies: ['React'], remoteOnly: true },
  candidateProfile: { name: 'Smoke Test', seniority: 'Senior', mainTechnologies: ['React'] },
  jobs: [
    {
      title: 'Frontend Developer',
      company: 'SmokeCo',
      url: `https://example.com/smoke-${Date.now()}`,
      score: { overall: 85, technologies: 90, experience: 80, salary: 75, location: 70 },
    },
  ],
};

let db;
let app;
let tempDbPath;

before(() => {
  tempDbPath = path.join(os.tmpdir(), `applyai-smoke-${process.pid}.db`);
  process.env.DATABASE_PATH = tempDbPath;
  process.env.RESUME_PATH = path.resolve('resume.md');
  process.env.SEARCH_QUERY_PATH = path.resolve('search-query.txt');
  db = initDatabase();
  app = createApp(db);
});

after(() => {
  db.close();
  if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
  if (fs.existsSync(`${tempDbPath}-wal`)) fs.unlinkSync(`${tempDbPath}-wal`);
  if (fs.existsSync(`${tempDbPath}-shm`)) fs.unlinkSync(`${tempDbPath}-shm`);
});

test('GET /api/health returns ok', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
});

test('GET /api/jobs returns array', async () => {
  const res = await request(app).get('/api/jobs');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
});

test('GET /api/settings returns resume, search paths and AI status', async () => {
  const res = await request(app).get('/api/settings');
  assert.equal(res.status, 200);
  assert.ok('resumePath' in res.body);
  assert.ok('searchQueryPath' in res.body);
  assert.equal(res.body.ai.provider, 'openrouter');
  assert.equal(res.body.ai.configured, false);
  assert.equal(Object.hasOwn(res.body.ai, 'apiKey'), false);
});

test('POST /api/imports accepts JSON file upload', async () => {
  const res = await request(app)
    .post('/api/imports')
    .attach('file', Buffer.from(JSON.stringify(importPayload)), {
      filename: 'smoke.json',
      contentType: 'application/json',
    });

  assert.equal(res.status, 201);
  assert.ok(res.body.added >= 1);
});

test('GET /api/imports returns paginated history', async () => {
  const res = await request(app).get('/api/imports?page=1&limit=10');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.items));
});

test('GET /api/ai/usage returns usage report', async () => {
  const res = await request(app).get('/api/ai/usage');
  assert.equal(res.status, 200);
  assert.ok('summary' in res.body);
});
