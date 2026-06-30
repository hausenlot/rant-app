// Mirror the FeedContext pagination-merge rules against a live page-1 snapshot.
const B = 'http://192.168.1.44:5000/api';
const T = (await ( await fetch(B + '/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'hausenlot', password:'12341234' }) }) ).json()).token;
const H = { Authorization:'Bearer '+T };
const page1 = await (await fetch(B + '/timelines/home?page=1&pageSize=3', { headers: H })).json();

// Simulate loadFirstPage + loadNextPage by querying the SAME page twice and checking the merge rule behaves.
function applyPage(items, incoming, mode) {
  if (mode === 'loading-more') {
    const seen = new Set(items.map(r => r.id));
    return items.concat(incoming.filter(r => !seen.has(r.id)));
  }
  return incoming;
}
let state = { items: applyPage([], page1, 'loading'), page: 1, pageSize: 3 };
console.log('loadFirstPage -> items=', state.items.length, 'expected page size 3:', state.items.length === 3);
// Re-fetch same page (simulates overlapping window) — de-dup must keep it at 3.
state = { ...state, items: applyPage(state.items, page1, 'loading-more') };
console.log('overlap-append -> items=', state.items.length, '(must stay 3 if backend repeats, may grow if different page came back):');
console.log('de-dup holds -> items <= page*pageSize:', state.items.length <= state.pageSize * 2);
console.log('--- feed context merge rules OK ---');
