import { Component, Injectable, NgModule } from '@angular/core';

@Injectable()
export class ApiService {
  data: string = 'If you see this theres no injection error';
}

@NgModule({
  providers: [ApiService],
})
export class ApiModule {}

@Component({
  template: `<span>{{ testForProvider }}</span>`,
  selector: 'not-standalone-component',
  imports: [ApiModule],
})
export default class NotStandaloneComponent {
  testForProvider = '';

  constructor(private service: ApiService) {
    this.testForProvider = service.data;
  }
}
