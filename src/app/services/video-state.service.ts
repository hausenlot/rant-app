import { Injectable, signal } from '@angular/core';

/**
 * VideoStateService
 * -----------------
 * Coordinates play state parameters (mute/volume) globally across all video player instances.
 * Ensures only one video plays at a time across the entire application.
 */
@Injectable({ providedIn: 'root' })
export class VideoStateService {
  /** Global mute state for all video players. Default is true for autoplay support. */
  readonly isMuted = signal(true);

  /** Global volume level (0–1) for all video players. */
  readonly volume = signal(1.0);

  /**
   * The currently playing HTMLVideoElement. When a new video requests playback,
   * the previous one is paused first so only one video plays at a time.
   */
  private activeVideo: HTMLVideoElement | null = null;

  /**
   * Register a video as the active (playing) video.
   * Pauses the previously active video if different.
   */
  requestPlay(video: HTMLVideoElement): void {
    if (this.activeVideo && this.activeVideo !== video) {
      this.activeVideo.pause();
    }
    this.activeVideo = video;
  }

  /**
   * Clear the active video reference when it pauses or is destroyed.
   * Only clears if the given video is the currently active one.
   */
  releaseIfActive(video: HTMLVideoElement): void {
    if (this.activeVideo === video) {
      this.activeVideo = null;
    }
  }

  /** Update the global volume level. Clamps to 0–1. */
  setVolume(value: number): void {
    this.volume.set(Math.max(0, Math.min(1, value)));
    // If volume is raised from 0, auto-unmute; if set to 0, auto-mute
    if (value > 0 && this.isMuted()) {
      this.isMuted.set(false);
    } else if (value === 0 && !this.isMuted()) {
      this.isMuted.set(true);
    }
  }
}
