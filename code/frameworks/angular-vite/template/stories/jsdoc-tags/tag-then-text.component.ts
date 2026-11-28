import { Component, Input } from '@angular/core';

/**
 * A component.
 * @summary a component
 * Ask @design first.
 */
@Component({
  selector: 'tag-then-text',
  template: `<span>{{ label }}</span>`,
  standalone: true,
})
export class TagThenTextComponent {
  /** The text. */
  @Input() label?: string;
}
