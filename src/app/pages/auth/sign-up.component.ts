/**
 * Sign-up (register) page.
 *
 * Receives the (username, password, displayName) payload from AuthFormComponent,
 * then drives the AuthContext.register() action. The context persists the
 * session to localStorage and navigates to /feed on success.
 */
import { Component } from '@angular/core';
import { AuthFormComponent, AuthFormData } from './auth-form.component';
import { useAuthContext } from '../../contexts/auth.context';

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [AuthFormComponent],
  template: `
    <app-auth-form
      mode="sign-up"
      [loading]="auth.derived.isSubmitting()"
      [error]="auth.state().error"
      (submitted)="onSubmit($event)"
    />
  `,
})
export class SignUpComponent {
  protected readonly auth = useAuthContext();

  onSubmit(data: AuthFormData): void {
    const displayName = data.displayName?.trim() || data.username;
    this.auth.register({ username: data.username, password: data.password, displayName });
  }
}
