import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'storybook-button',
  template: `
    <button
      type="button"
      class="storybook-button storybook-button--{{ size }} {{ mode }}"
      [style.backgroundColor]="backgroundColor"
      (click)="onClick($event)"
    >
      {{ label }}
    </button>
  `,
})
export class ButtonComponent {
  /**
   * Is this the principal call to action on the page?
   */
  @Input() primary = false;

  /**
   * What background color to use
   */
  @Input() backgroundColor: string | undefined = undefined;

  /**
   * How large should the button be?
   */
  @Input() size: 'small' | 'medium' | 'large' = 'medium';

  /**
   * Button contents
   */
  @Input() label: string = '';

  @Output() onClick = new EventEmitter<MouseEvent>();

  get mode() {
    return this.primary ? 'storybook-button--primary' : 'storybook-button--secondary';
  }
}
