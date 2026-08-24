import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  standalone: true,
  selector: 'sb-dynamic-snippets',
  template: `
    <button type="button" (click)="pressed.emit($event)">{{ label }}</button>
  `,
})
export class DynamicSnippetsComponent {
  /** Text the button shows. Driven by a Controls knob in the dynamic-snippets e2e. */
  @Input() label = '';

  @Output() pressed = new EventEmitter<MouseEvent>();
}
