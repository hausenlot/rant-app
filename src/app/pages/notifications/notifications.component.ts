import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationCardComponent } from '../../components/notifications/notification-card.component';
import { Notification } from '../../models/notification.model';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [NotificationCardComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
})
export class NotificationsComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly notifications = this.notificationService.notifications;
  protected readonly unreadCount = this.notificationService.unreadCount;

  ngOnInit(): void {
    this.notificationService.loadNotifications().subscribe();
  }

  protected markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe();
  }

  protected onNotificationClick(notification: Notification): void {
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id).subscribe();
    }

    if (notification.type === 'follow') {
      this.router.navigate(['/profile', notification.userUsername]);
    } else if (notification.rantId) {
      this.router.navigate(['/'], { fragment: `post-${notification.rantId}` });
    }
  }
}
