import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { provideAuthContext } from './contexts/auth.context';
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
  ],
};
