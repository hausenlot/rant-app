import { Component, signal } from '@angular/core';
import { ExploreTopicCardComponent, ExploreTopic } from '../components/explore-topic-card.component';

const SEED_GAME_TOPICS: ExploreTopic[] = [
  { emoji: '🎮', title: 'Game Launches', tag: '#GameLaunch', count: '31.2K rants' },
  { emoji: '🕹️', title: 'Retro Gaming', tag: '#RetroVibes', count: '14.6K rants' },
  { emoji: '💻', title: 'PC Master Race', tag: '#PCGaming', count: '11.9K rants' },
  { emoji: '🎯', title: 'Speedruns', tag: '#Speedrun', count: '7.3K rants' },
  { emoji: '🏆', title: 'Game Awards', tag: '#GameAwards', count: '4.1K rants' },
];

@Component({
  selector: 'app-explore-games',
  standalone: true,
  imports: [ExploreTopicCardComponent],
  templateUrl: './explore-games.component.html',
})
export class ExploreGamesComponent {
  protected readonly topics = signal<ExploreTopic[]>(SEED_GAME_TOPICS);
}
