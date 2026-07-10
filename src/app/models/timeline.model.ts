import type { Rant } from './rant.model';

/**
 * Component-facing envelope for a paginated timeline page.
 * Exposes a uniform shape so consumers don't care how the backend packages pages.
 */
export interface TimelinePage {
  items: Rant[];
  total: number;
  page: number;
  pageSize: number;
}

/** Parameters for a single paginated fetch against the explore timeline. */
export interface TimelineQuery {
  page: number;     // 1-based page index
  pageSize: number; // items per page
}
