import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RantCardComponent } from '../../components/rant-card/rant-card.component';
import { RantCardSkeletonComponent } from '../../components/rant-card/rant-card-skeleton.component';
import { AUTH_CONTEXT } from '../../contexts/auth.context';
import { provideProfileContext, PROFILE_CONTEXT, useProfileContext, ProfileTab } from '../../contexts/profile.context';
import { forkJoin, of } from 'rxjs';
import { UserService } from '../../services/user.service';
import { UserProfile } from '../../models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, RantCardComponent, RantCardSkeletonComponent],
  providers: [provideProfileContext()],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authCtx = inject(AUTH_CONTEXT);
  private readonly profileCtx = inject(PROFILE_CONTEXT);

  // Expose context state
  readonly state = this.profileCtx.state;
  readonly derived = this.profileCtx.derived;

  // View state check
  readonly currentUser = computed(() => this.authCtx.state().currentUser);
  readonly isOwnProfile = computed(() => {
    const prof = this.state().profile;
    const curr = this.currentUser();
    return prof !== null && curr !== null && prof.username === curr.username;
  });

  // Edit modal state
  readonly isEditModalOpen = signal(false);
  readonly editDisplayName = signal('');
  readonly editBio = signal('');
  readonly isSaving = signal(false);
  readonly editError = signal<string | null>(null);

  // Image files to upload
  readonly selectedAvatarFile = signal<File | null>(null);
  readonly selectedAvatarPreview = signal<string | null>(null);
  readonly selectedBannerFile = signal<File | null>(null);
  readonly selectedBannerPreview = signal<string | null>(null);

  // Deletion flags
  readonly deleteAvatarFlag = signal(false);
  readonly deleteBannerFlag = signal(false);

  // Connections modal state
  readonly isConnectionsModalOpen = signal(false);
  readonly connectionsModalTab = signal<'followers' | 'following'>('followers');
  readonly connectionsList = signal<UserProfile[]>([]);
  readonly isConnectionsLoading = signal(false);
  readonly connectionsError = signal<string | null>(null);

  private readonly userService = inject(UserService);

  ngOnInit(): void {
    // Listen for changes to the username path param.
    // If none, default to current user.
    this.route.params.subscribe((params) => {
      const username = params['username'];
      if (username) {
        this.profileCtx.loadProfile(username);
      } else {
        const curr = this.currentUser();
        if (curr) {
          this.profileCtx.loadProfile(curr.username);
        } else {
          this.router.navigate(['/auth/sign-in']);
        }
      }
    });
  }

  // --- Actions ---

  setActiveTab(tab: ProfileTab): void {
    this.profileCtx.setActiveTab(tab);
  }

  onScroll(): void {
    this.profileCtx.loadActiveTabNextPage();
  }

  toggleFollow(): void {
    if (!this.currentUser()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }
    this.profileCtx.toggleFollow();
  }

  onLike(rantId: string): void {
    if (!this.currentUser()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }
    this.profileCtx.toggleLike(rantId);
  }

  onRerant(rantId: string): void {
    if (!this.currentUser()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }
    this.profileCtx.toggleRerant(rantId);
  }

  onBookmark(rantId: string): void {
    if (!this.currentUser()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }
    this.profileCtx.toggleBookmark(rantId);
  }

  // --- Profile Edits Modal ---

  openEditModal(): void {
    const prof = this.state().profile;
    if (!prof) return;

    this.editDisplayName.set(prof.displayName || '');
    this.editBio.set(prof.bio || '');
    this.selectedAvatarFile.set(null);
    this.selectedAvatarPreview.set(null);
    this.selectedBannerFile.set(null);
    this.selectedBannerPreview.set(null);
    this.deleteAvatarFlag.set(false);
    this.deleteBannerFlag.set(false);
    this.editError.set(null);
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    this.isEditModalOpen.set(false);
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input?.files?.[0]) {
      const file = input.files[0];
      this.selectedAvatarFile.set(file);
      this.deleteAvatarFlag.set(false);

      const reader = new FileReader();
      reader.onload = () => {
        this.selectedAvatarPreview.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  onBannerSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input?.files?.[0]) {
      const file = input.files[0];
      this.selectedBannerFile.set(file);
      this.deleteBannerFlag.set(false);

      const reader = new FileReader();
      reader.onload = () => {
        this.selectedBannerPreview.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  removeAvatar(): void {
    this.selectedAvatarFile.set(null);
    this.selectedAvatarPreview.set(null);
    this.deleteAvatarFlag.set(true);
  }

  removeBanner(): void {
    this.selectedBannerFile.set(null);
    this.selectedBannerPreview.set(null);
    this.deleteBannerFlag.set(true);
  }

  saveProfile(): void {
    const prof = this.state().profile;
    if (!prof) return;

    this.isSaving.set(true);
    this.editError.set(null);

    const displayName = this.editDisplayName().trim();
    const bio = this.editBio().trim();

    // 1. Textual details
    const textUpdate$ = this.profileCtx.updateProfileDetails({ displayName, bio });

    // 2. Avatar edits
    let avatar$;
    if (this.selectedAvatarFile()) {
      avatar$ = this.profileCtx.uploadProfileImage(this.selectedAvatarFile()!);
    } else if (this.deleteAvatarFlag()) {
      avatar$ = this.profileCtx.deleteProfileImage();
    } else {
      avatar$ = of(null);
    }

    // 3. Banner edits
    let banner$;
    if (this.selectedBannerFile()) {
      banner$ = this.profileCtx.uploadBannerImage(this.selectedBannerFile()!);
    } else if (this.deleteBannerFlag()) {
      banner$ = this.profileCtx.deleteBannerImage();
    } else {
      banner$ = of(null);
    }

    forkJoin({
      text: textUpdate$,
      avatar: avatar$,
      banner: banner$,
    }).subscribe({
      next: (res: any) => {
        // Sync local current user in AuthContext if needed
        const updatedUser = {
          ...this.currentUser()!,
          displayName: displayName || this.currentUser()!.displayName,
        };
        if (res.avatar && res.avatar.profileImageUrl !== undefined) {
          updatedUser.profileImageUrl = res.avatar.profileImageUrl;
        } else if (this.deleteAvatarFlag()) {
          updatedUser.profileImageUrl = undefined;
        }
        
        // Update local auth user context in localStorage and memory
        localStorage.setItem('user', JSON.stringify(updatedUser));
        this.authCtx.refresh();

        this.isSaving.set(false);
        this.closeEditModal();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.editError.set(err);
      }
    });
  }

  // --- UI Helpers ---

  getAvatarColor(username?: string): string {
    const colors = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #ec4899, #f43f5e)',
      'linear-gradient(135deg, #f59e0b, #f97316)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #3b82f6, #6366f1)',
      'linear-gradient(135deg, #8b5cf6, #a855f7)',
      'linear-gradient(135deg, #ef4444, #dc2626)',
    ];
    const seed = username || '0';
    let sum = 0;
    for (let i = 0; i < seed.length; i++) {
      sum += seed.charCodeAt(i);
    }
    const index = sum % colors.length;
    return colors[index];
  }

  getAvatarInitials(displayName?: string, username?: string): string {
    if (displayName) {
      return displayName
        .split(' ')
        .map((name) => name[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return username?.substring(0, 2).toUpperCase() || '?';
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }



  // --- Connections Modal Actions ---

  openConnectionsModal(tab: 'followers' | 'following'): void {
    const prof = this.state().profile;
    if (!prof) return;

    this.connectionsModalTab.set(tab);
    this.connectionsList.set([]);
    this.connectionsError.set(null);
    this.isConnectionsModalOpen.set(true);
    this.loadConnections(tab);
  }

  closeConnectionsModal(): void {
    this.isConnectionsModalOpen.set(false);
  }

  loadConnections(tab: 'followers' | 'following'): void {
    const prof = this.state().profile;
    if (!prof) return;

    this.isConnectionsLoading.set(true);
    this.connectionsError.set(null);

    const obs$ = tab === 'followers' 
      ? this.userService.getFollowers(prof.username) 
      : this.userService.getFollowing(prof.username);

    obs$.subscribe({
      next: (list) => {
        console.log('[loadConnections] list:', list);
        this.connectionsList.set(list);
        this.isConnectionsLoading.set(false);
      },
      error: (err) => {
        this.connectionsError.set('Failed to load connections list.');
        this.isConnectionsLoading.set(false);
      }
    });
  }

  toggleConnectionFollow(user: UserProfile): void {
    if (!this.currentUser()) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }

    const previousFollowState = user.isFollowedByMe;
    
    // Optimistic Update
    this.connectionsList.update(list => 
      list.map(u => u.username === user.username ? { ...u, isFollowedByMe: !previousFollowState } : u)
    );

    const profile = this.state().profile;
    if (profile && user.username === profile.username) {
      this.profileCtx.toggleFollow();
    } else {
      this.userService.toggleFollow(user.username).subscribe({
        next: () => {
          // If the profile owner is the logged in user, toggle follow also updates their Following count
          if (profile && this.isOwnProfile()) {
            this.profileCtx.loadProfile(profile.username);
          }
        },
        error: () => {
          this.connectionsList.update(list => 
            list.map(u => u.username === user.username ? { ...u, isFollowedByMe: previousFollowState } : u)
          );
        }
      });
    }
  }
}
