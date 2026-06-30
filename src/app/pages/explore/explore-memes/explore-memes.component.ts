import { Component, signal } from '@angular/core';
import { ExploreTopicCardComponent, ExploreTopic } from '../components/explore-topic-card.component';

const SEED_MEME_TOPICS: ExploreTopic[] = [
  { emoji: '😂', title: 'Dev Life', tag: '#DevLife', count: '24.3K rants' },
  { emoji: '💀', title: 'Code Reviews', tag: '#CodeReview', count: '18.7K rants' },
  { emoji: '🤡', title: 'Standup Meetings', tag: '#StandupClown', count: '12.1K rants' },
  { emoji: '😭', title: 'Production Bugs', tag: '#ProdBugTears', count: '9.5K rants' },
  { emoji: '🧢', title: 'Fake It Till You Make It', tag: '#FakeDev', count: '5.8K rants' },
];

@Component({
  selector: 'app-explore-memes',
  standalone: true,
  imports: [ExploreTopicCardComponent],
  templateUrl: './explore-memes.component.html',
})
export class ExploreMemesComponent {
  protected readonly topics = signal<ExploreTopic[]>(SEED_MEME_TOPICS);
}
