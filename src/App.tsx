import { useState, useRef, useEffect } from 'react';
import { AlertCircle, Download, Loader2, Search, ChevronDown, ChevronUp, Plus, Trash2, CheckCircle, AlertTriangle, Info, ArrowDown } from 'lucide-react';

const NAVY   = '#1a2238';
const ORANGE = '#c95a1f';
const DARK   = '#111827';
const LIGHT  = '#f5f6f8';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Issue {
  title: string;
  severity: string;
  wcagCriterion: string;
  description: string;
  recommendation: string;
  prometSourceSolution: string;
  visualLocation: string;
  elementHtml: string;
  cssSelector: string;
  devtoolsSnippet: string;
}

interface Category {
  name: string;
  score: number;
  issues: Issue[];
}

interface AuditResult {
  overallScore: number;
  summary: string;
  categories: Category[];
}

interface PageResult {
  url: string;
  result: AuditResult | null;
  error: string | null;
}

interface Progress {
  current: number;
  total: number;
  currentUrl: string;
  phase: string;
}

interface SevStyle {
  color: string;
  bg: string;
  border: string;
  icon: JSX.Element | null;
  label: string;
}

// ── Severity map ──────────────────────────────────────────────────────────────
const SEV: Record<string, SevStyle> = {
  Critical: { color:'#b91c1c', bg:'#fef2f2', border:'#ef4444', icon:<AlertCircle size={14} aria-hidden="true"/>, label:'Critical severity' },
  High:     { color:'#92400e', bg:'#fff7ed', border:'#c95a1f', icon:<AlertTriangle size={14} aria-hidden="true"/>, label:'High severity' },
  Medium:   { color:'#713f12', bg:'#fefce8', border:'#ca8a04', icon:<Info size={14} aria-hidden="true"/>, label:'Medium severity' },
  Low:      { color:'#14532d', bg:'#f0fdf4', border:'#16a34a', icon:<ArrowDown size={14} aria-hidden="true"/>, label:'Low severity' },
};

const sevStyle = (s: string): SevStyle =>
  SEV[s] || { color:'#374151', bg:'#f3f4f6', border:'#9ca3af', icon:null, label: s+' severity' };
const scoreColor = (s: number) => s >= 80 ? '#15803d' : s >= 60 ? '#a16207' : '#b91c1c';
const scoreLabel = (s: number) => s >= 80 ? 'Good' : s >= 60 ? 'Needs improvement' : 'Critical';

const focusStyle = `
  *:focus-visible {
    outline: 3px solid #c95a1f !important;
    outline-offset: 3px !important;
    border-radius: 4px;
  }
  button:hover:not(:disabled), a:hover {
    outline: 2px solid #c95a1f !important;
    outline-offset: 2px !important;
    filter: brightness(1.08);
  }
  button:focus-visible, a:focus-visible {
    outline: 3px solid #c95a1f !important;
    outline-offset: 3px !important;
    border-radius: 4px;
    box-shadow: 0 0 0 6px rgba(201,90,31,0.2) !important;
  }
  button:hover:not(:disabled):not(:focus-visible) {
    box-shadow: 0 0 0 4px rgba(201,90,31,0.15) !important;
  }
  button:active:not(:disabled) {
    transform: scale(0.98);
  }
  input:focus-visible {
    outline: none !important;
    border-color: #c95a1f !important;
    box-shadow: 0 0 0 3px rgba(201,90,31,0.25) !important;
  }
  label:has(input[type="radio"]):hover {
    border-color: #c95a1f !important;
    background: #fff7f3 !important;
  }
  label:has(input[type="radio"]:focus-visible) {
    outline: 3px solid #c95a1f !important;
    outline-offset: 2px !important;
    border-radius: 10px;
    box-shadow: 0 0 0 6px rgba(201,90,31,0.2) !important;
  }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
  .sr-only { position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0; }
`;

// ── Robust JSON extractor ─────────────────────────────────────────────────────
const extractJSON = (raw: string): AuditResult => {
  const text = raw.replace(/```json/gi,'').replace(/```/g,'').trim();
  let depth = 0, start = -1, end = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { if (!depth) start = i; depth++; }
    else if (text[i] === '}') { depth--; if (!depth && start !== -1) { end = i; break; } }
  }
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  const json = text.substring(start, end + 1);
  const tries: Array<() => AuditResult> = [
    () => JSON.parse(json),
    () => JSON.parse(json.replace(/,(\s*[}\]])/g,'$1')),
    () => JSON.parse(json.replace(/[\x00-\x1F\x7F]/g,' ').replace(/,(\s*[}\]])/g,'$1')),
  ];
  for (const t of tries) { try { return t(); } catch { /* try next */ } }
  throw new Error('JSON repair failed');
};

// ── Score ring ────────────────────────────────────────────────────────────────
interface ScoreRingProps { score: number; size?: number; id: string; }
const ScoreRing = ({ score, size = 80, id }: ScoreRingProps) => {
  const r = 30, c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  const col = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" role="img" aria-labelledby={id+'-d'} focusable="false">
      <title id={id+'-d'}>Score {score} out of 100 — {scoreLabel(score)}</title>
      <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="7"/>
      <circle cx="40" cy="40" r={r} fill="none" stroke={col} strokeWidth="7"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round" transform="rotate(-90 40 40)"
        style={{transition:'stroke-dasharray .6s ease'}}/>
      <text x="40" y="45" textAnchor="middle" fontSize="17" fontWeight="700" fill={col} aria-hidden="true">{score}</text>
    </svg>
  );
};

// ── Category card ─────────────────────────────────────────────────────────────
interface CategoryCardProps { cat: Category; ci: number; pi: number; }
const CategoryCard = ({ cat, ci, pi }: CategoryCardProps) => {
  const [open, setOpen] = useState(true);
  const col = scoreColor(cat.score);
  const hId = `c-${pi}-${ci}-h`, rId = `c-${pi}-${ci}-r`;
  return (
    <div style={{background:'#fff',borderRadius:10,border:'1px solid #d1d5db',marginBottom:12,overflow:'hidden'}}>
      <h4 style={{margin:0}}>
        <button id={hId} onClick={()=>setOpen(o=>!o)} aria-expanded={open} aria-controls={rId}
          style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
            padding:'16px 20px',background:'none',border:'none',cursor:'pointer',textAlign:'left',font:'inherit'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:44,height:44,borderRadius:'50%',border:`3px solid ${col}`,display:'flex',
              alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,color:col}} aria-hidden="true">{cat.score}</div>
            <div style={{textAlign:'left'}}>
              <span style={{fontWeight:700,fontSize:15,color:DARK}}>{cat.name}</span>
              <span style={{display:'block',fontSize:12,color:'#6b7280',marginTop:1}}>
                {cat.issues?.length||0} finding{cat.issues?.length!==1?'s':''} · {cat.score}/100 ({scoreLabel(cat.score)})
              </span>
            </div>
          </div>
          <span aria-hidden="true" style={{color:'#6b7280',flexShrink:0}}>{open?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</span>
        </button>
      </h4>
      <div id={rId} role="region" aria-labelledby={hId} hidden={!open}>
        <div style={{padding:'0 20px 20px'}}>
          {cat.issues?.length > 0 ? cat.issues.map((iss: Issue, i: number) => {
            const sev = sevStyle(iss.severity);
            const iId = `iss-${pi}-${ci}-${i}`;
            return (
              <article key={i} aria-labelledby={iId}
                style={{border:'1px solid #d1d5db',borderLeft:`4px solid ${sev.border}`,borderRadius:8,padding:'14px 16px',marginTop:10}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:8}}>
                  <h5 id={iId} style={{fontWeight:600,fontSize:14,color:DARK,margin:0}}>{iss.title}</h5>
                  <span style={{display:'flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:20,
                    fontSize:12,fontWeight:600,background:sev.bg,color:sev.color,whiteSpace:'nowrap',flexShrink:0}}>
                    <span aria-hidden="true">{sev.icon}</span>
                    <span>{iss.severity}</span>
                    <span className="sr-only"> — {sev.label}</span>
                  </span>
                </div>
                {(iss.cssSelector||iss.elementHtml||iss.visualLocation||iss.devtoolsSnippet) && (
                  <section aria-label="Element location"
                    style={{background:'#0f172a',borderRadius:8,padding:'12px 14px',marginBottom:10}}>
                    <p style={{fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.08em',margin:'0 0 8px'}}>📍 Element Location</p>
                    {iss.visualLocation&&<div style={{marginBottom:6}}><p style={{fontSize:11,color:'#64748b',fontWeight:700,margin:'0 0 2px',textTransform:'uppercase'}}>Visual</p><p style={{fontSize:12,color:'#e2e8f0',margin:0}}>{iss.visualLocation}</p></div>}
                    {iss.elementHtml&&<div style={{marginBottom:6}}><p style={{fontSize:11,color:'#64748b',fontWeight:700,margin:'0 0 2px',textTransform:'uppercase'}}>HTML</p><code style={{fontFamily:'monospace',fontSize:12,color:'#86efac',wordBreak:'break-all',whiteSpace:'pre-wrap',display:'block'}}>{iss.elementHtml}</code></div>}
                    {iss.cssSelector&&<div style={{marginBottom:6}}><p style={{fontSize:11,color:'#64748b',fontWeight:700,margin:'0 0 2px',textTransform:'uppercase'}}>CSS Selector</p><code style={{fontFamily:'monospace',fontSize:12,color:'#93c5fd',wordBreak:'break-all',display:'block'}}>{iss.cssSelector}</code></div>}
                    {iss.devtoolsSnippet&&<div><p style={{fontSize:11,color:'#64748b',fontWeight:700,margin:'0 0 2px',textTransform:'uppercase'}}>DevTools</p><code style={{fontFamily:'monospace',fontSize:12,color:'#f9a8d4',wordBreak:'break-all',whiteSpace:'pre-wrap',display:'block'}}>{iss.devtoolsSnippet}</code></div>}
                  </section>
                )}
                {iss.wcagCriterion&&iss.wcagCriterion!=='N/A'&&(
                  <p style={{fontSize:12,color:'#4b5563',margin:'0 0 8px',fontWeight:500}}><strong>WCAG:</strong> {iss.wcagCriterion}</p>
                )}
                <p style={{fontSize:13,color:'#374151',margin:'0 0 8px',lineHeight:1.6}}>{iss.description}</p>
                <div role="note" aria-label="Recommendation" style={{background:'#eff6ff',borderLeft:'3px solid #2563eb',borderRadius:'0 6px 6px 0',padding:'10px 12px',marginBottom:8}}>
                  <p style={{fontSize:12,fontWeight:700,color:'#1d4ed8',margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'.05em'}}>Recommendation</p>
                  <p style={{fontSize:13,color:'#1e3a5f',margin:0,lineHeight:1.6}}>{iss.recommendation}</p>
                </div>
                {iss.prometSourceSolution&&(
                  <div role="note" aria-label="Promet Source solution" style={{background:'#fff7f3',borderLeft:`3px solid ${ORANGE}`,borderRadius:'0 6px 6px 0',padding:'10px 12px'}}>
                    <p style={{fontSize:12,fontWeight:700,color:ORANGE,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'.05em'}}>✦ Promet Source Solution</p>
                    <p style={{fontSize:13,color:'#7c2d12',margin:0,lineHeight:1.6}}>{iss.prometSourceSolution}</p>
                  </div>
                )}
              </article>
            );
          }) : (
            <p style={{textAlign:'center',padding:'20px 0',color:'#15803d',fontWeight:600,fontSize:13}}>
              <CheckCircle size={16} style={{verticalAlign:'middle',marginRight:6}} aria-hidden="true"/>No issues found
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Page result card ──────────────────────────────────────────────────────────
interface PageResultCardProps { pr: PageResult; index: number; }
const PageResultCard = ({ pr, index }: PageResultCardProps) => {
  const [open, setOpen] = useState(index === 0);
  const hId = `p-${index}-h`, rId = `p-${index}-r`;
  const counts = (() => {
    const c: Record<string, number> = {Critical:0,High:0,Medium:0,Low:0,total:0};
    pr.result?.categories?.forEach((cat: Category) =>
      cat.issues?.forEach((iss: Issue) => { c.total++; if (c[iss.severity] !== undefined) c[iss.severity]++; })
    );
    return c;
  })();
  return (
    <section aria-labelledby={hId} style={{background:'#fff',borderRadius:14,boxShadow:'0 2px 16px rgba(0,0,0,.08)',marginBottom:20,overflow:'hidden'}}>
      <h3 style={{margin:0}}>
        <button id={hId} onClick={()=>setOpen(o=>!o)} aria-expanded={open} aria-controls={rId}
          style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
            padding:'20px 28px',background:'none',border:'none',cursor:'pointer',textAlign:'left',font:'inherit',
            borderBottom:open?'1px solid #f3f4f6':'none'}}>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <ScoreRing score={pr.result?.overallScore||0} size={64} id={`ring-${index}`}/>
            <div style={{textAlign:'left'}}>
              <span style={{fontSize:12,fontWeight:700,color:ORANGE,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:4}}>Page {index+1}</span>
              <span style={{fontWeight:700,fontSize:15,color:DARK,display:'block',marginBottom:4,wordBreak:'break-all'}}>{pr.url}</span>
              <span style={{display:'flex',gap:10,flexWrap:'wrap',fontSize:12}}>
                {(['Critical','High','Medium','Low'] as const).map(s =>
                  counts[s] > 0 && <span key={s} style={{fontWeight:600,color:sevStyle(s).color}}>{counts[s]} {s}</span>
                )}
                <span style={{color:'#6b7280'}}>{counts.total} total</span>
              </span>
            </div>
          </div>
          <span aria-hidden="true" style={{color:'#6b7280',flexShrink:0}}>{open?<ChevronUp size={20}/>:<ChevronDown size={20}/>}</span>
        </button>
      </h3>
      <div id={rId} role="region" aria-labelledby={hId} hidden={!open}>
        <div style={{padding:'20px 28px'}}>
          <p style={{color:'#4b5563',fontSize:14,marginBottom:20,lineHeight:1.7}}>{pr.result?.summary}</p>
          <div role="list" aria-label="Category scores" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:20}}>
            {pr.result?.categories?.map((cat: Category, i: number) => (
              <div key={i} role="listitem" style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:LIGHT,borderRadius:8,padding:'8px 12px'}}>
                <span style={{fontSize:13,fontWeight:600,color:'#374151'}}>{cat.name}</span>
                <span style={{fontSize:13,fontWeight:700,color:scoreColor(cat.score)}}>{cat.score}/100 <span className="sr-only">({scoreLabel(cat.score)})</span></span>
              </div>
            ))}
          </div>
          {pr.result?.categories?.map((cat: Category, i: number) => <CategoryCard key={i} cat={cat} ci={i} pi={index}/>)}
        </div>
      </div>
    </section>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function UIAuditTool() {
  const [urls, setUrls]               = useState<string[]>(['']);
  const [auditType, setAuditType]     = useState<string>('full');
  const [loading, setLoading]         = useState<boolean>(false);
  const [pageResults, setPageResults] = useState<PageResult[]>([]);
  const [progress, setProgress]       = useState<Progress>({current:0,total:0,currentUrl:'',phase:''});
  const [error, setError]             = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [showCsvText, setShowCsvText] = useState<boolean>(false);
  const [csvData, setCsvData]         = useState<string>('');
  const [statusMsg, setStatusMsg]     = useState<string>('');
  const abortRef   = useRef<boolean>(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const urlRefs    = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (statusMsg) {
      const t = setTimeout(() => setStatusMsg(''), 6000);
      return () => clearTimeout(t);
    }
  }, [statusMsg]);

  const addUrl = () => {
    if (urls.length >= 7) return;
    setUrls(u => [...u, '']);
    setTimeout(() => urlRefs.current[urls.length]?.focus(), 50);
  };
  const removeUrl = (i: number) => { setUrls(u => u.filter((_,idx) => idx !== i)); setStatusMsg(`Page ${i+1} removed.`); };
  const updateUrl = (i: number, v: string) => setUrls(u => u.map((x, idx) => idx === i ? v : x));

  const catList: Record<string, string> = {
    full:          'Accessibility (WCAG 2.2), Design Consistency, User Experience, Visual Hierarchy, Mobile Responsiveness, SEO Basics, Performance Indicators',
    accessibility: 'Perceivable, Operable, Understandable, Robust, SEO Basics, Performance Indicators',
    migration:     'Content Inventory, File Assets, Technical Architecture, Data Structures, Integrations, SEO Basics, Performance Indicators',
    technical:     'SEO Fundamentals, Performance Analysis, Code Quality, Security Basics, Best Practices',
  };

  const buildPrompt = (url: string) => `You are an expert web auditor. Search for and analyze this page: ${url}

Use the web_search tool to look up the page and gather as much detail as possible about its HTML structure, accessibility issues, SEO, and performance.

After your research, return a single JSON object. Return the JSON IMMEDIATELY after your research — do not add any explanation, preamble, or markdown around it. Start your final response directly with the { character.

JSON structure required:
{
  "overallScore": <integer 0-100>,
  "summary": "<2 sentence plain English summary>",
  "categories": [
    {
      "name": "<category name>",
      "score": <integer 0-100>,
      "issues": [
        {
          "title": "<short title>",
          "severity": "<Critical|High|Medium|Low>",
          "wcagCriterion": "<e.g. 1.1.1 or N/A>",
          "description": "<1-2 plain English sentences>",
          "recommendation": "<1-2 plain English sentences>",
          "prometSourceSolution": "<1-2 plain English sentences>",
          "visualLocation": "<where on page e.g. Top navigation, second link>",
          "elementHtml": "<HTML snippet if known, else empty string>",
          "cssSelector": "<CSS selector if known, else empty string>",
          "devtoolsSnippet": "<console snippet if known, else empty string>"
        }
      ]
    }
  ]
}

Categories to audit: ${catList[auditType]}

STRICT RULES:
- Your FINAL response must be ONLY the raw JSON. No markdown. No explanation. No text before or after.
- Start your response with { and end with }
- Max 4 issues per category
- Plain language throughout (simple words, active voice, max 15 words per sentence)
- Do not truncate — the JSON must be complete and valid`;

  const callAPI = async (messages: object[]) => {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        messages,
        tools: [{ type:'web_search_20250305', name:'web_search' }]
      })
    });
    if (!resp.ok) {
      if (resp.status === 429) throw new Error('RATE_LIMIT');
      throw new Error(`HTTP ${resp.status}`);
    }
    return resp.json();
  };

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  const callAPIWithRetry = async (messages: object[], retries = 4): Promise<any> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await callAPI(messages);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('RATE_LIMIT') && attempt < retries) {
          const wait = Math.pow(2, attempt + 2) * 1000;
          setStatusMsg(`Rate limit hit — waiting ${wait/1000}s before retrying…`);
          await sleep(wait);
        } else {
          throw err;
        }
      }
    }
  };

  const auditPage = async (url: string): Promise<AuditResult> => {
    const userMsg = { role:'user', content: buildPrompt(url) };
    let messages: object[] = [userMsg];
    let attempts = 0;
    const MAX_TURNS = 6;

    while (attempts < MAX_TURNS) {
      attempts++;
      const data = await callAPIWithRetry(messages);

      if (data.error) {
        if (data.error.type === 'exceeded_limit') throw new Error('RATE_LIMIT');
        throw new Error(`API: ${data.error.message}`);
      }

      const content: Array<{type: string; text?: string; id?: string; input?: unknown}> = data.content || [];
      const textBlocks = content.filter(b => b.type === 'text').map(b => b.text || '');
      const fullText = textBlocks.join('\n');

      if (fullText.trim()) {
        try {
          const result = extractJSON(fullText);
          if (result.overallScore !== undefined && result.categories) return result;
        } catch { /* continue */ }
      }

      if (data.stop_reason === 'end_turn') {
        messages = [
          ...messages,
          { role:'assistant', content },
          { role:'user', content: 'Now provide ONLY the raw JSON audit report. Start immediately with { and nothing else.' }
        ];
        continue;
      }

      if (data.stop_reason === 'tool_use') {
        const toolUseBlocks = content.filter(b => b.type === 'tool_use');
        const toolResults = toolUseBlocks.map(b => ({
          type: 'tool_result',
          tool_use_id: b.id,
          content: `Search completed for: ${JSON.stringify(b.input)}. Now generate the complete JSON audit report.`
        }));
        messages = [
          ...messages,
          { role:'assistant', content },
          { role:'user', content: toolResults }
        ];
        continue;
      }

      messages = [
        ...messages,
        { role:'assistant', content },
        { role:'user', content: 'Provide the JSON audit report now. Start with { and end with }. No other text.' }
      ];
    }

    throw new Error(`Could not get valid JSON after ${MAX_TURNS} attempts`);
  };

  const runAudit = async () => {
    const validUrls = urls.map(u => u.trim()).filter(Boolean);
    if (!validUrls.length) { setError('Please enter at least one URL.'); return; }
    const bad = validUrls.find(u => !u.startsWith('http'));
    if (bad) { setError(`"${bad}" must start with http:// or https://`); return; }

    setLoading(true); setError(''); setPageResults([]); abortRef.current = false;
    setProgress({current:0, total:validUrls.length, currentUrl:'', phase:''});
    setStatusMsg(`Audit started for ${validUrls.length} page${validUrls.length !== 1 ? 's' : ''}.`);

    const results: PageResult[] = [];
    for (let i = 0; i < validUrls.length; i++) {
      if (abortRef.current) break;
      const url = validUrls[i];
      setProgress({current:i+1, total:validUrls.length, currentUrl:url, phase:'Searching and analyzing…'});
      setStatusMsg(`Analyzing page ${i+1} of ${validUrls.length}.`);
      try {
        const result = await auditPage(url);
        results.push({url, result, error:null});
        setStatusMsg(`Page ${i+1} complete. Score: ${result.overallScore}/100.`);
      } catch (err) {
        const msg = (err instanceof Error ? err.message : String(err)).includes('RATE_LIMIT')
          ? 'Rate limit reached. Please wait 10–15 minutes.'
          : (err instanceof Error ? err.message : String(err));
        results.push({url, result:null, error:msg});
        setStatusMsg(`Page ${i+1} failed: ${msg}`);
      }
      setPageResults([...results]);
      if (i < validUrls.length - 1) {
        const delay = Math.min(4000 + i * 1000, 10000);
        setStatusMsg(`Cooling down before next page (${Math.round(delay/1000)}s)…`);
        await sleep(delay);
      }
    }
    setLoading(false);
    setStatusMsg(`Audit complete. ${results.filter(r => r.result).length} of ${validUrls.length} analyzed.`);
    setTimeout(() => resultsRef.current?.focus(), 200);
  };

  const stopAudit = () => { abortRef.current = true; setLoading(false); setStatusMsg('Audit stopped.'); };

  const summary = pageResults.length > 0 ? (() => {
    const ok = pageResults.filter(p => p.result);
    const avg = ok.length ? Math.round(ok.reduce((a, p) => a + (p.result?.overallScore || 0), 0) / ok.length) : 0;
    const counts: Record<string, number> = {Critical:0, High:0, Medium:0, Low:0, total:0};
    ok.forEach(p => p.result?.categories?.forEach((c: Category) =>
      c.issues?.forEach((iss: Issue) => { counts.total++; if (counts[iss.severity] !== undefined) counts[iss.severity]++; })
    ));
    return {avg, counts, ok:ok.length, failed:pageResults.filter(p => p.error).length};
  })() : null;

  const exportCSV = () => {
    const rows: string[][] = [];
    rows.push(['PROMET SOURCE – MULTI-PAGE AUDIT REPORT'],[''],['Date',new Date().toLocaleString()],['Type',auditType],['Pages',String(pageResults.length)],[]);
    if (summary) rows.push(['SUMMARY'],['Avg Score',`${summary.avg}/100`],['Total',String(summary.counts.total)],['Critical',String(summary.counts.Critical)],['High',String(summary.counts.High)],['Medium',String(summary.counts.Medium)],['Low',String(summary.counts.Low)],[]);
    pageResults.forEach((pr, pi) => {
      rows.push([`PAGE ${pi+1}: ${pr.url}`]);
      if (pr.error) { rows.push(['ERROR', pr.error], []); return; }
      rows.push([`Score: ${pr.result?.overallScore}/100`],[pr.result?.summary||''],[]);
      pr.result?.categories?.forEach((c: Category) => {
        rows.push([`${c.name} (${c.score}/100)`],['#','Title','Visual Location','HTML Element','CSS Selector','DevTools','Severity','WCAG','Description','Recommendation','Promet Solution']);
        c.issues?.forEach((iss: Issue, i: number) => rows.push([String(i+1),iss.title||'',iss.visualLocation||'',iss.elementHtml||'',iss.cssSelector||'',iss.devtoolsSnippet||'',iss.severity||'',iss.wcagCriterion||'N/A',iss.description||'',iss.recommendation||'',iss.prometSourceSolution||'']));
        rows.push([]);
      });
      rows.push([]);
    });
    const csv = rows.map(r => r.map(c => { const s = String(c||''); return s.includes(',')||s.includes('"')||s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s; }).join(',')).join('\n');
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
      a.download = `Promet-Audit-${Date.now()}.csv`; a.style.cssText = 'position:absolute;opacity:0';
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 100);
      setCopySuccess(true); setShowCsvText(false); setStatusMsg('CSV downloaded.');
      setTimeout(() => setCopySuccess(false), 5000);
    } catch { setCsvData(csv); setShowCsvText(true); }
  };

  const copyCSV = () => {
    const fb = () => {
      const ta = document.createElement('textarea'); ta.value = csvData;
      ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); setCopySuccess(true); setStatusMsg('Copied.'); setTimeout(() => setCopySuccess(false), 3000); } catch { /* silent */ }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(csvData).then(() => { setCopySuccess(true); setStatusMsg('Copied.'); setTimeout(() => setCopySuccess(false), 3000); }).catch(fb);
    } else { fb(); }
  };

  const validCount = urls.filter(u => u.trim()).length;

  return (
    <>
      <style>{focusStyle}</style>
      <a href="#main-content"
        onFocus={e => Object.assign(e.target.style,{position:'fixed',top:'8px',left:'8px',zIndex:'9999',background:'#c95a1f',color:'#fff',padding:'12px 20px',fontWeight:'700',borderRadius:'4px',textDecoration:'none',fontSize:'14px',width:'auto',height:'auto',overflow:'visible',clip:'auto'})}
        onBlur={e => Object.assign(e.target.style,{position:'absolute',left:'-9999px',top:'auto',width:'1px',height:'1px',overflow:'hidden'})}
        style={{position:'absolute',left:'-9999px',top:'auto',width:'1px',height:'1px',overflow:'hidden',textDecoration:'none',color:'#fff'}}>
        Skip to main content
      </a>
      <div aria-live="polite" aria-atomic="true" className="sr-only">{statusMsg}</div>

      <div style={{minHeight:'100vh',background:LIGHT,fontFamily:"'Segoe UI',system-ui,-apple-system,sans-serif"}}>

        {/* Header */}
        <header role="banner" style={{background:NAVY,padding:'0 48px',display:'flex',alignItems:'center',
          justifyContent:'space-between',height:64,position:'sticky',top:0,zIndex:100,boxShadow:'0 2px 12px rgba(0,0,0,.3)'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:36,height:36,background:ORANGE,borderRadius:6,display:'flex',alignItems:'center',
              justifyContent:'center',fontWeight:900,color:'#fff',fontSize:16}} aria-hidden="true">P</div>
            <div>
              <span style={{color:'#fff',fontWeight:700,fontSize:15,display:'block'}}>Promet Source</span>
              <span style={{color:'#94a3b8',fontSize:12,letterSpacing:'.05em',textTransform:'uppercase'}}>Audit Tool</span>
            </div>
          </div>
          <a href="https://www.prometsource.com/contact" target="_blank" rel="noopener noreferrer"
            style={{background:ORANGE,color:'#fff',fontWeight:700,fontSize:13,padding:'8px 20px',borderRadius:6,textDecoration:'none'}}>
            Let's Talk<span className="sr-only"> (opens in new tab)</span>
          </a>
        </header>

        {/* Hero */}
        <div style={{background:`linear-gradient(135deg,${NAVY} 0%,#243352 100%)`,padding:'56px 48px'}}>
          <div style={{maxWidth:1200,margin:'0 auto',textAlign:'center'}}>
            <p style={{display:'inline-block',background:'rgba(201,90,31,.15)',border:'1px solid rgba(201,90,31,.4)',
              borderRadius:20,padding:'4px 16px',fontSize:12,color:'#f97316',fontWeight:600,
              letterSpacing:'.08em',textTransform:'uppercase',marginBottom:16}}>AI-Powered · Multi-Page · WCAG 2.2 AA</p>
            <h1 style={{color:'#fff',fontSize:36,fontWeight:800,margin:'0 0 14px',lineHeight:1.15,letterSpacing:'-.02em'}}>
              UI &amp; Accessibility<br/><span style={{color:'#f97316'}}>Audit Tool</span>
            </h1>
            <p style={{color:'#94a3b8',fontSize:15,margin:0,lineHeight:1.7}}>
              AI-powered analysis with pinpoint issue location.<br/>Built to WCAG 2.2 AA — accessible to every member of your team.
            </p>
          </div>
        </div>

        {/* Main */}
        <main id="main-content" tabIndex={-1} style={{maxWidth:1200,margin:'-28px auto 0',padding:'0 48px 48px'}}>

          {/* Form */}
          <section aria-labelledby="form-heading"
            style={{background:'#fff',borderRadius:14,boxShadow:'0 4px 24px rgba(0,0,0,.1)',padding:32,position:'relative',zIndex:10,marginBottom:24}}>
            <h2 id="form-heading" style={{fontSize:18,fontWeight:700,color:DARK,margin:'0 0 20px'}}>Configure Your Audit</h2>

            {/* URL inputs */}
            <fieldset style={{border:'none',padding:0,margin:'0 0 24px'}}>
              <legend style={{fontWeight:700,fontSize:14,color:'#374151',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:12,display:'block',width:'100%',padding:0}}>
                Website Pages to Audit
              </legend>
              {urls.map((u, i) => (
                <div key={i} style={{display:'flex',gap:8,marginBottom:10,alignItems:'center'}}>
                  <div style={{position:'relative',flex:1}}>
                    <Search size={16} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#9ca3af',pointerEvents:'none'}} aria-hidden="true"/>
                    <label htmlFor={`url-${i}`} className="sr-only">Page {i+1} URL</label>
                    <input id={`url-${i}`}
                      ref={(el: HTMLInputElement | null) => { urlRefs.current[i] = el; }}
                      type="url" value={u} onChange={e => updateUrl(i, e.target.value)}
                      placeholder={`https://example.com${i > 0 ? '/page-'+i : ''}`}
                      aria-describedby={error && i === 0 ? 'url-error' : undefined}
                      style={{width:'100%',padding:'12px 12px 12px 40px',border:`2px solid ${u?ORANGE:'#d1d5db'}`,
                        borderRadius:8,fontSize:14,outline:'none',boxSizing:'border-box',transition:'border-color .2s'}}/>
                  </div>
                  {urls.length > 1 && (
                    <button onClick={() => removeUrl(i)} aria-label={`Remove page ${i+1}`}
                      style={{background:'#fef2f2',border:'2px solid #fecaca',borderRadius:8,padding:'10px',cursor:'pointer',color:'#b91c1c',display:'flex',alignItems:'center'}}>
                      <Trash2 size={16} aria-hidden="true"/>
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addUrl} disabled={urls.length >= 7}
                aria-label={urls.length >= 7 ? 'Maximum 7 pages reached' : 'Add another page URL'}
                style={{display:'flex',alignItems:'center',gap:6,background:'none',
                  border:`2px dashed ${urls.length >= 7 ? '#d1d5db' : ORANGE}`,
                  color:urls.length >= 7 ? '#9ca3af' : ORANGE,fontWeight:600,fontSize:13,
                  padding:'9px 18px',borderRadius:8,cursor:urls.length >= 7 ? 'not-allowed' : 'pointer',marginTop:4,transition:'all .2s'}}>
                <Plus size={16} aria-hidden="true"/>
                {urls.length >= 7 ? 'Maximum 7 pages reached' : 'Add Another Page'}
              </button>
            </fieldset>

            {/* Audit type */}
            <fieldset style={{border:'none',padding:0,margin:'0 0 28px'}}>
              <legend style={{fontWeight:700,fontSize:14,color:'#374151',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:12,display:'block',width:'100%',padding:0}}>
                Audit Type
              </legend>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {[
                  {val:'full',          label:'Full UI Audit',        sub:'UX + SEO + Performance'},
                  {val:'accessibility', label:'Accessibility Focus',  sub:'WCAG 2.2 + SEO + Speed'},
                  {val:'migration',     label:'Migration Assessment', sub:'Content + Files + Tech'},
                  {val:'technical',     label:'Technical Audit',      sub:'SEO + Performance + Security'},
                ].map(o => {
                  const active = auditType === o.val;
                  return (
                    <label key={o.val} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',
                      border:`2px solid ${active ? ORANGE : '#d1d5db'}`,borderRadius:10,cursor:'pointer',
                      background:active ? '#fff7f3' : '#fff',transition:'all .2s'}}>
                      <input type="radio" name="auditType" value={o.val} checked={active}
                        onChange={() => setAuditType(o.val)} style={{accentColor:ORANGE,width:16,height:16}}/>
                      <div>
                        <span style={{fontWeight:700,fontSize:13,color:active ? ORANGE : DARK,display:'block'}}>{o.label}</span>
                        <span style={{fontSize:12,color:'#6b7280',marginTop:2,display:'block'}}>{o.sub}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {error && (
              <div id="url-error" role="alert" style={{marginBottom:16,background:'#fef2f2',border:'2px solid #fca5a5',
                borderRadius:8,padding:'12px 16px',display:'flex',gap:10,alignItems:'flex-start'}}>
                <AlertCircle size={18} style={{color:'#b91c1c',flexShrink:0,marginTop:1}} aria-hidden="true"/>
                <p style={{color:'#7f1d1d',margin:0,fontSize:14}}>{error}</p>
              </div>
            )}

            <div style={{display:'flex',gap:10}}>
              <button onClick={runAudit} disabled={loading} aria-busy={loading}
                style={{flex:1,background:loading ? '#9ca3af' : ORANGE,color:'#fff',fontWeight:700,fontSize:15,
                  padding:'14px 24px',border:'none',borderRadius:10,cursor:loading ? 'not-allowed' : 'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',gap:10,
                  boxShadow:loading ? 'none' : `0 4px 14px rgba(201,90,31,.4)`,transition:'all .2s'}}>
                {loading
                  ? <><Loader2 className="animate-spin" size={18} aria-hidden="true"/>Auditing…</>
                  : <><Search size={18} aria-hidden="true"/>Run Audit ({validCount} page{validCount !== 1 ? 's' : ''})</>}
              </button>
              {loading && (
                <button onClick={stopAudit}
                  style={{background:'#fef2f2',border:'2px solid #ef4444',color:'#b91c1c',
                    fontWeight:700,fontSize:14,padding:'14px 20px',borderRadius:10,cursor:'pointer'}}>
                  Stop
                </button>
              )}
            </div>

            {loading && (
              <div style={{marginTop:20}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#4b5563',marginBottom:8}}>
                  <span>Page {progress.current} of {progress.total} — {progress.phase}</span>
                  <span style={{fontWeight:700,color:ORANGE}} aria-hidden="true">{Math.round((progress.current/progress.total)*100)}%</span>
                </div>
                <div style={{background:'#e5e7eb',borderRadius:99,height:10,overflow:'hidden'}}
                  role="progressbar" aria-valuenow={progress.current} aria-valuemin={0} aria-valuemax={progress.total}
                  aria-label={`Page ${progress.current} of ${progress.total}`}>
                  <div style={{background:ORANGE,height:'100%',borderRadius:99,transition:'width .4s ease',
                    width:`${(progress.current/progress.total)*100}%`}}/>
                </div>
                <p style={{fontSize:12,color:'#6b7280',margin:'6px 0 0',wordBreak:'break-all'}}>
                  <span aria-hidden="true">🔍 </span>{progress.currentUrl}
                </p>
              </div>
            )}
          </section>

          {/* Results */}
          {pageResults.length > 0 && (
            <div ref={resultsRef} tabIndex={-1}>
              {summary && (
                <section aria-labelledby="summary-h"
                  style={{background:'#fff',borderRadius:14,boxShadow:'0 4px 24px rgba(0,0,0,.08)',padding:28,marginBottom:20}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
                    <div>
                      <p style={{fontSize:12,fontWeight:700,color:ORANGE,textTransform:'uppercase',letterSpacing:'.08em',margin:'0 0 6px'}}>Consolidated Report</p>
                      <h2 id="summary-h" style={{margin:0,fontSize:22,fontWeight:800,color:DARK}}>
                        {summary.ok} of {pageResults.length} pages audited
                        {summary.failed > 0 && <span style={{fontSize:14,color:'#b91c1c',fontWeight:600}}> · {summary.failed} failed</span>}
                      </h2>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <ScoreRing score={summary.avg} size={80} id="summary-ring"/>
                      <p style={{fontSize:12,color:'#6b7280',margin:'4px 0 0',fontWeight:600}}>Avg. Score</p>
                    </div>
                  </div>
                  <dl style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
                    {(['Critical','High','Medium','Low'] as const).map(s => (
                      <div key={s} style={{background:sevStyle(s).bg,borderRadius:10,padding:'14px',textAlign:'center'}}>
                        <dt style={{fontSize:12,fontWeight:700,color:sevStyle(s).color,textTransform:'uppercase',letterSpacing:'.06em'}}>{s}</dt>
                        <dd style={{fontSize:24,fontWeight:800,color:sevStyle(s).color,margin:'4px 0 0'}}>{summary.counts[s]}</dd>
                      </div>
                    ))}
                  </dl>
                  <table style={{width:'100%',borderCollapse:'collapse',marginBottom:20,fontSize:13}}>
                    <caption className="sr-only">Score per page</caption>
                    <thead>
                      <tr>
                        <th scope="col" style={{textAlign:'left',padding:'8px 12px',background:LIGHT,fontWeight:700,color:'#374151',borderRadius:'8px 0 0 8px'}}>Page</th>
                        <th scope="col" style={{textAlign:'right',padding:'8px 12px',background:LIGHT,fontWeight:700,color:'#374151',borderRadius:'0 8px 8px 0'}}>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageResults.map((pr, i) => (
                        <tr key={i} style={{borderBottom:'1px solid #f3f4f6'}}>
                          <td style={{padding:'8px 12px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              {pr.result
                                ? <CheckCircle size={14} style={{color:'#15803d',flexShrink:0}} aria-label="Success"/>
                                : <AlertCircle size={14} style={{color:'#b91c1c',flexShrink:0}} aria-label="Error"/>}
                              <span style={{wordBreak:'break-all'}}>{pr.url.replace(/^https?:\/\//,'')}</span>
                            </div>
                          </td>
                          <td style={{padding:'8px 12px',textAlign:'right',fontWeight:700}}>
                            {pr.result
                              ? <span style={{color:scoreColor(pr.result.overallScore)}}>{pr.result.overallScore}/100</span>
                              : <span style={{color:'#b91c1c',fontSize:12}}>Error</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button onClick={exportCSV}
                    style={{width:'100%',background:NAVY,color:'#fff',fontWeight:700,fontSize:15,
                      padding:'14px 24px',border:'none',borderRadius:10,cursor:'pointer',
                      display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
                    <Download size={20} aria-hidden="true"/>Download Full CSV Report
                  </button>
                  {copySuccess && (
                    <div role="status" style={{marginTop:12,background:'#f0fdf4',border:'2px solid #16a34a',borderRadius:10,padding:'14px 18px'}}>
                      <p style={{fontWeight:700,color:'#14532d',margin:'0 0 4px'}}><CheckCircle size={16} style={{verticalAlign:'middle',marginRight:6}} aria-hidden="true"/>CSV Downloaded</p>
                      <p style={{fontSize:13,color:'#374151',margin:0}}>Open in Google Sheets via File → Import → Upload.</p>
                    </div>
                  )}
                  {showCsvText && (
                    <div style={{marginTop:12,background:'#eff6ff',border:'2px solid #2563eb',borderRadius:10,padding:18}}>
                      <h3 style={{fontWeight:700,color:'#1d4ed8',margin:'0 0 10px',fontSize:15}}>Copy &amp; Paste to Google Sheets</h3>
                      <button onClick={copyCSV} style={{width:'100%',background:'#2563eb',color:'#fff',fontWeight:700,fontSize:14,padding:'10px',border:'none',borderRadius:8,cursor:'pointer',marginBottom:10}}>
                        {copySuccess ? '✓ Copied!' : 'Copy Report Data'}
                      </button>
                      <ol style={{fontSize:13,color:'#1e40af',paddingLeft:20,margin:'0 0 10px'}}>
                        <li>Open Google Sheets, create a new spreadsheet</li>
                        <li>Click cell A1 then press Ctrl+V / Cmd+V</li>
                      </ol>
                      <button onClick={() => setShowCsvText(false)} style={{background:'#e5e7eb',color:'#374151',fontWeight:600,fontSize:13,padding:'8px 16px',border:'none',borderRadius:8,cursor:'pointer'}}>Close</button>
                    </div>
                  )}
                </section>
              )}

              <h2 style={{fontSize:14,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.07em',margin:'0 0 12px'}}>Page-by-Page Results</h2>

              {pageResults.map((pr, i) =>
                pr.error ? (
                  <section key={i} aria-labelledby={`err-${i}`} role="alert"
                    style={{background:'#fff',borderRadius:14,boxShadow:'0 2px 16px rgba(0,0,0,.07)',padding:'20px 28px',marginBottom:16,borderLeft:'4px solid #ef4444'}}>
                    <h3 id={`err-${i}`} style={{fontWeight:700,color:DARK,margin:'0 0 6px',fontSize:15}}>Page {i+1}: {pr.url}</h3>
                    <p style={{display:'flex',gap:8,alignItems:'center',color:'#b91c1c',fontSize:13,margin:0}}>
                      <AlertCircle size={15} aria-hidden="true"/>{pr.error}
                    </p>
                  </section>
                ) : (
                  <PageResultCard key={i} pr={pr} index={i}/>
                )
              )}

              <div style={{background:`linear-gradient(135deg,${NAVY} 0%,#243352 100%)`,borderRadius:14,padding:'40px 32px',textAlign:'center',marginTop:8}}>
                <h2 style={{color:'#fff',fontSize:22,fontWeight:800,margin:'0 0 10px'}}>Ready to fix these issues?</h2>
                <p style={{color:'#94a3b8',fontSize:15,margin:'0 0 24px',lineHeight:1.6}}>Promet Source specializes in accessibility, performance, and migrations for the public sector.</p>
                <a href="https://www.prometsource.com/contact" target="_blank" rel="noopener noreferrer"
                  style={{display:'inline-block',background:ORANGE,color:'#fff',fontWeight:700,fontSize:15,
                    padding:'14px 32px',borderRadius:10,textDecoration:'none',boxShadow:'0 4px 14px rgba(201,90,31,.5)'}}>
                  Get a Free Consultation<span className="sr-only"> (opens in new tab)</span>
                </a>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
