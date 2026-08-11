/** Fixture: a component in its own file, imported by name from a story file. */
import { Component, Input } from '@angular/core';

@Component({ selector: 'sb-button', template: '<button>{{ label }}</button>' })
export class ButtonComponent {
  @Input() label = 'Click me';
}
