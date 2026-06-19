import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

export function resolveProjectPath(relativePath) {
  if (path.isAbsolute(relativePath)) return relativePath;
  return path.resolve(projectRoot, relativePath);
}

export function getDatabasePath() {
  const configured = process.env.DATABASE_PATH || './data/vagas.db';
  return resolveProjectPath(configured);
}

export function initDatabase() {
  const dbPath = getDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      location TEXT,
      salary TEXT,
      description TEXT,
      requirements TEXT,
      match_reasons TEXT,
      score_overall INTEGER NOT NULL,
      score_technologies INTEGER,
      score_experience INTEGER,
      score_salary INTEGER,
      score_location INTEGER,
      found_at TEXT,
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      search_criteria TEXT,
      candidate_profile TEXT,
      status TEXT NOT NULL DEFAULT 'found',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS job_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS generated_cvs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      language TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      jobs_added INTEGER NOT NULL DEFAULT 0,
      jobs_skipped INTEGER NOT NULL DEFAULT 0,
      jobs_filtered INTEGER NOT NULL DEFAULT 0,
      total_in_file INTEGER NOT NULL DEFAULT 0,
      imported_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      job_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at);
  `);

  runMigrations(db);

  const defaultResumePath = process.env.RESUME_PATH || './resume.md';
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  insertSetting.run('resume_path', defaultResumePath);
  insertSetting.run('search_query_path', process.env.SEARCH_QUERY_PATH || './search-query.txt');
  insertSetting.run('default_cv_language', 'pt-BR');
  insertSetting.run('kanban_sla', JSON.stringify({
    applied: { normalLimitDays: 15, warningLimitDays: 30 },
    interview: { normalLimitDays: 15, warningLimitDays: 30 },
    technicalInterview: { normalLimitDays: 15, warningLimitDays: 30 },
  }));

  return db;
}

function runMigrations(db) {
  const jobColumns = db.prepare('PRAGMA table_info(jobs)').all();
  if (!jobColumns.some((c) => c.name === 'entered_at')) {
    db.exec('ALTER TABLE jobs ADD COLUMN entered_at TEXT');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS job_stage_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      from_column TEXT NOT NULL,
      to_column TEXT NOT NULL,
      moved_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_job_stage_history_job_id ON job_stage_history(job_id);
    CREATE INDEX IF NOT EXISTS idx_job_stage_history_moved_at ON job_stage_history(moved_at);
  `);

  db.prepare(`
    UPDATE jobs
    SET entered_at = updated_at
    WHERE entered_at IS NULL
      AND status IN ('applied', 'interview', 'technical_interview')
  `).run();
}

export function parseJsonField(value, fallback = null) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function mapJobRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    url: row.url,
    location: row.location,
    salary: row.salary,
    description: row.description,
    requirements: parseJsonField(row.requirements, []),
    matchReasons: parseJsonField(row.match_reasons, []),
    score: {
      overall: row.score_overall,
      technologies: row.score_technologies,
      experience: row.score_experience,
      salary: row.score_salary,
      location: row.score_location,
    },
    foundAt: row.found_at,
    importedAt: row.imported_at,
    searchCriteria: parseJsonField(row.search_criteria),
    candidateProfile: parseJsonField(row.candidate_profile),
    status: row.status,
    enteredAt: row.entered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export { projectRoot };
