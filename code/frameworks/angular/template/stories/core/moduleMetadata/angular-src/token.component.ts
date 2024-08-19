import { Component, Input, InjectionToken, Inject, Optional } from '@angular/core';

export const ITEMS = new InjectionToken<string[]>('TokenComponent.Items');
export const DEFAULT_NAME = new InjectionToken<string>('TokenComponent.DefaultName');

@Component({
  selector: 'storybook-simple-token-component',
  template: `
    <h3>{{ name }}</h3>
<p>Items:</p>
<ul>
  <li *ngFor="let item of items">{{ item }}</li>
</ul>
  `,
})
export class TokenComponent {
  items;

  @Input()
  name;

  constructor(
    @Optional()
    @Inject(DEFAULT_NAME)
    defaultName: string,
    @Inject(ITEMS) items: string[]
  ) {
    this.name = defaultName;
    this.items = items;
  }
}
