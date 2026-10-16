import { Component, Input } from '@angular/core';

@Component({
  selector: 'sb-meta-render',
  template: '<span>{{ label }}</span>',
})
export class MetaRenderComponent {
  @Input() label = 'Meta';
}
