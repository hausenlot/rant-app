import { Component, input, output } from '@angular/core';
import { UserProfile } from '../../../models/user.model';

/**
 * Compact user card for the "For you" explore tab.
 * Shows an avatar, display name, handle, and a follow button.
 */
@Component({
  selector: 'app-explore-user-card',
  standalone: true,
  templateUrl: './explore-user-card.component.html',
  styleUrl: './explore-user-card.component.css',
})
export class ExploreUserCardComponent {
  user = input.required<UserProfile>();
  followToggle = output<UserProfile>();
  cardClick = output<UserProfile>();

  get initials(): string {
    const u = this.user();
    return u.displayName
      ?.split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || u.username?.substring(0, 2).toUpperCase() || '?';
  }

  get avatarColor(): string {
    const colors = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #ec4899, #f43f5e)',
      'linear-gradient(135deg, #f59e0b, #f97316)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #3b82f6, #6366f1)',
      'linear-gradient(135deg, #8b5cf6, #a855f7)',
      'linear-gradient(135deg, #ef4444, #dc2626)',
    ];
    const username = this.user().username;
    let sum = 0;
    for (let i = 0; i < username.length; i++) {
      sum += username.charCodeAt(i);
    }
    const index = sum % colors.length;
    return colors[index];
  }

  onFollow(event: Event): void {
    event.stopPropagation();
    this.followToggle.emit(this.user());
  }

  onCardClick(): void {
    this.cardClick.emit(this.user());
  }
}

