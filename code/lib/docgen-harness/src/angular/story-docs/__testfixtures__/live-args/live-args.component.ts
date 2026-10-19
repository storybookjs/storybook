import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'sb-live-args',
  template: '<button (click)="pressed.emit()">{{ formatter(label ?? "") }}</button>',
})
export class LiveArgsComponent {
  @Input() label: string | null = 'Label';

  @Input() control: unknown;

  @Input() formatter: (value: string) => string = (value) => value;

  @Output() pressed = new EventEmitter<Event>();
}
