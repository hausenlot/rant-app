import { Rant } from './rant.model';

export interface UserProfile {
  id: string;
  username: string;
  displayName?: string;
  bio?: string;
  profileImageUrl?: string;
  bannerImageUrl?: string;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  rantCount: number;
  isFollowedByMe: boolean;
}

export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
}

export interface UpdateProfileResponse {
  message: string;
}

export interface UploadProfileImageResponse {
  message: string;
  profileImageUrl?: string;
}

export interface UploadBannerImageResponse {
  message: string;
  bannerImageUrl?: string;
}
