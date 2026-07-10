/**
 * RantService
 * -----------
 * Authenticated rant feed + interaction layer. Wraps HttpClient and targets
 * /api/timelines/home, /api/rants/* with the bearer token supplied by the
 * auth interceptor automatically.
 *
 * Wire contract (verified live vs the backend, using the hausenlot account):
 *   GET  /timelines/home?page=&pageSize=               → Rant[]            (flat array, auth-scoped isLikedByMe flags)
 *   GET  /rants/:id                                    → Rant
 *   POST /rants             body=multipart or x-www-form-urlencoded (NOT JSON → 400)
 *       fields: content (1–1000 chars) [, quoteRantId ]
 *   DELETE /rants/:id                                  → void (204)
 *   POST /rants/:id/like                               → void (200, toggle)
 *   POST /rants/:id/rerant                             → void (200, toggle)
 *   POST /rants/:id/bookmark                           → void (200, toggle)
 *   GET  /rants/:id/replies?page=&pageSize=            → Reply[]           (flat)
 *   POST /rants/:id/replies body=multipart or x-www-form-urlencoded (NOT JSON)
 *       fields: content (1–1000 chars) [, parentReplyId ]
 *   POST /replies/:id/like                             → void (200, toggle)
 *
 * Note: create endpoints bind only from form bodies — raw JSON `{ content:'...' }`
 * returns 400 "Content field is required" regardless of case. So post/put bodies
 * use URLSearchParams / FormData, not application/json.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  Rant,
  Reply,
  CreateRantRequest,
  CreateReplyRequest,
  CreateRantWithMediaPayload,
  CreateReplyWithMediaPayload,
  TrendingHashtag
} from '../models/rant.model';


@Injectable({ providedIn: 'root' })
export class RantService {
  private readonly baseUrl = '/api';
  private readonly http = inject(HttpClient);

  /* ------------------------------- Feed ------------------------------- */

  /**
   * Authenticated home timeline feed. Returns a flat array of rants with
   * user-scoped flags (isLikedByMe, isRerantedByMe, isBookmarkedByMe).
   */
  getHomeFeed(page = 1, pageSize = 10): Observable<Rant[]> {
    const params = new HttpParams({ fromObject: { page: String(page), pageSize: String(pageSize) } });
    return this.http.get<Rant[]>(`${this.baseUrl}/timelines/home`, { params });
  }

  /** Fetch a single rant by id (auth-scoped flags). */
  getRant(id: string): Observable<Rant> {
    return this.http.get<Rant>(`${this.baseUrl}/rants/${id}`);
  }

  /** Fetch trending hashtags from the backend. */
  getTrendingHashtags(): Observable<TrendingHashtag[]> {
    return this.http.get<TrendingHashtag[]>(`${this.baseUrl}/rants/trending`);
  }

  /** Search for rants matching a query term or hashtag. */
  searchRants(query: string, page = 1, pageSize = 10): Observable<Rant[]> {
    const params = new HttpParams({ fromObject: { q: query, page: String(page), pageSize: String(pageSize) } });
    return this.http.get<Rant[]>(`${this.baseUrl}/rants/search`, { params });
  }

  /* ------------------------------- CRUD ------------------------------- */

  /**
   * Create a plain-text rant. Sends `application/x-www-form-urlencoded` because
   * the backend only binds from form bodies — raw JSON silently produces a 400
   * "Content field is required" even when present. Verified live vs /api/rants.
   */
  createRant(req: CreateRantRequest): Observable<Rant> {
    const body = new URLSearchParams();
    body.set('content', req.content);
    if (req.quoteRantId) body.set('quoteRantId', req.quoteRantId);
    return this.http.post<Rant>(`${this.baseUrl}/rants`, body.toString(), {
      headers: new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    });
  }

  /**
   * Create a rant with optional media. Sends multipart/form-data. The browser
   * sets the content-type boundary automatically; do NOT stringify the form.
   */
  createRantWithMedia(payload: CreateRantWithMediaPayload): Observable<Rant> {
    const fd = new FormData();
    fd.append('content', payload.content);
    if (payload.quoteRantId) fd.append('quoteRantId', payload.quoteRantId);
    if (payload.mediaFile) fd.append('mediaFile', payload.mediaFile);
    return this.http.post<Rant>(`${this.baseUrl}/rants`, fd);
  }

  deleteRant(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/rants/${id}`);
  }

  /* --------------------------- Interactions --------------------------- */

  /** Toggle like on a rant. Returns void → re-fetch the rant to read the new likeCount + isLikedByMe. */
  toggleLike(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/rants/${id}/like`, {});
  }

  /** Toggle rerant (quote-without-comment repost). */
  toggleRerant(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/rants/${id}/rerant`, {});
  }

  /** Toggle bookmark. */
  toggleBookmark(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/rants/${id}/bookmark`, {});
  }

  /* ------------------------------ Replies ----------------------------- */

  /** Fetch top-level replies for a rant. */
  getReplies(rantId: string, page = 1, pageSize = 10): Observable<Reply[]> {
    const params = new HttpParams({ fromObject: { page: String(page), pageSize: String(pageSize) } });
    return this.http.get<Reply[]>(`${this.baseUrl}/rants/${rantId}/replies`, { params });
  }

  /** Fetch child replies (sub-replies) for a specific reply. */
  getChildReplies(replyId: string, page = 1, pageSize = 10): Observable<Reply[]> {
    const params = new HttpParams({ fromObject: { page: String(page), pageSize: String(pageSize) } });
    return this.http.get<Reply[]>(`${this.baseUrl}/replies/${replyId}/replies`, { params });
  }

  /**
   * Post a (possibly nested) reply to a rant. Sends x-www-form-urlencoded
   * (same form-only binding rule as rant creation).
   */
  createReply(rantId: string, req: CreateReplyRequest): Observable<Reply> {
    const body = new URLSearchParams();
    body.set('content', req.content);
    if (req.parentReplyId) body.set('parentReplyId', req.parentReplyId);
    return this.http.post<Reply>(`${this.baseUrl}/rants/${rantId}/replies`, body.toString(), {
      headers: new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    });
  }

  /** Post a reply with optional media (multipart/form-data). */
  createReplyWithMedia(rantId: string, payload: CreateReplyWithMediaPayload): Observable<Reply> {
    const fd = new FormData();
    fd.append('content', payload.content);
    if (payload.parentReplyId) fd.append('parentReplyId', payload.parentReplyId);
    if (payload.mediaFile) fd.append('mediaFile', payload.mediaFile);
    return this.http.post<Reply>(`${this.baseUrl}/rants/${rantId}/replies`, fd);
  }

  /** Toggle like on a reply. */
  toggleReplyLike(replyId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/replies/${replyId}/like`, {});
  }
}
