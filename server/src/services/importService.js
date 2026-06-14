import fs from 'fs';
import { SCORE_THRESHOLD } from '../constants.js';
import { resolveProjectPath } from '../db.js';

export function validateImportPayload(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('JSON inválido: objeto raiz esperado');
  }
  if (!data.searchCriteria || !data.candidateProfile || !Array.isArray(data.jobs)) {
    throw new Error(
      'JSON inválido: campos searchCriteria, candidateProfile e jobs[] são obrigatórios'
    );
  }
  return data;
}

export function importJobs(db, payload, filename = null) {
  const data = validateImportPayload(payload);
  const searchCriteriaJson = JSON.stringify(data.searchCriteria);
  const candidateProfileJson = JSON.stringify(data.candidateProfile);

  const findByUrl = db.prepare('SELECT id FROM jobs WHERE url = ?');
  const insertJob = db.prepare(`
    INSERT INTO jobs (
      title, company, url, location, salary, description,
      requirements, match_reasons,
      score_overall, score_technologies, score_experience, score_salary, score_location,
      found_at, search_criteria, candidate_profile, status
    ) VALUES (
      @title, @company, @url, @location, @salary, @description,
      @requirements, @match_reasons,
      @score_overall, @score_technologies, @score_experience, @score_salary, @score_location,
      @found_at, @search_criteria, @candidate_profile, 'found'
    )
  `);

  let added = 0;
  let skipped = 0;
  let filtered = 0;
  const warnings = [];

  const importTransaction = db.transaction(() => {
    for (const job of data.jobs) {
      const overall = job?.score?.overall ?? 0;
      if (overall <= SCORE_THRESHOLD) {
        filtered += 1;
        continue;
      }

      if (!job.url || !job.title || !job.company) {
        warnings.push(`Vaga ignorada: falta url, title ou company (${job.title || 'sem título'})`);
        continue;
      }

      const existing = findByUrl.get(job.url);
      if (existing) {
        skipped += 1;
        continue;
      }

      insertJob.run({
        title: job.title,
        company: job.company,
        url: job.url,
        location: job.location ?? null,
        salary: job.salary ?? null,
        description: job.description ?? null,
        requirements: JSON.stringify(job.requirements ?? []),
        match_reasons: JSON.stringify(job.matchReasons ?? []),
        score_overall: overall,
        score_technologies: job.score?.technologies ?? null,
        score_experience: job.score?.experience ?? null,
        score_salary: job.score?.salary ?? null,
        score_location: job.score?.location ?? null,
        found_at: job.foundAt ?? null,
        search_criteria: searchCriteriaJson,
        candidate_profile: candidateProfileJson,
      });
      added += 1;
    }

    const importResult = db
      .prepare(
        `INSERT INTO imports (filename, jobs_added, jobs_skipped, jobs_filtered, total_in_file)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(filename, added, skipped, filtered, data.jobs.length);

    return importResult.lastInsertRowid;
  });

  const importId = importTransaction();

  return {
    importId,
    added,
    skipped,
    filtered,
    totalInFile: data.jobs.length,
    warnings,
  };
}

export function getSetting(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row?.value ?? fallback;
}

export function setSetting(db, key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

export function readResumeContent(db) {
  const resumePath = getSetting(db, 'resume_path', process.env.RESUME_PATH || './resume.md');
  const absolutePath = resolveProjectPath(resumePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Arquivo de currículo não encontrado: ${absolutePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf-8');
}

export function readSearchQueryContent(db) {
  const searchQueryPath = getSetting(
    db,
    'search_query_path',
    process.env.SEARCH_QUERY_PATH || './search-query.txt'
  );
  const absolutePath = resolveProjectPath(searchQueryPath);
  if (!fs.existsSync(absolutePath)) {
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf-8');
}

export function getSearchQueryPath(db) {
  return getSetting(
    db,
    'search_query_path',
    process.env.SEARCH_QUERY_PATH || './search-query.txt'
  );
}
