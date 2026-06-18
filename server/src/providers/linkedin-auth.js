const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';

let cachedToken = null;
let cachedExpiryMs = 0;

function readEnv(name) {
  return process.env[name]?.trim() || '';
}

export function isLinkedInConfigured() {
  if (readEnv('LINKEDIN_ACCESS_TOKEN')) return true;
  return Boolean(readEnv('LINKEDIN_CLIENT_ID') && readEnv('LINKEDIN_CLIENT_SECRET'));
}

export function getLinkedInApiVersion() {
  return readEnv('LINKEDIN_API_VERSION') || '202603';
}

export async function getLinkedInAccessToken() {
  const explicitToken = readEnv('LINKEDIN_ACCESS_TOKEN');
  if (explicitToken) return explicitToken;

  const clientId = readEnv('LINKEDIN_CLIENT_ID');
  const clientSecret = readEnv('LINKEDIN_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;

  if (cachedToken && Date.now() < cachedExpiryMs - 60_000) {
    return cachedToken;
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`LinkedIn OAuth falhou: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('LinkedIn OAuth retornou resposta sem access_token');
  }

  cachedToken = data.access_token;
  cachedExpiryMs = Date.now() + (Number(data.expires_in) || 1800) * 1000;
  return cachedToken;
}

export function resetLinkedInTokenCacheForTests() {
  cachedToken = null;
  cachedExpiryMs = 0;
}
