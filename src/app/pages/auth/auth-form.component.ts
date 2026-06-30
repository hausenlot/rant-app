import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

/**
 * Raw form payload handed up to the page component.
 * - sign-in uses only `username` + `password` (the backend's login contract)
 * - sign-up uses `username` + `password` + `displayName`
 *
 * `email` is intentionally absent: the live API authenticates via `username`,
 * not email. The form's field is labeled "Username".
 */
export interface AuthFormData {
  username: string;
  password: string;
  displayName?: string;
}

/**
 * Reusable auth form — used by both sign-in and sign-up pages.
 * The page sets the mode, title, subtitle, and link.
 */
@Component({
  selector: 'app-auth-form',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './auth-form.component.html',
  styleUrl: './auth-form.component.css',
})
export class AuthFormComponent {
  /** 'sign-in' or 'sign-up' — controls which fields and labels render. */
  mode = input.required<'sign-in' | 'sign-up'>();

  /** True while the auth request is in flight — disables the submit button. */
  loading = input<boolean>(false);

  /** Latest error message from the auth request (e.g. invalid credentials). */
  error = input<string | null>(null);

  /** Emits the form data when the user submits. */
  submitted = output<AuthFormData>();

  protected username = '';
  protected password = '';
  protected displayName = '';

  protected get isSignUp(): boolean {
    return this.mode() === 'sign-up';
  }

  protected get title(): string {
    return this.isSignUp ? 'Create your account' : 'Welcome back';
  }

  protected get subtitle(): string {
    return this.isSignUp
      ? 'Join the rant community. No filter, just honesty.'
      : 'Sign in to continue ranting.';
  }

  protected get ctaLabel(): string {
    return this.isSignUp ? 'Create account' : 'Sign in';
  }

  protected get switchPrompt(): string {
    return this.isSignUp ? 'Already have an account?' : "Don't have an account?";
  }

  protected get switchLabel(): string {
    return this.isSignUp ? 'Sign in' : 'Sign up';
  }

  protected get switchLink(): string {
    return this.isSignUp ? '/auth/sign-in' : '/auth/sign-up';
  }

  protected onSubmit(): void {
    if (this.isSignUp) {
      // Register needs a username + password + chosen display name.
      this.submitted.emit({
        username: this.username,
        password: this.password,
        displayName: this.displayName,
      });
    } else {
      // Sign-in is just + password.
      this.submitted.emit({
        username: this.username,
        password: this.password,
      });
    }
  }
}
