import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'sb-decorator-io-basics',
  template: '<span (click)="clicked.emit(label)">{{ label }} {{ count }}</span>',
})
export class DecoratorIoBasicsComponent {
  /** The text shown on the badge. */
  @Input() label = 'Badge';

  @Input() count?: number;

  // `any` stands in for an untyped input: a truly annotation-free member cannot
  // exist under the harness's strict/noImplicitAny check.
  @Input() data: any;

  @Input() formatter!: (value: number) => string;

  @Output() clicked = new EventEmitter<string>();
}
