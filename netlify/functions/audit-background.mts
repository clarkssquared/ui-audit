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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

async function fetchAiSignals(pageUrl: string): Promise<string> {
  const origin = new URL(pageUrl).origin;
  const grab = async (path: string, label: string): Promise<string> => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${origin}${path}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PrometAuditBot/1.0)' },
      });
      clearTimeout(timer);
      if (!res.ok) return `=== ${label} ===\nNOT FOUND (HTTP ${res.status})`;
      const text = await res.text();
      return `=== ${label} ===\n${text.slice(0, 4000)}`;
    } catch {
      return `=== ${label} ===\nCOULD NOT FETCH`;
    }
  };
  const [robots, llms] = await Promise.all([
    grab('/robots.txt', 'ROBOTS.TXT'),
    grab('/llms.txt', 'LLMS.TXT'),
  ]);
  return `${robots}\n\n${llms}`;
}

async function fetchLighthouse(url: string): Promise<any> {
  try {
    const key = process.env.PSI_API_KEY;
    if (!key) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${key}&category=performance&category=accessibility&category=seo&category=best-practices`;
    const res = await fetch(api, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    const cats = json?.lighthouseResult?.categories;
    if (!cats) return null;
    return {
      performance:   Math.round((cats['performance']?.score ?? 0) * 100),
      accessibility: Math.round((cats['accessibility']?.score ?? 0) * 100),
      seo:           Math.round((cats['seo']?.score ?? 0) * 100),
      bestPractices: Math.round((cats['best-practices']?.score ?? 0) * 100),
    };
  } catch {
    return null;
  }
}

export default async (req: Request) => {
  const store = getStore('audits');
  let jobId = '';
  try {
    const body = await req.json();
    jobId = body.jobId;
    const { url, prompt, auditType } = body;

    const [dom, lighthouse] = await Promise.all([
      fetchDom(url),
      auditType === 'full' ? fetchLighthouse(url) : Promise.resolve(null),
    ]);
    const aiSignals = auditType === 'aiReadiness' ? await fetchAiSignals(url) : '';

    const lighthouseBlock = lighthouse
      ? `\n\n=== GOOGLE LIGHTHOUSE MEASURED SCORES (0-100) ===\nPerformance: ${lighthouse.performance}\nAccessibility: ${lighthouse.accessibility}\nSEO: ${lighthouse.seo}\nBest Practices: ${lighthouse.bestPractices}\nThese are real measured scores from Google's Lighthouse tool. Use them as evidence in your Performance Indicators, Accessibility, and SEO findings. Reference them explicitly where relevant.`
      : '';

    let data = await callClaude(prompt, dom, '', aiSignals + lighthouseBlock);

    if (!hasJson(data)) {
      data = await callClaude(
        prompt, dom,
        '\n\nIMPORTANT: Your entire response must be ONLY the raw JSON object. Start with { and end with }. No other text.',
        aiSignals + lighthouseBlock
      );
    }

    await store.setJSON(jobId, { status: 'done', data, lighthouse });

  } catch (err: any) {
    if (jobId) await store.setJSON(jobId, { status: 'error', message: err.message || 'Audit failed' });
  }
};

// ---- helpers (hoisted, so they can live at the bottom) ----

async function callClaude(prompt: string, dom: string, retryHint = '', aiSignals = '') {
  const extra = aiSignals ? `\n\n=== AI CRAWLER SIGNAL FILES ===\n${aiSignals}` : '';
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
      messages: [{
        role: 'user',
        content: `${prompt}${retryHint}\n\n=== ACTUAL HTML OF THE PAGE BELOW ===\n${dom}${extra}`,
      }],
    }),
  });
  return anthropicRes.json();
}

function hasJson(data: any): boolean {
  const text = (data?.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text || '')
    .join('\n');
  return text.includes('{') && text.includes('}');
}