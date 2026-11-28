import { Component, Input } from '@angular/core';

/** Use the `@summary` tag. */
@Component({
  selector: 'at-in-backticks',
  template: `<span>{{ label }}</span>`,
  standalone: true,
})
export class AtInBackticksComponent {
  /** The text. */
  @Input() label?: string;
}
