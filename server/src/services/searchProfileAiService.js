import { getAiCredentials } from './aiConfigService.js';
import { createChatCompletion, usageFromResponse } from './openRouterService.js';

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function parseAiPayload(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const profile = parsed?.candidateProfile ?? {};
  const filters = parsed?.searchFilters ?? {};

  return {
    candidateProfile: {
      name: profile.name?.trim() || null,
      seniority: profile.seniority?.trim() || null,
      yearsOfExperience:
        typeof profile.yearsOfExperience === 'number' ? profile.yearsOfExperience : null,
      languages: normalizeStringArray(profile.languages),
      mainTechnologies: normalizeStringArray(profile.mainTechnologies),
    },
    searchFilters: {
      position: filters.position?.trim() || null,
      technologies: normalizeStringArray(filters.technologies),
      remoteOnly: Boolean(filters.remoteOnly),
      location: filters.location?.trim() || null,
      preferredSeniority: filters.preferredSeniority?.trim() || null,
      international: Boolean(filters.international),
    },
  };
}

export async function enhanceSearchContextWithAi(db, { resumeContent, searchQueryContent, ruleBased }) {
  const credentials = getAiCredentials(db);
  if (!credentials) {
    return { aiUsed: false };
  }

  const { model, apiKey } = credentials;

  const response = await createChatCompletion({
    apiKey,
    model,
    temperature: 0.2,
    json: true,
    messages: [
      {
        role: 'system',
        content: `You extract structured job search data from a candidate resume and search preferences file.
Return JSON only with this shape:
{
  "candidateProfile": {
    "name": string,
    "seniority": "Junior" | "Pleno" | "Senior",
    "yearsOfExperience": number,
    "languages": string[],
    "mainTechnologies": string[]
  },
  "searchFilters": {
    "position": string,
    "technologies": string[],
    "remoteOnly": boolean,
    "location": string,
    "preferredSeniority": string,
    "international": boolean
  }
}
Use only information present in the inputs. Prefer concise technology names suitable for job API queries.`,
      },
      {
        role: 'user',
        content: `Resume markdown:
${resumeContent.slice(0, 14000)}

Search preferences:
${searchQueryContent.slice(0, 6000) || '(empty — infer reasonable search filters from the resume)'}

Rule-based baseline (you may refine it):
${JSON.stringify(ruleBased, null, 2)}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('O modelo não retornou conteúdo ao analisar o perfil de busca.');
  }

  const parsed = parseAiPayload(content);

  return {
    aiUsed: true,
    candidateProfile: parsed.candidateProfile,
    searchFilters: parsed.searchFilters,
    usage: usageFromResponse(response, model),
  };
}
