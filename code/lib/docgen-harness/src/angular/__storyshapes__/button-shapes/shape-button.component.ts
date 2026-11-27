import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'sb-shape-button',
  template: '<button (click)="clicked.emit(label)">{{ label }} {{ count }}</button>',
})
export class ShapeButtonComponent {
  @Input() label = 'Button';

  @Input() count?: number;

  @Input() items: number[] = [];

  @Input() loadingError?: Error;

  @Output() clicked = new EventEmitter<string>();
}
