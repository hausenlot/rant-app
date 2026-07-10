import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserProfile, UpdateProfileRequest, UpdateProfileResponse, UploadProfileImageResponse, UploadBannerImageResponse } from '../models/user.model';
import { Rant, Reply } from '../models/rant.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly baseUrl = '/api';
  private readonly http = inject(HttpClient);

  /** Fetch user profile details. */
  getUserProfile(username: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.baseUrl}/users/${username}`);
  }

  /** Update display name and bio. */
  updateProfile(req: UpdateProfileRequest): Observable<UpdateProfileResponse> {
    return this.http.put<UpdateProfileResponse>(`${this.baseUrl}/users/profile`, req);
  }

  /** Upload profile image. */
  uploadProfileImage(file: File): Observable<UploadProfileImageResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadProfileImageResponse>(`${this.baseUrl}/users/profile/image`, formData);
  }

  /** Upload banner image. */
  uploadBannerImage(file: File): Observable<UploadBannerImageResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadBannerImageResponse>(`${this.baseUrl}/users/profile/banner`, formData);
  }

  /** Delete profile image. */
  deleteProfileImage(): Observable<UpdateProfileResponse> {
    return this.http.delete<UpdateProfileResponse>(`${this.baseUrl}/users/profile/image`);
  }

  /** Delete banner image. */
  deleteBannerImage(): Observable<UpdateProfileResponse> {
    return this.http.delete<UpdateProfileResponse>(`${this.baseUrl}/users/profile/banner`);
  }

  /** Toggle follow/unfollow for a username. */
  toggleFollow(username: string): Observable<UpdateProfileResponse> {
    return this.http.post<UpdateProfileResponse>(`${this.baseUrl}/users/${username}/follow`, {});
  }

  /** Get user's followers. */
  getFollowers(username: string, page = 1, pageSize = 20): Observable<UserProfile[]> {
    const params = new HttpParams({ fromObject: { page: String(page), pageSize: String(pageSize) } });
    return this.http.get<UserProfile[]>(`${this.baseUrl}/users/${username}/followers`, { params });
  }

  /** Get user's following. */
  getFollowing(username: string, page = 1, pageSize = 20): Observable<UserProfile[]> {
    const params = new HttpParams({ fromObject: { page: String(page), pageSize: String(pageSize) } });
    return this.http.get<UserProfile[]>(`${this.baseUrl}/users/${username}/following`, { params });
  }

  /** Get user's rants. */
  getUserRants(username: string, page = 1, pageSize = 10): Observable<Rant[]> {
    const params = new HttpParams({ fromObject: { page: String(page), pageSize: String(pageSize) } });
    return this.http.get<Rant[]>(`${this.baseUrl}/users/${username}/rants`, { params });
  }

  /** Get user's replies. */
  getUserReplies(username: string, page = 1, pageSize = 10): Observable<Reply[]> {
    const params = new HttpParams({ fromObject: { page: String(page), pageSize: String(pageSize) } });
    return this.http.get<Reply[]>(`${this.baseUrl}/users/${username}/replies`, { params });
  }

  /** Get user's liked rants. */
  getUserLikes(username: string, page = 1, pageSize = 10): Observable<Rant[]> {
    const params = new HttpParams({ fromObject: { page: String(page), pageSize: String(pageSize) } });
    return this.http.get<Rant[]>(`${this.baseUrl}/users/${username}/likes`, { params });
  }

  /** Fetch suggested users to follow. */
  getSuggestedUsers(count = 5): Observable<UserProfile[]> {
    const params = new HttpParams().set('count', String(count));
    return this.http.get<UserProfile[]>(`${this.baseUrl}/users/suggested`, { params });
  }

  /** Search users by query. */
  searchUsers(query: string): Observable<UserProfile[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<UserProfile[]>(`${this.baseUrl}/users/search`, { params });
  }
}
