import { Component, OnInit, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RantService } from '../../services/rant.service';
import { TrendingHashtag } from '../../models/rant.model';

const FALLBACK_TRENDS: TrendingHashtag[] = [
  { category: 'Technology · Trending', tag: '#AITakeover', count: 0 },
  { category: 'Politics · Trending', tag: '#ChaosGovernment', count: 0 },
  { category: 'Gaming · Trending', tag: '#LiveServiceBad', count: 0 },
  { category: 'Life · Trending', tag: '#MondayAgain', count: 0 }
];

@Component({
  selector: 'app-whats-trending',
  standalone: true,
  templateUrl: './whats-trending.component.html',
  styleUrl: './whats-trending.component.css'
})
export class WhatsTrendingComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly rantService = inject(RantService);

  readonly trends = signal<TrendingHashtag[]>([]);

  ngOnInit() {
    this.rantService.getTrendingHashtags().subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.trends.set(data.slice(0, 4));
        } else {
          this.trends.set(FALLBACK_TRENDS);
        }
      },
      error: () => {
        this.trends.set(FALLBACK_TRENDS);
      }
    });
  }

  onTagClick(tag: string) {
    this.router.navigate(['/explore/search'], { queryParams: { q: tag } });
  }

  showMoreTrends() {
    this.router.navigate(['/explore/trending']);
  }
}
