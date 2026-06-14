import { buildSearchQuery, fetchJson, normalizeTags, stripHtml } from './http.js';

/** @type {import('./provider.interface.js').JobProvider} */
export const arbeitnowProvider = {
  id: 'arbeitnow',
  name: 'Arbeitnow',
  requiresAuth: false,

  isConfigured() {
    return true;
  },

  async search(filters) {
    const query = buildSearchQuery(filters);
    const params = new URLSearchParams();
    if (query) params.set('search', query);

    const url = `https://www.arbeitnow.com/api/job-board-api?${params.toString()}`;
    const data = await fetchJson(url);
    const jobs = Array.isArray(data?.data) ? data.data : [];

    return jobs
      .map((item) => {
        const tagsList = normalizeTags(item.tags);
        const remote = Boolean(item.remote);
        return {
          title: item.title,
          company: item.company_name || 'Empresa não informada',
          location: item.location || (remote ? 'Remoto' : 'Não informado'),
          remote,
          salary: undefined,
          description: stripHtml(item.description),
          requirements: tagsList,
          url: item.url,
          source: 'arbeitnow',
          foundAt: item.created_at
            ? new Date(item.created_at * 1000).toISOString()
            : new Date().toISOString(),
        };
      })
      .filter((job) => {
        if (!job.url || !job.title) return false;
        if (filters.remoteOnly && !job.remote) return false;
        return true;
      });
  },
};
