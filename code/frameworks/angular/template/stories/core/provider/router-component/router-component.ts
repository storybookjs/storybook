import { Component, Injectable } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from "@angular/router";

@Injectable()
export class ApiService {
  data: string = 'original Api Service';
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  // Needs to be a different name to the CLI template button
  template: `<span>Router works</span>`,
  selector: 'router-provider-button',
})
export default class ProvideRouterComponent {
}
