import { Component, signal, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ExplorePostCardComponent, ExplorePost } from '../components/explore-post-card.component';
import { RantService } from '../../../services/rant.service';

const FALLBACK_POSTS: ExplorePost[] = [
  { category: 'Technology · Trending', tag: '#AITakeover', count: '0 rants', description: 'Everyone has a take on AI replacing devs. Here are the best ones.' },
  { category: 'Politics · Trending', tag: '#ChaosGovernment', count: '0 rants' },
  { category: 'Gaming · Trending', tag: '#LiveServiceBad', count: '0 rants', description: 'Why do so many games launch broken in 2026?' },
  { category: 'Life · Trending', tag: '#MondayAgain', count: '0 rants' },
  { category: 'Programming · Trending', tag: '#SemicolonGate', count: '0 rants', description: 'The great semicolon debate continues.' },
];

@Component({
  selector: 'app-explore-trending',
  standalone: true,
  imports: [ExplorePostCardComponent],
  templateUrl: './explore-trending.component.html',
})
export class ExploreTrendingComponent implements OnInit {
  private readonly rantService = inject(RantService);
  private readonly router = inject(Router);

  protected readonly posts = signal<ExplorePost[]>([]);

  ngOnInit() {
    this.rantService.getTrendingHashtags().subscribe({
      next: (trends) => {
        if (trends && trends.length > 0) {
          const mapped = trends.map(t => ({
            category: t.category,
            tag: t.tag,
            count: t.count === 1 ? '1 rant' : `${t.count} rants`,
            description: t.description || undefined
          }));
          this.posts.set(mapped);
        } else {
          this.posts.set(FALLBACK_POSTS);
        }
      },
      error: () => {
        this.posts.set(FALLBACK_POSTS);
      }
    });
  }

  onTagClick(tag: string) {
    this.router.navigate(['/explore/search'], { queryParams: { q: tag } });
  }
}
