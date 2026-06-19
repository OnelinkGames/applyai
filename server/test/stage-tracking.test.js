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
  candidateProfile: { name: 'Stage Test', seniority: 'Senior', mainTechnologies: ['React'] },
  jobs: [
    {
      title: 'Stage Tracking Dev',
      company: 'StageCo',
      url: `https://example.com/stage-${Date.now()}`,
      score: { overall: 85, technologies: 90, experience: 80, salary: 75, location: 70 },
    },
  ],
};

let db;
let app;
let tempDbPath;
let jobId;

before(async () => {
  tempDbPath = path.join(os.tmpdir(), `applyai-stage-${process.pid}.db`);
  process.env.DATABASE_PATH = tempDbPath;
  process.env.RESUME_PATH = path.resolve('resume.md');
  process.env.SEARCH_QUERY_PATH = path.resolve('search-query.txt');
  db = initDatabase();
  app = createApp(db);

  const importRes = await request(app)
    .post('/api/imports')
    .attach('file', Buffer.from(JSON.stringify(importPayload)), {
      filename: 'stage.json',
      contentType: 'application/json',
    });
  assert.equal(importRes.status, 201);

  const jobsRes = await request(app).get('/api/jobs');
  jobId = jobsRes.body[0].id;
});

after(() => {
  db.close();
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${tempDbPath}${suffix}`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});

test('moving to monitored column sets enteredAt and records history', async () => {
  const res = await request(app)
    .patch(`/api/jobs/${jobId}/status`)
    .send({ status: 'applied' });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'applied');
  assert.ok(res.body.enteredAt);

  const history = db
    .prepare('SELECT * FROM job_stage_history WHERE job_id = ? ORDER BY id DESC')
    .all(jobId);

  assert.equal(history.length, 1);
  assert.equal(history[0].from_column, 'found');
  assert.equal(history[0].to_column, 'applied');
});

test('moving between monitored columns resets enteredAt', async () => {
  const before = db
    .prepare('UPDATE jobs SET entered_at = ? WHERE id = ?')
    .run('2025-01-01T00:00:00.000Z', jobId);

  assert.ok(before.changes === 1);

  const res = await request(app)
    .patch(`/api/jobs/${jobId}/status`)
    .send({ status: 'interview' });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'interview');
  assert.notEqual(res.body.enteredAt, '2025-01-01T00:00:00.000Z');

  const history = db
    .prepare('SELECT * FROM job_stage_history WHERE job_id = ? ORDER BY id DESC')
    .all(jobId);

  assert.equal(history[0].from_column, 'applied');
  assert.equal(history[0].to_column, 'interview');
});

test('moving to non-monitored column does not record history', async () => {
  const historyBefore = db
    .prepare('SELECT COUNT(*) AS count FROM job_stage_history WHERE job_id = ?')
    .get(jobId).count;

  const res = await request(app)
    .patch(`/api/jobs/${jobId}/status`)
    .send({ status: 'approved' });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'approved');

  const historyAfter = db
    .prepare('SELECT COUNT(*) AS count FROM job_stage_history WHERE job_id = ?')
    .get(jobId).count;

  assert.equal(historyAfter, historyBefore);
});

test('GET /api/jobs includes enteredAt field', async () => {
  await request(app).patch(`/api/jobs/${jobId}/status`).send({ status: 'applied' });

  const res = await request(app).get('/api/jobs');
  assert.equal(res.status, 200);
  const job = res.body.find((j) => j.id === jobId);
  assert.ok('enteredAt' in job);
});
