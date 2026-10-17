import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'sb-meta-actions',
  template: '<button [class.primary]="primary" (click)="onClick.emit()">{{ label }}</button>',
})
export class MetaActionsComponent {
  @Input() primary = false;

  @Input() label = 'Button';

  @Output() onClick = new EventEmitter<Event>();
}
