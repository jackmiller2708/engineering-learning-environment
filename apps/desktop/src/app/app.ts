import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { APP_NAME } from '@ele/domain';
import { map } from 'rxjs';
import { ActiveLab } from './active-lab';
import { StatusMessage } from './status-message';
import { WORLD_NAME } from './world';
import { shortId } from './workspaces/workspace-format';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  private readonly activeLab = inject(ActiveLab);
  protected readonly status = inject(StatusMessage).text;
  protected readonly appName = APP_NAME;
  protected readonly worldName = WORLD_NAME;
  protected readonly shortId = shortId;

  private readonly url = toSignal(this.router.events.pipe(map(() => this.router.url)), { initialValue: this.router.url });
  /** On Worlds (or the launch screen that leads to it), "Worlds" is the current page. On any other screen it is a link. */
  protected readonly atWorlds = computed(() => {
    this.url();
    return /^\/(worlds)?([?#]|$)/.test(this.router.url);
  });
  /** The lab id in the address, or null on any other screen. */
  protected readonly labId = computed(() => {
    this.url();
    const m = /^\/workspace\/([^/?#]+)/.exec(this.router.url);
    return m ? decodeURIComponent(m[1]!) : null;
  });
  /** Named only when the host confirmed this very lab; otherwise the breadcrumb stops at the world. */
  protected readonly lab = computed(() => {
    const l = this.activeLab.lab();
    return l && l.id === this.labId() ? l : null;
  });

  protected skip(event: Event): void {
    event.preventDefault();
    const main = document.querySelector<HTMLElement>('main');
    if (!main) return;
    main.tabIndex = -1;
    main.focus();
  }
}
