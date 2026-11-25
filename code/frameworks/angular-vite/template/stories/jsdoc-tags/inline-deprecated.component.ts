import { Component, Input } from '@angular/core';

/** A component. @deprecated Use another component. */
@Component({
  selector: 'inline-deprecated',
  template: `<span>{{ label }}</span>`,
  standalone: true,
})
export class InlineDeprecatedComponent {
  /** The text. */
  @Input() label?: string;
}
