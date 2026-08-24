import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'sb-expression-defaults',
  template: '<span (click)="saved.emit()">{{ rows }} {{ timeoutMs }}</span>',
})
export class ExpressionDefaultsComponent {
  @Input() rows = Math.max(1, 3);

  @Input() timeoutMs = 5 * 60 * 1000;

  @Output() saved = new EventEmitter<void>();
}
