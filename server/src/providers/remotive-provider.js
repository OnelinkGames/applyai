import { buildSearchQuery, fetchJson, normalizeTags, stripHtml } from './http.js';

/** @type {import('./provider.interface.js').JobProvider} */
export const remotiveProvider = {
  id: 'remotive',
  name: 'Remotive',
  requiresAuth: false,

  isConfigured() {
    return true;
  },

  async search(filters) {
    const query = buildSearchQuery(filters);
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    params.set('limit', '50');

    const url = `https://remotive.com/api/remote-jobs?${params.toString()}`;
    const data = await fetchJson(url);
    const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

    return jobs
      .map((item) => {
        const tagsList = normalizeTags(item.tags);
        return {
          title: item.title,
          company: item.company_name || 'Empresa não informada',
          location: item.candidate_required_location || 'Remoto',
          remote: true,
          salary: item.salary || undefined,
          description: stripHtml(item.description),
          requirements: tagsList,
          url: item.url,
          source: 'remotive',
          foundAt: item.publication_date || new Date().toISOString(),
        };
      })
      .filter((job) => job.url && job.title);
  },
};
