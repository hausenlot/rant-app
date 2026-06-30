import { Rant } from '../models/rant.model';

/**
 * Static seed data for the feed.
 *
 * Shared across pages so the same rants appear everywhere during the static-data phase.
 * Swap this file for an HttpClient call when the API is wired up.
 */
export const SEED_RANTS: Rant[] = [
  {
    id: 'r-001',
    content:
      "Hot take: anyone who says 'it works on my machine' has never actually tried to deploy anything. Your machine is not the production environment. Write integration tests. Please.",
    createdAt: '2026-06-27T14:22:00.000Z',
    updatedAt: '2026-06-27T14:22:00.000Z',
    userId: 'u-101',
    username: 'dev_rants',
    displayName: 'Dev Rants',
    profileImageUrl: undefined,
    likeCount: 142,
    reRantCount: 31,
    replyCount: 18,
    isLikedByMe: true,
    isRerantedByMe: false,
    isBookmarkedByMe: false,
    reRantedByUsername: undefined,
    quoteRantId: undefined,
    quoteRant: undefined,
    mediaUrl: undefined,
    mediaType: undefined,
  },
  {
    id: 'r-002',
    content:
      "Just spent three hours debugging a feature that was broken by a single missing semicolon. CSS doesn't even use semicolons properly and it's fine. JavaScript is just trolling us at this point.",
    createdAt: '2026-06-27T11:05:00.000Z',
    userId: 'u-102',
    username: 'css_warrior',
    displayName: 'CSS Warrior',
    profileImageUrl: undefined,
    likeCount: 87,
    reRantCount: 12,
    replyCount: 9,
    isLikedByMe: false,
    isRerantedByMe: false,
    isBookmarkedByMe: true,
    reRantedByUsername: 'just_jordan',
    quoteRantId: undefined,
    quoteRant: undefined,
    mediaUrl:
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=70',
    mediaType: 'image',
  },
  {
    id: 'r-003',
    content: "Quote-ranting this because it perfectly describes every sprint planning session I've ever sat through.",
    createdAt: '2026-06-26T20:48:00.000Z',
    userId: 'u-103',
    username: 'scrum_skeptic',
    displayName: 'Sprint Skeptic',
    profileImageUrl: undefined,
    likeCount: 213,
    reRantCount: 54,
    replyCount: 27,
    isLikedByMe: false,
    isRerantedByMe: false,
    isBookmarkedByMe: false,
    reRantedByUsername: undefined,
    quoteRantId: 'r-001',
    quoteRant: {
      id: 'r-001',
      content:
        "Hot take: anyone who says 'it works on my machine' has never actually tried to deploy anything. Your machine is not the production environment. Write integration tests. Please.",
      username: 'dev_rants',
      displayName: 'Dev Rants',
      createdAt: '2026-06-27T14:22:00.000Z',
      profileImageUrl: undefined,
      mediaUrl: undefined,
      mediaType: undefined,
    },
    mediaUrl: undefined,
    mediaType: undefined,
  },
  {
    id: 'r-004',
    content:
      "The worst part of remote work isn't the loneliness or the distractions. It's the 47 Slack messages that could have been one sentence: 'the build is broken, please fix it.' Stop narrating your debugging process at me in real time.",
    createdAt: '2026-06-26T09:15:00.000Z',
    userId: 'u-104',
    username: 'quiet_coder',
    displayName: 'Quiet Coder',
    profileImageUrl: undefined,
    likeCount: 320,
    reRantCount: 89,
    replyCount: 41,
    isLikedByMe: true,
    isRerantedByMe: true,
    isBookmarkedByMe: true,
    reRantedByUsername: undefined,
    quoteRantId: undefined,
    quoteRant: undefined,
    mediaUrl:
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=70',
    mediaType: 'image',
  },
];
