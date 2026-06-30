import { Component, input } from '@angular/core';

export interface ExplorePost {
  category: string;
  tag: string;
  count: string;
  description?: string;
}

/**
 * Compact trending post card for the "Trending" explore tab.
 * Shows a category, hashtag tag, and rant count.
 */
@Component({
  selector: 'app-explore-post-card',
  standalone: true,
  templateUrl: './explore-post-card.component.html',
  styleUrl: './explore-post-card.component.css',
})
export class ExplorePostCardComponent {
  post = input.required<ExplorePost>();
}
