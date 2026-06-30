import { Component, input } from '@angular/core';

export interface ExploreTopic {
  emoji: string;
  title: string;
  tag: string;
  count: string;
}

/**
 * Topic card for the "Memes" and "Games" explore tabs.
 * Shows an emoji, topic title, hashtag, and rant count in a horizontal layout.
 */
@Component({
  selector: 'app-explore-topic-card',
  standalone: true,
  templateUrl: './explore-topic-card.component.html',
  styleUrl: './explore-topic-card.component.css',
})
export class ExploreTopicCardComponent {
  topic = input.required<ExploreTopic>();
}
