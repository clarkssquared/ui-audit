import { getStore } from '@netlify/blobs';

const MAX_RUN_MS = 4 * 60 * 1000; // if a job has been "running" longer than 4 min, treat it as failed

export default async (req: Request) => {
  const jobId = new URL(req.url).searchParams.get('jobId');
  if (!jobId) return Response.json({ status: 'error', message: 'Missing jobId' }, { status: 400 });

  const store = getStore('audits');
  const result = await store.get(jobId, { type: 'json' }) as any;

  // Nothing stored yet — the job may still be starting up
  if (!result) return Response.json({ status: 'pending' });

  // Job is still working — but if it's been running too long, call it failed
  if (result.status === 'running') {
    const runningFor = Date.now() - (result.startedAt || 0);
    if (runningFor > MAX_RUN_MS) {
      return Response.json({
        status: 'error',
        message: 'This page could not be audited (it took too long — the site may be slow, very large, or blocking automated access).',
      });
    }
    return Response.json({ status: 'pending' });
  }

  // Otherwise it's 'done' or 'error' — return as-is
  return Response.json(result);
};