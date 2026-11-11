import { Component, EventEmitter, Input, NgModule, Output } from '@angular/core';

@Component({
  selector: 'sb-legacy-button',
  standalone: false,
  template: '<button (click)="pressed.emit(label)">{{ label }}</button>',
})
export class LegacyButtonComponent {
  @Input() label = 'Save';

  @Output() pressed = new EventEmitter<string>();
}

@NgModule({
  declarations: [LegacyButtonComponent],
  exports: [LegacyButtonComponent],
})
export class LegacyButtonModule {}
