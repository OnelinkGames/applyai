import { SCORE_THRESHOLD } from '../constants.js';
import { mapJobRow } from '../db.js';
import { jobProviders } from '../providers/index.js';
import { buildSearchContext } from './profileService.js';
import { scoreJob } from './jobScoring.js';
import { recordAiUsage } from './aiUsageService.js';

function matchesRemoteFilter(job, remoteOnly) {
  if (!remoteOnly) return true;
  if (job.remote) return true;
  const location = (job.location ?? '').toLowerCase();
  return /remote|remoto|anywhere|worldwide|global|home office|work from home/.test(
    location
  );
}

function matchesLocationFilter(job, location) {
  if (!location) return true;
  const filter = location.toLowerCase();
  const jobLocation = (job.location ?? '').toLowerCase();

  if (filter.includes('brasil') || filter.includes('brazil')) {
    return (
      jobLocation.includes('brasil') ||
      jobLocation.includes('brazil') ||
      jobLocation.includes('latam') ||
      jobLocation.includes('emea') ||
      job.remote
    );
  }

  return jobLocation.includes(filter) || job.remote;
}

function dedupeJobs(jobs) {
  const seen = new Set();
  const unique = [];

  for (const job of jobs) {
    const key = job.url?.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(job);
  }

  return unique;
}

function sortJobs(jobs) {
  return [...jobs].sort((a, b) => {
    const dateA = Date.parse(a.foundAt ?? '') || 0;
    const dateB = Date.parse(b.foundAt ?? '') || 0;
    return dateB - dateA;
  });
}

async function runProvider(provider, filters) {
  if (provider.requiresAuth && !provider.isConfigured()) {
    return {
      id: provider.id,
      name: provider.name,
      status: 'skipped',
      reason: 'Credenciais não configuradas',
      count: 0,
    };
  }

  try {
    const jobs = await provider.search(filters);
    return {
      id: provider.id,
      name: provider.name,
      status: 'success',
      count: jobs.length,
      jobs,
    };
  } catch (error) {
    console.error(`[job-search] Provider ${provider.id} falhou:`, error.message);
    return {
      id: provider.id,
      name: provider.name,
      status: 'error',
      error: error.message,
      count: 0,
      jobs: [],
    };
  }
}

function persistJobs(db, jobs, searchCriteria, candidateProfile) {
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

  const searchCriteriaJson = JSON.stringify(searchCriteria);
  const candidateProfileJson = JSON.stringify(candidateProfile);

  let added = 0;
  let skipped = 0;
  let filtered = 0;
  const insertedIds = [];

  const transaction = db.transaction(() => {
    for (const job of jobs) {
      const { score, matchReasons } = scoreJob(job, searchCriteria, candidateProfile);

      if (score.overall <= SCORE_THRESHOLD) {
        filtered += 1;
        continue;
      }

      const existing = findByUrl.get(job.url);
      if (existing) {
        skipped += 1;
        continue;
      }

      const result = insertJob.run({
        title: job.title,
        company: job.company,
        url: job.url,
        location: job.location ?? null,
        salary: job.salary ?? null,
        description: job.description ?? null,
        requirements: JSON.stringify(job.requirements ?? []),
        match_reasons: JSON.stringify(matchReasons),
        score_overall: score.overall,
        score_technologies: score.technologies,
        score_experience: score.experience,
        score_salary: score.salary,
        score_location: score.location,
        found_at: job.foundAt ?? new Date().toISOString(),
        search_criteria: searchCriteriaJson,
        candidate_profile: candidateProfileJson,
      });

      insertedIds.push(Number(result.lastInsertRowid));
      added += 1;
    }

    db.prepare(
      `INSERT INTO imports (filename, jobs_added, jobs_skipped, jobs_filtered, total_in_file)
       VALUES (?, ?, ?, ?, ?)`
    ).run('api-job-search', added, skipped, filtered, jobs.length);
  });

  transaction();

  const savedJobs = insertedIds
    .map((id) => mapJobRow(db.prepare('SELECT * FROM jobs WHERE id = ?').get(id)))
    .filter(Boolean);

  return { added, skipped, filtered, savedJobs };
}

export async function runJobSearch(db, body = {}) {
  const useAi = body.useAi !== false;
  const { filters, searchCriteria, candidateProfile, aiUsage } = await buildSearchContext(
    db,
    body,
    { useAi }
  );

  if (aiUsage) {
    recordAiUsage(db, {
      operation: 'job_search_profile',
      model: aiUsage.model,
      promptTokens: aiUsage.promptTokens,
      completionTokens: aiUsage.completionTokens,
    });
  }

  const providerResults = await Promise.all(
    jobProviders.map((provider) => runProvider(provider, filters))
  );

  const allJobs = providerResults.flatMap((result) => result.jobs ?? []);
  const filteredJobs = allJobs.filter(
    (job) =>
      matchesRemoteFilter(job, filters.remoteOnly) &&
      matchesLocationFilter(job, filters.location)
  );
  const uniqueJobs = dedupeJobs(filteredJobs);
  const sortedJobs = sortJobs(uniqueJobs);

  const { added, skipped, filtered, savedJobs } = persistJobs(
    db,
    sortedJobs,
    searchCriteria,
    candidateProfile
  );

  const executed = providerResults.filter((r) => r.status === 'success').length;
  const skippedProviders = providerResults.filter((r) => r.status === 'skipped').length;
  const failedProviders = providerResults.filter((r) => r.status === 'error').length;

  return {
    jobs: savedJobs,
    summary: {
      totalFound: sortedJobs.length,
      added,
      skipped,
      filtered,
      providers: {
        total: jobProviders.length,
        executed,
        skipped: skippedProviders,
        failed: failedProviders,
        details: providerResults.map(({ jobs: _jobs, ...detail }) => detail),
      },
    },
    searchCriteria,
    candidateProfile,
    aiUsed: Boolean(aiUsage),
  };
}
