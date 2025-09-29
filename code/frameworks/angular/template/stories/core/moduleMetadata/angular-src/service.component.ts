import type { OnInit } from '@angular/core';
import { Component, Input } from '@angular/core';
import type { DummyService } from './dummy.service';

@Component({
  standalone: false,
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
