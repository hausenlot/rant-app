import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-rant-card-skeleton',
  standalone: true,
  templateUrl: './rant-card-skeleton.component.html',
  styleUrl: './rant-card-skeleton.component.css',
  host: {
    'style': 'display: block; width: 100%; max-width: 100%; box-sizing: border-box; min-width: 0;',
  },
})
export class RantCardSkeletonComponent {
  /** Number of skeleton cards to render. Defaults to 3. */
  @Input() count = 3;

  /** Array used by @for track — just indices 0..count-1. */
  get skeletonItems(): number[] {
    return Array.from({ length: this.count }, (_, i) => i);
  }
}
