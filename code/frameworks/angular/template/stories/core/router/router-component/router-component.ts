import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

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
