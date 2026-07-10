import { Injectable, inject } from '@angular/core';

export interface HistoryState {
  expandedPostId?: string;
  mediaModalPostId?: string;
  [key: string]: unknown;
}

/**
 * HistoryService
 * --------------
 * Thin wrapper around the browser History API for managing feed navigation state.
 * Pushes state for in-place post expansion and media modal open/close so that
 * the browser back button can close modals and expanded posts.
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly popStateHandlers = new Set<() => void>();

  constructor() {
    window.addEventListener('popstate', () => {
      this.popStateHandlers.forEach((handler) => handler());
    });
  }

  /** Subscribe to popstate (browser back/forward) events. Returns unsubscribe fn. */
  onPopState(handler: () => void): () => void {
    this.popStateHandlers.add(handler);
    return () => this.popStateHandlers.delete(handler);
  }

  /** Push a new history entry for expanded post (in-place). */
  pushExpandedPost(postId: string): void {
    const state: HistoryState = { expandedPostId: postId };
    const url = `#post-${postId}`;
    history.pushState(state, '', url);
  }

  /** Push a new history entry for media modal. */
  pushMediaModal(postId: string): void {
    const state: HistoryState = { mediaModalPostId: postId };
    const url = `#media-${postId}`;
    history.pushState(state, '', url);
  }



  /** Get current history state. */
  getState(): HistoryState | null {
    return history.state as HistoryState | null;
  }

  /** Check if current state represents an expanded post. */
  isExpandedPostState(): boolean {
    return !!history.state?.expandedPostId;
  }

  /** Check if current state represents a media modal. */
  isMediaModalState(): boolean {
    return !!history.state?.mediaModalPostId;
  }

  /** Get expanded post ID from current history state. */
  getExpandedPostId(): string | null {
    return history.state?.expandedPostId ?? null;
  }

  /** Get media modal post ID from current history state. */
  getMediaModalPostId(): string | null {
    return history.state?.mediaModalPostId ?? null;
  }

}