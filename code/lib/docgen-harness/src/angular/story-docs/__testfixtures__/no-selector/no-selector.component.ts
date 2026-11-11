import { Component, Input } from '@angular/core';

@Component({
  template: '<span>{{ label }}</span>',
})
export class NoSelectorComponent {
  @Input() label = 'Outlet';
}
