import { Component, Input } from '@angular/core';

@Component({
  selector: 'sb-nested-badge',
  template: '<span>{{ label }}</span>',
})
export class NestedBadgeComponent {
  @Input() label = '';
}
