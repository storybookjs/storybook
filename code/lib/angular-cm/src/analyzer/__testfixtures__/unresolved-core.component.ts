// @ts-nocheck - compiled by a test program that cannot resolve '@angular/core', exercising the
// signal fallback for imports whose module resolution fails.
import { Component, input, model, output } from '@angular/core';

@Component({
  selector: 'sb-unresolved-core',
  template: '',
})
export class UnresolvedCoreComponent {
  label = input('hi');

  checked = model.required<boolean>();

  toggled = output<boolean>();
}
