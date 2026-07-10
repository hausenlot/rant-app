import { Component, inject, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AUTH_CONTEXT } from '../../contexts/auth.context';
import { NotificationService } from '../../services/notification.service';
import { MessageContext } from '../../contexts/message.context';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  private readonly authCtx = inject(AUTH_CONTEXT);
  private readonly notificationService = inject(NotificationService);
  private readonly messageCtx = inject(MessageContext);
  private readonly router = inject(Router);

  readonly currentUser = computed(() => this.authCtx.state().currentUser);
  readonly unreadCount = computed(() => this.notificationService.unreadCount());
  readonly unreadMessagesCount = computed(() => this.messageCtx.totalUnreadCount());

  onRantClick() {
    if (this.currentUser()) {
      this.router.navigate(['/'], { queryParams: { compose: 'true' }, queryParamsHandling: 'merge' });
    } else {
      this.router.navigate(['/auth/sign-in']);
    }
  }

  onLogout() {
    this.authCtx.logout();
  }

  get avatarInitials(): string {
    const user = this.currentUser();
    if (!user) return '';
    return user.displayName
      ?.split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || user.username?.substring(0, 2).toUpperCase() || '?';
  }
}
