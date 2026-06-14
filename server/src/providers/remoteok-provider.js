import { fetchJson, normalizeTags, stripHtml } from './http.js';

/** @type {import('./provider.interface.js').JobProvider} */
export const remoteOkProvider = {
  id: 'remoteok',
  name: 'Remote OK',
  requiresAuth: false,

  isConfigured() {
    return true;
  },

  async search(filters) {
    const tagCandidates = [
      ...(filters.technologies ?? []),
      ...(filters.position ?? '').split(/\s+/),
    ]
      .map((value) => value.toLowerCase().replace(/[^a-z0-9.+#-]/gi, ''))
      .filter(Boolean);

    const tag = tagCandidates.find((value) => value.length > 2) ?? 'dev';
    const url = `https://remoteok.com/api?tags=${encodeURIComponent(tag)}`;

    const data = await fetchJson(url);
    if (!Array.isArray(data)) return [];

    return data
      .filter((item) => item && typeof item === 'object' && item.id && item.position)
      .map((item) => {
        const tagsList = normalizeTags(item.tags);
        const salary =
          item.salary && item.salary !== '0'
            ? String(item.salary)
            : item.salary_min || item.salary_max
              ? [item.salary_min, item.salary_max].filter(Boolean).join(' - ')
              : undefined;

        return {
          title: item.position,
          company: item.company || 'Empresa não informada',
          location: item.location || 'Remoto',
          remote: true,
          salary: salary || undefined,
          description: stripHtml(item.description),
          requirements: tagsList,
          url: item.url || item.apply_url,
          source: 'remoteok',
          foundAt: item.date || new Date().toISOString(),
        };
      })
      .filter((job) => job.url);
  },
};
