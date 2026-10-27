import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'sb-csf4',
  template: '<button (click)="saved.emit()">{{ label }}</button>',
})
export class CsfFourComponent {
  @Input() label = 'Save';

  @Output() saved = new EventEmitter<void>();
}
