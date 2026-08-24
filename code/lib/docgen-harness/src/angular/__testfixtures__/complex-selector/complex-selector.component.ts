import { Component, Input } from '@angular/core';

@Component({
  selector: 'button[sb-harness-action], a[sb-harness-action]',
  template: '<span class="chip">{{ emphasis }}</span>',
})
export class ComplexSelectorComponent {
  @Input() emphasis = false;
}
