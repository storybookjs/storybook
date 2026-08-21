import { Input } from '@angular/core';

export class BaseToggleComponent {
  /** Whether the control is disabled. */
  @Input() disabled = false;
}
