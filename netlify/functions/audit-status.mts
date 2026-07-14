import { getStore } from '@netlify/blobs';

export default async (req: Request) => {
  const jobId = new URL(req.url).searchParams.get('jobId');
  if (!jobId) return Response.json({ status: 'error', message: 'Missing jobId' }, { status: 400 });

  const store = getStore('audits');
  const result = await store.get(jobId, { type: 'json' });
  if (!result) return Response.json({ status: 'pending' });
  return Response.json(result);
};