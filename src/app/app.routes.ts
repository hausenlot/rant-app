import { Routes } from '@angular/router';
import { FeedComponent } from './pages/feed/feed.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { ExploreComponent } from './pages/explore/explore.component';
import { MessagesComponent } from './pages/messages/messages.component';
import { NotificationsComponent } from './pages/notifications/notifications.component';
import { BookmarksComponent } from './pages/bookmarks/bookmarks.component';
import { ExploreForYouComponent } from './pages/explore/explore-for-you/explore-for-you.component';
import { ExploreTrendingComponent } from './pages/explore/explore-trending/explore-trending.component';
import { ExploreMemesComponent } from './pages/explore/explore-memes/explore-memes.component';
import { ExploreGamesComponent } from './pages/explore/explore-games/explore-games.component';
import { ExploreSearchFeedComponent } from './pages/explore/explore-search-feed/explore-search-feed.component';
import { SignInComponent } from './pages/auth/sign-in.component';
import { SignUpComponent } from './pages/auth/sign-up.component';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { authGuard, publicOnlyGuard } from './guards/auth.guard';

export const routes: Routes = [
  // Auth routes with auth layout (no sidebar/right panel).
  // publicOnlyGuard redirects already-authenticated users away from /auth/* — back to /.
  {
    path: 'auth',
    component: AuthLayoutComponent,
    canActivate: [publicOnlyGuard],
    children: [
      { path: 'sign-in', component: SignInComponent },
      { path: 'sign-up', component: SignUpComponent },
    ],
  },
  // Main app routes with main layout (sidebar + right panel).
  // Feed and explore are PUBLIC — no authGuard on the layout itself.
  // Only auth-required routes (messages, notifications, bookmarks, profile)
  // have their own authGuard so unauthenticated visitors can still browse.
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', component: FeedComponent },
      {
        path: 'explore',
        component: ExploreComponent,
        children: [
          { path: '', redirectTo: 'for-you', pathMatch: 'full' },
          { path: 'for-you', component: ExploreForYouComponent },
          { path: 'trending', component: ExploreTrendingComponent },
          { path: 'memes', component: ExploreMemesComponent },
          { path: 'games', component: ExploreGamesComponent },
          { path: 'search', component: ExploreSearchFeedComponent },
        ],
      },
      // Auth-required routes — unauthenticated visitors are redirected to sign-in.
      { path: 'messages', component: MessagesComponent, canActivate: [authGuard] },
      { path: 'notifications', component: NotificationsComponent, canActivate: [authGuard] },
      { path: 'bookmarks', component: BookmarksComponent, canActivate: [authGuard] },
      { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
      { path: 'profile/:username', component: ProfileComponent },
      { path: '**', redirectTo: '' },
    ],
  },
];
