import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app.component';
import { AUTH_CONTEXT } from './app/contexts/auth.context';
import { inject } from '@angular/core';

bootstrapApplication(App, appConfig)
  .then((appRef) => {
    // Restore an existing session from localStorage before the app renders,
    // so authenticated routes/components see currentUser immediately.
    const auth = appRef.injector.get(AUTH_CONTEXT);
    auth.init();
  })
  .catch((err) => console.error(err));
