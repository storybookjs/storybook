import { Component, Input } from '@angular/core';

@Component({
  selector: 'sb-as-cast',
  template: '<span>{{ label }}</span>',
})
export class AsCastComponent {
  @Input() label = 'Cast';

  @Input() tone: 'info' | 'warn' = 'info';
}
