/**
 * Domain models for the rant feed.
 *
 * These shapes mirror the backend DTOs exactly so that, when the API is wired up,
 * the only change needed is the data source — the components already consume these types.
 *
 * Timestamps are ISO-8601 strings to match the wire format; the UI formats them for display.
 */

export type MediaType = 'image' | 'video';

export interface QuoteRant {
  id: string;
  content: string;
  username: string;
  displayName?: string;
  createdAt: string;
  profileImageUrl?: string;
  mediaUrl?: string;
  mediaType?: MediaType;
}

export interface Rant {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  userId: string;
  username: string;
  displayName: string;
  profileImageUrl?: string;
  likeCount: number;
  reRantCount: number;
  replyCount: number;
  isLikedByMe: boolean;
  isRerantedByMe: boolean;
  isBookmarkedByMe: boolean;
  reRantedByUsername?: string;
  quoteRantId?: string;
  quoteRant?: QuoteRant;
  mediaUrl?: string;
  mediaType?: MediaType;
}

export interface Reply {
  id: string;
  rantId: string;
  content: string;
  createdAt: string;
  userId: string;
  username: string;
  displayName: string;
  profileImageUrl?: string;
  parentReplyId?: string;
  parentReplyUsername?: string;
  likeCount: number;
  replyCount: number;
  isLikedByMe: boolean;
  mediaUrl?: string;
  mediaType?: MediaType;
}

/**
 * Body for creating a new rant.
 * IMPORTANT — the backend's create endpoint does NOT bind from JSON. It only binds
 * from form bodies (multipart/form-data or x-www-form-urlencoded). See the
 * service implementation: we send URLSearchParams / FormData, not JSON objects.
 */
export interface CreateRantRequest {
  content: string;
  quoteRantId?: string;
}

/** Body for creating a reply to a rant (also sends form-encoded). */
export interface CreateReplyRequest {
  content: string;
  parentReplyId?: string;
}

/** Media upload payload (multipart/form-data). */
export interface CreateRantWithMediaPayload {
  content: string;
  quoteRantId?: string;
  mediaFile?: File;
}

/** Body for creating a reply with media. */
export interface CreateReplyWithMediaPayload {
  content: string;
  parentReplyId?: string;
  mediaFile?: File;
}

export interface TrendingHashtag {
  tag: string;
  count: number;
  category: string;
  description?: string;
}


