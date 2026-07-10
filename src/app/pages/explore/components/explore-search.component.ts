import { Component, ElementRef, ViewChild, inject, OnInit, signal, HostListener } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { UserService } from '../../../services/user.service';
import { RantService } from '../../../services/rant.service';
import { UserProfile } from '../../../models/user.model';

@Component({
  selector: 'app-explore-search',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './explore-search.component.html',
  styleUrl: './explore-search.component.css',
})
export class ExploreSearchComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly userService = inject(UserService);
  private readonly rantService = inject(RantService);

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  // Dropdown visibility states
  readonly showSuggestions = signal<boolean>(false);
  readonly isLoadingSuggestions = signal<boolean>(false);

  // Suggestion data arrays
  readonly suggestedUsers = signal<UserProfile[]>([]);
  readonly suggestedHashtags = signal<string[]>([]);

  private readonly searchSubject = new Subject<string>();
  private trendingTags: string[] = [];

  constructor() {
    // Keep the search box value in sync with the query string ?q=...
    this.route.queryParams.subscribe(params => {
      const q = params['q'] || '';
      if (this.searchInput) {
        this.searchInput.nativeElement.value = q;
      }
    });
  }

  ngOnInit() {
    // Load trending hashtags for matching suggestions synchronously
    this.rantService.getTrendingHashtags().subscribe({
      next: (trends) => {
        this.trendingTags = trends.map(t => t.tag);
      },
      error: (err) => console.error('Failed to load trending tags', err)
    });

    // Debounced RxJS search trigger for matching users
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        const val = query.trim();
        if (val.length < 2) {
          return of([]);
        }
        this.isLoadingSuggestions.set(true);
        return this.userService.searchUsers(val).pipe(
          catchError(err => {
            console.error('Search suggestions failed', err);
            return of([]);
          })
        );
      })
    ).subscribe({
      next: (users) => {
        this.suggestedUsers.set(users);
        this.isLoadingSuggestions.set(false);
      },
      error: () => this.isLoadingSuggestions.set(false)
    });
  }

  onInputChange(value: string) {
    const val = value.trim();
    if (val.length < 2) {
      this.showSuggestions.set(false);
      this.suggestedUsers.set([]);
      this.suggestedHashtags.set([]);
      return;
    }

    this.showSuggestions.set(true);
    this.searchSubject.next(val);

    // Filter matching hashtags
    const searchTag = val.startsWith('#') ? val : `#${val}`;
    const cleanVal = val.startsWith('#') ? val.substring(1) : val;

    const matchedTrends = this.trendingTags
      .filter(t => t.toLowerCase().includes(cleanVal.toLowerCase()) && t.toLowerCase() !== searchTag.toLowerCase());

    const hashtags = [searchTag, ...matchedTrends].slice(0, 3);
    this.suggestedHashtags.set(hashtags);
  }

  onInputFocus(value: string) {
    if (value.trim().length >= 2) {
      this.showSuggestions.set(true);
      this.onInputChange(value);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    this.showSuggestions.set(false);
  }

  onSearch(value: string) {
    if (value.trim()) {
      this.showSuggestions.set(false);
      this.router.navigate(['/explore/search'], { queryParams: { q: value.trim() } });
    }
  }

  clearSearch(inputEl: HTMLInputElement) {
    inputEl.value = '';
    this.showSuggestions.set(false);
    this.suggestedUsers.set([]);
    this.suggestedHashtags.set([]);
    inputEl.focus();
  }

  selectHashtag(tag: string) {
    this.showSuggestions.set(false);
    if (this.searchInput) {
      this.searchInput.nativeElement.value = tag;
    }
    this.router.navigate(['/explore/search'], { queryParams: { q: tag } });
  }

  selectProfile(username: string) {
    this.showSuggestions.set(false);
    this.router.navigate(['/profile', username]);
  }

  getInitials(user: UserProfile): string {
    return user.displayName
      ?.split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || user.username?.substring(0, 2).toUpperCase() || '?';
  }

  getAvatarColor(username: string): string {
    const colors = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #ec4899, #f43f5e)',
      'linear-gradient(135deg, #f59e0b, #f97316)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #3b82f6, #6366f1)',
      'linear-gradient(135deg, #8b5cf6, #a855f7)',
      'linear-gradient(135deg, #ef4444, #dc2626)',
    ];
    let sum = 0;
    for (let i = 0; i < username.length; i++) {
      sum += username.charCodeAt(i);
    }
    const index = sum % colors.length;
    return colors[index];
  }
}
