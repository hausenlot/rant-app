import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { RightPanel } from '../../components/right-panel/right-panel.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, RightPanel],
  template: `
    <div class="app-shell" [class.is-messages]="isMessagesPage()">
      <app-sidebar />
      <main class="main-content">
        <router-outlet />
      </main>
      @if (!isMessagesPage()) {
        <aside class="right-panel-wrapper">
          <app-right-panel />
        </aside>
      }
    </div>
  `,
  styles: [`
    .app-shell {
      display: flex;
      align-items: flex-start;
      min-height: 100vh;
      max-width: 1295px;
      margin: 0 auto;
    }

    .app-shell > app-sidebar {
      flex: 0 0 275px;
      width: 275px;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
    }

    .main-content {
      flex: 0 0 600px;
      min-width: 0;
      border-left: 1px solid var(--border, #2f3336);
      border-right: 1px solid var(--border, #2f3336);
      min-height: 100vh;
      overflow-x: hidden;
      max-width: 600px;
      width: 600px;
      box-sizing: border-box;
      transition: all 0.2s ease;
    }

    .app-shell.is-messages .main-content {
      flex: 0 0 950px;
      max-width: 950px;
      width: 950px;
    }

    .right-panel-wrapper {
      flex: 0 0 350px;
      width: 350px;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      padding: 12px 16px;
    }

    @media (max-width: 768px) {
      .app-shell {
        flex-direction: column;
        max-width: 100%;
        padding-bottom: 68px;
      }

      .app-shell.is-messages {
        height: 100vh;
        height: 100dvh;
        overflow: hidden;
        padding-bottom: 60px;
      }

      .app-shell > app-sidebar {
        flex: none;
        width: 100%;
        height: auto;
        position: fixed;
        bottom: 0;
        left: 0;
        top: unset;
        z-index: 100;
        overflow: visible;
      }

      .main-content {
        flex: 1 1 auto;
        width: 100%;
        border-left: none;
        border-right: none;
        min-height: calc(100vh - 68px);
      }

      .app-shell.is-messages .main-content {
        flex: 1 1 auto;
        width: 100%;
        max-width: 100%;
        height: 100%;
        min-height: unset;
      }

      .right-panel-wrapper {
        display: none;
      }
    }
  `]
})
export class MainLayoutComponent {
  private readonly router = inject(Router);

  isMessagesPage(): boolean {
    return this.router.url.includes('/messages');
  }
}