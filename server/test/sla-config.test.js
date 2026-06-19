import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { initDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { validateKanbanSla } from '../src/services/slaService.js';

let db;
let app;
let tempDbPath;

before(() => {
  tempDbPath = path.join(os.tmpdir(), `applyai-sla-${process.pid}.db`);
  process.env.DATABASE_PATH = tempDbPath;
  process.env.RESUME_PATH = path.resolve('resume.md');
  process.env.SEARCH_QUERY_PATH = path.resolve('search-query.txt');
  db = initDatabase();
  app = createApp(db);
});

after(() => {
  db.close();
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${tempDbPath}${suffix}`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});

test('validateKanbanSla rejects invalid limits', () => {
  assert.throws(() => validateKanbanSla({ applied: { normalLimitDays: 0, warningLimitDays: 10 } }));
  assert.throws(() =>
    validateKanbanSla({
      applied: { normalLimitDays: 20, warningLimitDays: 15 },
      interview: { normalLimitDays: 7, warningLimitDays: 15 },
      technicalInterview: { normalLimitDays: 5, warningLimitDays: 10 },
    })
  );
});

test('validateKanbanSla accepts valid config', () => {
  const config = validateKanbanSla({
    applied: { normalLimitDays: 10, warningLimitDays: 20 },
    interview: { normalLimitDays: 7, warningLimitDays: 15 },
    technicalInterview: { normalLimitDays: 5, warningLimitDays: 10 },
  });

  assert.deepEqual(config.applied, { normalLimitDays: 10, warningLimitDays: 20 });
});

test('GET /api/settings includes default kanbanSla', async () => {
  const res = await request(app).get('/api/settings');
  assert.equal(res.status, 200);
  assert.ok(res.body.kanbanSla);
  assert.equal(res.body.kanbanSla.applied.normalLimitDays, 15);
  assert.equal(res.body.kanbanSla.technicalInterview.warningLimitDays, 30);
});

test('PATCH /api/settings persists kanbanSla', async () => {
  const payload = {
    kanbanSla: {
      applied: { normalLimitDays: 10, warningLimitDays: 20 },
      interview: { normalLimitDays: 7, warningLimitDays: 15 },
      technicalInterview: { normalLimitDays: 5, warningLimitDays: 10 },
    },
  };

  const patchRes = await request(app).patch('/api/settings').send(payload);
  assert.equal(patchRes.status, 200);
  assert.deepEqual(patchRes.body.kanbanSla.applied, payload.kanbanSla.applied);

  const getRes = await request(app).get('/api/settings');
  assert.deepEqual(getRes.body.kanbanSla.interview, payload.kanbanSla.interview);
});

test('PATCH /api/settings rejects invalid kanbanSla', async () => {
  const res = await request(app)
    .patch('/api/settings')
    .send({
      kanbanSla: {
        applied: { normalLimitDays: 30, warningLimitDays: 10 },
        interview: { normalLimitDays: 7, warningLimitDays: 15 },
        technicalInterview: { normalLimitDays: 5, warningLimitDays: 10 },
      },
    });

  assert.equal(res.status, 400);
  assert.ok(res.body.error);
});
