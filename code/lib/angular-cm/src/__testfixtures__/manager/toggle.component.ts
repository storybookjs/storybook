import { Component, Input, input } from '@angular/core';

import { BaseToggleComponent } from './base-toggle.ts';

/** A toggle switch. */
@Component({
  selector: 'sb-toggle',
  template: '<button>{{ label }}</button>',
})
export class ToggleComponent extends BaseToggleComponent {
  /** Text shown next to the toggle. */
  @Input() label = 'Toggle';

  /** Visual size of the control. */
  size = input<'small' | 'large'>('small');
}
