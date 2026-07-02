import { Injectable, inject, ComponentRef, Type } from '@angular/core';
import {
  Overlay,
  OverlayRef,
  OverlayConfig,
  GlobalPositionStrategy,
  ScrollStrategy,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Subject, filter, fromEvent } from 'rxjs';

export interface PostMediaModalConfig {
  postId: string;
  mediaIndex?: number;
}

/**
 * PostMediaModalService
 * ---------------------
 * Manages the media viewer modal using Angular CDK Overlay.
 * The modal displays the post's media (image/video) taking ~85% of viewport,
 * with the post content + replies in a sidebar (~15%).
 */
@Injectable({ providedIn: 'root' })
export class PostMediaModalService {
  private readonly overlay = inject(Overlay);

  private overlayRef: OverlayRef | null = null;
  private componentRef: ComponentRef<unknown> | null = null;

  /** Emits when the modal is closed. */
  readonly closed$ = new Subject<void>();

  /**
   * Open the media modal with a dynamically loaded component.
   * @param component The modal component type to instantiate
   * @param config Configuration with postId and optional mediaIndex
   * @param setInputs Function to set @Input() values on the component instance
   */
  open<T>(
    component: Type<T>,
    config: PostMediaModalConfig,
    setInputs: (instance: T) => void
  ): void {
    if (this.overlayRef) {
      return; // Prevent multiple modals
    }

    const positionStrategy = this.createPositionStrategy();
    const scrollStrategy = this.overlay.scrollStrategies.block();

    const overlayConfig: OverlayConfig = {
      positionStrategy,
      hasBackdrop: true,
      backdropClass: 'post-media-modal-backdrop',
      panelClass: 'post-media-modal-panel',
      scrollStrategy,
      disposeOnNavigation: true,
    };

    this.overlayRef = this.overlay.create(overlayConfig);

    const portal = new ComponentPortal(component);
    this.componentRef = this.overlayRef.attach(portal);

    // Set inputs on the component instance
    if (this.componentRef.instance) {
      setInputs(this.componentRef.instance as T);
    }

    // Handle backdrop click to close
    this.overlayRef.backdropClick().subscribe(() => this.close());

    // Handle ESC key to close
    this.overlayRef.keydownEvents()
      .pipe(filter((event: KeyboardEvent) => event.key === 'Escape'))
      .subscribe(() => this.close());

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  /** Close the modal and clean up. */
  close(): void {
    if (!this.overlayRef) return;

    // Detach and dispose first
    this.overlayRef.detach();
    this.overlayRef.dispose();
    this.overlayRef = null;
    this.componentRef = null;

    // Restore body scroll
    document.body.style.overflow = '';

    // Emit closed event
    this.closed$.next();
  }

  /** Check if modal is currently open. */
  isOpen(): boolean {
    return this.overlayRef !== null;
  }

  private createPositionStrategy(): GlobalPositionStrategy {
    return this.overlay.position()
      .global()
      .centerHorizontally()
      .centerVertically();
  }
}