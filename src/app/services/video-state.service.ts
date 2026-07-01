import { Injectable, signal } from '@angular/core';

/**
 * VideoStateService
 * -----------------
 * Coordinates play state parameters (mute/volume) globally across all video player instances.
 * If the user unmutes a video, all other videos will play unmuted.
 */
@Injectable({ providedIn: 'root' })
export class VideoStateService {
  /** Global mute state for all video players. Default is true for autoplay support. */
  readonly isMuted = signal(true);

  /** Global volume level for all video players. */
  readonly volume = signal(1.0);
}
