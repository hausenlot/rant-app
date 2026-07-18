export interface ContentSegment {
  text: string;
  type: 'text' | 'hashtag' | 'mention' | 'link';
  url?: string;
}

export interface ParsedContent {
  segments: ContentSegment[];
  mediaLinks: { url: string; type: 'image' | 'video' }[];
}

const MEDIA_REGEX = {
  image: /\.(gif|jpe?g|png|webp|bmp)$/i,
  video: /\.(mp4|webm|ogg)$/i,
};

/**
 * Parses post/rant content into interactive segments (hashtags, mentions, links)
 * and extracts media links for auto-embedding (hiding them from the text itself).
 */
export function parseContent(text: string): ParsedContent {
  if (!text) return { segments: [], mediaLinks: [] };

  const mediaLinks: { url: string; type: 'image' | 'video' }[] = [];
  
  // Split on URLs, mentions, and hashtags
  const regex = /(https?:\/\/[^\s]+|@\w+|#[a-zA-Z0-9_]+)/g;
  const parts = text.split(regex);

  const segments: ContentSegment[] = parts
    .map((part): ContentSegment | null => {
      if (!part) return null;

      // Mentions
      if (part.startsWith('@')) {
        return { text: part, type: 'mention' };
      }

      // Hashtags
      if (part.startsWith('#')) {
        return { text: part, type: 'hashtag' };
      }

      // URLs
      if (part.startsWith('http')) {
        const lowerPart = part.toLowerCase();
        let actualMediaUrl = part;
        let isMedia = false;
        let mediaType: 'image' | 'video' = 'image';

        if (lowerPart.includes('tenor.com')) {
          isMedia = true;
          if (!lowerPart.includes('media.tenor.com')) {
            const match = part.match(/tenor\.com\/(?:view\/)?(?:[a-zA-Z0-9-]+-)?([a-zA-Z0-9]+)/);
            if (match && match[1]) {
              actualMediaUrl = `https://media.tenor.com/m/${match[1]}/tenor.gif`;
            }
          }
        } else if (lowerPart.includes('giphy.com')) {
          isMedia = true;
          if (
            !lowerPart.includes('media.giphy.com') &&
            !lowerPart.includes('media0.giphy.com') &&
            !lowerPart.includes('media1.giphy.com') &&
            !lowerPart.includes('media2.giphy.com') &&
            !lowerPart.includes('media3.giphy.com') &&
            !lowerPart.includes('media4.giphy.com')
          ) {
            const match = part.match(/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)/);
            if (match && match[1]) {
              actualMediaUrl = `https://media.giphy.com/media/${match[1]}/giphy.gif`;
            }
          }
        } else if (MEDIA_REGEX.image.test(lowerPart)) {
          isMedia = true;
        } else if (MEDIA_REGEX.video.test(lowerPart)) {
          isMedia = true;
          mediaType = 'video';
        }

        if (isMedia) {
          if (!mediaLinks.some((ml) => ml.url === actualMediaUrl)) {
            mediaLinks.push({ url: actualMediaUrl, type: mediaType });
          }
          return null; // Hide the URL from the text since it's auto-embedded
        }

        return { text: part, type: 'link', url: part };
      }

      return { text: part, type: 'text' };
    })
    .filter((segment): segment is ContentSegment => segment !== null);

  return { segments, mediaLinks };
}
