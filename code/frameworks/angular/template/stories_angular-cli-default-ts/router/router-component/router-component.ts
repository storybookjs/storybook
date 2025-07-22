import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Router } from '@angular/router';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `<button (click)="routeToNonExistingUrl()">Route</button>`,
  selector: 'router-provider-button',
})
export default class ProvideRouterComponent {
  constructor(private router: Router) {}

  routeToNonExistingUrl() {
    this.router.navigate(['/nonExisting']);
  }
}
