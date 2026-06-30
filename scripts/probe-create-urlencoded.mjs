// Replicate exactly what RantService.createRant now sends (x-www-form-urlencoded).
const B = 'http://192.168.1.44:5000/api';
const T = (await ( await fetch(B + '/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'hausenlot', password:'12341234' }) }) ).json()).token;
const headers = { 'Content-Type':'application/x-www-form-urlencoded', Authorization:'Bearer '+T };
const body = new URLSearchParams();
body.set('content', 'urlencoded lowercase content — should succeed');
const res = await fetch(B + '/rants', { method:'POST', headers, body: body.toString() });
const raw = await res.text();
console.log('create =>', res.status, raw.slice(0, 200));
let id = null; try { id = JSON.parse(raw).id; } catch {}
if (id) {
  console.log('created id =', id);
  const dl = await fetch(B + '/rants/' + id, { method:'DELETE', headers:{ Authorization:'Bearer '+T } });
  console.log('delete =>', dl.status);
} else {
  console.log('NO ID — create did not work');
}
