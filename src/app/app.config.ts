import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { provideAuthContext } from './contexts/auth.context';
import { provideFeedContext } from './contexts/feed.context';
import { provideExploreTimelineContext } from './contexts/explore-timeline.context';
import { provideBookmarkContext } from './contexts/bookmark.context';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Enables DI for HttpClient (TimelineService, future API services) + attaches
    // the AuthInterceptor that injects the bearer token into every API request.
    provideHttpClient(withInterceptors([authInterceptor])),
    // App-wide auth state (singleton) — shared current-user signal across the app.
    provideAuthContext(),
    // App-wide feed contexts (singletons) — feed data persists across route navigations.
    // Only reset on manual refresh, auth change, or 12-hour TTL expiry.
    provideFeedContext(),
    provideExploreTimelineContext(),
    provideBookmarkContext(),
    // Animations for transitions
    provideAnimations(),
  ],
};
