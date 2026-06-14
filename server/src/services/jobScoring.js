/**
 * Calcula score de compatibilidade sem IA, com base em correspondência de palavras-chave.
 * @param {import('../providers/provider.interface.js').Job} job
 * @param {import('../providers/provider.interface.js').JobSearchFilters} filters
 * @param {object} [candidateProfile]
 */
export function scoreJob(job, filters, candidateProfile = null) {
  const haystack = [
    job.title,
    job.description ?? '',
    ...(job.requirements ?? []),
    job.location ?? '',
  ]
    .join(' ')
    .toLowerCase();

  const searchTechnologies = filters.technologies ?? [];
  const profileTechnologies = candidateProfile?.mainTechnologies ?? [];
  const technologies = uniqueStrings([...searchTechnologies, ...profileTechnologies]);

  let scoreTechnologies = 75;

  if (technologies.length > 0) {
    const matched = technologies.filter((tech) => haystack.includes(tech.toLowerCase()));
    scoreTechnologies = Math.round((matched.length / technologies.length) * 100);
  } else if (filters.position) {
    const words = filters.position.toLowerCase().split(/\s+/).filter(Boolean);
    const matched = words.filter((word) => haystack.includes(word));
    scoreTechnologies = words.length
      ? Math.round((matched.length / words.length) * 100)
      : 75;
  }

  let scoreExperience = 80;
  const seniority = candidateProfile?.seniority?.toLowerCase();
  const title = job.title.toLowerCase();
  if (seniority) {
    if (seniority.includes('senior') && /senior|sênior|sr\.?/i.test(title)) scoreExperience = 95;
    else if (seniority.includes('pleno') && /pleno|mid|semi/i.test(title)) scoreExperience = 90;
    else if (/senior|sênior|pleno|mid/i.test(title)) scoreExperience = 85;
  }

  const scoreSalary = job.salary ? 85 : 75;

  let scoreLocation = 70;
  const locationFilter = (filters.location ?? '').toLowerCase();
  const jobLocation = (job.location ?? '').toLowerCase();

  if (filters.remoteOnly && job.remote) {
    scoreLocation = 100;
  } else if (locationFilter) {
    const brazilMatch =
      (locationFilter.includes('brasil') || locationFilter.includes('brazil')) &&
      (jobLocation.includes('brasil') ||
        jobLocation.includes('brazil') ||
        jobLocation.includes('latam') ||
        job.remote);

    if (brazilMatch || jobLocation.includes(locationFilter)) {
      scoreLocation = 95;
    }
  } else if (job.remote) {
    scoreLocation = 90;
  }

  const overall = Math.round(
    scoreTechnologies * 0.4 +
      scoreExperience * 0.3 +
      scoreSalary * 0.2 +
      scoreLocation * 0.1
  );

  const matchReasons = [`Fonte: ${job.source}`];
  const matchedTechs = technologies.filter((tech) => haystack.includes(tech.toLowerCase()));
  if (matchedTechs.length > 0) {
    matchReasons.push(`Tecnologias encontradas: ${matchedTechs.join(', ')}`);
  }
  if (candidateProfile?.seniority && scoreExperience >= 90) {
    matchReasons.push(`Senioridade compatível (${candidateProfile.seniority})`);
  }
  if (job.remote) {
    matchReasons.push('Vaga remota');
  }

  return {
    score: {
      overall,
      technologies: scoreTechnologies,
      experience: scoreExperience,
      salary: scoreSalary,
      location: scoreLocation,
    },
    matchReasons,
  };
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const trimmed = String(value).trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}
