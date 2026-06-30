// Authentated feed endpoint sweep. Logs status+body for each contract endpoint.
const B = 'http://192.168.1.44:5000/api';

async function getToken() {
  const r = await fetch(B + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'hausenlot', password: '12341234' }),
  });
  const j = await r.json();
  return j.token;
}

const T = await getToken();
if (!T) { console.error('NO TOKEN — login failed'); process.exit(1); }
console.log('token acquired');

async function t(m, p, body) {
  const headers = { Authorization: 'Bearer ' + T };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(B + p, { method: m, headers, body: body ? JSON.stringify(body) : undefined });
  const raw = await res.text();
  console.log(m.padEnd(6), p, '=>', res.status, raw.length < 360 ? raw : raw.slice(0, 360) + '...');
  return raw;
}

const homeRaw = await t('GET', '/timelines/home?page=1&pageSize=3');
let firstId = null;
try { firstId = JSON.parse(homeRaw)[0]?.id; } catch {}
if (firstId) {
  await t('GET', '/rants/' + firstId);
  await t('GET', '/rants/' + firstId + '/replies?page=1&pageSize=3');
}
await t('POST', '/rants', { content: 'API probe test rant — should be deleted' });
await t('POST', '/rants/' + (firstId || '0') + '/like');
console.log('---probe complete---');
