const DEFAULT_TIMEOUT_MS = 15000;

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ApplyAI/1.0 (https://github.com/applyai)',
      ...options.headers,
    },
    signal: AbortSignal.timeout(options.timeout ?? DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao consultar ${url}`);
  }

  return response.json();
}

export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x26;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSearchQuery(filters) {
  const parts = [];
  if (filters.position?.trim()) parts.push(filters.position.trim());
  for (const tech of filters.technologies ?? []) {
    if (tech?.trim()) parts.push(tech.trim());
  }
  return parts.join(' ').trim();
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => String(tag).trim()).filter(Boolean);
}
