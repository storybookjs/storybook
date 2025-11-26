import { Component, Input } from '@angular/core';

@Component({
  standalone: false,
  selector: `storybook-base-button`,
  template: ` <button>{{ label }}</button> `,
})
export class BaseButtonComponent {
  @Input()
  label?: string;
}
