/**
 * FeedContext
 * -----------
 * Signal-based Context (state + provider + hook) for the authenticated home feed.
 *
 * Owns:
 *   - the cumulative rant list (`items`) loaded from /timelines/home plus a lookup map
 *     (rantMap) for O(1) access by id
 *   - pagination (`page`, `pageSize`, `hasMore`)
 *   - lifecycle flags (`status`, `error`)
 *
 * Actions:
 *   - `loadFirstPage(pageSize?)` — reset + fetch (mount / refresh)
 *   - `loadNextPage()`           — append next page (infinite scroll)
 *   - `refresh()`                — reset + re-fetch first page
 *   - `reset()`                  — clear everything (e.g. on logout)
 *   - `insertRant(rant)`         — prepend a freshly-created rant to the top
 *   - `removeRant(id)`           — drop a deleted rant
 *   - `toggleLike(id)` / `toggleRerant(id)` / `toggleBookmark(id)` — optimistic UI +
 *       then re-fetch the rant; needed because the backend returns void, so the
 *       UI must ask for the server's truth after the optimistic tweak.
 *
 * Toggle strategy (optimistic):
 *   1. patch rantMap + items with the flipped boolean + +/-1 count
 *   2. fire POST to /rants/{id}/{like,rerant,bookmark}
 *   3. on success → re-fetch /rants/:id and reconcile (prevents drift)
 *   4. on error → revert the optimistic patch and surface error
 *
 * Unlike timeline/explore contexts, the FeedContext depends on an authenticated
 * session — mount it from a route protected by authGuard.
 */
import {
  Injectable,
  Signal,
  computed,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RantService } from '../services/rant.service';
import type { Rant } from '../models/rant.model';

/* --------------------------------- State --------------------------------- */

export const FEED_DEFAULT_PAGE_SIZE = 10;
export type FeedStatus = 'idle' | 'loading' | 'refreshing' | 'loading-more' | 'error';

/** UI state for expanded post (in-place) and media modal (overlay) */
export type ExpandedPostMode = 'in-place' | 'modal';

export interface FeedState {
  readonly items: Rant[];
  readonly rantMap: Record<string, Rant>;
  readonly page: number;
  readonly pageSize: number;
  readonly status: FeedStatus;
  readonly error: string | null;
  // Scroll preservation
  readonly scrollPosition: number;
  // Expanded post (in-place) - clicking post body/content
  readonly expandedPostId: string | null;
  readonly expandedPostMode: ExpandedPostMode;
  // Media modal - clicking media (image/video)
  readonly mediaModalPostId: string | null;
  readonly mediaModalMediaIndex: number; // for multi-media future support
}

export const INITIAL_FEED_STATE: FeedState = {
  items: [],
  rantMap: {},
  page: 0,
  pageSize: FEED_DEFAULT_PAGE_SIZE,
  status: 'idle',
  error: null,
  scrollPosition: 0,
  expandedPostId: null,
  expandedPostMode: 'in-place',
  mediaModalPostId: null,
  mediaModalMediaIndex: 0,
};

/* -------------------------------- Derived ------------------------------- */

export interface FeedDerived {
  readonly isLoading: Signal<boolean>;
  readonly isRefreshing: Signal<boolean>;
  readonly isLoadingMore: Signal<boolean>;
  readonly hasError: Signal<boolean>;
  readonly hasMore: Signal<boolean>;
  readonly hasLoadedOnce: Signal<boolean>;
  readonly isEmpty: Signal<boolean>;
  readonly progressLabel: Signal<string>;
  // NEW: UI state derived signals
  readonly scrollPosition: Signal<number>;
  readonly expandedPostId: Signal<string | null>;
  readonly expandedPostMode: Signal<ExpandedPostMode>;
  readonly expandedPost: Signal<Rant | null>;
  readonly mediaModalPostId: Signal<string | null>;
  readonly mediaModalMediaIndex: Signal<number>;
  readonly isMediaModalOpen: Signal<boolean>;
}

/* --------------------------------- Context ------------------------------ */

@Injectable()
export class FeedContext {
  private readonly api = inject(RantService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly items = signal<Rant[]>(INITIAL_FEED_STATE.items);
  private readonly rantMap = signal<Record<string, Rant>>(INITIAL_FEED_STATE.rantMap);
  private readonly page = signal<number>(INITIAL_FEED_STATE.page);
  private readonly pageSize = signal<number>(INITIAL_FEED_STATE.pageSize);
  private readonly status = signal<FeedStatus>(INITIAL_FEED_STATE.status);
  private readonly error = signal<string | null>(INITIAL_FEED_STATE.error);
  // NEW: scroll + expanded post + media modal state
  private readonly _scrollPosition = signal<number>(INITIAL_FEED_STATE.scrollPosition);
  private readonly _expandedPostId = signal<string | null>(INITIAL_FEED_STATE.expandedPostId);
  private readonly _expandedPostMode = signal<ExpandedPostMode>(INITIAL_FEED_STATE.expandedPostMode);
  private readonly _mediaModalPostId = signal<string | null>(INITIAL_FEED_STATE.mediaModalPostId);
  private readonly _mediaModalMediaIndex = signal<number>(INITIAL_FEED_STATE.mediaModalMediaIndex);

  readonly state = signal<FeedState>(INITIAL_FEED_STATE);

  readonly derived: FeedDerived = {
    isLoading: computed(() => this.status() === 'loading'),
    isRefreshing: computed(() => this.status() === 'refreshing'),
    isLoadingMore: computed(() => this.status() === 'loading-more'),
    hasError: computed(() => this.status() === 'error'),
    // Conservative: until the backend supplies X-Total-Count, treat a full last page as "more".
    hasMore: computed(() => {
      if (this.page() === 0) return true;
      return this.items().length === this.page() * this.pageSize();
    }),
    hasLoadedOnce: computed(() => this.page() > 0),
    isEmpty: computed(() => this.page() > 0 && this.items().length === 0),
    progressLabel: computed(() => `${this.items().length} rants`),
    // NEW: UI state derived signals
    scrollPosition: computed(() => this._scrollPosition()),
    expandedPostId: computed(() => this._expandedPostId()),
    expandedPostMode: computed(() => this._expandedPostMode()),
    expandedPost: computed(() => {
      const id = this._expandedPostId();
      return id ? this.rantMap()[id] ?? null : null;
    }),
    mediaModalPostId: computed(() => this._mediaModalPostId()),
    mediaModalMediaIndex: computed(() => this._mediaModalMediaIndex()),
    isMediaModalOpen: computed(() => this._mediaModalPostId() !== null),
  };

  /* ------------------------------- Actions ------------------------------ */

  /** Fetch the first page; resets existing items. */
  loadFirstPage(pageSize: number = this.pageSize()): void {
    this.pageSize.set(pageSize);
    this.items.set([]);
    this.rantMap.set({});
    this.page.set(0);
    this.error.set(null);
    this.runPageQuery({ page: 1, pageSize }, 'loading');
  }

  /** Append the next page (infinite scroll). */
  loadNextPage(): void {
    if (this.isQueryInFlight()) return;
    if (!this.derived.hasMore()) return;
    const next = this.page() + 1;
    if (!Number.isFinite(next)) return;
    this.runPageQuery({ page: next, pageSize: this.pageSize() }, 'loading-more');
  }

  /** Pull-to-refresh: reset and re-request page 1. */
  refresh(): void {
    this.pageSize.set(this.pageSize());
    this.items.set([]);
    this.rantMap.set({});
    this.page.set(0);
    this.error.set(null);
    this.runPageQuery({ page: 1, pageSize: this.pageSize() }, 'refreshing');
  }

  /** Clear all state. */
  reset(): void {
    this.items.set([]);
    this.rantMap.set({});
    this.page.set(0);
    this.error.set(null);
    this.status.set('idle');
    // Clear UI state
    this._scrollPosition.set(0);
    this._expandedPostId.set(null);
    this._expandedPostMode.set('in-place');
    this._mediaModalPostId.set(null);
    this._mediaModalMediaIndex.set(0);
    this.syncState();
  }

  /** Prepend a freshly-created rant to the top of the feed. */
  insertRant(rant: Rant): void {
    this.items.update((list) => [rant, ...list.filter((r) => r.id !== rant.id)]);
    this.rantMap.update((m) => ({ ...m, [rant.id]: rant }));
    this.syncState();
  }

  /** Remove a deleted rant. */
  removeRant(id: string): void {
    this.items.update((list) => list.filter((r) => r.id !== id));
    this.rantMap.update((m) => {
      if (!(id in m)) return m;
      const next = { ...m };
      delete next[id];
      return next;
    });
    this.syncState();
  }

  /** Toggle like on a rant (optimistic, reconcile on success). */
  toggleLike(id: string): void {
    const rant = this.rantMap()[id];
    if (!rant) return;
    this.optimisticPatch(id, {
      isLikedByMe: !rant.isLikedByMe,
      likeCount: rant.likeCount + (rant.isLikedByMe ? -1 : 1),
    });
    this.api
      .toggleLike(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.reconcileRant(id),
        error: (err) => {
          this.revertOptimisticPatch(id, rant);
          this.error.set(this.humanizeError(err));
          this.status.set('error');
        },
      });
  }

  /** Toggle rerant on a rant (optimistic). */
  toggleRerant(id: string): void {
    const rant = this.rantMap()[id];
    if (!rant) return;
    this.optimisticPatch(id, {
      isRerantedByMe: !rant.isRerantedByMe,
      reRantCount: rant.reRantCount + (rant.isRerantedByMe ? -1 : 1),
    });
    this.api
      .toggleRerant(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.reconcileRant(id),
        error: (err) => {
          this.revertOptimisticPatch(id, rant);
          this.error.set(this.humanizeError(err));
          this.status.set('error');
        },
      });
  }

  /** Toggle bookmark on a rant (optimistic). */
  toggleBookmark(id: string): void {
    const rant = this.rantMap()[id];
    if (!rant) return;
    this.optimisticPatch(id, { isBookmarkedByMe: !rant.isBookmarkedByMe });
    this.api
      .toggleBookmark(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.reconcileRant(id),
        error: (err) => {
          this.revertOptimisticPatch(id, rant);
          this.error.set(this.humanizeError(err));
          this.status.set('error');
        },
      });
  }

  /* ------------------------ Post Expansion & Media Modal ------------------------ */

  /** Expand a post in-place (click on post content). */
  expandPost(id: string, mode: ExpandedPostMode = 'in-place'): void {
    this._expandedPostId.set(id);
    this._expandedPostMode.set(mode);
    this.syncState();
  }

  /** Collapse the currently expanded post. */
  collapsePost(): void {
    this._expandedPostId.set(null);
    this._expandedPostMode.set('in-place');
    this.syncState();
  }

  /** Open media modal for a post (click on media). */
  openMediaModal(postId: string, mediaIndex: number = 0): void {
    this._mediaModalPostId.set(postId);
    this._mediaModalMediaIndex.set(mediaIndex);
    this.syncState();
  }

  /** Close the media modal. */
  closeMediaModal(): void {
    this._mediaModalPostId.set(null);
    this._mediaModalMediaIndex.set(0);
    this.syncState();
  }

  /* ------------------------ Scroll Position Preservation ------------------------ */

  /** Save current feed scroll position. */
  saveScrollPosition(position: number): void {
    this._scrollPosition.set(Math.max(0, position));
    this.syncState();
  }

  /** Get saved scroll position. */
  getScrollPosition(): number {
    return this._scrollPosition();
  }

  /** Clear saved scroll position (e.g., on feed reset). */
  clearScrollPosition(): void {
    this._scrollPosition.set(0);
    this.syncState();
  }

  /* ------------------------------ Internals ----------------------------- */

  private isQueryInFlight(): boolean {
    return this.status() === 'loading' || this.status() === 'loading-more';
  }

  private runPageQuery(query: { page: number; pageSize: number }, mode: 'loading' | 'loading-more' | 'refreshing'): void {
    this.status.set(mode);
    this.error.set(null);

    this.api
      .getHomeFeed(query.page, query.pageSize)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => this.applyPage(items, query, mode),
        error: (err) => {
          this.status.set('error');
          this.error.set(this.humanizeError(err));
        },
      });
  }

  private applyPage(items: Rant[], query: { page: number; pageSize: number }, mode: 'loading' | 'loading-more' | 'refreshing'): void {
    if (mode === 'loading-more') {
      // Append the page; de-dupe by id.
      const seen = new Set(this.items().map((r) => r.id));
      const merged = this.items().concat(items.filter((r) => !seen.has(r.id)));
      this.items.set(merged);
    } else {
      this.items.set(items);
    }
    this.page.set(query.page);
    // Refresh the lookup map for the currently-loaded set.
    const map: Record<string, Rant> = {};
    for (const r of this.items()) map[r.id] = r;
    this.rantMap.set(map);
    this.status.set('idle');
    this.syncState();
  }

  /** Patch a single rant optimistically in both the items list and the map. */
  private optimisticPatch(id: string, patch: Partial<Rant>): void {
    const current = this.rantMap()[id];
    if (!current) return;
    const updated = { ...current, ...patch };
    this.rantMap.update((m) => ({ ...m, [id]: updated }));
    this.items.update((list) => list.map((r) => (r.id === id ? updated : r)));
    this.syncState();
  }

  private revertOptimisticPatch(id: string, original: Rant): void {
    this.rantMap.update((m) => ({ ...m, [id]: original }));
    this.items.update((list) => list.map((r) => (r.id === id ? original : r)));
    this.syncState();
  }

  /** Re-fetch the latest truth from the server for one rant and reconcile into state. */
  private reconcileRant(id: string): void {
    this.api
      .getRant(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rant) => {
          const updated = { ...rant };
          this.rantMap.update((m) => ({ ...m, [id]: updated }));
          this.items.update((list) => list.map((r) => (r.id === id ? updated : r)));
          this.syncState();
        },
      });
  }

  private syncState(): void {
    this.state.set({
      items: this.items(),
      rantMap: this.rantMap(),
      page: this.page(),
      pageSize: this.pageSize(),
      status: this.status(),
      error: this.error(),
      scrollPosition: this._scrollPosition(),
      expandedPostId: this._expandedPostId(),
      expandedPostMode: this._expandedPostMode(),
      mediaModalPostId: this._mediaModalPostId(),
      mediaModalMediaIndex: this._mediaModalMediaIndex(),
    });
  }

  private humanizeError(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err instanceof Error) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        return 'Network unreachable — is the API running at 192.168.1.44:5000?';
      }
      if (err.message.toLowerCase().includes('401')) return 'Session expired — please sign in again.';
      if (err.message.toLowerCase().includes('404')) return 'Rant not found.';
      return err.message;
    }
    return 'Feed action failed.';
  }
}

/* --------------------------------- Hook --------------------------------- */

import { InjectionToken, Provider, inject as angularInject } from '@angular/core';

export const FEED_CONTEXT = new InjectionToken<FeedContext>('FEED_CONTEXT');

/**
 * Provide the feed state at a given feed boundary. Typically added to the
 * route/component that hosts the home feed; guards on that route should run
 * authGuard so an authenticated session is guaranteed to exist when the
 * Context mounts.
 */
export function provideFeedContext(): Provider {
  return { provide: FEED_CONTEXT, useClass: FeedContext };
}

/**
 * Hook for components inside the feed boundary to consume the FeedContext.
 */
export function useFeedContext(): FeedContext {
  return angularInject(FEED_CONTEXT);
}
