import { Component, input } from '@angular/core';

export interface ExploreUser {
  initials: string;
  displayName: string;
  username: string;
  avatarColor: string;
  bio?: string;
}

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
  user = input.required<ExploreUser>();
}
