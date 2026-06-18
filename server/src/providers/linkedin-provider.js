import { buildSearchQuery } from './http.js';
import {
  getLinkedInAccessToken,
  getLinkedInApiVersion,
  isLinkedInConfigured,
} from './linkedin-auth.js';
import { parseLinkedInSearchHtml } from './linkedin-parse.js';

const SEARCH_URL =
  'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';
const REST_SEARCH_URL = 'https://api.linkedin.com/v2/jobSearch';
const PAGE_SIZE = 25;
const DEFAULT_MAX_RESULTS = 50;

function resolveMaxResults() {
  const configured = Number.parseInt(process.env.LINKEDIN_MAX_RESULTS ?? '', 10);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.min(configured, 100);
  }
  return DEFAULT_MAX_RESULTS;
}

function resolveLocation(filters) {
  if (filters.location?.trim()) return filters.location.trim();
  return 'Brazil';
}

function buildGuestSearchParams(filters, start) {
  const query = buildSearchQuery(filters) || filters.position || 'developer';
  const params = new URLSearchParams({
    keywords: query,
    location: resolveLocation(filters),
    start: String(start),
  });

  if (filters.remoteOnly) {
    params.set('f_WT', '2');
  }

  return params;
}

async function fetchLinkedInHtml(url, accessToken) {
  const headers = {
    Accept: 'text/html,application/xhtml+xml',
    'User-Agent': 'ApplyAI/1.0 (LinkedIn Jobs integration)',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao consultar LinkedIn Jobs`);
  }

  return response.text();
}

function mapRestJob(item) {
  const title =
    item?.title?.text ??
    item?.jobTitle ??
    item?.localizedTitle ??
    item?.title;
  const company =
    item?.companyDetails?.company?.name ??
    item?.companyName ??
    item?.company?.name ??
    'Empresa não informada';
  const location =
    item?.formattedLocation ??
    item?.location?.name ??
    item?.location ??
    undefined;
  const url =
    item?.jobPostingUrl ??
    item?.url ??
    (item?.id ? `https://www.linkedin.com/jobs/view/${item.id}` : undefined);
  const description =
    item?.description?.text ??
    item?.description ??
    item?.localizedDescription ??
    '';

  if (!title || !url) return null;

  const locationText = typeof location === 'string' ? location : location?.name;
  const remote = /remote|remoto|home office|work from home/i.test(
    `${locationText ?? ''} ${title}`
  );

  return {
    title: String(title).trim(),
    company: String(company).trim(),
    location: locationText ? String(locationText).trim() : undefined,
    remote,
    salary: undefined,
    description: String(description).trim(),
    requirements: [],
    url: String(url).trim(),
    source: 'linkedin',
    foundAt: item?.listedAt ?? item?.createdAt ?? new Date().toISOString(),
  };
}

async function searchViaRestApi(accessToken, filters) {
  const query = buildSearchQuery(filters) || filters.position || 'developer';
  const params = new URLSearchParams({
    q: 'search',
    keywords: query,
  });

  const location = resolveLocation(filters);
  if (location) params.set('location', location);

  const response = await fetch(`${REST_SEARCH_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Linkedin-Version': getLinkedInApiVersion(),
      'X-Restli-Protocol-Version': '2.0.0',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`LinkedIn REST jobSearch falhou: HTTP ${response.status}`);
  }

  const data = await response.json();
  const elements = data?.elements ?? data?.jobs ?? data?.results ?? [];

  if (!Array.isArray(elements)) return [];

  return elements.map(mapRestJob).filter(Boolean);
}

async function searchViaGuestApi(accessToken, filters) {
  const maxResults = resolveMaxResults();
  const collected = [];

  for (let start = 0; start < maxResults; start += PAGE_SIZE) {
    const params = buildGuestSearchParams(filters, start);
    const url = `${SEARCH_URL}?${params.toString()}`;
    const html = await fetchLinkedInHtml(url, accessToken);
    const pageJobs = parseLinkedInSearchHtml(html);

    if (pageJobs.length === 0) break;

    collected.push(...pageJobs);
    if (pageJobs.length < PAGE_SIZE || collected.length >= maxResults) break;
  }

  return collected.slice(0, maxResults);
}

/** @type {import('./provider.interface.js').JobProvider} */
export const linkedinProvider = {
  id: 'linkedin',
  name: 'LinkedIn',
  requiresAuth: true,

  isConfigured() {
    return isLinkedInConfigured();
  },

  async search(filters) {
    if (!isLinkedInConfigured()) return [];

    const accessToken = await getLinkedInAccessToken();
    if (!accessToken) return [];

    let jobs = await searchViaRestApi(accessToken, filters);
    if (jobs === null) {
      jobs = await searchViaGuestApi(accessToken, filters);
    }

    return jobs.filter((job) => job.url && job.title);
  },
};
