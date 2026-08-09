import { Component, Directive, Input } from '@angular/core';

// Selector-less base directive: Angular only inherits input metadata from a decorated base.
@Directive()
export class OverrideBase {
  /** Whether the control is disabled. */
  @Input() disabled = true;
}

@Component({
  selector: 'sb-override-input',
  template: '',
})
export class OverrideInputComponent extends OverrideBase {
  // Re-declared as a plain property; Angular still inherits the input metadata.
  override disabled = false;
}
