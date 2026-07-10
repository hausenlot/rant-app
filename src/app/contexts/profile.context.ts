import {
  Injectable,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Subject, takeUntil, Observable, tap, catchError, throwError } from 'rxjs';
import { UserService } from '../services/user.service';
import { RantService } from '../services/rant.service';
import { UserProfile, UpdateProfileRequest } from '../models/user.model';
import { Rant, Reply } from '../models/rant.model';

export type ProfileTab = 'rants' | 'replies' | 'likes';
export type QueryStatus = 'idle' | 'loading' | 'refreshing' | 'loading-more' | 'success' | 'error';

export interface ProfileState {
  readonly profile: UserProfile | null;
  readonly activeTab: ProfileTab;
  readonly profileStatus: QueryStatus;
  readonly profileError: string | null;

  readonly rants: Rant[];
  readonly rantsPage: number;
  readonly rantsStatus: QueryStatus;
  readonly rantsHasMore: boolean;

  readonly replies: Reply[];
  readonly repliesPage: number;
  readonly repliesStatus: QueryStatus;
  readonly repliesHasMore: boolean;

  readonly likes: Rant[];
  readonly likesPage: number;
  readonly likesStatus: QueryStatus;
  readonly likesHasMore: boolean;
}

export const INITIAL_PROFILE_STATE: ProfileState = {
  profile: null,
  activeTab: 'rants',
  profileStatus: 'idle',
  profileError: null,

  rants: [],
  rantsPage: 0,
  rantsStatus: 'idle',
  rantsHasMore: true,

  replies: [],
  repliesPage: 0,
  repliesStatus: 'idle',
  repliesHasMore: true,

  likes: [],
  likesPage: 0,
  likesStatus: 'idle',
  likesHasMore: true,
};

@Injectable()
export class ProfileContext {
  private readonly userService = inject(UserService);
  private readonly rantService = inject(RantService);

  private readonly cancel$ = new Subject<void>();

  /* --- Raw Signals --- */
  private readonly _profile = signal<UserProfile | null>(INITIAL_PROFILE_STATE.profile);
  private readonly _activeTab = signal<ProfileTab>(INITIAL_PROFILE_STATE.activeTab);
  private readonly _profileStatus = signal<QueryStatus>(INITIAL_PROFILE_STATE.profileStatus);
  private readonly _profileError = signal<string | null>(INITIAL_PROFILE_STATE.profileError);

  private readonly _rants = signal<Rant[]>(INITIAL_PROFILE_STATE.rants);
  private readonly _rantsPage = signal<number>(INITIAL_PROFILE_STATE.rantsPage);
  private readonly _rantsStatus = signal<QueryStatus>(INITIAL_PROFILE_STATE.rantsStatus);
  private readonly _rantsHasMore = signal<boolean>(INITIAL_PROFILE_STATE.rantsHasMore);

  private readonly _replies = signal<Reply[]>(INITIAL_PROFILE_STATE.replies);
  private readonly _repliesPage = signal<number>(INITIAL_PROFILE_STATE.repliesPage);
  private readonly _repliesStatus = signal<QueryStatus>(INITIAL_PROFILE_STATE.repliesStatus);
  private readonly _repliesHasMore = signal<boolean>(INITIAL_PROFILE_STATE.repliesHasMore);

  private readonly _likes = signal<Rant[]>(INITIAL_PROFILE_STATE.likes);
  private readonly _likesPage = signal<number>(INITIAL_PROFILE_STATE.likesPage);
  private readonly _likesStatus = signal<QueryStatus>(INITIAL_PROFILE_STATE.likesStatus);
  private readonly _likesHasMore = signal<boolean>(INITIAL_PROFILE_STATE.likesHasMore);

  /* --- Expose State Snapshot --- */
  readonly state = computed<ProfileState>(() => ({
    profile: this._profile(),
    activeTab: this._activeTab(),
    profileStatus: this._profileStatus(),
    profileError: this._profileError(),

    rants: this._rants(),
    rantsPage: this._rantsPage(),
    rantsStatus: this._rantsStatus(),
    rantsHasMore: this._rantsHasMore(),

    replies: this._replies(),
    repliesPage: this._repliesPage(),
    repliesStatus: this._repliesStatus(),
    repliesHasMore: this._repliesHasMore(),

    likes: this._likes(),
    likesPage: this._likesPage(),
    likesStatus: this._likesStatus(),
    likesHasMore: this._likesHasMore(),
  }));

  readonly derived = {
    isLoadingProfile: computed(() => this._profileStatus() === 'loading'),
    hasProfileError: computed(() => this._profileStatus() === 'error'),
    isTabLoading: computed(() => {
      const tab = this._activeTab();
      if (tab === 'rants') return this._rantsStatus() === 'loading';
      if (tab === 'replies') return this._repliesStatus() === 'loading';
      return this._likesStatus() === 'loading';
    }),
    isTabLoadingMore: computed(() => {
      const tab = this._activeTab();
      if (tab === 'rants') return this._rantsStatus() === 'loading-more';
      if (tab === 'replies') return this._repliesStatus() === 'loading-more';
      return this._likesStatus() === 'loading-more';
    }),
    tabHasMore: computed(() => {
      const tab = this._activeTab();
      if (tab === 'rants') return this._rantsHasMore();
      if (tab === 'replies') return this._repliesHasMore();
      return this._likesHasMore();
    }),
    activeTabItems: computed(() => {
      const tab = this._activeTab();
      if (tab === 'rants') return this._rants();
      if (tab === 'replies') return this._replies() as any[];
      return this._likes();
    }),
  };

  /* ------------------------------- Actions ----------------------------- */

  /** Load/Reset profile and all associated feeds. */
  loadProfile(username: string): void {
    this.cancel$.next(); // cancel pending operations
    this._profileStatus.set('loading');
    this._profileError.set(null);
    this.resetFeeds();

    this.userService
      .getUserProfile(username)
      .pipe(takeUntil(this.cancel$))
      .subscribe({
        next: (profile) => {
          this._profile.set(profile);
          this._profileStatus.set('success');
          // Automatically load the active tab's first page
          this.loadTab(this._activeTab(), true);
        },
        error: (err) => {
          this._profileStatus.set('error');
          this._profileError.set(this.humanizeError(err));
        },
      });
  }

  /** Set active tab and load its first page if not already loaded. */
  setActiveTab(tab: ProfileTab): void {
    if (this._activeTab() === tab) return;
    this._activeTab.set(tab);

    const items = tab === 'rants' ? this._rants() : tab === 'replies' ? this._replies() : this._likes();
    const page = tab === 'rants' ? this._rantsPage() : tab === 'replies' ? this._repliesPage() : this._likesPage();

    if (items.length === 0 && page === 0) {
      this.loadTab(tab, true);
    }
  }

  /** Load the first page or refresh a specific tab feed. */
  loadTab(tab: ProfileTab, reset = false): void {
    const profile = this._profile();
    if (!profile) return;

    const page = 1;
    const pageSize = 10;

    if (tab === 'rants') {
      this._rantsStatus.set(reset ? 'loading' : 'refreshing');
      this.userService.getUserRants(profile.username, page, pageSize)
        .pipe(takeUntil(this.cancel$))
        .subscribe({
          next: (items) => {
            this._rants.set(items);
            this._rantsPage.set(page);
            this._rantsHasMore.set(items.length >= pageSize);
            this._rantsStatus.set('success');
          },
          error: (err) => {
            this._rantsStatus.set('error');
          }
        });
    } else if (tab === 'replies') {
      this._repliesStatus.set(reset ? 'loading' : 'refreshing');
      this.userService.getUserReplies(profile.username, page, pageSize)
        .pipe(takeUntil(this.cancel$))
        .subscribe({
          next: (items) => {
            this._replies.set(items);
            this._repliesPage.set(page);
            this._repliesHasMore.set(items.length >= pageSize);
            this._repliesStatus.set('success');
          },
          error: (err) => {
            this._repliesStatus.set('error');
          }
        });
    } else {
      this._likesStatus.set(reset ? 'loading' : 'refreshing');
      this.userService.getUserLikes(profile.username, page, pageSize)
        .pipe(takeUntil(this.cancel$))
        .subscribe({
          next: (items) => {
            this._likes.set(items);
            this._likesPage.set(page);
            this._likesHasMore.set(items.length >= pageSize);
            this._likesStatus.set('success');
          },
          error: (err) => {
            this._likesStatus.set('error');
          }
        });
    }
  }

  /** Fetch the next page of items for the currently active tab (infinite scroll). */
  loadActiveTabNextPage(): void {
    const profile = this._profile();
    if (!profile) return;

    const tab = this._activeTab();
    const pageSize = 10;

    if (tab === 'rants') {
      if (this._rantsStatus() === 'loading-more' || !this._rantsHasMore()) return;
      const nextPage = this._rantsPage() + 1;
      this._rantsStatus.set('loading-more');

      this.userService.getUserRants(profile.username, nextPage, pageSize)
        .pipe(takeUntil(this.cancel$))
        .subscribe({
          next: (items) => {
            const seen = new Set(this._rants().map(r => r.id));
            const merged = this._rants().concat(items.filter(r => !seen.has(r.id)));
            this._rants.set(merged);
            this._rantsPage.set(nextPage);
            this._rantsHasMore.set(items.length >= pageSize);
            this._rantsStatus.set('success');
          },
          error: (err) => this._rantsStatus.set('error')
        });
    } else if (tab === 'replies') {
      if (this._repliesStatus() === 'loading-more' || !this._repliesHasMore()) return;
      const nextPage = this._repliesPage() + 1;
      this._repliesStatus.set('loading-more');

      this.userService.getUserReplies(profile.username, nextPage, pageSize)
        .pipe(takeUntil(this.cancel$))
        .subscribe({
          next: (items) => {
            const seen = new Set(this._replies().map(r => r.id));
            const merged = this._replies().concat(items.filter(r => !seen.has(r.id)));
            this._replies.set(merged);
            this._repliesPage.set(nextPage);
            this._repliesHasMore.set(items.length >= pageSize);
            this._repliesStatus.set('success');
          },
          error: (err) => this._repliesStatus.set('error')
        });
    } else {
      if (this._likesStatus() === 'loading-more' || !this._likesHasMore()) return;
      const nextPage = this._likesPage() + 1;
      this._likesStatus.set('loading-more');

      this.userService.getUserLikes(profile.username, nextPage, pageSize)
        .pipe(takeUntil(this.cancel$))
        .subscribe({
          next: (items) => {
            const seen = new Set(this._likes().map(r => r.id));
            const merged = this._likes().concat(items.filter(r => !seen.has(r.id)));
            this._likes.set(merged);
            this._likesPage.set(nextPage);
            this._likesHasMore.set(items.length >= pageSize);
            this._likesStatus.set('success');
          },
          error: (err) => this._likesStatus.set('error')
        });
    }
  }

  /** Optimistically toggle follow status. */
  toggleFollow(): void {
    const profile = this._profile();
    if (!profile) return;

    const previousFollowState = profile.isFollowedByMe;
    const previousFollowersCount = profile.followerCount;

    // Optimistic Update
    this._profile.set({
      ...profile,
      isFollowedByMe: !previousFollowState,
      followerCount: previousFollowersCount + (previousFollowState ? -1 : 1),
    });

    this.userService.toggleFollow(profile.username)
      .pipe(takeUntil(this.cancel$))
      .subscribe({
        next: () => {
          // Success: optionally re-load profile metadata to ensure sync
        },
        error: () => {
          // Revert on error
          this._profile.set({
            ...profile,
            isFollowedByMe: previousFollowState,
            followerCount: previousFollowersCount,
          });
        }
      });
  }

  /** Update user profile textual details. */
  updateProfileDetails(req: UpdateProfileRequest): Observable<any> {
    return this.userService.updateProfile(req).pipe(
      tap((res) => {
        const profile = this._profile();
        if (profile) {
          this._profile.set({
            ...profile,
            displayName: req.displayName || profile.displayName,
            bio: req.bio || profile.bio,
          });
        }
      }),
      catchError((err) => throwError(() => this.humanizeError(err)))
    );
  }

  /** Upload profile image file. */
  uploadProfileImage(file: File): Observable<any> {
    return this.userService.uploadProfileImage(file).pipe(
      tap((res) => {
        const profile = this._profile();
        if (profile && res.profileImageUrl) {
          this._profile.set({
            ...profile,
            profileImageUrl: res.profileImageUrl
          });
        }
      }),
      catchError((err) => throwError(() => this.humanizeError(err)))
    );
  }

  /** Upload banner image file. */
  uploadBannerImage(file: File): Observable<any> {
    return this.userService.uploadBannerImage(file).pipe(
      tap((res) => {
        const profile = this._profile();
        if (profile && res.bannerImageUrl) {
          this._profile.set({
            ...profile,
            bannerImageUrl: res.bannerImageUrl
          });
        }
      }),
      catchError((err) => throwError(() => this.humanizeError(err)))
    );
  }

  /** Delete profile image. */
  deleteProfileImage(): Observable<any> {
    return this.userService.deleteProfileImage().pipe(
      tap(() => {
        const profile = this._profile();
        if (profile) {
          this._profile.set({
            ...profile,
            profileImageUrl: undefined
          });
        }
      }),
      catchError((err) => throwError(() => this.humanizeError(err)))
    );
  }

  /** Delete banner image. */
  deleteBannerImage(): Observable<any> {
    return this.userService.deleteBannerImage().pipe(
      tap(() => {
        const profile = this._profile();
        if (profile) {
          this._profile.set({
            ...profile,
            bannerImageUrl: undefined
          });
        }
      }),
      catchError((err) => throwError(() => this.humanizeError(err)))
    );
  }

  /* ----------------------- Card Interactions ----------------------- */

  /** Optimistically toggle like on a rant card in the current views. */
  toggleLike(rantId: string): void {
    const currentRants = this._rants();
    const currentLikes = this._likes();

    const findAndToggle = (list: Rant[]) => {
      const idx = list.findIndex(r => r.id === rantId);
      if (idx === -1) return null;
      const target = list[idx];
      const updated = {
        ...target,
        isLikedByMe: !target.isLikedByMe,
        likeCount: target.likeCount + (target.isLikedByMe ? -1 : 1)
      };
      const next = [...list];
      next[idx] = updated;
      return { list: next, original: target };
    };

    const rantsResult = findAndToggle(currentRants);
    const likesResult = findAndToggle(currentLikes);

    if (rantsResult) this._rants.set(rantsResult.list);
    if (likesResult) this._likes.set(likesResult.list);

    this.rantService.toggleLike(rantId).subscribe({
      next: () => {
        // Reconcile by re-fetching that single rant
        this.rantService.getRant(rantId).subscribe(freshRant => {
          this.reconcileSingleRant(rantId, freshRant);
        });
      },
      error: () => {
        // Revert
        if (rantsResult) {
          const reverted = [...this._rants()];
          const idx = reverted.findIndex(r => r.id === rantId);
          if (idx !== -1) reverted[idx] = rantsResult.original;
          this._rants.set(reverted);
        }
        if (likesResult) {
          const reverted = [...this._likes()];
          const idx = reverted.findIndex(r => r.id === rantId);
          if (idx !== -1) reverted[idx] = likesResult.original;
          this._likes.set(reverted);
        }
      }
    });
  }

  /** Optimistically toggle rerant. */
  toggleRerant(rantId: string): void {
    const currentRants = this._rants();
    const currentLikes = this._likes();

    const findAndToggle = (list: Rant[]) => {
      const idx = list.findIndex(r => r.id === rantId);
      if (idx === -1) return null;
      const target = list[idx];
      const updated = {
        ...target,
        isRerantedByMe: !target.isRerantedByMe,
        reRantCount: target.reRantCount + (target.isRerantedByMe ? -1 : 1)
      };
      const next = [...list];
      next[idx] = updated;
      return { list: next, original: target };
    };

    const rantsResult = findAndToggle(currentRants);
    const likesResult = findAndToggle(currentLikes);

    if (rantsResult) this._rants.set(rantsResult.list);
    if (likesResult) this._likes.set(likesResult.list);

    this.rantService.toggleRerant(rantId).subscribe({
      next: () => {
        this.rantService.getRant(rantId).subscribe(freshRant => {
          this.reconcileSingleRant(rantId, freshRant);
        });
      },
      error: () => {
        if (rantsResult) {
          const reverted = [...this._rants()];
          const idx = reverted.findIndex(r => r.id === rantId);
          if (idx !== -1) reverted[idx] = rantsResult.original;
          this._rants.set(reverted);
        }
        if (likesResult) {
          const reverted = [...this._likes()];
          const idx = reverted.findIndex(r => r.id === rantId);
          if (idx !== -1) reverted[idx] = likesResult.original;
          this._likes.set(reverted);
        }
      }
    });
  }

  /** Optimistically toggle bookmark. */
  toggleBookmark(rantId: string): void {
    const currentRants = this._rants();
    const currentLikes = this._likes();

    const findAndToggle = (list: Rant[]) => {
      const idx = list.findIndex(r => r.id === rantId);
      if (idx === -1) return null;
      const target = list[idx];
      const updated = {
        ...target,
        isBookmarkedByMe: !target.isBookmarkedByMe
      };
      const next = [...list];
      next[idx] = updated;
      return { list: next, original: target };
    };

    const rantsResult = findAndToggle(currentRants);
    const likesResult = findAndToggle(currentLikes);

    if (rantsResult) this._rants.set(rantsResult.list);
    if (likesResult) this._likes.set(likesResult.list);

    this.rantService.toggleBookmark(rantId).subscribe({
      next: () => {
        this.rantService.getRant(rantId).subscribe(freshRant => {
          this.reconcileSingleRant(rantId, freshRant);
        });
      },
      error: () => {
        if (rantsResult) {
          const reverted = [...this._rants()];
          const idx = reverted.findIndex(r => r.id === rantId);
          if (idx !== -1) reverted[idx] = rantsResult.original;
          this._rants.set(reverted);
        }
        if (likesResult) {
          const reverted = [...this._likes()];
          const idx = reverted.findIndex(r => r.id === rantId);
          if (idx !== -1) reverted[idx] = likesResult.original;
          this._likes.set(reverted);
        }
      }
    });
  }

  /* ------------------------------- Internals ----------------------------- */

  private reconcileSingleRant(rantId: string, freshRant: Rant): void {
    this._rants.update(list => list.map(r => r.id === rantId ? freshRant : r));
    this._likes.update(list => list.map(r => r.id === rantId ? freshRant : r));
  }

  private resetFeeds(): void {
    this._rants.set([]);
    this._rantsPage.set(0);
    this._rantsStatus.set('idle');
    this._rantsHasMore.set(true);

    this._replies.set([]);
    this._repliesPage.set(0);
    this._repliesStatus.set('idle');
    this._repliesHasMore.set(true);

    this._likes.set([]);
    this._likesPage.set(0);
    this._likesStatus.set('idle');
    this._likesHasMore.set(true);
  }

  private humanizeError(err: any): string {
    if (typeof err === 'string') return err;
    if (err?.error?.message) return err.error.message;
    if (err?.message) return err.message;
    return 'An unexpected error occurred.';
  }
}

/* --------------------------------- Injection Setup ---------------------------------- */

import { InjectionToken, Provider, inject as angularInject } from '@angular/core';

export const PROFILE_CONTEXT = new InjectionToken<ProfileContext>('PROFILE_CONTEXT');

export function provideProfileContext(): Provider {
  return { provide: PROFILE_CONTEXT, useClass: ProfileContext };
}

export function useProfileContext(): ProfileContext {
  return angularInject(PROFILE_CONTEXT);
}
