import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { RantService } from '../../../services/rant.service';
import { UserService } from '../../../services/user.service';
import { AUTH_CONTEXT } from '../../../contexts/auth.context';
import { RantCardComponent } from '../../../components/rant-card/rant-card.component';
import { RantCardSkeletonComponent } from '../../../components/rant-card/rant-card-skeleton.component';
import { Rant } from '../../../models/rant.model';
import { UserProfile } from '../../../models/user.model';

@Component({
  selector: 'app-explore-search-feed',
  standalone: true,
  imports: [CommonModule, RantCardComponent, RantCardSkeletonComponent],
  templateUrl: './explore-search-feed.component.html',
  styleUrl: './explore-search-feed.component.css',
})
export class ExploreSearchFeedComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly rantService = inject(RantService);
  private readonly userService = inject(UserService);
  private readonly authCtx = inject(AUTH_CONTEXT);

  readonly isAuthenticated = this.authCtx.derived.isAuthenticated;

  query = signal<string>('');
  activeTab = signal<'rants' | 'people'>('rants');
  rants = signal<Rant[]>([]);
  users = signal<UserProfile[]>([]);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  private querySub?: Subscription;

  ngOnInit() {
    this.querySub = this.route.queryParams.subscribe(params => {
      const q = params['q'] || '';
      this.query.set(q);
      if (q) {
        this.performSearch(q);
      } else {
        this.rants.set([]);
        this.users.set([]);
      }
    });
  }

  ngOnDestroy() {
    this.querySub?.unsubscribe();
  }

  setActiveTab(tab: 'rants' | 'people') {
    this.activeTab.set(tab);
  }

  performSearch(q: string) {
    this.isLoading.set(true);
    this.error.set(null);

    forkJoin({
      rants: this.rantService.searchRants(q),
      users: this.userService.searchUsers(q)
    }).subscribe({
      next: (res) => {
        this.rants.set(res.rants);
        this.users.set(res.users);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Search failed', err);
        this.error.set('Search failed to load results.');
        this.isLoading.set(false);
      }
    });
  }

  goToProfile(username: string) {
    this.router.navigate(['/profile', username]);
  }

  toggleFollow(event: Event, user: UserProfile): void {
    event.stopPropagation(); // Avoid triggering navigation to profile

    if (!this.isAuthenticated()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }

    const previousFollowState = user.isFollowedByMe;
    const previousFollowerCount = user.followerCount;

    // Optimistic Update
    this.users.update(list =>
      list.map(u => u.id === user.id ? {
        ...u,
        isFollowedByMe: !previousFollowState,
        followerCount: previousFollowerCount + (previousFollowState ? -1 : 1)
      } : u)
    );

    this.userService.toggleFollow(user.username).subscribe({
      next: () => {
        // Follow status toggled successfully
      },
      error: (err) => {
        console.error('Failed to toggle follow status', err);
        // Revert optimistic update
        this.users.update(list =>
          list.map(u => u.id === user.id ? {
            ...u,
            isFollowedByMe: previousFollowState,
            followerCount: previousFollowerCount
          } : u)
        );
      }
    });
  }

  getInitials(user: UserProfile): string {
    return user.displayName
      ?.split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || user.username?.substring(0, 2).toUpperCase() || '?';
  }

  getAvatarColor(username: string): string {
    const colors = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #ec4899, #f43f5e)',
      'linear-gradient(135deg, #f59e0b, #f97316)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #3b82f6, #6366f1)',
      'linear-gradient(135deg, #8b5cf6, #a855f7)',
      'linear-gradient(135deg, #ef4444, #dc2626)',
    ];
    let sum = 0;
    for (let i = 0; i < username.length; i++) {
      sum += username.charCodeAt(i);
    }
    const index = sum % colors.length;
    return colors[index];
  }

  onToggleLike(id: string) {
    this.rantService.toggleLike(id).subscribe({
      next: () => {
        this.rants.update(list => list.map(r => {
          if (r.id === id) {
            const isLiked = !r.isLikedByMe;
            return {
              ...r,
              isLikedByMe: isLiked,
              likeCount: r.likeCount + (isLiked ? 1 : -1)
            };
          }
          return r;
        }));
      }
    });
  }

  onToggleReRant(id: string) {
    this.rantService.toggleRerant(id).subscribe({
      next: () => {
        this.rants.update(list => list.map(r => {
          if (r.id === id) {
            const isReranted = !r.isRerantedByMe;
            return {
              ...r,
              isRerantedByMe: isReranted,
              reRantCount: r.reRantCount + (isReranted ? 1 : -1)
            };
          }
          return r;
        }));
      }
    });
  }

  onToggleBookmark(id: string) {
    this.rantService.toggleBookmark(id).subscribe({
      next: () => {
        this.rants.update(list => list.map(r => {
          if (r.id === id) {
            return {
              ...r,
              isBookmarkedByMe: !r.isBookmarkedByMe
            };
          }
          return r;
        }));
      }
    });
  }
}
