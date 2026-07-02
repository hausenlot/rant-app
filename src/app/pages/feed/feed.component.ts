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
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { RantCardComponent } from '../../components/rant-card/rant-card.component';
import { RantCardSkeletonComponent } from '../../components/rant-card/rant-card-skeleton.component';
import { RantExpandedComponent } from '../../components/rant-card/rant-expanded.component';
import { PostMediaModalComponent } from '../../components/post-media-modal/post-media-modal.component';
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
import { HistoryService } from '../../services/history.service';
import { PostMediaModalService } from '../../components/post-media-modal/post-media-modal.service';
import { RantService } from '../../services/rant.service';

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
  // UI state signals
  readonly expandedPostId: Signal<string | null>;
  readonly expandedPostMode: Signal<'in-place' | 'modal'>;
  readonly mediaModalPostId: Signal<string | null>;
  readonly mediaModalMediaIndex: Signal<number>;
  readonly scrollPosition: Signal<number>;
  // Actions
  loadFirstPage(pageSize?: number): void;
  loadNextPage(): void;
  refresh(): void;
  reset(): void;
  /** Only available from the authenticated FeedContext; no-op for public. */
  toggleLike?(id: string): void;
  toggleRerant?(id: string): void;
  toggleBookmark?(id: string): void;
  // UI state actions
  expandPost(id: string, mode?: 'in-place' | 'modal'): void;
  collapsePost(): void;
  openMediaModal(postId: string, mediaIndex?: number): void;
  closeMediaModal(): void;
  saveScrollPosition(position: number): void;
  getScrollPosition(): number;
}

/* ──────────────────────────── Component ──────────────────────────── */

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [RantCardComponent, RantCardSkeletonComponent, RantExpandedComponent, RouterLink],
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
  private readonly historyService = inject(HistoryService);
  private readonly mediaModalService = inject(PostMediaModalService);
  private readonly rantService = inject(RantService);

  /** True when the user is signed in. */
  readonly isAuthenticated = this.authCtx.derived.isAuthenticated;

  /**
   * Signal-based proxy that delegates to FeedContext when authenticated,
   * ExploreTimelineContext when public. All signals reactively switch
   * source when auth state changes (login/logout mid-session).
   */
  readonly feed: FeedAdapter = this.buildAdapter();

  /** Store the current expanded rant details. */
  readonly currentExpandedRant = signal<Rant | null>(null);

  readonly hasExpandedOnce = signal(false);

  /** Track if scroll position has been restored for the current feed list view. */
  private scrollRestored = false;

  /** Track previous auth state to detect transitions. */
  private previousAuthState = this.isAuthenticated();

  /** Track if we're handling a popstate to avoid double-processing. */
  private isHandlingPopState = false;

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

    effect(() => {
      if (this.feed.expandedPostId()) {
        this.hasExpandedOnce.set(true);
      }
    });

    // Listen for browser back/forward navigation
    this.historyService.onPopState(() => this.handlePopState());

    // Subscribe to media modal close from the modal itself
    this.mediaModalService.closed$.subscribe(() => {
      if (!this.isHandlingPopState) {
        this.onMediaModalClosed();
      }
    });

    // Restore scroll position on initial load — fires once items are rendered.
    // Direct event handlers (onCollapsePost, handlePopState) handle subsequent restores.
    effect(() => {
      const items = this.feed.items();
      const isLoading = this.feed.isLoading();
      const expandedId = this.feed.expandedPostId();

      // Only restore once on the very first load of the feed (no expanded post)
      if (!isLoading && items.length > 0 && !expandedId && !this.scrollRestored) {
        this.scrollRestored = true;
        requestAnimationFrame(() => {
          setTimeout(() => {
            this.restoreScrollPosition() || this.restoreScrollFromHistory();
          }, 50);
        });
      }
    });
  }

  ngAfterViewInit() {
    this.updateDimensions();
    this.feed.loadFirstPage();

    // Check if there is an initial expanded post in history or URL hash
    const state = this.historyService.getState();
    const hash = window.location.hash;
    let initialPostId: string | null = null;
    let initialMediaPostId: string | null = null;

    if (state?.expandedPostId) {
      initialPostId = state.expandedPostId;
    } else if (hash.startsWith('#post-')) {
      initialPostId = hash.replace('#post-', '');
    } else if (state?.mediaModalPostId) {
      initialMediaPostId = state.mediaModalPostId;
    } else if (hash.startsWith('#media-')) {
      initialMediaPostId = hash.replace('#media-', '');
    }

    if (initialPostId) {
      this.feed.expandPost(initialPostId);
      this.loadRantForExpansion(initialPostId);
    } else if (initialMediaPostId) {
      this.feed.openMediaModal(initialMediaPostId);
      this.openMediaModalOverlay(initialMediaPostId);
    } else {
      this.restoreScrollFromHistory();
    }
  }

  private loadRantForExpansion(postId: string): void {
    this.currentExpandedRant.set(null);
    this.rantService.getRant(postId).subscribe({
      next: (rant) => {
        this.currentExpandedRant.set(rant);
      },
      error: (err) => {
        console.error('Failed to load rant for expansion:', err);
      }
    });
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

    // Use FeedContext for UI state (scroll, expanded post, media modal)
    // since ExploreTimelineContext doesn't have these features yet
    const feedCtx = self.feedCtx;

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

      // UI state signals (from FeedContext only)
      expandedPostId: feedCtx.derived.expandedPostId,
      expandedPostMode: feedCtx.derived.expandedPostMode,
      mediaModalPostId: feedCtx.derived.mediaModalPostId,
      mediaModalMediaIndex: feedCtx.derived.mediaModalMediaIndex,
      scrollPosition: feedCtx.derived.scrollPosition,

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

      // UI state actions
      expandPost(id: string, mode = 'in-place') {
        feedCtx.expandPost(id, mode);
      },
      collapsePost() {
        feedCtx.collapsePost();
      },
      openMediaModal(postId: string, mediaIndex = 0) {
        feedCtx.openMediaModal(postId, mediaIndex);
      },
      closeMediaModal() {
        feedCtx.closeMediaModal();
      },
      saveScrollPosition(position: number) {
        feedCtx.saveScrollPosition(position);
      },
      getScrollPosition() {
        return feedCtx.getScrollPosition();
      },
    };
  }

  /* ──────────────────────────── Event Handlers ──────────────────────────── */

  /** Handle click on post content - expand. */
  onExpandPost(postId: string): void {
    this.saveScrollPosition();
    this.scrollRestored = false;
    this.feed.expandPost(postId);
    this.historyService.pushExpandedPost(postId);

    const found = this.feed.items().find((r) => r.id === postId);
    if (found) {
      this.currentExpandedRant.set(found);
    } else {
      this.loadRantForExpansion(postId);
    }
  }

  /** Handle click on media - open media modal. */
  onOpenMediaModal(postId: string): void {
    this.saveScrollPosition();
    this.feed.openMediaModal(postId);
    this.historyService.pushMediaModal(postId);
    // Also open the actual CDK overlay modal
    this.openMediaModalOverlay(postId);
  }

  /** Handle close of expanded post (via close button or back navigation). */
  // onCollapsePost(): void {
  //   this.feed.collapsePost();
  //   this.scrollRestored = false;
  //   this.currentExpandedRant.set(null);
  //   this.historyService.replaceFeedState(this.feed.getScrollPosition());
  //   requestAnimationFrame(() => {
  //     this.restoreScrollPosition();
  //   });
  // }

  onCollapsePost(): void {
    this.saveScrollPosition(); // Save current position
    if (this.historyService.isExpandedPostState()) {
      history.back(); // Let popstate handle the rest
    } else {
      // Fallback if not in history state
      this.feed.collapsePost();
      this.currentExpandedRant.set(null);
      this.restoreScrollPosition();
    }
  }

  /** Handle close of media modal. */
  onMediaModalClosed(): void {
    this.feed.closeMediaModal();
    this.scrollRestored = false;
    this.historyService.replaceFeedState(this.feed.getScrollPosition());
    requestAnimationFrame(() => {
      this.restoreScrollPosition();
    });
  }

  /** Handle click on test button. */
  onQuoteClick(postId: string): void {
    // console.log("test")
    this.saveScrollPosition();
    this.feed.expandPost(postId);
    this.historyService.pushExpandedPost(postId);

    const found = this.feed.items().find((r) => r.id === postId);
    if (found) {
      this.currentExpandedRant.set(found);
    } else {
      this.loadRantForExpansion(postId);
    }
  }

  /** Handle click on quote media - open media modal. */
  onQuoteMediaClick(postId: string): void {
    // console.log(postId)
    this.saveScrollPosition();
    this.feed.openMediaModal(postId);
    this.historyService.pushMediaModal(postId);
    // Also open the actual CDK overlay modal
    this.openMediaModalOverlay(postId);
  }

  /** Handle browser back/forward navigation. */
  private handlePopState(): void {
    this.isHandlingPopState = true;

    try {
      const state = this.historyService.getState();

      if (state?.expandedPostId) {
        // Navigated back to an expanded post - keep it expanded
        this.scrollRestored = false;
        this.feed.expandPost(state.expandedPostId);
        this.mediaModalService.close(); // Make sure media modal is closed
        const found = this.feed.items().find((r) => r.id === state.expandedPostId);
        if (found) {
          this.currentExpandedRant.set(found);
        } else {
          this.loadRantForExpansion(state.expandedPostId);
        }
      } else if (state?.mediaModalPostId) {
        // Navigated back to a media modal - open it
        this.feed.openMediaModal(state.mediaModalPostId);
        this.openMediaModalOverlay(state.mediaModalPostId);
      } else {
        // Navigated back to feed - collapse everything and restore scroll
        // DON'T set scrollRestored to true here - let the restoration happen
        // this.scrollRestored = true; // ← REMOVE THIS LINE
        this.feed.collapsePost();
        this.feed.closeMediaModal();
        this.mediaModalService.close(); // Make sure media modal is closed
        this.currentExpandedRant.set(null);
        // Restore scroll after DOM update
        requestAnimationFrame(() => {
          this.restoreScrollPosition();
        });
      }
    } finally {
      this.isHandlingPopState = false;
    }
  }

  /** Open the CDK overlay media modal. */
  private openMediaModalOverlay(postId: string): void {
    // Find the rant in the current feed items to skip a redundant API call.
    // But what if its the quote rant? its not in the feed items.
    const rant = this.feed.items().find((r) => r.id === postId) ?? null;

    // Then instead of null, let's try finding it using the rantService
    // this.rantService.getRant(postId).subscribe({
    //   next: (rant) => {
    //     this.currentExpandedRant.set(rant);
    //   },
    //   error: (err) => {
    //     console.error('Failed to load rant for expansion:', err);
    //   }
    this.mediaModalService.open(
      PostMediaModalComponent,
      { postId },
      (instance) => {
        // rantData MUST be set before postId so the postId setter sees it
        // and skips the fetchRant() call.
        if (rant) instance.rantData = rant;
        instance.postId = postId;
      }
    );
  }

  /** Save current feed scroll position using window scroll API. */
  private saveScrollPosition(): void {
    const scrollPos = window.scrollY || document.documentElement.scrollTop;
    this.feed.saveScrollPosition(scrollPos);
  }

  /** Restore feed scroll position from saved state. Returns true if scroll was restored. */
  private restoreScrollPosition(): boolean {
    const savedPosition = this.feed.getScrollPosition();
    if (savedPosition > 0) {
      window.scrollTo(0, savedPosition);
      return true;
    }
    return false;
  }

  /** Restore scroll position from history state on initial load. Returns true if restored. */
  private restoreScrollFromHistory(): boolean {
    const savedPosition = this.historyService.getSavedScrollPosition();
    if (savedPosition !== null && savedPosition > 0) {
      window.scrollTo(0, savedPosition);
      return true;
    }
    return false;
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