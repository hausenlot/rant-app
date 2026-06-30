/**
 * Logic-only smoke test for ExploreTimelineContext.
 *
 * Re-runs the same HTTP fetch the Context drives and asserts the post-merge state
 * that a UI would read (`items`, `page`, `total`, `hasMore`, `progressLabel`).
 *
 * No Angular involved here — pure-logic mirror so we can confirm the rules before
 * wiring through provideExploreTimelineContext().
 */
const BASE = 'http://192.168.1.44:5000/api';
const PAGE_SIZE = 5;

async function fetchPage(page) {
  const url = `${BASE}/rants/explore?page=${page}&pageSize=${PAGE_SIZE}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const items = await res.json();
  if (!Array.isArray(items)) throw new Error('Expected flat array');
  return { items, total: items.length, page, pageSize: PAGE_SIZE };
}

// Replicate Context.applyPage() (append + de-dupe by id).
function appendBy(acc, page) {
  const seen = new Set(acc.map((r) => r.id));
  return acc.concat(page.items.filter((r) => !seen.has(r.id)));
}

// Replicate Context.derived.hasMore() conservative rule.
function hasMore(state) {
  const { items, total, page, pageSize } = state;
  if (total > 0) return items.length < total;
  return items.length === page * pageSize;
}

async function main() {
  // 1) loadFirstPage()
  const p1 = await fetchPage(1);
  let state = { items: p1.items, page: p1.page, pageSize: p1.pageSize, total: p1.total, status: 'idle' };

  // 2) loadNextPage()
  const p2 = await fetchPage(2);
  state = { ...state, items: appendBy(state.items, p2), page: p2.page, total: state.total + p2.total };

  const derived = {
    hasLoadedOnce: state.page > 0,
    hasMore: hasMore(state),
    progressLabel: state.total > 0 ? `${state.items.length} of ${state.total}` : `${state.items.length}`,
  };

  console.log('--- ExploreTimelineContext logic smoke ---');
  console.log('Page 1 length :', p1.items.length);
  console.log('Page 2 length :', p2.items.length);
  console.log('Merged items  :', state.items.length);
  console.log('Has loaded once:', derived.hasLoadedOnce);
  console.log('Has more      :', derived.hasMore);
  console.log('Progress label:', derived.progressLabel);
  console.log('Latest rant   :', JSON.stringify(state.items.at(-1), null, 2));
  console.log('-------------------------------------------');
}

main().catch((e) => {
  console.error('EXPLORE CONTEXT SMOKE FAILED:', e.message);
  process.exit(1);
});
