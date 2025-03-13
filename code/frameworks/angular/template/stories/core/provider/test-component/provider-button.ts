import { Component, Injectable } from '@angular/core';
import { CommonModule } from '@angular/common';

@Injectable()
export class ApiService {
  data: string = 'original Api Service';
}

@Component({
  standalone: true,
  imports: [CommonModule],
  // Needs to be a different name to the CLI template button
  template: `<button type="button">{{ label }}</button>`,
  providers: [ApiService],
})
export default class ProviderButtonComponent {
  constructor(private apiService: ApiService) {
    this.label = apiService.data;
  }

  label = 'NotSetYet';
}
