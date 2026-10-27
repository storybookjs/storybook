import { Component, Input } from '@angular/core';

@Component({
  selector: 'sb-render-function',
  template: '<span>{{ label }}</span>',
})
export class RenderFunctionComponent {
  @Input() label = 'Render';
}
