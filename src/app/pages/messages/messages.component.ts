import { Component, inject, signal, computed, effect, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageContext } from '../../contexts/message.context';
import { AUTH_CONTEXT } from '../../contexts/auth.context';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.css',
})
export class MessagesComponent {
  readonly messageCtx = inject(MessageContext);
  readonly authCtx = inject(AUTH_CONTEXT);

  @ViewChild('messageStream') private messageStream!: ElementRef;

  // Local UI State
  newMessageText = '';
  searchUsername = '';
  showNewChatModal = false;

  readonly currentUser = computed(() => this.authCtx.state().currentUser);

  constructor() {
    // Scroll to bottom when message list changes
    effect(() => {
      const msgs = this.messageCtx.activeMessages();
      if (msgs.length > 0) {
        this.scrollToBottom();
      }
    });
  }

  onSendMessage(): void {
    const text = this.newMessageText.trim();
    if (!text) return;
    this.messageCtx.sendMessage(text);
    this.newMessageText = '';
  }

  onStartChat(): void {
    const username = this.searchUsername.trim();
    if (!username) return;
    
    this.messageCtx.startNewChat(username, () => {
      this.showNewChatModal = false;
      this.searchUsername = '';
    });
  }

  selectConversation(conv: any): void {
    this.messageCtx.selectConversation(conv);
  }

  goBackToList(): void {
    this.messageCtx.selectConversation(null);
  }

  closeModal(): void {
    this.showNewChatModal = false;
    this.searchUsername = '';
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messageStream) {
        const el = this.messageStream.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 100);
  }
}