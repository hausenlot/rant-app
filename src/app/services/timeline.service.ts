/**
 * TimelineService
 * ----------------
 * Thin wrapper over the back-end timeline (rants) API.
 *
 * It is deliberately standalone (no interceptors, no auth) so it can be unit-
 * tested / driven from the CLI today and wired into a Context or component later.
 *
 * Wire format it expects from the server (per the rant.model.ts mirror):
 *   GET /api/rants/explore?page={page}&pageSize={pageSize}
 *   -> { items: Rant[], total: number, page: number, pageSize: number }
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import type { Rant } from '../models/rant.model';
import type { TimelinePage, TimelineQuery } from '../models/timeline.model';

@Injectable({ providedIn: 'root' })
export class TimelineService {
  /** App-wide API root. All service URLs resolve against this. */
  private readonly baseUrl = '/api';

  /** Angular's HTTP client; no auth config needed for the public explore endpoint. */
  private readonly http = inject(HttpClient);

  /**
   * Fetches one page of rants from the "explore" home timeline.
   *
   * Note: the backend returns a flat JSON array rather than an envelope, so we
   * wrap it into `TimelinePage` ourselves. Because there is no X-Total-Count
   * header yet, `total` is derived from the current page length; the Context
   * will adapt this in real-time polling / when the backend adds a total count.
   *
   * @returns Observable envelope of { items, total, page, pageSize }
   */
  getHomeTimeline(query: TimelineQuery): Observable<TimelinePage> {
    const url = `${this.baseUrl}/rants/explore`;
    const params = new HttpParams({
      fromObject: {
        page: String(query.page),
        pageSize: String(query.pageSize),
      },
    });

    return this.http.get<Rant[]>(url, { params }).pipe(
      map((items) => ({
        items,
        total: items.length,
        page: query.page,
        pageSize: query.pageSize,
      }))
    );
  }
}
