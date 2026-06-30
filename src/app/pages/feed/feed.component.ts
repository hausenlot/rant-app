import {
  Component,
  HostListener,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  Signal,
  computed,
  effect,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { RantCardComponent } from '../../components/rant-card/rant-card.component';
import { RantCardSkeletonComponent } from '../../components/rant-card/rant-card-skeleton.component';
import { AUTH_CONTEXT, AuthContext } from '../../contexts/auth.context';
import {
  FEED_CONTEXT,
  FeedContext,
  provideFeedContext,
} from '../../contexts/feed.context';
import {
  EXPLORE_TIMELINE_CONTEXT,
  ExploreTimelineContext,
  provideExploreTimelineContext,
} from '../../contexts/explore-timeline.context';
import type { Rant } from '../../models/rant.model';

/* ──────────────────────────── Unified feed adapter ──────────────────────────── */

/**
 * Thin read-only adapter that the template consumes. Both FeedContext
 * (authenticated) and ExploreTimelineContext (public) are projected onto
 * this shape so the template never knows which backend is driving the feed.
 */
interface FeedAdapter {
  readonly items: Signal<Rant[]>;
  readonly isLoading: Signal<boolean>;
  readonly isRefreshing: Signal<boolean>;
  readonly isLoadingMore: Signal<boolean>;
  readonly hasMore: Signal<boolean>;
  readonly hasError: Signal<boolean>;
  readonly hasLoadedOnce: Signal<boolean>;
  readonly error: Signal<string | null>;
  readonly isEmpty: Signal<boolean>;
  loadFirstPage(pageSize?: number): void;
  loadNextPage(): void;
  refresh(): void;
  reset(): void;
  /** Only available from the authenticated FeedContext; no-op for public. */
  toggleLike?(id: string): void;
  toggleRerant?(id: string): void;
  toggleBookmark?(id: string): void;
}

/* ──────────────────────────── Component ──────────────────────────── */

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [RantCardComponent, RantCardSkeletonComponent, RouterLink],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.css',
  providers: [
    // Each FeedComponent instance owns its own context pair. When the
    // component is destroyed, the contexts are too — clean, no leaks.
    provideFeedContext(),
    provideExploreTimelineContext(),
  ],
})
export class FeedComponent implements AfterViewInit, OnDestroy {
  private readonly authCtx = inject(AUTH_CONTEXT);
  private readonly feedCtx = inject(FEED_CONTEXT);
  private readonly exploreCtx = inject(EXPLORE_TIMELINE_CONTEXT);

  /** True when the user is signed in. */
  readonly isAuthenticated = this.authCtx.derived.isAuthenticated;

  /**
   * Signal-based proxy that delegates to FeedContext when authenticated,
   * ExploreTimelineContext when public. All signals reactively switch
   * source when auth state changes (login/logout mid-session).
   */
  readonly feed: FeedAdapter = this.buildAdapter();

  /** Track previous auth state to detect transitions. */
  private previousAuthState = this.isAuthenticated();

  windowWidth = 0;
  mainContentWidth = 0;
  feedPageWidth = 0;

  @ViewChild('feedPage', { static: false }) feedPageRef!: ElementRef;

  constructor() {
    // When auth state changes (login/logout), reset stale context + reload.
    effect(() => {
      const current = this.isAuthenticated();
      if (current !== this.previousAuthState) {
        this.previousAuthState = current;
        this.onAuthChanged();
      }
    });
  }

  ngAfterViewInit() {
    this.updateDimensions();
    this.feed.loadFirstPage();
  }

  ngOnDestroy() {
    this.feed.reset();
  }

  /* ──────────────────────────── Auth transition ──────────────────────────── */

  /** Reset the context that was active before the change, then reload. */
  private onAuthChanged(): void {
    if (this.isAuthenticated()) {
      this.exploreCtx.reset();
    } else {
      this.feedCtx.reset();
    }
    this.feed.loadFirstPage();
  }

  /* ──────────────────────────── Adapter factory ──────────────────────────── */

  /**
   * Build a single FeedAdapter whose signals read from whichever context
   * matches the current auth state. Each computed() reads isAuthenticated(),
   * so Angular's reactivity graph automatically switches sources on login/logout.
   */
  private buildAdapter(): FeedAdapter {
    const self = this;

    const activeItems = computed(() =>
      self.isAuthenticated() ? self.feedCtx.state().items : self.exploreCtx.state().items
    );
    const activeError = computed(() =>
      self.isAuthenticated() ? self.feedCtx.state().error : self.exploreCtx.state().error
    );
    const activeIsLoading = computed(() =>
      self.isAuthenticated() ? self.feedCtx.derived.isLoading() : self.exploreCtx.derived.isLoading()
    );
    const activeIsRefreshing = computed(() =>
      self.isAuthenticated() ? self.feedCtx.derived.isRefreshing() : self.exploreCtx.derived.isRefreshing()
    );
    const activeIsLoadingMore = computed(() =>
      self.isAuthenticated() ? self.feedCtx.derived.isLoadingMore() : self.exploreCtx.derived.isLoadingMore()
    );
    const activeHasMore = computed(() =>
      self.isAuthenticated() ? self.feedCtx.derived.hasMore() : self.exploreCtx.derived.hasMore()
    );
    const activeHasError = computed(() =>
      self.isAuthenticated() ? self.feedCtx.derived.hasError() : self.exploreCtx.derived.hasError()
    );
    const activeHasLoadedOnce = computed(() =>
      self.isAuthenticated() ? self.feedCtx.derived.hasLoadedOnce() : self.exploreCtx.derived.hasLoadedOnce()
    );
    const activeIsEmpty = computed(() =>
      self.isAuthenticated() ? self.feedCtx.derived.isEmpty() : self.exploreCtx.derived.isEmpty()
    );

    return {
      items: activeItems,
      isLoading: activeIsLoading,
      isRefreshing: activeIsRefreshing,
      isLoadingMore: activeIsLoadingMore,
      hasMore: activeHasMore,
      hasError: activeHasError,
      hasLoadedOnce: activeHasLoadedOnce,
      error: activeError,
      isEmpty: activeIsEmpty,

      loadFirstPage(ps?: number) {
        self.isAuthenticated()
          ? self.feedCtx.loadFirstPage(ps)
          : self.exploreCtx.loadFirstPage(ps);
      },
      loadNextPage() {
        self.isAuthenticated()
          ? self.feedCtx.loadNextPage()
          : self.exploreCtx.loadNextPage();
      },
      refresh() {
        self.isAuthenticated()
          ? self.feedCtx.refresh()
          : self.exploreCtx.refresh();
      },
      reset() {
        self.feedCtx.reset();
        self.exploreCtx.reset();
      },
      toggleLike(id: string) {
        if (self.isAuthenticated()) self.feedCtx.toggleLike(id);
      },
      toggleRerant(id: string) {
        if (self.isAuthenticated()) self.feedCtx.toggleRerant(id);
      },
      toggleBookmark(id: string) {
        if (self.isAuthenticated()) self.feedCtx.toggleBookmark(id);
      },
    };
  }

  /* ──────────────────────────── Template helpers ──────────────────────────── */

  @HostListener('window:resize')
  onResize() {
    this.updateDimensions();
  }

  updateDimensions() {
    this.windowWidth = window.innerWidth;
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      this.mainContentWidth = mainContent.getBoundingClientRect().width;
    }
    if (this.feedPageRef) {
      this.feedPageWidth = this.feedPageRef.nativeElement.getBoundingClientRect().width;
    }
  }

  onToggleLike(id: string): void {
    this.feed.toggleLike?.(id);
  }

  onToggleRerant(id: string): void {
    this.feed.toggleRerant?.(id);
  }

  onToggleBookmark(id: string): void {
    this.feed.toggleBookmark?.(id);
  }
}
