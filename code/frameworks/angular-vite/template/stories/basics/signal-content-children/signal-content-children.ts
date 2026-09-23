import { Component, contentChildren } from '@angular/core';

@Component({
  selector: 'storybook-content-child',
  template: 'Child',
  standalone: false,
})
export class ContentChildComponent {}

@Component({
  selector: 'storybook-content-parent',
  template: `
    <p data-testid="query-result">{{ options().length }} projected children</p>
    <p data-testid="label">{{ label }}</p>
    <ng-content />
  `,
  standalone: false,
})
export class ContentParentComponent {
  options = contentChildren(ContentChildComponent);

  label = '';
}
