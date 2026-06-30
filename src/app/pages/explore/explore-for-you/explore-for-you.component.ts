import { Component, signal } from '@angular/core';
import { ExploreUserCardComponent, ExploreUser } from '../components/explore-user-card.component';

const SEED_USERS: ExploreUser[] = [
  { initials: 'A', displayName: 'Angela', username: 'angela_rants', avatarColor: '#e040fb', bio: 'Frontend dev. CSS enjoyer. Rants about CSS and component libraries.' },
  { initials: 'J', displayName: 'JustJordan', username: 'just_jordan', avatarColor: '#00bcd4', bio: 'Loves ranting about JavaScript and build tools.' },
  { initials: 'R', displayName: 'RantKing', username: 'rantking99', avatarColor: '#ff7043' },
  { initials: 'Q', displayName: 'QuietCoder', username: 'quiet_coder', avatarColor: '#4caf50', bio: 'Silent but opinionated. Mostly rants about remote work.' },
  { initials: 'D', displayName: 'Dev Rants', username: 'dev_rants', avatarColor: '#607d8b', bio: 'DevOps opinions you did not ask for.' },
];

@Component({
  selector: 'app-explore-for-you',
  standalone: true,
  imports: [ExploreUserCardComponent],
  templateUrl: './explore-for-you.component.html',
})
export class ExploreForYouComponent {
  protected readonly users = signal<ExploreUser[]>(SEED_USERS);
}
