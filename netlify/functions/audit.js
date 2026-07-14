const MAX_HTML_CHARS = 50000; // caps token cost per page

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

async function fetchDom(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000); // 8s cap
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; PrometAuditBot/1.0; +https://www.prometsource.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) throw new Error(`Page fetch failed: HTTP ${res.status}`);
    const html = await res.text();
    return html.length > MAX_HTML_CHARS
      ? html.slice(0, MAX_HTML_CHARS) + '\n<!-- TRUNCATED -->'
      : html;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Page took too long to respond (timed out after 8s)');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: { message: 'Method not allowed' } }, 405);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: { message: 'Server missing ANTHROPIC_API_KEY' } }, 500);

  try {
    const { url, prompt } = JSON.parse(await req.text());
    if (!url || !prompt) return json({ error: { message: 'Missing url or prompt' } }, 400);

    const dom = await fetchDom(url);

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // If this string errors, grab a current one from docs.claude.com
        model: 'claude-sonnet-4-6',
        max_tokens: 6000,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\n=== ACTUAL HTML OF THE PAGE BELOW ===\n${dom}`,
          },
        ],
      }),
    });

    const data = await anthropicRes.json();
    return json(data, anthropicRes.status); // forwards 429 so your retry logic still fires
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: { message: msg } }, 502);
  }
};