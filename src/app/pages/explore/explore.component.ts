import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ExploreSearchComponent } from './components/explore-search.component';

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ExploreSearchComponent],
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.css',
})
export class ExploreComponent { }
