/**
 * Sign-in page.
 *
 * Receives the (username, password) payload from AuthFormComponent, then drives
 * the AuthContext.login() action. The context persists the session to
 * localStorage and navigates to /feed on success — so this component just
 * forwards and renders the error surfaced on the context.
 */
import { Component, inject } from '@angular/core';
import { AuthFormComponent, AuthFormData } from './auth-form.component';
import { useAuthContext } from '../../contexts/auth.context';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [AuthFormComponent],
  template: `
    <app-auth-form
      mode="sign-in"
      [loading]="auth.derived.isSubmitting()"
      [error]="auth.state().error"
      (submitted)="onSubmit($event)"
    />
  `,
})
export class SignInComponent {
  protected readonly auth = useAuthContext();

  onSubmit(data: AuthFormData): void {
    this.auth.login({ username: data.username, password: data.password });
  }
}
