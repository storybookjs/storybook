import { Component, Injectable, inject } from '@angular/core';

@Injectable()
export class ApiService {
  data: string = 'original Api Service';
}

@Component({
  standalone: true,
  // Needs to be a different name to the CLI template button
  template: `
    <button type="button">{{ label }}</button>
  `,
  selector: 'app-provider-button',
  providers: [ApiService],
})
export default class ProviderButtonComponent {
  private apiService = inject(ApiService);

  label = this.apiService.data;
}
