import { Component, Input } from '@angular/core';

@Component({
  selector: 'sb-csf1-legacy',
  template: '<span>{{ label }} {{ count }}</span>',
})
export class CsfOneLegacyComponent {
  @Input() label = 'Legacy';

  @Input() count = 0;
}
