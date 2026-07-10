import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { WhoToFollowComponent } from '../who-to-follow/who-to-follow.component';
import { ExploreSearchComponent } from '../../pages/explore/components/explore-search.component';
import { WhatsTrendingComponent } from '../whats-trending/whats-trending.component';

@Component({
  selector: 'app-right-panel',
  standalone: true,
  imports: [WhoToFollowComponent, ExploreSearchComponent, WhatsTrendingComponent],
  templateUrl: './right-panel.component.html',
  styleUrl: './right-panel.component.css',
})
export class RightPanel {
  private readonly router = inject(Router);

  get isExplorePage(): boolean {
    return this.router.url.startsWith('/explore');
  }

  get showWhoToFollow(): boolean {
    const url = this.router.url;
    return !(url === '/explore/for-you' || url === '/explore');
  }

  get showWhatsTrending(): boolean {
    return this.router.url !== '/explore/trending';
  }
}

