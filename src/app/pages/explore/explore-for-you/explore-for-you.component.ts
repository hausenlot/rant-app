import { Component, OnInit, signal, inject, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { ExploreUserCardComponent } from '../components/explore-user-card.component';
import { RantCardComponent } from '../../../components/rant-card/rant-card.component';
import { RantCardSkeletonComponent } from '../../../components/rant-card/rant-card-skeleton.component';
import { UserService } from '../../../services/user.service';
import { AUTH_CONTEXT } from '../../../contexts/auth.context';
import { EXPLORE_TIMELINE_CONTEXT } from '../../../contexts/explore-timeline.context';
import { UserProfile } from '../../../models/user.model';

@Component({
  selector: 'app-explore-for-you',
  standalone: true,
  imports: [
    ExploreUserCardComponent,
    RantCardComponent,
    RantCardSkeletonComponent,
  ],
  templateUrl: './explore-for-you.component.html',
  styleUrl: './explore-for-you.component.css',
})
export class ExploreForYouComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly authCtx = inject(AUTH_CONTEXT);
  protected readonly exploreCtx = inject(EXPLORE_TIMELINE_CONTEXT);
  private readonly router = inject(Router);

  readonly isAuthenticated = this.authCtx.derived.isAuthenticated;
  readonly suggestedUsers = signal<UserProfile[]>([]);
  readonly suggestionsLoading = signal(true);

  ngOnInit(): void {
    this.fetchSuggestions();

    // Load explore timeline if not loaded or expired
    if (!this.exploreCtx.hasData()) {
      this.exploreCtx.loadFirstPage();
    }
  }

  fetchSuggestions(): void {
    this.suggestionsLoading.set(true);
    // Fetch suggestions from backend
    this.userService.getSuggestedUsers(4).subscribe({
      next: (users) => {
        // Filter out already followed users to keep only people we can follow
        const toFollow = (users || []).filter((u) => !u.isFollowedByMe);
        this.suggestedUsers.set(toFollow);
        this.suggestionsLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load user suggestions', err);
        this.suggestedUsers.set([]);
        this.suggestionsLoading.set(false);
      },
    });
  }

  onFollowToggle(user: UserProfile): void {
    if (!this.isAuthenticated()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }

    const prevFollowState = user.isFollowedByMe;
    const prevCount = user.followerCount;

    // Optimistic Update
    this.suggestedUsers.update((list) =>
      list.map((u) =>
        u.id === user.id
          ? {
            ...u,
            isFollowedByMe: !prevFollowState,
            followerCount: prevCount + (prevFollowState ? -1 : 1),
          }
          : u
      )
    );

    this.userService.toggleFollow(user.username).subscribe({
      next: () => {
        // Successful follow!
      },
      error: (err) => {
        console.error('Failed to toggle follow status', err);
        // Revert optimistic update
        this.suggestedUsers.update((list) =>
          list.map((u) =>
            u.id === user.id
              ? {
                ...u,
                isFollowedByMe: prevFollowState,
                followerCount: prevCount,
              }
              : u
          )
        );
      },
    });
  }

  onUserCardClick(username: string): void {
    this.router.navigate(['/profile', username]);
  }

  /* ── Explore Timeline Interactions ── */

  onToggleLike(id: string): void {
    if (!this.isAuthenticated()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }
    this.exploreCtx.toggleLike(id);
  }

  onToggleRerant(id: string): void {
    if (!this.isAuthenticated()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }
    this.exploreCtx.toggleRerant(id);
  }

  onToggleBookmark(id: string): void {
    if (!this.isAuthenticated()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }
    this.exploreCtx.toggleBookmark(id);
  }

  onExpandPost(postId: string): void {
    this.router.navigate(['/'], { fragment: `post-${postId}` });
  }

  onOpenMediaModal(postId: string): void {
    this.router.navigate(['/'], { fragment: `media-${postId}` });
  }

  onQuoteClick(postId: string): void {
    this.router.navigate(['/'], { fragment: `post-${postId}` });
  }

  onQuoteMediaClick(postId: string): void {
    this.router.navigate(['/'], { fragment: `media-${postId}` });
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (
      this.exploreCtx.state().items.length > 0 &&
      this.exploreCtx.derived.hasMore() &&
      !this.exploreCtx.derived.isLoadingMore() &&
      !this.exploreCtx.derived.isLoading()
    ) {
      const pos =
        (window.scrollY || document.documentElement.scrollTop) +
        window.innerHeight;
      const max = document.documentElement.scrollHeight;
      if (pos >= max - 300) {
        this.exploreCtx.loadNextPage();
      }
    }
  }
}

