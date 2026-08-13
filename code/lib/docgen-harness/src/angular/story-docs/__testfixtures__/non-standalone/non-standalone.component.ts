import { Component, EventEmitter, Input, NgModule, Output } from '@angular/core';

@Component({
  selector: 'sb-non-standalone',
  standalone: false,
  template: '<button (click)="pressed.emit(label)">{{ label }}</button>',
})
export class NonStandaloneComponent {
  @Input() label = 'Save';

  @Output() pressed = new EventEmitter<string>();
}

@NgModule({
  declarations: [NonStandaloneComponent],
  exports: [NonStandaloneComponent],
})
export class NonStandaloneModule {}
