import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Notification, NotificationType } from '../../models/notification.model';

/**
 * Single notification row.
 * Shows an icon, avatar, message, timestamp, and optional rant preview.
 */
@Component({
  selector: 'app-notification-card',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './notification-card.component.html',
  styleUrl: './notification-card.component.css',
})
export class NotificationCardComponent {
  notification = input.required<Notification>();

  /** Returns the icon path for the notification type. */
  protected iconPath(type: NotificationType): string {
    switch (type) {
      case 'like':
        return 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z';
      case 'reply':
        return 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z';
      case 'repost':
        return 'M17 1l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3';
      case 'follow':
        return 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M20 8v6 M23 11h-6';
      case 'mention':
        return 'M12 2a10 10 0 1 0 10 10H12V2z';
      default:
        return '';
    }
  }

  /** Color for the icon background circle. */
  protected iconColor(type: NotificationType): string {
    switch (type) {
      case 'like':
        return '#f93058';
      case 'reply':
        return 'var(--color-primary)';
      case 'repost':
        return 'var(--color-primary)';
      case 'follow':
        return 'var(--color-accent)';
      case 'mention':
        return '#f59e0b';
      default:
        return 'var(--color-text-muted)';
    }
  }
}
