import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLinkedInSearchHtml } from '../src/providers/linkedin-parse.js';
import { linkedinProvider } from '../src/providers/linkedin-provider.js';
import {
  isLinkedInConfigured,
  resetLinkedInTokenCacheForTests,
} from '../src/providers/linkedin-auth.js';

const sampleHtml = `
<li>
  <div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:12345">
    <a class="base-card__full-link" href="https://br.linkedin.com/jobs/view/react-developer-at-acme-12345?position=1"></a>
    <div class="base-search-card__info">
      <h3 class="base-search-card__title">React Developer</h3>
      <h4 class="base-search-card__subtitle">Acme Corp</h4>
      <span class="job-search-card__location">São Paulo, Brazil (Remote)</span>
    </div>
  </div>
</li>
`;

test('parseLinkedInSearchHtml extracts job cards', () => {
  const jobs = parseLinkedInSearchHtml(sampleHtml);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'React Developer');
  assert.equal(jobs[0].company, 'Acme Corp');
  assert.equal(jobs[0].location, 'São Paulo, Brazil (Remote)');
  assert.equal(jobs[0].source, 'linkedin');
  assert.equal(jobs[0].remote, true);
  assert.match(jobs[0].url, /12345/);
});

test('linkedinProvider is skipped when credentials are missing', () => {
  const originalToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const originalId = process.env.LINKEDIN_CLIENT_ID;
  const originalSecret = process.env.LINKEDIN_CLIENT_SECRET;

  delete process.env.LINKEDIN_ACCESS_TOKEN;
  delete process.env.LINKEDIN_CLIENT_ID;
  delete process.env.LINKEDIN_CLIENT_SECRET;
  resetLinkedInTokenCacheForTests();

  assert.equal(isLinkedInConfigured(), false);
  assert.equal(linkedinProvider.isConfigured(), false);
  assert.equal(linkedinProvider.requiresAuth, true);

  if (originalToken) process.env.LINKEDIN_ACCESS_TOKEN = originalToken;
  if (originalId) process.env.LINKEDIN_CLIENT_ID = originalId;
  if (originalSecret) process.env.LINKEDIN_CLIENT_SECRET = originalSecret;
});

test('linkedinProvider.search returns empty array without credentials', async () => {
  const originalToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const originalId = process.env.LINKEDIN_CLIENT_ID;
  const originalSecret = process.env.LINKEDIN_CLIENT_SECRET;

  delete process.env.LINKEDIN_ACCESS_TOKEN;
  delete process.env.LINKEDIN_CLIENT_ID;
  delete process.env.LINKEDIN_CLIENT_SECRET;
  resetLinkedInTokenCacheForTests();

  const jobs = await linkedinProvider.search({ position: 'developer' });
  assert.deepEqual(jobs, []);

  if (originalToken) process.env.LINKEDIN_ACCESS_TOKEN = originalToken;
  if (originalId) process.env.LINKEDIN_CLIENT_ID = originalId;
  if (originalSecret) process.env.LINKEDIN_CLIENT_SECRET = originalSecret;
});
