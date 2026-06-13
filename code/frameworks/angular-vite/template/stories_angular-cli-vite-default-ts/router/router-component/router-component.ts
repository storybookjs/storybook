import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  template: `
    <button (click)="routeToNonExistingUrl()">Route</button>
  `,
  selector: 'router-provider-button',
})
export default class ProvideRouterComponent {
  private router = inject(Router);

  routeToNonExistingUrl() {
    this.router.navigate(['/nonExisting']);
  }
}
