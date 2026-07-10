/**
 * ExploreTimelineContext
 * ----------------------
 * Self-contained, signal-based Context (state + provider) for the public
 * explore timeline. Registered as a **singleton** at the app root so the
 * explore feed persists across route navigations. Only resets on manual
 * refresh, auth change, or 12-hour TTL expiry.
 *
 * No component imports it directly — they call useExploreTimelineContext() so the
 * state stays in one place and every consumer sees the same signals.
 *
 * Wire format notes:
 *   - backend: /api/rants/explore?page=&pageSize=  → flat Rant[] array
 *   - service: wraps it into TimelinePage { items, total, page, pageSize }
 *   - state:   accumulates items for infinite-scroll; `total` may be page-sized
 *              until the backend exposes X-Total-Count — guarded by hasMore().
 */
import {
  Injectable,
  Signal,
  computed,
  inject,
  signal,
  effect,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { TimelineService } from '../services/timeline.service';
import { RantService } from '../services/rant.service';
import type { TimelineQuery, TimelinePage } from '../models/timeline.model';
import type { Rant } from '../models/rant.model';

/* --------------------------------- State --------------------------------- */

/** Default page size matches the explore-trending seed UX (5 tiles). */
export const DEFAULT_PAGE_SIZE = 5;
/** Explore feed session expires after 12 hours. */
export const EXPLORE_TTL_MS = 12 * 60 * 60 * 1000;

export type PageStatus = 'idle' | 'loading' | 'refreshing' | 'loading-more' | 'error';

export interface ExploreTimelineState {
  /** All loaded rants so far, in display order. Grows with "load more". */
  readonly items: Rant[];
  /** Current page that is loaded (1-based). */
  readonly page: number;
  /** Items per page (fixed per instance). */
  readonly pageSize: number;
  /** Total rants reported by the server (may equal items.length if the backend does not yet supply a total). */
  readonly total: number;
  /** Lifecycle status of the current operation. */
  readonly status: PageStatus;
  /** Last error message, if any. */
  readonly error: string | null;
}

/* ------------------------------ Derived signals --------------------------- */

/**
 * Derived signals exposed by the Context. The UI reads these as signals, e.g.
 * `<div *ngIf="ctx.derived.isLoading()">...</div>`.
 */
export interface ExploreTimelineDerived {
  /** True while the very first page is being fetched. */
  readonly isLoading: Signal<boolean>;
  /** True during a pull-to-refresh / explicit refresh. */
  readonly isRefreshing: Signal<boolean>;
  /** True during a "load more" append. */
  readonly isLoadingMore: Signal<boolean>;
  /** True if the most recent operation failed. */
  readonly hasError: Signal<boolean>;
  /** True if there is another page to request. */
  readonly hasMore: Signal<boolean>;
  /** True once at least one page has loaded. */
  readonly hasLoadedOnce: Signal<boolean>;
  /** True when at least one page has loaded but there are zero items. */
  readonly isEmpty: Signal<boolean>;
  /** Progress string for debugging / HUD e.g. "5 of 42". */
  readonly progressLabel: Signal<string>;
}

export const INITIAL_STATE: ExploreTimelineState = {
  items: [],
  page: 0,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
  status: 'idle',
  error: null,
};

/* ------------------------------ Context impl ----------------------------- */

/**
 * Signal-based Context for the explore timeline.
 *
 * Registered as a singleton at the app root so the explore feed persists
 * across route navigations.
 */
@Injectable()
export class ExploreTimelineContext {
  private readonly api = inject(TimelineService);
  private readonly rantService = inject(RantService);

  /** Cancels any in-flight HTTP request when a new one starts or on reset. */
  private readonly cancel$ = new Subject<void>();

  /* --- raw signals --- */
  private readonly items = signal<Rant[]>(INITIAL_STATE.items);
  private readonly page = signal<number>(INITIAL_STATE.page);
  private readonly pageSize = signal<number>(INITIAL_STATE.pageSize);
  private readonly total = signal<number>(INITIAL_STATE.total);
  private readonly status = signal<PageStatus>(INITIAL_STATE.status);
  private readonly error = signal<string | null>(INITIAL_STATE.error);

  /** Timestamp (ms) when the explore feed was last successfully loaded. */
  private readonly lastLoadedAt = signal<number | null>(null);

  /* --- expose raw state as a snapshot --- */
  readonly state = signal<ExploreTimelineState>(INITIAL_STATE);

  /* --- derived signals (the UI actually reads these) --- */
  readonly derived: ExploreTimelineDerived = {
    isLoading: computed(() => this.status() === 'loading'),
    isRefreshing: computed(() => this.status() === 'refreshing'),
    isLoadingMore: computed(() => this.status() === 'loading-more'),
    hasError: computed(() => this.status() === 'error'),
    hasMore: computed(() => {
      // Conservative: if we have no total yet (backend reports page length only),
      // assume there's more when the last page came back full.
      const knownTotal = this.total();
      if (knownTotal > 0) return this.items().length < knownTotal;
      return this.items().length === this.page() * this.pageSize();
    }),
    hasLoadedOnce: computed(() => this.page() > 0),
    isEmpty: computed(() => this.page() > 0 && this.items().length === 0),
    progressLabel: computed(() => {
      const total = this.total();
      if (total > 0) return `${this.items().length} of ${total}`;
      return `${this.items().length}`;
    }),
  };

  constructor() {
    // Keep the public snapshot `state` in sync with the underlying primitives
    // without a manual refresh() after each change.
    effect(() => {
      this.state.set({
        items: this.items(),
        page: this.page(),
        pageSize: this.pageSize(),
        total: this.total(),
        status: this.status(),
        error: this.error(),
      });
    });
  }

  /* ------------------------------- Actions -------------------------------- */

  /**
   * Load the first page. Resets existing items — used on mount and on refresh().
   */
  loadFirstPage(pageSize: number = this.pageSize()): void {
    this.pageSize.set(pageSize);
    this.items.set([]);
    this.page.set(0);
    this.error.set(null);
    this.runQuery({ page: 1, pageSize }, 'loading');
  }

  /**
   * Fetch the next page and append its items. No-op if a request is in flight
   * or there are no more pages (guarded by `hasMore`).
   */
  loadNextPage(): void {
    if (this.derived.isLoadingMore() || this.derived.isLoading()) return;
    if (!this.derived.hasMore()) return;
    const next = this.page() + 1;
    if (!Number.isFinite(next)) return;
    this.runQuery({ page: next, pageSize: this.pageSize() }, 'loading-more');
  }

  /**
   * Pull-to-refresh: reset and re-request the first page.
   */
  refresh(pageSize: number = this.pageSize()): void {
    this.loadFirstPage(pageSize);
  }

  /**
   * Reset all state back to idle/empty. Useful after sign-out.
   */
  reset(): void {
    this.cancel$.next();
    this.items.set([]);
    this.page.set(0);
    this.total.set(0);
    this.error.set(null);
    this.status.set('idle');
    this.lastLoadedAt.set(null);
  }

  /** Toggle like on an explore rant (optimistic, reconcile on success). */
  toggleLike(id: string): void {
    const items = this.items();
    const original = items.find((r) => r.id === id);
    if (!original) return;

    const updated = {
      ...original,
      isLikedByMe: !original.isLikedByMe,
      likeCount: original.likeCount + (original.isLikedByMe ? -1 : 1),
    };
    this.items.update((list) => list.map((r) => (r.id === id ? updated : r)));

    this.rantService
      .toggleLike(id)
      .pipe(takeUntil(this.cancel$))
      .subscribe({
        next: () => this.reconcileRant(id),
        error: () => {
          this.items.update((list) => list.map((r) => (r.id === id ? original : r)));
        },
      });
  }

  /** Toggle rerant on an explore rant (optimistic). */
  toggleRerant(id: string): void {
    const items = this.items();
    const original = items.find((r) => r.id === id);
    if (!original) return;

    const updated = {
      ...original,
      isRerantedByMe: !original.isRerantedByMe,
      reRantCount: original.reRantCount + (original.isRerantedByMe ? -1 : 1),
    };
    this.items.update((list) => list.map((r) => (r.id === id ? updated : r)));

    this.rantService
      .toggleRerant(id)
      .pipe(takeUntil(this.cancel$))
      .subscribe({
        next: () => this.reconcileRant(id),
        error: () => {
          this.items.update((list) => list.map((r) => (r.id === id ? original : r)));
        },
      });
  }

  /** Toggle bookmark on an explore rant (optimistic). */
  toggleBookmark(id: string): void {
    const items = this.items();
    const original = items.find((r) => r.id === id);
    if (!original) return;

    const updated = {
      ...original,
      isBookmarkedByMe: !original.isBookmarkedByMe,
    };
    this.items.update((list) => list.map((r) => (r.id === id ? updated : r)));

    this.rantService
      .toggleBookmark(id)
      .pipe(takeUntil(this.cancel$))
      .subscribe({
        next: () => this.reconcileRant(id),
        error: () => {
          this.items.update((list) => list.map((r) => (r.id === id ? original : r)));
        },
      });
  }

  /** Re-fetch the latest truth from the server for one rant and reconcile. */
  private reconcileRant(id: string): void {
    this.rantService
      .getRant(id)
      .pipe(takeUntil(this.cancel$))
      .subscribe({
        next: (rant) => {
          this.items.update((list) => list.map((r) => (r.id === id ? rant : r)));
        },
      });
  }

  /* ----------------------- Session / TTL helpers ----------------------- */

  /** True if the explore feed has loaded items and hasn't expired. */
  hasData(): boolean {
    return this.items().length > 0 && !this.isExpired();
  }

  /** True if the explore feed session has exceeded the 12-hour TTL. */
  isExpired(): boolean {
    const ts = this.lastLoadedAt();
    if (ts === null) return true;
    return Date.now() - ts > EXPLORE_TTL_MS;
  }

  /* ------------------------------- Internals ------------------------------ */

  /**
   * Runs the given query against the API, updates raw signals from the result,
   * and resolves loading flags. Uses cancel$ to abort in-flight requests.
   */
  private runQuery(query: TimelineQuery, mode: 'loading' | 'loading-more'): void {
    this.cancel$.next(); // Cancel any in-flight request
    this.status.set(mode === 'loading' ? 'loading' : 'loading-more');
    this.error.set(null);

    this.api
      .getHomeTimeline(query)
      .pipe(takeUntil(this.cancel$))
      .subscribe({
        next: (page) => this.applyPage(page, mode),
        error: (err: unknown) => {
          this.status.set('error');
          this.error.set(this.humanizeError(err));
        },
      });
  }

  /** Merge a freshly fetched page into state. */
  private applyPage(page: TimelinePage, mode: 'loading' | 'loading-more'): void {
    if (mode === 'loading') {
      // First page: replace entirely (also covers refresh).
      this.items.set(page.items);
    } else {
      // Append, de-duping by id in case the backend returned overlapping windows.
      const seen = new Set(this.items().map((r) => r.id));
      const merged = this.items().concat(page.items.filter((r) => !seen.has(r.id)));
      this.items.set(merged);
    }
    this.page.set(page.page);
    this.total.set(page.total);
    this.status.set('idle');
    this.lastLoadedAt.set(Date.now());
  }

  /** Convert a raw HTTP/platform error into a short UI message. */
  private humanizeError(err: unknown): string {
    if (err instanceof Error) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        return 'Network unreachable — please check if the backend API is running.';
      }
      return err.message;
    }
    return 'Failed to load the explore timeline.';
  }
}

/* --------------------------------- Hook ---------------------------------- */

/**
 * Using this instead of inject(ExploreTimelineContext) forces callers to set up
 * the provider (provideExploreTimelineContext) and fails loudly if they forget.
 */
import { InjectionToken, Provider } from '@angular/core';
export const EXPLORE_TIMELINE_CONTEXT = new InjectionToken<ExploreTimelineContext>(
  'EXPLORE_TIMELINE_CONTEXT'
);

/**
 * Provide the explore timeline state as a singleton at the app root.
 * Register in app.config.ts providers so the feed persists across route navigations.
 */
export function provideExploreTimelineContext(): Provider {
  return {
    provide: EXPLORE_TIMELINE_CONTEXT,
    useClass: ExploreTimelineContext,
  };
}

/**
 * Hook for components inside the explore tab to consume the Context.
 *
 * @throws if provideExploreTimelineContext() is missing from an ancestor provider.
 */
export function useExploreTimelineContext(): ExploreTimelineContext {
  // `inject()` throws if the token is absent; the $inject diagnostic attached to
  // EXPLORE_TIMELINE_CONTEXT also flags missing providers at build time.
  return inject(EXPLORE_TIMELINE_CONTEXT);
}
