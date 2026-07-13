// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { Component, model } from '@angular/core';

/**
 * A component exercising Angular's `model()` two-way binding signal.
 *
 * compodoc emits a `model()` member as an identical entry in BOTH `inputsClass` and
 * `outputsClass` (see `.omc/plans/probe-fixtures/compodoc-model-probe-documentation.json`).
 */
@Component({ selector: 'cp', template: '' })
export class ColorPickerComponent {
  public readonly color = model<string>('#345F92');

  showText = model.required<boolean>();
}
