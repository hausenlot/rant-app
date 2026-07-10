import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { AUTH_CONTEXT } from '../../contexts/auth.context';
import { UserProfile } from '../../models/user.model';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-who-to-follow',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './who-to-follow.component.html',
  styleUrl: './who-to-follow.component.css'
})
export class WhoToFollowComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly authCtx = inject(AUTH_CONTEXT);
  private readonly router = inject(Router);

  readonly currentUser = computed(() => this.authCtx.state().currentUser);

  // States
  readonly suggestedUsers = signal<UserProfile[]>([]);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  
  // Suggested count management
  readonly currentCount = signal<number>(3);
  readonly hasMore = signal<boolean>(true);

  ngOnInit(): void {
    this.fetchSuggestions();
  }

  fetchSuggestions(): void {
    this.loading.set(true);
    this.error.set(null);

    this.userService.getSuggestedUsers(this.currentCount())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (users) => {
          this.suggestedUsers.set(users);
          // If we requested N suggestions but got fewer, we reached the end of suggested users
          if (users.length < this.currentCount()) {
            this.hasMore.set(false);
          } else {
            this.hasMore.set(true);
          }
        },
        error: (err) => {
          console.error('Failed to load user suggestions', err);
          this.error.set('Failed to load suggestions.');
        }
      });
  }

  showMore(): void {
    // Increment suggested users count (e.g., from 3 to 8, etc.)
    this.currentCount.update(c => c + 5);
    this.fetchSuggestions();
  }

  goToProfile(username: string): void {
    this.router.navigate(['/profile', username]);
  }

  toggleFollow(event: Event, user: UserProfile): void {
    event.stopPropagation(); // Avoid triggering navigation to profile

    if (!this.currentUser()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }

    const previousFollowState = user.isFollowedByMe;
    const previousFollowerCount = user.followerCount;

    // Optimistic Update
    this.suggestedUsers.update(users =>
      users.map(u => u.id === user.id ? {
        ...u,
        isFollowedByMe: !previousFollowState,
        followerCount: previousFollowerCount + (previousFollowState ? -1 : 1)
      } : u)
    );

    this.userService.toggleFollow(user.username).subscribe({
      next: () => {
        // Successfully toggled!
      },
      error: (err) => {
        console.error('Failed to toggle follow status', err);
        // Revert optimistic update
        this.suggestedUsers.update(users =>
          users.map(u => u.id === user.id ? {
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
}
