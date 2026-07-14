import { getStore } from '@netlify/blobs';

const MAX_HTML_CHARS = 80000;

async function fetchDom(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PrometAuditBot/1.0; +https://www.prometsource.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) throw new Error(`Page fetch failed: HTTP ${res.status}`);
    const html = await res.text();
    return html.length > MAX_HTML_CHARS ? html.slice(0, MAX_HTML_CHARS) + '\n<!-- TRUNCATED -->' : html;
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('Page took too long to respond (timed out)');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export default async (req: Request) => {
  const store = getStore('audits');
  let jobId = '';
  try {
    const body = await req.json();
    jobId = body.jobId;
    const { url, prompt } = body;

    const dom = await fetchDom(url);

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY as string,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{ role: 'user', content: `${prompt}\n\n=== ACTUAL HTML OF THE PAGE BELOW ===\n${dom}` }],
      }),
    });

    const data = await anthropicRes.json();
    await store.setJSON(jobId, { status: 'done', data });
  } catch (err: any) {
    if (jobId) await store.setJSON(jobId, { status: 'error', message: err.message || 'Audit failed' });
  }
};