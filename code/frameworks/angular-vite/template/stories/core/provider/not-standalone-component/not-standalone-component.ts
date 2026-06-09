import { Component, Injectable, NgModule, inject } from '@angular/core';

@Injectable()
export class ApiService {
  data: string = 'If you see this theres no injection error';
}

@NgModule({
  providers: [ApiService],
})
export class ApiModule {}

@Component({
  standalone: false,
  template: `
    <span>{{ testForProvider }}</span>
  `,
  selector: 'not-standalone-component',
})
export default class NotStandaloneComponent {
  private service = inject(ApiService);

  testForProvider = this.service.data;
}
