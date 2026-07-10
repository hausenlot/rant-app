import { Component, Input, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, take } from 'rxjs';
import { Rant, Reply, MediaType } from '../../models/rant.model';
import { RantService } from '../../services/rant.service';
import { PostMediaModalService } from './post-media-modal.service';
import { HistoryService } from '../../services/history.service';
import { VideoPlayerComponent } from '../video-player/video-player.component';

@Component({
  selector: 'app-post-media-modal',
  standalone: true,
  imports: [CommonModule, VideoPlayerComponent],
  templateUrl: './post-media-modal.component.html',
  styleUrl: './post-media-modal.component.css',
  host: {
    'class': 'post-media-modal-host',
  },
})
export class PostMediaModalComponent implements OnDestroy {
  private readonly rantService = inject(RantService);
  private readonly modalService = inject(PostMediaModalService);
  private readonly historyService = inject(HistoryService);
  private readonly destroy$ = new Subject<void>();

  /**
   * CDK Overlay calls ngOnInit BEFORE setInputs sets the @Input values.
   * Using a setter ensures data loading fires when postId is actually assigned.
   */
  private _postId = '';

  @Input({ required: true })
  set postId(value: string) {
    this._postId = value;
    if (value) {
      if (!this.rant) {
        this.fetchRant(value);
      }
      this.fetchReplies(value);
    }
  }
  get postId(): string { return this._postId; }

  @Input() mediaIndex = 0;

  /**
   * Optional: pass the already-loaded Rant to skip a redundant API call.
   * Must be set BEFORE postId in the setInputs callback so the postId setter
   * sees it and skips fetchRant().
   */
  @Input()
  set rantData(value: Rant | null) {
    if (value) {
      this.rant = value;
    }
  }

  /** The post being displayed. */
  rant: Rant | null = null;

  /** Loading state for the rant itself. */
  loadingRant = signal<boolean>(false);  // ← ADD THIS

  /** Replies for this post. */
  replies = signal<Reply[]>([]);

  /** Loading state for replies. */
  loadingReplies = signal(true);

  /** Current reply page for pagination. */
  replyPage = signal(1);

  /** Whether there are more replies to load. */
  hasMoreReplies = signal(true);

  /** Child replies keyed by parent reply ID. */
  childRepliesMap = signal<Record<string, Reply[]>>({});

  /** Loading states keyed by parent reply ID. */
  loadingChildReplies = signal<Record<string, boolean>>({});

  /** Set of reply IDs whose children are currently expanded/visible. */
  expandedReplies = signal<Set<string>>(new Set());


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private fetchRant(postId: string): void {
    this.loadingRant.set(true);  // ← ADD THIS - show loading
    this.rantService.getRant(postId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rant) => {
          this.rant = rant;
          this.loadingRant.set(false);  // ← ADD THIS - hide loading
        },
        error: (err) => {
          console.error('Failed to load rant for media modal:', err);
          this.loadingRant.set(false);  // ← ADD THIS - hide loading on error
        },
      });
  }

  private fetchReplies(postId: string): void {
    this.loadingReplies.set(true);
    this.rantService.getReplies(postId, this.replyPage())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (replies) => {
          this.replies.update((current) => [...current, ...replies]);
          this.hasMoreReplies.set(replies.length >= 10);
          this.loadingReplies.set(false);
        },
        error: (err) => {
          console.error('Failed to load replies:', err);
          this.loadingReplies.set(false);
        },
      });
  }

  loadMoreReplies(): void {
    if (this.loadingReplies() || !this.hasMoreReplies()) return;
    this.replyPage.update((p) => p + 1);
    this.fetchReplies(this._postId);
  }

  onMediaError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    console.warn('Failed to load media:', img.src);
  }

  close(): void {
    if (this.historyService.isMediaModalState()) {
      // CLOSE THE DAMN MODAL FIRST
      this.modalService.close();
      // THEN GO BACK
      history.back();
    } else {
      this.modalService.close();
    }
  }

  getMediaType(): MediaType {
    return this.rant?.mediaType ?? 'image';
  }

  getMediaUrl(): string | undefined {
    return this.rant?.mediaUrl;
  }

  formatReplyCount(count: number): string {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return String(count);
  }

  getAvatarInitials(displayName: string): string {
    return displayName
      ?.split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
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
    const index = parseInt(username.split('-')[1] || '0') % colors.length;
    return colors[index];
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    if (diffMins < 43200) return `${Math.floor(diffMins / 1440)}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ── Threaded reply methods ────────────────────────────────────────────

  /** Toggle visibility of a reply's children. Loads on first expand. */
  toggleChildReplies(reply: Reply): void {
    const expanded = this.expandedReplies();
    const next = new Set(expanded);

    if (next.has(reply.id)) {
      next.delete(reply.id);
      this.expandedReplies.set(next);
      return;
    }

    next.add(reply.id);
    this.expandedReplies.set(next);

    if (!this.childRepliesMap()[reply.id]) {
      this.loadChildReplies(reply.id);
    }
  }

  /** Fetch child replies for a given parent reply. */
  private loadChildReplies(parentReplyId: string): void {
    this.loadingChildReplies.update((m) => ({ ...m, [parentReplyId]: true }));

    this.rantService.getChildReplies(parentReplyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (children) => {
          this.childRepliesMap.update((m) => ({ ...m, [parentReplyId]: children }));
          this.loadingChildReplies.update((m) => ({ ...m, [parentReplyId]: false }));
        },
        error: (err) => {
          console.error('Failed to load child replies:', err);
          this.loadingChildReplies.update((m) => ({ ...m, [parentReplyId]: false }));
        },
      });
  }

  /** Toggle like on a reply and update local state. */
  onToggleReplyLike(reply: Reply): void {
    this.rantService.toggleReplyLike(reply.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          const wasLiked = reply.isLikedByMe;
          const delta = wasLiked ? -1 : 1;

          // Update in top-level replies
          this.replies.update((list) =>
            list.map((r) =>
              r.id === reply.id
                ? { ...r, isLikedByMe: !wasLiked, likeCount: r.likeCount + delta }
                : r
            )
          );

          // Update in child replies map
          this.childRepliesMap.update((map) => {
            const updated = { ...map };
            for (const key of Object.keys(updated)) {
              updated[key] = updated[key].map((r) =>
                r.id === reply.id
                  ? { ...r, isLikedByMe: !wasLiked, likeCount: r.likeCount + delta }
                  : r
              );
            }
            return updated;
          });
        },
        error: (err) => console.error('Failed to toggle reply like:', err),
      });
  }

  /** Check if a reply's children are currently expanded. */
  isExpanded(replyId: string): boolean {
    return this.expandedReplies().has(replyId);
  }

  /** Get child replies for a specific parent. */
  getChildReplies(parentReplyId: string): Reply[] {
    return this.childRepliesMap()[parentReplyId] || [];
  }

  /** Check if child replies are loading for a specific parent. */
  isLoadingChildren(parentReplyId: string): boolean {
    return !!this.loadingChildReplies()[parentReplyId];
  }

  getLocalTime(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  }

  getFullTime(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });
  }

  formatCount(count: number): string {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return String(count);
  }
}