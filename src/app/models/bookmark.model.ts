import type { Rant } from './rant.model';

export interface BookmarkDto {
  id: string; // matches rant.id for O(1) lookups
  rant: Rant;
  bookmarkedAt: string; // Timestamp when saved (or fallback to rant.createdAt)
}
