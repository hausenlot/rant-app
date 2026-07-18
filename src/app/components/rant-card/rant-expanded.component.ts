import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, take } from 'rxjs';
import { Rant, Reply, MediaType } from '../../models/rant.model';
import { RantService } from '../../services/rant.service';
import { VideoPlayerComponent } from '../video-player/video-player.component';
import { AUTH_CONTEXT } from '../../contexts/auth.context';
import { FEED_CONTEXT } from '../../contexts/feed.context';
import { ParseContentPipe } from '../../pipes/parse-content.pipe';

@Component({
  selector: 'app-rant-expanded',
  standalone: true,
  imports: [CommonModule, VideoPlayerComponent, ParseContentPipe],
  templateUrl: './rant-expanded.component.html',
  styleUrl: './rant-expanded.component.css',
  host: {
    'class': 'rant-expanded-host',
  },
})
export class RantExpandedComponent implements OnInit, OnDestroy {
  private readonly rantService = inject(RantService);
  private readonly authCtx = inject(AUTH_CONTEXT);
  private readonly feedCtx = inject(FEED_CONTEXT, { optional: true });
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  private _rant!: Rant;
  
  @Input({ required: true }) set rant(value: Rant) {
    this._rant = value;
    this.focusedItem.set(value);
    this.threadHistory.set([]);
    this.loadRepliesForCurrentFocused();
  }
  get rant(): Rant {
    return this._rant;
  }

  @Input() readonly = false;

  @Output() close = new EventEmitter<void>();
  @Output() likeClick = new EventEmitter<string>();
  @Output() rerantClick = new EventEmitter<string>();
  @Output() bookmarkClick = new EventEmitter<string>();
  @Output() mediaClick = new EventEmitter<string>();
  @Output() quoteClick = new EventEmitter<string>();
  @Output() quoteMediaClick = new EventEmitter<string>();

  /** Current user for showing avatar in reply section */
  currentUser = computed(() => this.authCtx.state().currentUser);

  /** Currently focused item in the thread view (Rant or Reply) */
  focusedItem = signal<Rant | Reply | null>(null);

  /** Navigation stack of parent posts (Rants or Replies) */
  threadHistory = signal<(Rant | Reply)[]>([]);

  /** Replies/Children for the currently focused post. */
  replies = signal<Reply[]>([]);

  /** Loading state for replies. */
  loadingReplies = signal(true);

  /** Current reply page for pagination. */
  replyPage = signal(1);

  /** Whether there are more replies to load. */
  hasMoreReplies = signal(true);

  // Reply compose state
  replyContent = signal('');
  selectedReplyFile = signal<File | null>(null);
  selectedReplyFilePreview = signal<string | null>(null);
  isSubmittingReply = signal(false);

  // ── Threaded reply state ──────────────────────────────────────────────

  /** Child replies keyed by parent reply ID. */
  childRepliesMap = signal<Record<string, Reply[]>>({});

  /** Loading states keyed by parent reply ID. */
  loadingChildReplies = signal<Record<string, boolean>>({});

  /** Set of reply IDs whose children are currently expanded/visible. */
  expandedReplies = signal<Set<string>>(new Set());

  /** The reply the user is currently composing a response to (null = replying to focused post). */
  replyingTo = signal<Reply | null>(null);

  ngOnInit(): void {
    if (!this.focusedItem()) {
      this.focusedItem.set(this.rant);
      this.loadRepliesForCurrentFocused();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Load replies for the currently focused item */
  loadRepliesForCurrentFocused(): void {
    const item = this.focusedItem();
    if (!item) return;

    this.loadingReplies.set(true);
    this.replies.set([]);
    this.replyPage.set(1);
    this.hasMoreReplies.set(true);

    const isReply = 'rantId' in item;
    const request$ = isReply
      ? this.rantService.getChildReplies(item.id, this.replyPage())
      : this.rantService.getReplies(item.id, this.replyPage());

    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (replies) => {
          this.replies.set(replies);
          this.hasMoreReplies.set(replies.length >= 10); // pageSize = 10
          this.loadingReplies.set(false);
        },
        error: (err) => {
          console.error('Failed to load replies:', err);
          this.loadingReplies.set(false);
        },
      });
  }

  loadMoreReplies(): void {
    const item = this.focusedItem();
    if (!item || this.loadingReplies() || !this.hasMoreReplies()) return;

    this.loadingReplies.set(true);
    const isReply = 'rantId' in item;
    const nextPage = this.replyPage() + 1;
    this.replyPage.set(nextPage);

    const request$ = isReply
      ? this.rantService.getChildReplies(item.id, nextPage)
      : this.rantService.getReplies(item.id, nextPage);

    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (replies) => {
          this.replies.update((current) => [...current, ...replies]);
          this.hasMoreReplies.set(replies.length >= 10);
          this.loadingReplies.set(false);
        },
        error: (err) => {
          console.error('Failed to load more replies:', err);
          this.loadingReplies.set(false);
        },
      });
  }

  // ── Thread Navigation methods ─────────────────────────────────────────

  /** Navigate back up the history stack */
  navigateBack(): void {
    const history = this.threadHistory();
    if (history.length === 0) {
      this.onClose();
      return;
    }

    const nextHistory = [...history];
    const prev = nextHistory.pop();
    this.threadHistory.set(nextHistory);
    this.focusedItem.set(prev || null);
    this.loadRepliesForCurrentFocused();
  }

  /** Drill down into a specific reply as the focused thread item */
  onReplyClick(reply: Reply, event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('.video-player-host') || target.closest('.rant-expanded__view-children')) {
      return;
    }

    const current = this.focusedItem();
    if (current) {
      this.threadHistory.update((h) => [...h, current]);
    }

    this.focusedItem.set(reply);
    this.loadRepliesForCurrentFocused();
  }

  /** Direct navigation to any ancestor in the breadcrumb path */
  navigateToAncestor(ancestor: Rant | Reply, index: number): void {
    const history = this.threadHistory();
    const nextHistory = history.slice(0, index);
    this.threadHistory.set(nextHistory);
    this.focusedItem.set(ancestor);
    this.loadRepliesForCurrentFocused();
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

  /** Set the reply the user wants to respond to. */
  onReplyToReply(reply: Reply): void {
    this.replyingTo.set(reply);
    setTimeout(() => {
      const textarea = document.querySelector('.rant-expanded__reply-textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  }

  /** Cancel replying to a specific reply (revert to replying to focused item). */
  cancelReplyTo(): void {
    this.replyingTo.set(null);
  }

  /** Toggle like on a reply and update local state. */
  onToggleReplyLike(reply: Reply): void {
    if (this.readonly) return;

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

          // Update if currently focused is this reply
          const focused = this.focusedItem();
          if (focused && focused.id === reply.id) {
            this.focusedItem.update((item) => {
              if (item) {
                return { ...item, isLikedByMe: !wasLiked, likeCount: item.likeCount + delta };
              }
              return item;
            });
          }
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

  // ── Rant interactions ─────────────────────────────────────────────────

  onLike(): void {
    if (!this.readonly) this.likeClick.emit(this.rant.id);
  }

  onRerant(): void {
    if (!this.readonly) this.rerantClick.emit(this.rant.id);
  }

  onBookmark(): void {
    if (!this.readonly) this.bookmarkClick.emit(this.rant.id);
  }

  onMediaClick(): void {
    const focused = this.focusedItem();
    if (focused?.mediaUrl) {
      this.mediaClick.emit(this.rant.id);
    }
  }

  onQuoteClick(event: MouseEvent): void {
    event.stopPropagation();
    const rantObj = this.asRant(this.focusedItem());
    if (rantObj?.quoteRantId) {
      this.quoteClick.emit(rantObj.quoteRantId);
    }
  }

  onQuoteMediaClick(event: MouseEvent): void {
    event.stopPropagation();
    const rantObj = this.asRant(this.focusedItem());
    if (rantObj?.quoteRantId) {
      this.quoteMediaClick.emit(rantObj.quoteRantId);
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onReplyInput(value: string): void {
    this.replyContent.set(value);
  }

  onReplyFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.selectedReplyFile.set(file);

      const reader = new FileReader();
      reader.onload = () => {
        this.selectedReplyFilePreview.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  removeSelectedReplyFile(): void {
    this.selectedReplyFile.set(null);
    this.selectedReplyFilePreview.set(null);
  }

  isReplyDisabled(): boolean {
    const text = this.replyContent().trim();
    return (text.length === 0 && !this.selectedReplyFile()) || text.length > 1000;
  }

  onReplyKeyDown(event: KeyboardEvent, textarea: HTMLTextAreaElement): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.submitReply(textarea);
    }
  }

  submitReply(textarea: HTMLTextAreaElement): void {
    if (this.isReplyDisabled() || this.isSubmittingReply()) return;

    this.isSubmittingReply.set(true);

    const content = this.replyContent().trim();
    const mediaFile = this.selectedReplyFile() || undefined;
    const parentReply = this.replyingTo();
    const focused = this.focusedItem();
    if (!focused) return;

    const isFocusedReply = 'rantId' in focused;
    const rantId = isFocusedReply ? (focused as Reply).rantId : focused.id;
    const parentReplyId = parentReply?.id ?? (isFocusedReply ? focused.id : undefined);

    const request$ = mediaFile
      ? this.rantService.createReplyWithMedia(rantId, { content, parentReplyId, mediaFile })
      : this.rantService.createReply(rantId, { content, parentReplyId });

    request$.pipe(take(1)).subscribe({
      next: (newReply) => {
        if (parentReply) {
          // Replying to a child reply in the list
          this.childRepliesMap.update((map) => {
            const existing = map[parentReply.id] || [];
            return { ...map, [parentReply.id]: [...existing, newReply] };
          });

          // Increment replyCount on that parent reply
          this.replies.update((list) =>
            list.map((r) =>
              r.id === parentReply.id ? { ...r, replyCount: r.replyCount + 1 } : r
            )
          );

          // Auto-expand the parent to show the new child
          this.expandedReplies.update((set) => {
            const next = new Set(set);
            next.add(parentReply.id);
            return next;
          });
        } else {
          // Replying directly to the focused post
          this.replies.update((current) => [...current, newReply]);
          
          // Increment replyCount on the focused item
          this.focusedItem.update((item) => {
            if (item) {
              return { ...item, replyCount: item.replyCount + 1 };
            }
            return item;
          });
        }

        // Increment root rant reply count in UI
        this.rant.replyCount++;

        // Reset state
        this.replyContent.set('');
        this.selectedReplyFile.set(null);
        this.selectedReplyFilePreview.set(null);
        this.replyingTo.set(null);
        textarea.value = '';
        this.isSubmittingReply.set(false);

        // Tell feed context to sync the counts for this rant
        if (this.feedCtx) {
          this.feedCtx.reconcileRant(this.rant.id);
        }
      },
      error: (err) => {
        console.error('Failed to create reply:', err);
        this.isSubmittingReply.set(false);
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  isReply(item: Rant | Reply | null): boolean {
    return !!item && 'rantId' in item;
  }

  asRant(item: Rant | Reply | null): Rant | null {
    return item && !('rantId' in item) ? (item as Rant) : null;
  }

  getMediaType(): MediaType {
    return this.focusedItem()?.mediaType ?? 'image';
  }

  getMediaUrl(): string | undefined {
    return this.focusedItem()?.mediaUrl;
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

  formatCount(count: number): string {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return String(count);
  }

  onHashtagClick(event: Event, tag: string): void {
    event.stopPropagation();
    this.router.navigate(['/explore/search'], { queryParams: { q: tag } });
  }

  onMentionClick(event: Event, mention: string): void {
    event.stopPropagation();
    const username = mention.replace(/^@/, '');
    this.router.navigate(['/profile', username]);
  }

  onEmbeddedMediaClick(event: Event, url: string): void {
    event.stopPropagation();
    window.open(url, '_blank');
  }
}