import { buildSearchQuery, fetchJson, stripHtml } from './http.js';

/** @type {import('./provider.interface.js').JobProvider} */
export const jobicyProvider = {
  id: 'jobicy',
  name: 'Jobicy',
  requiresAuth: false,

  isConfigured() {
    return true;
  },

  async search(filters) {
    const tagCandidates = [
      ...(filters.technologies ?? []),
      ...(filters.position ?? '').split(/\s+/),
    ]
      .map((value) => value.toLowerCase().replace(/[^a-z0-9]/gi, ''))
      .filter((value) => value.length > 2);

    const params = new URLSearchParams({ count: '50' });
    if (tagCandidates[0]) params.set('tag', tagCandidates[0]);

    const location = filters.location?.toLowerCase() ?? '';
    if (location.includes('brasil') || location.includes('brazil')) {
      params.set('geo', 'brazil');
    } else if (tagCandidates.length === 0) {
      params.set('geo', 'anywhere');
    }

    const url = `https://jobicy.com/api/v2/remote-jobs?${params.toString()}`;
    const data = await fetchJson(url);
    const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

    return jobs
      .map((item) => {
        const industries = Array.isArray(item.jobIndustry) ? item.jobIndustry : [];
        const types = Array.isArray(item.jobType) ? item.jobType : [];
        const requirements = [...industries, ...types].filter(Boolean);

        let salary;
        if (item.salaryMin || item.salaryMax) {
          const currency = item.salaryCurrency || 'USD';
          const period = item.salaryPeriod === 'yearly' ? 'ano' : 'mês';
          salary = `${currency} ${item.salaryMin ?? '?'}-${item.salaryMax ?? '?'} / ${period}`;
        }

        return {
          title: item.jobTitle,
          company: item.companyName || 'Empresa não informada',
          location: item.jobGeo || 'Remoto',
          remote: true,
          salary,
          description: stripHtml(item.jobDescription || item.jobExcerpt),
          requirements,
          url: item.url,
          source: 'jobicy',
          foundAt: item.pubDate || new Date().toISOString(),
        };
      })
      .filter((job) => job.url && job.title);
  },
};
