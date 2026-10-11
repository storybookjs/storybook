import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'sb-basic',
  template: '<button (click)="pressed.emit(label)">{{ label }} {{ count }}</button>',
})
export class BasicComponent {
  @Input() label = 'Save';

  @Input() count?: number;

  @Output() pressed = new EventEmitter<string>();
}
