import {
  Component,
  ElementRef,
  Input,
  OnInit,
  OnDestroy,
  ViewChild,
  inject,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoStateService } from '../../services/video-state.service';

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-player.component.html',
  styleUrl: './video-player.component.css'
})
export class VideoPlayerComponent implements OnInit, OnDestroy {
  private readonly videoStateService = inject(VideoStateService);

  @Input({ required: true }) src!: string;
  @Input() playsInline = true;
  @Input() loop = true;

  @ViewChild('videoElement', { static: true }) videoElementRef!: ElementRef<HTMLVideoElement>;

  private observer: IntersectionObserver | null = null;

  // Reactively bind local values to the shared state service
  readonly isMuted = this.videoStateService.isMuted;
  readonly volume = this.videoStateService.volume;

  constructor() {
    // When global mute state changes, update the video element directly (in case bindings lag)
    effect(() => {
      const muted = this.isMuted();
      const vol = this.volume();
      const video = this.videoElementRef?.nativeElement;
      if (video) {
        video.muted = muted;
        video.volume = vol;
      }
    });
  }

  ngOnInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    const video = this.videoElementRef?.nativeElement;
    if (video) {
      video.pause();
    }
  }

  private setupIntersectionObserver(): void {
    const options = {
      root: null, // viewport
      threshold: 0.95 // Require 95% visibility to autoplay (safer than 100% due to border scroll offsets)
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = this.videoElementRef.nativeElement;
        if (entry.isIntersecting) {
          // Play video with catch block to handle browser autoplay policies
          video.play().catch((err) => {
            console.log('Autoplay blocked or interrupted:', err);
          });
        } else {
          video.pause();
        }
      });
    }, options);

    this.observer.observe(this.videoElementRef.nativeElement);
  }

  togglePlay(event: Event): void {
    event.stopPropagation(); // Stop click from opening details view
    const video = this.videoElementRef.nativeElement;
    if (video.paused) {
      video.play().catch(err => console.log(err));
    } else {
      video.pause();
    }
  }

  toggleMute(event: Event): void {
    event.stopPropagation(); // Prevent card navigation or media modal opening
    const currentMute = this.isMuted();
    this.videoStateService.isMuted.set(!currentMute);
  }
}
