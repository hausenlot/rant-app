import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService, ConversationDto, MessageResponseDto } from '../services/message.service';
import { NotificationService } from '../services/notification.service';
import { AUTH_CONTEXT } from './auth.context';

@Injectable({ providedIn: 'root' })
export class MessageContext {
  private readonly api = inject(MessageService);
  private readonly notificationService = inject(NotificationService);
  private readonly authCtx = inject(AUTH_CONTEXT);

  // Core signals
  readonly conversations = signal<ConversationDto[]>([]);
  readonly activeConversation = signal<ConversationDto | null>(null);
  readonly activeMessages = signal<MessageResponseDto[]>([]);
  readonly isLoadingConversations = signal<boolean>(false);
  readonly isLoadingHistory = signal<boolean>(false);

  // Derived signals
  readonly totalUnreadCount = computed(() => {
    return this.conversations().reduce((sum, c) => sum + c.unreadCount, 0);
  });

  constructor() {
    // Reload conversations and clear state when login changes
    effect(() => {
      const user = this.authCtx.state().currentUser;
      if (user) {
        this.loadConversations();
      } else {
        this.conversations.set([]);
        this.activeConversation.set(null);
        this.activeMessages.set([]);
      }
    });

    // Listen to real-time messages forwarded from SignalR
    this.notificationService.messageReceived$
      .pipe(takeUntilDestroyed())
      .subscribe((msg: MessageResponseDto) => {
        this.handleIncomingMessage(msg);
      });
  }

  loadConversations(): void {
    this.isLoadingConversations.set(true);
    this.api.getConversations().subscribe({
      next: (convs) => {
        this.conversations.set(convs);
        this.isLoadingConversations.set(false);
      },
      error: () => this.isLoadingConversations.set(false)
    });
  }

  selectConversation(conv: ConversationDto | null): void {
    this.activeConversation.set(conv);
    if (!conv) {
      this.activeMessages.set([]);
      return;
    }

    // Mark as read in UI immediately
    this.conversations.update((list) =>
      list.map((c) =>
        c.conversationId === conv.conversationId ? { ...c, unreadCount: 0 } : c
      )
    );

    // Call API to mark read and fetch history
    this.api.markAsRead(conv.conversationId).subscribe();
    this.loadHistory(conv.conversationId);
  }

  loadHistory(conversationId: string): void {
    this.isLoadingHistory.set(true);
    this.api.getChatHistory(conversationId).subscribe({
      next: (history) => {
        this.activeMessages.set(history);
        this.isLoadingHistory.set(false);
      },
      error: () => this.isLoadingHistory.set(false)
    });
  }

  sendMessage(content: string): void {
    const active = this.activeConversation();
    if (!active || !content.trim()) return;

    this.api.sendMessage(active.conversationId, content).subscribe({
      next: (newMsg) => {
        // Append in UI
        this.activeMessages.update((prev) => [...prev, newMsg]);

        // Update last message in the sidebar list
        this.updateConversationLastMessage(active.conversationId, newMsg);
      }
    });
  }

  startNewChat(username: string, callback?: () => void): void {
    this.api.getOrCreate1To1Conversation(username).subscribe({
      next: (conv) => {
        // Add to list if not already present
        const list = this.conversations();
        const exists = list.some((c) => c.conversationId === conv.conversationId);
        if (!exists) {
          this.conversations.set([conv, ...list]);
        }
        this.selectConversation(conv);
        if (callback) callback();
      },
      error: (err: any) => {
        console.error('Error starting chat:', err);
        alert(err.error?.message || 'Failed to start chat. Check if the username exists.');
      }
    });
  }

  private handleIncomingMessage(msg: MessageResponseDto): void {
    const active = this.activeConversation();
    
    if (active && active.conversationId === msg.conversationId) {
      // Append message
      this.activeMessages.update((prev) => [...prev, msg]);
      
      // Auto-read receipt to backend
      this.api.markAsRead(msg.conversationId).subscribe();
      
      // Update last message
      this.updateConversationLastMessage(msg.conversationId, msg, 0);
    } else {
      // Message is for a background or new conversation
      const list = this.conversations();
      const existingConv = list.find((c) => c.conversationId === msg.conversationId);

      if (existingConv) {
        // Increment unread count and update last message
        this.conversations.update((prevList) =>
          prevList.map((c) =>
            c.conversationId === msg.conversationId
              ? {
                  ...c,
                  unreadCount: c.unreadCount + 1,
                  lastMessageContent: msg.content,
                  lastMessageCreatedAt: msg.createdAt,
                  lastMessageSenderUsername: msg.senderUsername
                }
              : c
          )
        );
        // Sort conversations list again
        this.sortConversations();
      } else {
        // Brand new conversation initiated by someone else
        this.loadConversations();
      }
    }
  }

  private updateConversationLastMessage(
    conversationId: string,
    msg: MessageResponseDto,
    unreadCountOverride?: number
  ): void {
    this.conversations.update((prevList) =>
      prevList.map((c) =>
        c.conversationId === conversationId
          ? {
              ...c,
              lastMessageContent: msg.content,
              lastMessageCreatedAt: msg.createdAt,
              lastMessageSenderUsername: msg.senderUsername,
              unreadCount: unreadCountOverride !== undefined ? unreadCountOverride : c.unreadCount
            }
          : c
      )
    );
    this.sortConversations();
  }

  private sortConversations(): void {
    this.conversations.update((list) =>
      [...list].sort((a, b) => {
        const timeA = a.lastMessageCreatedAt ? new Date(a.lastMessageCreatedAt).getTime() : 0;
        const timeB = b.lastMessageCreatedAt ? new Date(b.lastMessageCreatedAt).getTime() : 0;
        return timeB - timeA;
      })
    );
  }
}
