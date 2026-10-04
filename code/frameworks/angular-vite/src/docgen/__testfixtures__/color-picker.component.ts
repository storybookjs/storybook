/** Fixture: a `model()` signal, which is one input plus a synthesized `Change` output. */
import { Component, model } from '@angular/core';

@Component({ selector: 'sb-color-picker', template: '<span>{{ color() }}</span>' })
export class ColorPickerComponent {
  /** The currently selected colour */
  color = model<string>('#345F92');
}
