import { OnInit, Component, Input } from '@angular/core';
import { DummyService } from './dummy.service';

@Component({
  selector: 'storybook-simple-service-component',
  template: `<p>{{ name }}:</p>
<ul>
  <li *ngFor="let item of items">{{ item }}</li>
</ul>`,
})
export class ServiceComponent implements OnInit {
  items?: {};

  @Input()
  name?: any;

  constructor(private dummy: DummyService) {}

  async ngOnInit() {
    this.items = (await this.dummy.getItems()) as any;
  }
}
