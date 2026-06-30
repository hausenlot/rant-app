import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Rant } from '../../models/rant.model';

@Component({
    selector: 'app-rant-card',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './rant-card.component.html',
    styleUrl: './rant-card.component.css',
    // Force the host element to behave
    host: {
        'style': 'display: block; width: 100%; max-width: 100%; box-sizing: border-box; min-width: 0;'
    }
})

export class RantCardComponent {
    @Input({ required: true }) rant!: Rant;
    /** When true, action buttons (like/rerant/bookmark) are visible but disabled. */
    @Input() readonly = false;

    /** Emitted when the like button is clicked. */
    @Output() likeClick = new EventEmitter<string>();
    /** Emitted when the rerant button is clicked. */
    @Output() rerantClick = new EventEmitter<string>();
    /** Emitted when the bookmark button is clicked. */
    @Output() bookmarkClick = new EventEmitter<string>();

    /** Track which images have finished loading, keyed by rant id. */
    private loadedImages = new Set<string>();
    /** Track which quote-rant images have finished loading. */
    private loadedQuoteImages = new Set<string>();

    get avatarInitials(): string {
        if (!this.rant) return '';
        return this.rant.displayName
            ?.split(' ')
            .map(name => name[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || this.rant.username?.substring(0, 2).toUpperCase() || '?';
    }

    getAvatarColor(): string {
        const colors = [
            'linear-gradient(135deg, #6366f1, #8b5cf6)',
            'linear-gradient(135deg, #ec4899, #f43f5e)',
            'linear-gradient(135deg, #f59e0b, #f97316)',
            'linear-gradient(135deg, #10b981, #059669)',
            'linear-gradient(135deg, #3b82f6, #6366f1)',
            'linear-gradient(135deg, #8b5cf6, #a855f7)',
            'linear-gradient(135deg, #ef4444, #dc2626)',
        ];
        const index = parseInt(this.rant.id.split('-')[1] || '0') % colors.length;
        return colors[index];
    }

    /** Whether the media image for this rant has finished loading. */
    isImageLoaded(): boolean {
        return this.loadedImages.has(this.rant.id);
    }

    /** Called when the <img> fires its load event. */
    onImageLoad(): void {
        this.loadedImages.add(this.rant.id);
    }

    /** Whether the quote-rant media image has finished loading. */
    isQuoteImageLoaded(): boolean {
        return this.loadedQuoteImages.has(this.rant.id);
    }

    /** Called when the quote-rant <img> fires its load event. */
    onQuoteImageLoad(): void {
        this.loadedQuoteImages.add(this.rant.id);
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

    onLike(): void {
        if (!this.readonly) this.likeClick.emit(this.rant.id);
    }

    onRerant(): void {
        if (!this.readonly) this.rerantClick.emit(this.rant.id);
    }

    onBookmark(): void {
        if (!this.readonly) this.bookmarkClick.emit(this.rant.id);
    }
}
