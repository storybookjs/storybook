import { Component, Input } from '@angular/core';

/** A component. Ask @design before you change it. */
@Component({
  selector: 'at-in-prose',
  template: `<span>{{ label }}</span>`,
  standalone: true,
})
export class AtInProseComponent {
  /** The text. */
  @Input() label?: string;
}
