import { Component, booleanAttribute, input, output } from '@angular/core';

@Component({
  selector: 'sb-signal-io',
  template: '<span>{{ label() }} {{ count() }} {{ step() }} {{ disabled() }}</span>',
})
export class SignalIoComponent {
  /** Visible caption next to the control. */
  label = input('');

  count = input.required<number>();

  step = input(1, { alias: 'increment' });

  disabled = input(false, { transform: booleanAttribute });

  toggled = output<boolean>();

  readonly version = 'v1';
}
