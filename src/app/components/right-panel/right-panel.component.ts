import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-right-panel',
  imports: [],
  templateUrl: './right-panel.component.html',
  styleUrl: './right-panel.component.css',
})
export class RightPanel {
  constructor(private router: Router) { }

  get isExplorePage(): boolean {
    return this.router.url.startsWith('/explore');
  }
}
