import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, take } from 'rxjs';
import { Rant, Reply, MediaType } from '../../models/rant.model';
import { RantService } from '../../services/rant.service';
import { VideoPlayerComponent } from '../video-player/video-player.component';

@Component({
  selector: 'app-rant-expanded',
  standalone: true,
  imports: [CommonModule, VideoPlayerComponent],
  templateUrl: './rant-expanded.component.html',
  styleUrl: './rant-expanded.component.css',
  host: {
    'class': 'rant-expanded-host',
  },
})
export class RantExpandedComponent implements OnInit, OnDestroy {
  private readonly rantService = inject(RantService);
  private readonly destroy$ = new Subject<void>();

  @Input({ required: true }) rant!: Rant;
  @Input() readonly = false;

  @Output() close = new EventEmitter<void>();
  @Output() likeClick = new EventEmitter<string>();
  @Output() rerantClick = new EventEmitter<string>();
  @Output() bookmarkClick = new EventEmitter<string>();
  @Output() mediaClick = new EventEmitter<string>();

  /** Replies for this post. */
  replies = signal<Reply[]>([]);

  /** Loading state for replies. */
  loadingReplies = signal(true);

  /** Current reply page for pagination. */
  replyPage = signal(1);

  /** Whether there are more replies to load. */
  hasMoreReplies = signal(true);

  ngOnInit(): void {
    this.loadReplies();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadReplies(): void {
    this.loadingReplies.set(true);
    this.rantService.getReplies(this.rant.id, this.replyPage())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (replies) => {
          this.replies.update((current) => [...current, ...replies]);
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
    if (this.loadingReplies() || !this.hasMoreReplies()) return;
    this.replyPage.update((p) => p + 1);
    this.loadReplies();
  }

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
    if (this.rant.mediaUrl) {
      this.mediaClick.emit(this.rant.id);
    }
  }

  onClose(): void {
    this.close.emit();
  }

  getMediaType(): MediaType {
    return this.rant?.mediaType ?? 'image';
  }

  getMediaUrl(): string | undefined {
    return this.rant?.mediaUrl;
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
}