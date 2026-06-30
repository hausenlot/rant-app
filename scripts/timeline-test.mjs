/**
 * Standalone TimelineService probe.
 *
 * Verifies once that the API is reachable and look at the real wire shape.
 * Not a persistent test harness — just a sanity check against /rants/explore.
 */
const BASE = 'http://192.168.1.44:5000/api';
const url = `${BASE}/rants/explore?page=1&pageSize=5`;

const res = await fetch(url, { method: 'GET' });
const status = res.status;
const contentType = res.headers.get('content-type') ?? '';

let body;
const text = await res.text();
try { body = JSON.parse(text); } catch { body = text; }

console.log('--- TimelineService standalone probe ---');
console.log('URL     :', url);
console.log('Status  :', status, res.statusText);
console.log('Content :', contentType);
console.log('IsArray :', Array.isArray(body));
console.log('Body    :', JSON.stringify(body, null, 2));
console.log('---------------------------------------');
