function stripTags(value) {
  if (!value) return '';
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x26;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value) {
  return stripTags(value);
}

/**
 * Parses HTML returned by LinkedIn Jobs Search (seeMoreJobPostings).
 * @param {string} html
 * @returns {import('./provider.interface.js').Job[]}
 */
export function parseLinkedInSearchHtml(html) {
  if (!html?.trim()) return [];

  const jobs = [];
  const cardPattern =
    /<div class="base-card[^"]*job-search-card"[\s\S]*?(?=<div class="base-card[^"]*job-search-card"|$)/gi;
  const cards = html.match(cardPattern) ?? [];

  for (const card of cards) {
    const urlMatch = card.match(
      /href="(https:\/\/[^"]+linkedin\.com\/jobs\/view\/[^"?]+)/
    );
    const titleMatch = card.match(
      /<h3 class="base-search-card__title">\s*([\s\S]*?)\s*<\/h3>/
    );
    const companyMatch = card.match(
      /<h4 class="base-search-card__subtitle">\s*([\s\S]*?)\s*<\/h4>/
    );
    const locationMatch = card.match(
      /<span class="job-search-card__location">\s*([\s\S]*?)\s*<\/span>/
    );

    const title = decodeHtmlEntities(titleMatch?.[1]);
    const company = decodeHtmlEntities(companyMatch?.[1]);
    const location = decodeHtmlEntities(locationMatch?.[1]);
    const url = urlMatch?.[1]?.replace(/&amp;/g, '&');

    if (!title || !url) continue;

    const remote = /remote|remoto|home office|work from home|telecommute/i.test(
      `${location} ${title}`
    );

    jobs.push({
      title,
      company: company || 'Empresa não informada',
      location: location || undefined,
      remote,
      salary: undefined,
      description: '',
      requirements: [],
      url,
      source: 'linkedin',
      foundAt: new Date().toISOString(),
    });
  }

  return jobs;
}

export { stripTags as stripLinkedInHtml };
