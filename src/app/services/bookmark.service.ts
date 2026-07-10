import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import type { Rant } from '../models/rant.model';
import type { BookmarkDto } from '../models/bookmark.model';

@Injectable({ providedIn: 'root' })
export class BookmarkService {
  private readonly baseUrl = '/api';
  private readonly http = inject(HttpClient);

  /**
   * Fetch authenticated user's bookmarked rants, mapping them to BookmarkDto[].
   */
  getBookmarks(page = 1, pageSize = 10): Observable<BookmarkDto[]> {
    const params = new HttpParams({
      fromObject: {
        page: String(page),
        pageSize: String(pageSize),
      },
    });

    return this.http
      .get<Rant[]>(`${this.baseUrl}/timelines/bookmarks`, { params })
      .pipe(
        map((rants) =>
          rants.map((rant) => ({
            id: rant.id,
            rant,
            bookmarkedAt: rant.createdAt,
          }))
        )
      );
  }
}
