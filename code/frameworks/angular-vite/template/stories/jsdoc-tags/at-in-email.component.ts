import { Component, Input } from '@angular/core';

/** Mail me@example.com for help. */
@Component({
  selector: 'at-in-email',
  template: `<span>{{ label }}</span>`,
  standalone: true,
})
export class AtInEmailComponent {
  /** The text. */
  @Input() label?: string;
}
