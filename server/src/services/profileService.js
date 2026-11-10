import fs from 'fs';
import { resolveProjectPath } from '../db.js';
import {
  getSearchQueryPath,
  getSetting,
  readResumeContent,
  readSearchQueryContent,
} from './importService.js';
import { getPublicAiSettings } from './aiConfigService.js';
import { enhanceSearchContextWithAi } from './searchProfileAiService.js';

const TECH_KEYWORDS = [
  'angular',
  'react',
  'node.js',
  'nodejs',
  'typescript',
  'javascript',
  'nestjs',
  'postgresql',
  'postgres',
  'mongodb',
  'docker',
  'rxjs',
  'jest',
  'pentaho',
  'java',
  'python',
  'flutter',
  'mysql',
  'oracle',
  'tailwindcss',
  'redux',
];

function stripResumeMarkup(content) {
  return content
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<progress[\s\S]*?<\/progress>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '');
}

function uniqueValues(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function extractName(lines) {
  const headerIndex = lines.findIndex((line) => /^#\s*header/i.test(line.trim()));
  if (headerIndex >= 0) {
    for (let i = headerIndex + 1; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;
      if (/desenvolvedor|developer|engineer|full stack|front-end|frontend/i.test(line)) continue;
      return line;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('**')) {
      return trimmed;
    }
  }

  return null;
}

function extractTechnologiesFromText(text) {
  const lower = text.toLowerCase();
  const found = [];

  for (const keyword of TECH_KEYWORDS) {
    if (lower.includes(keyword)) {
      found.push(keyword === 'nodejs' ? 'Node.js' : capitalizeTech(keyword));
    }
  }

  const pipeLine = text
    .split('\n')
    .find((line) => line.includes('|') && /desenvolvedor|developer|javascript|angular|react/i.test(line));

  if (pipeLine) {
    for (const part of pipeLine.split('|')) {
      const cleaned = part.replace(/[#*]/g, '').trim();
      if (cleaned.length >= 2 && cleaned.length <= 30) found.push(cleaned);
    }
  }

  const skillsMatches = text.matchAll(/\*\*Habilidades aprendidas:\*\*\s*(.+)/gi);
  for (const match of skillsMatches) {
    for (const skill of match[1].split(',')) {
      const cleaned = skill.replace(/\.$/, '').trim();
      if (cleaned) found.push(cleaned);
    }
  }

  return uniqueValues(found);
}

function capitalizeTech(value) {
  if (value === 'node.js') return 'Node.js';
  if (value === 'postgresql' || value === 'postgres') return 'PostgreSQL';
  if (value === 'mongodb') return 'MongoDB';
  if (value === 'typescript') return 'TypeScript';
  if (value === 'javascript') return 'JavaScript';
  if (value === 'nestjs') return 'NestJS';
  if (value === 'tailwindcss') return 'TailwindCSS';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function extractSeniority(text) {
  if (/\bs[êe]nior\b|\bsenior\b/i.test(text)) return 'Senior';
  if (/\bpleno\b/i.test(text)) return 'Pleno';
  if (/\bj[úu]nior\b|\bjunior\b/i.test(text)) return 'Junior';
  return null;
}

function extractLanguages(text) {
  const languages = [];
  if (/\bportugu[eê]s\b/i.test(text)) languages.push('Portuguese');
  if (/\bingl[eê]s\b|\benglish\b/i.test(text)) languages.push('English');
  if (/\bespanhol\b|\bspanish\b/i.test(text)) languages.push('Spanish');
  return languages;
}

function extractYearsOfExperience(text) {
  const experienceSection = text.match(/#\s*Experi[eê]ncia([\s\S]*?)(?:#\s*Forma|$)/i)?.[1] ?? text;
  const matches = [...experienceSection.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  if (matches.length === 0) return null;
  const earliest = Math.min(...matches);
  const currentYear = new Date().getFullYear();
  return Math.max(0, currentYear - earliest);
}

export function parseCandidateProfile(resumeContent) {
  const text = stripResumeMarkup(resumeContent);
  const lines = text.split('\n').map((line) => line.trim());

  const mainTechnologies = extractTechnologiesFromText(text);
  const seniority = extractSeniority(text) ?? 'Pleno';
  const yearsOfExperience = extractYearsOfExperience(text);

  return {
    name: extractName(lines),
    seniority,
    yearsOfExperience,
    languages: extractLanguages(text),
    mainTechnologies,
  };
}

function parseChecked(line) {
  return /\[x\]/i.test(line);
}

function parseListSection(content, sectionTitle) {
  const regex = new RegExp(`${sectionTitle}:?\\s*\\n([\\s\\S]*?)(?:\\n\\n|$)`, 'i');
  const match = content.match(regex);
  if (!match) return [];

  return match[1]
    .split('\n')
    .map((line) => line.replace(/^-\s*/, '').trim())
    .filter((line) => line && !line.startsWith('-'));
}

export function parseSearchCriteria(searchQueryContent, candidateProfile) {
  const content = searchQueryContent.trim();
  const firstLine = content.split('\n').map((line) => line.trim()).find(Boolean) ?? '';

  let position = null;
  const positionMatch = firstLine.match(/vagas de\s+(.+?)(?:\.|$)/i);
  if (positionMatch) {
    position = positionMatch[1].trim();
  } else if (firstLine) {
    position = firstLine;
  }

  const technologyLines = parseListSection(content, 'Tecnologias');
  const technologies = uniqueValues(
    technologyLines
      .map((line) => line.replace(/^-\s*/, '').trim())
      .filter(Boolean)
  );

  const otherCriteria = content.match(/Outros crit[eé]rios:\s*\n-\s*(.+)/i)?.[1];
  if (otherCriteria) {
    const extraTechs = extractTechnologiesFromText(otherCriteria);
    technologies.push(...extraTechs);
  }

  const remoteOnly = /Modalidade:[\s\S]*?-\s*\[x\]\s*Somente remoto/i.test(content);
  const brazilChecked = /Escopo geogr[aá]fico:[\s\S]*?-\s*\[x\]\s*Brasil/i.test(content);
  const internationalChecked =
    /Escopo geogr[aá]fico:[\s\S]*?-\s*\[x\]\s*Internacional/i.test(content);

  let location = null;
  if (brazilChecked && internationalChecked) location = 'Brasil';
  else if (brazilChecked) location = 'Brasil';
  else if (internationalChecked) location = 'Internacional';

  const seniorityLine = content.match(/Senioridade:\s*\n-\s*(.+)/i)?.[1] ?? '';
  const preferredSeniority = seniorityLine.includes('Senior')
    ? 'Senior'
    : seniorityLine.includes('Pleno')
      ? 'Pleno'
      : candidateProfile?.seniority ?? null;

  return {
    position,
    technologies: uniqueValues([
      ...technologies,
      ...(candidateProfile?.mainTechnologies?.slice(0, 5) ?? []),
    ]),
    remoteOnly,
    location,
    preferredSeniority,
    international: internationalChecked,
  };
}

function mergeProfiles(ruleBased, aiProfile) {
  if (!aiProfile) return ruleBased;
  return {
    name: aiProfile.name ?? ruleBased.name,
    seniority: aiProfile.seniority ?? ruleBased.seniority,
    yearsOfExperience: aiProfile.yearsOfExperience ?? ruleBased.yearsOfExperience,
    languages: aiProfile.languages?.length ? aiProfile.languages : ruleBased.languages,
    mainTechnologies: aiProfile.mainTechnologies?.length
      ? aiProfile.mainTechnologies
      : ruleBased.mainTechnologies,
  };
}

function mergeSearchFilters(ruleBased, aiFilters, overrides = {}) {
  const base = aiFilters ?? ruleBased;

  const technologies =
    Array.isArray(overrides.technologies) && overrides.technologies.length > 0
      ? overrides.technologies.map((tech) => String(tech).trim()).filter(Boolean)
      : base.technologies ?? ruleBased.technologies ?? [];

  return {
    position: overrides.position?.trim() || base.position || ruleBased.position || undefined,
    technologies,
    remoteOnly:
      overrides.remoteOnly !== undefined
        ? Boolean(overrides.remoteOnly)
        : base.remoteOnly ?? ruleBased.remoteOnly ?? false,
    location: overrides.location?.trim() || base.location || ruleBased.location || undefined,
    preferredSeniority:
      base.preferredSeniority ?? ruleBased.preferredSeniority ?? null,
    international: base.international ?? ruleBased.international ?? false,
  };
}

export async function buildSearchContext(db, overrides = {}, options = {}) {
  const resumeContent = readResumeContent(db);
  const searchQueryContent = readSearchQueryContent(db);
  const ruleBasedProfile = parseCandidateProfile(resumeContent);
  const ruleBasedCriteria = parseSearchCriteria(searchQueryContent, ruleBasedProfile);

  let aiUsage = null;
  let aiEnhanced = null;

  const useAi = options.useAi !== false && getPublicAiSettings(db).configured;
  if (useAi) {
    try {
      aiEnhanced = await enhanceSearchContextWithAi(db, {
        resumeContent,
        searchQueryContent,
        ruleBased: {
          candidateProfile: ruleBasedProfile,
          searchFilters: ruleBasedCriteria,
        },
      });
      if (aiEnhanced.aiUsed) {
        aiUsage = aiEnhanced.usage;
      }
    } catch (error) {
      console.warn('[job-search] Falha ao enriquecer perfil com IA:', error.message);
    }
  }

  const candidateProfile = mergeProfiles(ruleBasedProfile, aiEnhanced?.candidateProfile);
  const mergedCriteria = mergeSearchFilters(ruleBasedCriteria, aiEnhanced?.searchFilters, overrides);

  const filters = {
    position: mergedCriteria.position,
    technologies: mergedCriteria.technologies,
    remoteOnly: mergedCriteria.remoteOnly,
    location: mergedCriteria.location,
  };

  const searchCriteria = {
    position: filters.position ?? null,
    technologies: filters.technologies ?? [],
    remoteOnly: filters.remoteOnly ?? false,
    location: filters.location ?? null,
    preferredSeniority: mergedCriteria.preferredSeniority ?? candidateProfile.seniority ?? null,
    international: mergedCriteria.international ?? false,
    source: 'api-search',
    profileSource: aiEnhanced?.aiUsed ? 'ai+rules' : 'rules',
    resumePath: getSetting(db, 'resume_path', process.env.RESUME_PATH || './resume.md'),
    searchQueryPath: getSearchQueryPath(db),
  };

  return {
    filters,
    searchCriteria,
    candidateProfile,
    aiUsage,
  };
}

export function getSearchDefaults(db) {
  const resumePath = getSetting(db, 'resume_path', process.env.RESUME_PATH || './resume.md');
  const searchQueryPath = getSearchQueryPath(db);
  const searchQueryAbsolutePath = resolveProjectPath(searchQueryPath);

  const resumeContent = readResumeContent(db);
  const searchQueryContent = readSearchQueryContent(db);
  const candidateProfile = parseCandidateProfile(resumeContent);
  const fromFiles = parseSearchCriteria(searchQueryContent, candidateProfile);

  const filters = {
    position: fromFiles.position || undefined,
    technologies: fromFiles.technologies,
    remoteOnly: fromFiles.remoteOnly,
    location: fromFiles.location || undefined,
  };

  const searchCriteria = {
    position: filters.position ?? null,
    technologies: filters.technologies ?? [],
    remoteOnly: filters.remoteOnly ?? false,
    location: filters.location ?? null,
    preferredSeniority: fromFiles.preferredSeniority ?? candidateProfile.seniority ?? null,
    international: fromFiles.international ?? false,
    source: 'api-search',
    profileSource: 'rules',
    resumePath,
    searchQueryPath,
  };

  const ai = getPublicAiSettings(db);

  return {
    resumePath,
    resumeExists: fs.existsSync(resolveProjectPath(resumePath)),
    searchQueryPath,
    searchQueryExists: fs.existsSync(searchQueryAbsolutePath),
    searchQueryAbsolutePath,
    filters,
    searchCriteria,
    candidateProfile,
    ai,
    aiAvailable: ai.configured,
  };
}
