import { buildSearchQuery, fetchJson, stripHtml } from './http.js';

function resolveCountry(location) {
  const value = (location ?? '').toLowerCase();
  if (value.includes('brasil') || value.includes('brazil')) return 'br';
  if (value.includes('usa') || value.includes('estados unidos')) return 'us';
  if (value.includes('uk') || value.includes('reino unido')) return 'gb';
  return 'br';
}

/** @type {import('./provider.interface.js').JobProvider} */
export const adzunaProvider = {
  id: 'adzuna',
  name: 'Adzuna',
  requiresAuth: true,

  isConfigured() {
    return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
  },

  async search(filters) {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) return [];

    const country = resolveCountry(filters.location);
    const query = buildSearchQuery(filters) || filters.position || 'developer';
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: '50',
      what: query,
      'content-type': 'application/json',
    });

    if (filters.location?.trim()) {
      params.set('where', filters.location.trim());
    }

    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;
    const data = await fetchJson(url);
    const jobs = Array.isArray(data?.results) ? data.results : [];

    return jobs
      .map((item) => {
        const locationParts = [item.location?.display_name].filter(Boolean);
        const remote =
          /remote|remoto|home office|work from home/i.test(locationParts.join(' ')) ||
          /remote|remoto|home office|work from home/i.test(item.title ?? '');

        let salary;
        if (item.salary_min || item.salary_max) {
          salary = `${item.salary_min ?? '?'}-${item.salary_max ?? '?'}`;
        }

        return {
          title: item.title,
          company: item.company?.display_name || 'Empresa não informada',
          location: locationParts.join(', ') || undefined,
          remote,
          salary,
          description: stripHtml(item.description),
          requirements: [],
          url: item.redirect_url || item.adref,
          source: 'adzuna',
          foundAt: item.created || new Date().toISOString(),
        };
      })
      .filter((job) => job.url && job.title);
  },
};
