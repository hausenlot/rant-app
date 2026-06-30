import { Component, signal } from '@angular/core';
import { NotificationCardComponent } from '../../components/notifications/notification-card.component';
import { Notification } from '../../models/notification.model';
import { SEED_NOTIFICATIONS } from '../../data/seed-notifications';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [NotificationCardComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
})
export class NotificationsComponent {
  protected readonly notifications = signal<Notification[]>(SEED_NOTIFICATIONS);

  protected get unreadCount(): number {
    return this.notifications().filter((n) => !n.isRead).length;
  }
}
