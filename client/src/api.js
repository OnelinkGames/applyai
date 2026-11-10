const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Erro ${res.status}`);
  }
  return data;
}

export const api = {
  getJobs: () => request('/jobs'),
  getJob: (id) => request(`/jobs/${id}`),
  updateJobStatus: (id, status) =>
    request(`/jobs/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
  deleteJob: (id) => request(`/jobs/${id}`, { method: 'DELETE' }),
  addComment: (id, content) =>
    request(`/jobs/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }),
  generateCv: (id, language) =>
    request(`/jobs/${id}/generate-cv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language }),
    }),
  getCvs: (id) => request(`/jobs/${id}/cvs`),
  importJson: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/imports', { method: 'POST', body: form });
  },
  searchJobs: (filters) =>
    request('/jobs/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters ?? {}),
    }),
  getJobSearchDefaults: () => request('/jobs/search/defaults'),
  getImports: (page = 1, limit = 20) =>
    request(`/imports?page=${page}&limit=${limit}`),
  getAiUsage: () => request('/ai/usage'),
  getSettings: () => request('/settings'),
  getAiModels: () => request('/ai/models'),
  updateAiSettings: (data) =>
    request('/settings/ai', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  testAiConnection: (data) =>
    request('/settings/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateSettings: (data) =>
    request('/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  pickResumeFile: async () => {
    const res = await fetch(`${API_BASE}/settings/pick-resume-file`, { method: 'POST' });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erro ${res.status}`);
    }
    return data;
  },
  pickSearchQueryFile: async () => {
    const res = await fetch(`${API_BASE}/settings/pick-search-query-file`, { method: 'POST' });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erro ${res.status}`);
    }
    return data;
  },
  resetDatabase: () =>
    request('/database/reset', { method: 'POST' }),
};
