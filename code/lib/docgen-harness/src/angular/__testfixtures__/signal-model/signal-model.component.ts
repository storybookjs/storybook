import { Component, model } from '@angular/core';

@Component({
  selector: 'sb-signal-model',
  template: '<span>{{ value() }} {{ checked() }}</span>',
})
export class SignalModelComponent {
  /** Current text value of the field. */
  value = model('start');

  checked = model.required<boolean>();
}
