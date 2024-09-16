import { Component, Inject, InjectionToken, Optional } from '@angular/core';

export const WITHOUT_SELECTOR_DATA = new InjectionToken<{ color: string; name: string }>(
  'WITHOUT_SELECTOR_DATA'
);

@Component({
  template: `My name in color :
<div [style.color]="color">{{ name }}</div>
<ng-content></ng-content> <ng-content></ng-content>`,
})
export class WithoutSelectorComponent {
  color = '#1e88e5';

  name = 'Joe Bar';

  constructor(
    @Inject(WITHOUT_SELECTOR_DATA)
    @Optional()
    data: {
      color: string;
      name: string;
    } | null
  ) {
    if (data) {
      this.color = data.color;
      this.name = data.name;
    }
  }
}
