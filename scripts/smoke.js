const BASE = 'http://localhost:3001';
let cookies = {};
async function call(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' }, ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  (res.headers.getSetCookie?.() || []).forEach(c => { const [kv] = c.split(';'); const [k,v] = kv.split('='); cookies[k]=v; });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
(async () => {
  let r = await call('/api/auth/login', { method: 'POST', body: { login: 'demo_user', password: 'demo' } });
  console.log('login', r.status);
  r = await call('/api/analysis/run-demo', { method: 'POST' });
  console.log('run-demo', r.status, r.data.analysisId);
  r = await call('/api/analysis/' + r.data.analysisId);
  console.log('analysis', r.status, 'steps=', r.data.route?.steps?.length);
  console.log('SMOKE OK');
})().catch(e => { console.error(e); process.exit(1); });
