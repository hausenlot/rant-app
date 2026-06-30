export type NotificationType = 'like' | 'reply' | 'follow' | 'repost' | 'mention';

export interface Notification {
  id: string;
  type: NotificationType;
  userDisplayName: string;
  userUsername: string;
  userInitials: string;
  userAvatarColor: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  /** The rant content this notification relates to (optional). */
  relatedRantContent?: string;
}
