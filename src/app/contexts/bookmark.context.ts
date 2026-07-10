import {
  Injectable,
  Signal,
  computed,
  inject,
  signal,
  effect,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { BookmarkService } from '../services/bookmark.service';
import { RantService } from '../services/rant.service';
import type { BookmarkDto } from '../models/bookmark.model';
import type { Rant } from '../models/rant.model';

export const BOOKMARK_DEFAULT_PAGE_SIZE = 10;
export const BOOKMARK_TTL_MS = 12 * 60 * 60 * 1000;

export type BookmarkStatus = 'idle' | 'loading' | 'refreshing' | 'loading-more' | 'error';

export interface BookmarkState {
  readonly items: BookmarkDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly status: BookmarkStatus;
  readonly error: string | null;
}

export interface BookmarkDerived {
  readonly isLoading: Signal<boolean>;
  readonly isRefreshing: Signal<boolean>;
  readonly isLoadingMore: Signal<boolean>;
  readonly hasError: Signal<boolean>;
  readonly hasMore: Signal<boolean>;
  readonly hasLoadedOnce: Signal<boolean>;
  readonly isEmpty: Signal<boolean>;
  readonly progressLabel: Signal<string>;
}

export const INITIAL_STATE: BookmarkState = {
  items: [],
  page: 0,
  pageSize: BOOKMARK_DEFAULT_PAGE_SIZE,
  total: 0,
  status: 'idle',
  error: null,
};

@Injectable()
export class BookmarkContext {
  private readonly bookmarkService = inject(BookmarkService);
  private readonly rantService = inject(RantService);

  private readonly cancel$ = new Subject<void>();

  /* --- raw signals --- */
  private readonly items = signal<BookmarkDto[]>(INITIAL_STATE.items);
  private readonly page = signal<number>(INITIAL_STATE.page);
  private readonly pageSize = signal<number>(INITIAL_STATE.pageSize);
  private readonly total = signal<number>(INITIAL_STATE.total);
  private readonly status = signal<BookmarkStatus>(INITIAL_STATE.status);
  private readonly error = signal<string | null>(INITIAL_STATE.error);

  private readonly lastLoadedAt = signal<number | null>(null);

  /* --- expose raw state as snapshot --- */
  readonly state = signal<BookmarkState>(INITIAL_STATE);

  /* --- derived signals --- */
  readonly derived: BookmarkDerived = {
    isLoading: computed(() => this.status() === 'loading'),
    isRefreshing: computed(() => this.status() === 'refreshing'),
    isLoadingMore: computed(() => this.status() === 'loading-more'),
    hasError: computed(() => this.status() === 'error'),
    hasMore: computed(() => {
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

  loadFirstPage(pageSize: number = this.pageSize()): void {
    this.pageSize.set(pageSize);
    this.items.set([]);
    this.page.set(0);
    this.error.set(null);
    this.runQuery(1, pageSize, 'loading');
  }

  loadNextPage(): void {
    if (this.derived.isLoadingMore() || this.derived.isLoading()) return;
    if (!this.derived.hasMore()) return;
    const next = this.page() + 1;
    this.runQuery(next, this.pageSize(), 'loading-more');
  }

  refresh(pageSize: number = this.pageSize()): void {
    this.loadFirstPage(pageSize);
  }

  reset(): void {
    this.cancel$.next();
    this.items.set([]);
    this.page.set(0);
    this.total.set(0);
    this.error.set(null);
    this.status.set('idle');
    this.lastLoadedAt.set(null);
  }

  /**
   * Toggle bookmark (unbookmark) from this page.
   * Optimistically removes the item from the list.
   */
  toggleBookmark(id: string): void {
    const list = this.items();
    const target = list.find((item) => item.id === id);
    if (!target) return;

    // Optimistic remove
    this.items.update((prev) => prev.filter((item) => item.id !== id));

    this.rantService
      .toggleBookmark(id)
      .pipe(takeUntil(this.cancel$))
      .subscribe({
        next: () => {
          // Successfully toggled (removed). We can adjust the total count.
          this.total.update((t) => Math.max(0, t - 1));
        },
        error: () => {
          // Revert optimistic remove
          this.items.set(list);
        },
      });
  }

  /** Toggle like on a bookmarked rant. */
  toggleLike(id: string): void {
    const list = this.items();
    const target = list.find((item) => item.id === id);
    if (!target) return;

    const originalRant = target.rant;
    const updatedRant = {
      ...originalRant,
      isLikedByMe: !originalRant.isLikedByMe,
      likeCount: originalRant.likeCount + (originalRant.isLikedByMe ? -1 : 1),
    };

    this.updateRantInList(id, updatedRant);

    this.rantService
      .toggleLike(id)
      .pipe(takeUntil(this.cancel$))
      .subscribe({
        next: () => this.reconcileRant(id),
        error: () => this.updateRantInList(id, originalRant),
      });
  }

  /** Toggle rerant on a bookmarked rant. */
  toggleRerant(id: string): void {
    const list = this.items();
    const target = list.find((item) => item.id === id);
    if (!target) return;

    const originalRant = target.rant;
    const updatedRant = {
      ...originalRant,
      isRerantedByMe: !originalRant.isRerantedByMe,
      reRantCount: originalRant.reRantCount + (originalRant.isRerantedByMe ? -1 : 1),
    };

    this.updateRantInList(id, updatedRant);

    this.rantService
      .toggleRerant(id)
      .pipe(takeUntil(this.cancel$))
      .subscribe({
        next: () => this.reconcileRant(id),
        error: () => this.updateRantInList(id, originalRant),
      });
  }

  private updateRantInList(id: string, updatedRant: Rant): void {
    this.items.update((list) =>
      list.map((item) => (item.id === id ? { ...item, rant: updatedRant } : item))
    );
  }

  private reconcileRant(id: string): void {
    this.rantService
      .getRant(id)
      .pipe(takeUntil(this.cancel$))
      .subscribe({
        next: (rant) => this.updateRantInList(id, rant),
      });
  }

  /* ------------------------------- Internals ------------------------------ */

  private runQuery(page: number, pageSize: number, mode: 'loading' | 'loading-more'): void {
    this.cancel$.next();
    this.status.set(mode);
    this.error.set(null);

    this.bookmarkService
      .getBookmarks(page, pageSize)
      .pipe(takeUntil(this.cancel$))
      .subscribe({
        next: (items) => this.applyPage(items, page, pageSize, mode),
        error: (err: unknown) => {
          this.status.set('error');
          this.error.set(this.humanizeError(err));
        },
      });
  }

  private applyPage(
    newItems: BookmarkDto[],
    pageNum: number,
    pageSizeNum: number,
    mode: 'loading' | 'loading-more'
  ): void {
    if (mode === 'loading') {
      this.items.set(newItems);
    } else {
      const seen = new Set(this.items().map((item) => item.id));
      const merged = this.items().concat(newItems.filter((item) => !seen.has(item.id)));
      this.items.set(merged);
    }

    this.page.set(pageNum);
    // derivation fallback: total defaults to length if backend total not provided
    this.total.set(mode === 'loading' ? newItems.length : this.items().length);
    this.status.set('idle');
    this.lastLoadedAt.set(Date.now());
  }

  private humanizeError(err: unknown): string {
    if (err instanceof Error) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        return 'Network unreachable — please check if the backend API is running.';
      }
      return err.message;
    }
    return 'Failed to load bookmarks.';
  }
}

/* --------------------------------- Hook / Provider ---------------------------------- */

import { InjectionToken, Provider } from '@angular/core';

export const BOOKMARK_CONTEXT = new InjectionToken<BookmarkContext>('BOOKMARK_CONTEXT');

export function provideBookmarkContext(): Provider {
  return {
    provide: BOOKMARK_CONTEXT,
    useClass: BookmarkContext,
  };
}

export function useBookmarkContext(): BookmarkContext {
  return inject(BOOKMARK_CONTEXT);
}
