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
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { RantCardComponent } from '../../components/rant-card/rant-card.component';
import { RantCardSkeletonComponent } from '../../components/rant-card/rant-card-skeleton.component';
import { RantExpandedComponent } from '../../components/rant-card/rant-expanded.component';
import { PostMediaModalComponent } from '../../components/post-media-modal/post-media-modal.component';
import { AUTH_CONTEXT } from '../../contexts/auth.context';
import {
  FEED_CONTEXT,
} from '../../contexts/feed.context';
import {
  EXPLORE_TIMELINE_CONTEXT,
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
})
export class FeedComponent implements AfterViewInit, OnDestroy {
  private readonly authCtx = inject(AUTH_CONTEXT);
  private readonly feedCtx = inject(FEED_CONTEXT);
  private readonly exploreCtx = inject(EXPLORE_TIMELINE_CONTEXT);
  private readonly historyService = inject(HistoryService);
  private readonly mediaModalService = inject(PostMediaModalService);
  private readonly rantService = inject(RantService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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

  // Compose rant state
  readonly currentUser = computed(() => this.authCtx.state().currentUser);
  readonly rantContent = signal('');
  readonly selectedFile = signal<File | null>(null);
  readonly selectedFilePreview = signal<string | null>(null);
  readonly isSubmitting = signal(false);

  /** Track previous auth state to detect transitions. */
  private previousAuthState = this.isAuthenticated();

  /** Unsubscribe from popstate handler on destroy. */
  private unsubPopState?: () => void;

  windowWidth = 0;
  mainContentWidth = 0;
  feedPageWidth = 0;

  @ViewChild('feedPage', { static: false }) feedPageRef!: ElementRef;
  @ViewChild(RantExpandedComponent) expandedComponent?: RantExpandedComponent;
  @ViewChild('rantInput', { static: false }) rantInputRef?: ElementRef<HTMLTextAreaElement>;

  private queryParamsSub?: any;

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
    this.unsubPopState = this.historyService.onPopState(() => this.handlePopState());

    // Subscribe to media modal close from the modal itself
    this.mediaModalService.closed$.subscribe(() => {
      this.onMediaModalClosed();
    });
  }

  ngAfterViewInit() {
    this.updateDimensions();

    // Resume-aware: only load if context has no valid cached data.
    // If the feed already has items (returned from another route), skip the API call
    // and just restore the scroll position.
    const shouldLoad = this.isAuthenticated()
      ? !this.feedCtx.hasData()
      : !this.exploreCtx.hasData();

    if (shouldLoad) {
      this.feed.loadFirstPage();
    }

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
    } else if (!shouldLoad) {
      // Feed already loaded — restore scroll position from context
      requestAnimationFrame(() => {
        setTimeout(() => {
          this.restoreScrollPosition();
        }, 50);
      });
    }

    // Listen for query parameters to trigger focus/compose state
    this.queryParamsSub = this.route.queryParams.subscribe(params => {
      if (params['compose'] === 'true') {
        this.triggerComposeFocus();
      }
    });
  }

  private triggerComposeFocus() {
    // 1. Collapse any expanded post so the feed-list is visible (which contains the compose box)
    if (this.feed.expandedPostId()) {
      this.feed.collapsePost();
      this.currentExpandedRant.set(null);
    }
    // 2. Clear query param so it doesn't trigger again on reload or back/forward
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { compose: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    // 3. Focus the element after a short timeout to let the UI update
    setTimeout(() => {
      if (this.rantInputRef) {
        this.rantInputRef.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.rantInputRef.nativeElement.focus();
      }
    }, 100);
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
    this.unsubPopState?.();
    this.queryParamsSub?.unsubscribe();
    this.saveScrollPosition();
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
  onCollapsePost(): void {
    if (this.expandedComponent && this.expandedComponent.threadHistory().length > 0) {
      this.expandedComponent.navigateBack();
      return;
    }

    if (this.historyService.isExpandedPostState()) {
      history.back(); // Let popstate handle the rest
    } else {
      // Fallback if not in history state
      this.feed.collapsePost();
      this.currentExpandedRant.set(null);
      requestAnimationFrame(() => {
        this.restoreScrollPosition();
      });
    }
  }

  /** Handle close of media modal. */
  onMediaModalClosed(): void {
    this.feed.closeMediaModal();
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
    const state = this.historyService.getState();

    if (state?.expandedPostId) {
      // Navigated back to an expanded post — keep it expanded
      this.feed.expandPost(state.expandedPostId);
      this.mediaModalService.close();
      const found = this.feed.items().find((r) => r.id === state.expandedPostId);
      if (found) {
        this.currentExpandedRant.set(found);
      } else {
        this.loadRantForExpansion(state.expandedPostId);
      }
    } else if (state?.mediaModalPostId) {
      // Navigated back to a media modal — open it
      this.feed.openMediaModal(state.mediaModalPostId);
      this.openMediaModalOverlay(state.mediaModalPostId);
    } else {
      // Navigated back to feed — collapse everything, restore scroll
      this.feed.collapsePost();
      this.feed.closeMediaModal();
      this.mediaModalService.close();
      this.currentExpandedRant.set(null);
      requestAnimationFrame(() => {
        this.restoreScrollPosition();
      });
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



  /* ──────────────────────────── Template helpers ──────────────────────────── */

  @HostListener('window:scroll')
  onWindowScroll() {
    if (this.feed.expandedPostId()) {
      return;
    }
    if (
      this.feed.items().length > 0 &&
      this.feed.hasMore() &&
      !this.feed.isLoadingMore() &&
      !this.feed.isLoading()
    ) {
      const pos = (window.scrollY || document.documentElement.scrollTop) + window.innerHeight;
      const max = document.documentElement.scrollHeight;
      if (pos >= max - 300) {
        this.feed.loadNextPage();
      }
    }
  }

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

  /* ──────────────────────────── Compose methods ──────────────────────────── */

  readonly MAX_CHARS = 500;
  private readonly MAX_HEIGHT = 517;

  onInput(textarea: HTMLTextAreaElement): void {
    // Enforce character limit
    if (textarea.value.length > this.MAX_CHARS) {
      textarea.value = textarea.value.slice(0, this.MAX_CHARS);
    }
    this.rantContent.set(textarea.value);

    // Auto-resize: reset height then expand to content, capped at MAX_HEIGHT
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, this.MAX_HEIGHT);
    textarea.style.height = newHeight + 'px';
    textarea.style.overflowY = textarea.scrollHeight > this.MAX_HEIGHT ? 'auto' : 'hidden';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.selectedFile.set(file);

      const reader = new FileReader();
      reader.onload = () => {
        this.selectedFilePreview.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  removeSelectedFile(): void {
    this.selectedFile.set(null);
    this.selectedFilePreview.set(null);
  }

  isPostDisabled(): boolean {
    const text = this.rantContent().trim();
    return text.length === 0 || text.length > this.MAX_CHARS;
  }

  submitRant(textarea: HTMLTextAreaElement): void {
    if (this.isPostDisabled() || this.isSubmitting()) return;

    this.isSubmitting.set(true);

    const payload = {
      content: this.rantContent().trim(),
      mediaFile: this.selectedFile() || undefined
    };

    this.rantService.createRantWithMedia(payload).subscribe({
      next: (newRant) => {
        // Insert new rant at the top
        this.feedCtx.insertRant(newRant);
        // Reset compose box state
        this.rantContent.set('');
        this.selectedFile.set(null);
        this.selectedFilePreview.set(null);
        textarea.value = '';
        textarea.style.height = 'auto';
        this.isSubmitting.set(false);
      },
      error: (err) => {
        console.error('Failed to create rant:', err);
        this.isSubmitting.set(false);
      }
    });
  }

  getAvatarInitials(displayName: string | undefined): string {
    if (!displayName) return '?';
    return displayName
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  }

  getAvatarColor(username?: string): string {
    const colors = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #ec4899, #f43f5e)',
      'linear-gradient(135deg, #f59e0b, #f97316)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #3b82f6, #6366f1)',
      'linear-gradient(135deg, #8b5cf6, #a855f7)',
      'linear-gradient(135deg, #ef4444, #dc2626)',
    ];
    const seed = username || 'Y';
    let sum = 0;
    for (let i = 0; i < seed.length; i++) {
      sum += seed.charCodeAt(i);
    }
    const index = sum % colors.length;
    return colors[index];
  }
}