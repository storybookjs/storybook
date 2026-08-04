import { EventEmitter, Input, Output } from '@angular/core';

export abstract class BaseAlertComponent {
  /** Whether the alert shows a close button. */
  @Input() dismissible = false;

  @Output() dismissed = new EventEmitter<void>();
}
