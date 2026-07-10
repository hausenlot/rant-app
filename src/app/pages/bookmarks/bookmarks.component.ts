import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BOOKMARK_CONTEXT, useBookmarkContext } from '../../contexts/bookmark.context';
import { AUTH_CONTEXT } from '../../contexts/auth.context';
import { RantCardComponent } from '../../components/rant-card/rant-card.component';
import { RantCardSkeletonComponent } from '../../components/rant-card/rant-card-skeleton.component';

@Component({
  selector: 'app-bookmarks',
  standalone: true,
  imports: [
    CommonModule,
    RantCardComponent,
    RantCardSkeletonComponent,
  ],
  templateUrl: './bookmarks.component.html',
  styleUrl: './bookmarks.component.css',
})
export class BookmarksComponent implements OnInit {
  protected readonly bookmarkCtx = useBookmarkContext();
  private readonly authCtx = inject(AUTH_CONTEXT);
  private readonly router = inject(Router);

  readonly isAuthenticated = this.authCtx.derived.isAuthenticated;

  ngOnInit(): void {
    this.bookmarkCtx.loadFirstPage();
  }

  onToggleLike(id: string): void {
    if (!this.isAuthenticated()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }
    this.bookmarkCtx.toggleLike(id);
  }

  onToggleRerant(id: string): void {
    if (!this.isAuthenticated()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }
    this.bookmarkCtx.toggleRerant(id);
  }

  onToggleBookmark(id: string): void {
    if (!this.isAuthenticated()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }
    this.bookmarkCtx.toggleBookmark(id);
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
      this.bookmarkCtx.state().items.length > 0 &&
      this.bookmarkCtx.derived.hasMore() &&
      !this.bookmarkCtx.derived.isLoadingMore() &&
      !this.bookmarkCtx.derived.isLoading()
    ) {
      const pos =
        (window.scrollY || document.documentElement.scrollTop) +
        window.innerHeight;
      const max = document.documentElement.scrollHeight;
      if (pos >= max - 300) {
        this.bookmarkCtx.loadNextPage();
      }
    }
  }
}