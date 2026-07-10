import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ParticipantDto {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
}

export interface ConversationDto {
  conversationId: string;
  name: string | null;
  isGroup: boolean;
  otherParticipant: ParticipantDto | null;
  lastMessageContent: string | null;
  lastMessageCreatedAt: string | null;
  lastMessageSenderUsername: string | null;
  unreadCount: number;
  participants: ParticipantDto[];
}

export interface MessageResponseDto {
  id: number;
  conversationId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderProfileImageUrl: string | null;
  content: string;
  mediaId: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = '/api/messages';

  /** Retrieve the list of active conversations for the current user. */
  getConversations(): Observable<ConversationDto[]> {
    return this.http.get<ConversationDto[]>(`${this.apiBaseUrl}/conversations`);
  }

  /** Start or load a 1-to-1 conversation with a user by username. */
  getOrCreate1To1Conversation(recipientUsername: string): Observable<ConversationDto> {
    return this.http.post<ConversationDto>(`${this.apiBaseUrl}/conversations/1to1`, { recipientUsername });
  }

  /** Retrieve paginated message history for a conversation. */
  getChatHistory(conversationId: string, page = 1, pageSize = 50): Observable<MessageResponseDto[]> {
    return this.http.get<MessageResponseDto[]>(`${this.apiBaseUrl}/conversations/${conversationId}/history`, {
      params: { page: String(page), pageSize: String(pageSize) }
    });
  }

  /** Send a message inside a conversation. */
  sendMessage(conversationId: string, content: string): Observable<MessageResponseDto> {
    return this.http.post<MessageResponseDto>(`${this.apiBaseUrl}/conversations/${conversationId}`, { content });
  }

  /** Mark all messages in a conversation as read. */
  markAsRead(conversationId: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiBaseUrl}/conversations/${conversationId}/read`, {});
  }
}
