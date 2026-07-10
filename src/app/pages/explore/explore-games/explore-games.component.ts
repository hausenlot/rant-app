import { Component, OnInit, signal, inject, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { RantCardComponent } from '../../../components/rant-card/rant-card.component';
import { RantCardSkeletonComponent } from '../../../components/rant-card/rant-card-skeleton.component';
import { RantService } from '../../../services/rant.service';
import { AUTH_CONTEXT } from '../../../contexts/auth.context';
import { Rant } from '../../../models/rant.model';

@Component({
  selector: 'app-explore-games',
  standalone: true,
  imports: [RantCardComponent, RantCardSkeletonComponent],
  templateUrl: './explore-games.component.html',
  styleUrl: './explore-games.component.css',
})
export class ExploreGamesComponent implements OnInit {
  private readonly rantService = inject(RantService);
  private readonly authCtx = inject(AUTH_CONTEXT);
  private readonly router = inject(Router);

  readonly isAuthenticated = this.authCtx.derived.isAuthenticated;
  readonly rants = signal<Rant[]>([]);
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly isLoading = signal(false);
  readonly isLoadingMore = signal(false);
  readonly hasMore = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadFirstPage();
  }

  loadFirstPage(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.page.set(1);
    this.hasMore.set(true);

    this.rantService.searchRants('#gaming', 1, this.pageSize).subscribe({
      next: (items) => {
        this.rants.set(items || []);
        this.hasMore.set((items || []).length === this.pageSize);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load gaming posts', err);
        this.error.set('Failed to load gaming posts.');
        this.isLoading.set(false);
      },
    });
  }

  loadNextPage(): void {
    if (this.isLoading() || this.isLoadingMore() || !this.hasMore()) return;

    this.isLoadingMore.set(true);
    const nextPage = this.page() + 1;

    this.rantService.searchRants('#gaming', nextPage, this.pageSize).subscribe({
      next: (items) => {
        const currentList = this.rants();
        const seen = new Set(currentList.map((r) => r.id));
        const merged = currentList.concat((items || []).filter((r) => !seen.has(r.id)));

        this.rants.set(merged);
        this.page.set(nextPage);
        this.hasMore.set((items || []).length === this.pageSize);
        this.isLoadingMore.set(false);
      },
      error: (err) => {
        console.error('Failed to load more gaming posts', err);
        this.isLoadingMore.set(false);
      },
    });
  }

  onToggleLike(id: string): void {
    if (!this.isAuthenticated()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }

    const currentList = this.rants();
    const original = currentList.find((r) => r.id === id);
    if (!original) return;

    // Optimistic Update
    const updated = {
      ...original,
      isLikedByMe: !original.isLikedByMe,
      likeCount: original.likeCount + (original.isLikedByMe ? -1 : 1),
    };
    this.rants.update((list) => list.map((r) => (r.id === id ? updated : r)));

    this.rantService.toggleLike(id).subscribe({
      next: () => {
        this.reconcileRant(id);
      },
      error: (err) => {
        console.error('Failed to toggle like', err);
        this.rants.update((list) => list.map((r) => (r.id === id ? original : r)));
      },
    });
  }

  onToggleRerant(id: string): void {
    if (!this.isAuthenticated()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }

    const currentList = this.rants();
    const original = currentList.find((r) => r.id === id);
    if (!original) return;

    // Optimistic Update
    const updated = {
      ...original,
      isRerantedByMe: !original.isRerantedByMe,
      reRantCount: original.reRantCount + (original.isRerantedByMe ? -1 : 1),
    };
    this.rants.update((list) => list.map((r) => (r.id === id ? updated : r)));

    this.rantService.toggleRerant(id).subscribe({
      next: () => {
        this.reconcileRant(id);
      },
      error: (err) => {
        console.error('Failed to toggle rerant', err);
        this.rants.update((list) => list.map((r) => (r.id === id ? original : r)));
      },
    });
  }

  onToggleBookmark(id: string): void {
    if (!this.isAuthenticated()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }

    const currentList = this.rants();
    const original = currentList.find((r) => r.id === id);
    if (!original) return;

    // Optimistic Update
    const updated = {
      ...original,
      isBookmarkedByMe: !original.isBookmarkedByMe,
    };
    this.rants.update((list) => list.map((r) => (r.id === id ? updated : r)));

    this.rantService.toggleBookmark(id).subscribe({
      next: () => {
        this.reconcileRant(id);
      },
      error: (err) => {
        console.error('Failed to toggle bookmark', err);
        this.rants.update((list) => list.map((r) => (r.id === id ? original : r)));
      },
    });
  }

  private reconcileRant(id: string): void {
    this.rantService.getRant(id).subscribe({
      next: (r) => {
        this.rants.update((list) => list.map((item) => (item.id === id ? r : item)));
      },
    });
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
      this.rants().length > 0 &&
      this.hasMore() &&
      !this.isLoadingMore() &&
      !this.isLoading()
    ) {
      const pos = (window.scrollY || document.documentElement.scrollTop) + window.innerHeight;
      const max = document.documentElement.scrollHeight;
      if (pos >= max - 300) {
        this.loadNextPage();
      }
    }
  }
}

