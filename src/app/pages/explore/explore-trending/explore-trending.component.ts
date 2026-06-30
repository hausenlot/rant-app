import { Component, signal } from '@angular/core';
import { ExplorePostCardComponent, ExplorePost } from '../components/explore-post-card.component';

const SEED_POSTS: ExplorePost[] = [
  { category: 'Technology · Trending', tag: '#AITakeover', count: '42.1K rants', description: 'Everyone has a take on AI replacing devs. Here are the best ones.' },
  { category: 'Politics · Trending', tag: '#ChaosGovernment', count: '19.8K rants' },
  { category: 'Gaming · Trending', tag: '#LiveServiceBad', count: '11.3K rants', description: 'Why do so many games launch broken in 2026?' },
  { category: 'Life · Trending', tag: '#MondayAgain', count: '8.5K rants' },
  { category: 'Programming · Trending', tag: '#SemicolonGate', count: '6.2K rants', description: 'The great semicolon debate continues.' },
];

@Component({
  selector: 'app-explore-trending',
  standalone: true,
  imports: [ExplorePostCardComponent],
  templateUrl: './explore-trending.component.html',
})
export class ExploreTrendingComponent {
  protected readonly posts = signal<ExplorePost[]>(SEED_POSTS);
}
