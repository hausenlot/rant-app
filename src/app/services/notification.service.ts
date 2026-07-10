import { Injectable, inject, signal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HubConnection, HubConnectionBuilder } from '@microsoft/signalr';
import { AUTH_CONTEXT } from '../contexts/auth.context';
import { Notification, NotificationType } from '../models/notification.model';
import { Observable, tap, Subject } from 'rxjs';

interface NotificationResponseDto {
  id: number;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  sourceUsername?: string;
  sourceDisplayName?: string;
  sourceProfileImageUrl?: string;
  rantId?: string;
  relatedRantContent?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly authCtx = inject(AUTH_CONTEXT);

  private readonly apiBaseUrl = '/api';
  private readonly hubBaseUrl = '';

  private hubConnection: HubConnection | null = null;

  // Signals
  readonly notifications = signal<Notification[]>([]);
  readonly unreadCount = signal<number>(0);

  // Re-use SignalR stream for direct messages
  readonly messageReceived$ = new Subject<any>();

  constructor() {
    // Reactively connect/disconnect based on user auth state
    effect(() => {
      const currentUser = this.authCtx.state().currentUser;
      if (currentUser) {
        this.connectHub();
        this.loadUnreadCount().subscribe();
      } else {
        this.disconnectHub();
        this.notifications.set([]);
        this.unreadCount.set(0);
      }
    });
  }

  /** Connect to the SignalR notification hub. */
  private connectHub(): void {
    if (this.hubConnection) return;

    const token = localStorage.getItem('token') || '';
    
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(`${this.hubBaseUrl}/hubs/notifications`, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('ReceiveNotification', (dto: NotificationResponseDto) => {
      const frontendNotification = this.mapToFrontendNotification(dto);
      
      // Update notifications list (prepend)
      this.notifications.update((prev) => [frontendNotification, ...prev]);
      
      // Increment unread count
      this.unreadCount.update((count) => count + 1);
    });

    this.hubConnection.on('ReceiveMessage', (dto: any) => {
      this.messageReceived$.next(dto);
    });

    this.hubConnection.start()
      .then(() => console.log('SignalR Notification Hub connected.'))
      .catch((err) => console.error('Error connecting to Notification Hub:', err));
  }

  /** Disconnect from the SignalR notification hub. */
  private disconnectHub(): void {
    if (this.hubConnection) {
      this.hubConnection.stop()
        .then(() => {
          console.log('SignalR Notification Hub disconnected.');
          this.hubConnection = null;
        })
        .catch((err) => console.error('Error stopping Notification Hub:', err));
    }
  }

  /** Load notifications list from API. */
  loadNotifications(page = 1, pageSize = 40): Observable<NotificationResponseDto[]> {
    return this.http.get<NotificationResponseDto[]>(`${this.apiBaseUrl}/notifications`, {
      params: { page: String(page), pageSize: String(pageSize) }
    }).pipe(
      tap((dtos) => {
        const mapped = dtos.map(dto => this.mapToFrontendNotification(dto));
        this.notifications.set(mapped);
      })
    );
  }

  /** Fetch current unread notifications count. */
  loadUnreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.apiBaseUrl}/notifications/unread-count`).pipe(
      tap((res) => {
        this.unreadCount.set(res.count);
      })
    );
  }

  /** Mark a single notification as read. */
  markAsRead(id: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiBaseUrl}/notifications/read/${id}`, {}).pipe(
      tap(() => {
        // Update local list
        this.notifications.update((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        // Decrement unread count
        this.unreadCount.update((count) => Math.max(0, count - 1));
      })
    );
  }

  /** Mark all notifications as read. */
  markAllAsRead(): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiBaseUrl}/notifications/read-all`, {}).pipe(
      tap(() => {
        // Update local list
        this.notifications.update((prev) =>
          prev.map((n) => ({ ...n, isRead: true }))
        );
        // Reset unread count
        this.unreadCount.set(0);
      })
    );
  }

  /** Map backend NotificationResponseDto to frontend Notification model. */
  private mapToFrontendNotification(dto: NotificationResponseDto): Notification {
    const typeMap: Record<string, NotificationType> = {
      'Like': 'like',
      'Reply': 'reply',
      'Follow': 'follow',
      'ReRant': 'repost',
      'Mention': 'mention'
    };

    const type = typeMap[dto.type] || 'mention';
    const sourceUsername = dto.sourceUsername || 'someone';
    const sourceDisplayName = dto.sourceDisplayName || sourceUsername;

    // Derive initials
    const initials = sourceDisplayName
      .split(' ')
      .map((name: string) => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || sourceUsername.substring(0, 2).toUpperCase() || '?';

    // Generate gradient background color based on sourceUsername
    const colors = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #ec4899, #f43f5e)',
      'linear-gradient(135deg, #f59e0b, #f97316)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #3b82f6, #6366f1)',
      'linear-gradient(135deg, #8b5cf6, #a855f7)',
      'linear-gradient(135deg, #ef4444, #dc2626)',
    ];
    let sum = 0;
    for (let i = 0; i < sourceUsername.length; i++) {
      sum += sourceUsername.charCodeAt(i);
    }
    const index = sum % colors.length;
    const userAvatarColor = colors[index];

    return {
      id: String(dto.id),
      type,
      userDisplayName: sourceDisplayName,
      userUsername: sourceUsername,
      userInitials: initials,
      userAvatarColor,
      message: dto.message,
      createdAt: dto.createdAt,
      isRead: dto.isRead,
      relatedRantContent: dto.relatedRantContent,
      rantId: dto.rantId,
      sourceProfileImageUrl: dto.sourceProfileImageUrl
    };
  }
}
