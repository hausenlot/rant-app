// Confirm create-rant endpoint accepts capital Content (1-1000 char rule).
const B = 'http://192.168.1.44:5000/api';
const T = (await ( await fetch(B + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'hausenlot', password: '12341234' }) }) ).json()).token;
const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T };
async function t(m, p, body) {
  const res = await fetch(B + p, { method: m, headers, body: body ? JSON.stringify(body) : undefined });
  const raw = await res.text();
  console.log(m, p, '=>', res.status, raw.slice(0, 300));
  return { status: res.status, raw };
}
console.log('— create with lowercase `content` — backend expects capital `Content`');
await t('POST', '/rants', { content: 'lowercase content' });
console.log('— create with capital `Content` —');
const r = await t('POST', '/rants', { Content: 'smoke test — will delete' });
if (r.status === 200 || r.status === 201) {
  const rant = JSON.parse(r.raw);
  console.log('created rant id =', rant.id, 'isLikedByMe =', rant.isLikedByMe);
  console.log('— delete it —');
  await t('DELETE', '/rants/' + rant.id);
}
