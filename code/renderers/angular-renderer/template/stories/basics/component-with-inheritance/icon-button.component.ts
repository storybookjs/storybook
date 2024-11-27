import { Component, Input } from '@angular/core';
import { BaseButtonComponent } from './base-button.component';

@Component({
  standalone: false,
  selector: `storybook-icon-button`,
  template: ` <button>{{ label }} - {{ icon }}</button> `,
})
export class IconButtonComponent extends BaseButtonComponent {
  @Input()
  icon?: string;
}
