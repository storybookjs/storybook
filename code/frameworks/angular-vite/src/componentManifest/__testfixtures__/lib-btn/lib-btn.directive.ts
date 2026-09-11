import { Directive, Input } from '@angular/core';

/**
 * Attaches library button styling to any host element.
 */
@Directive({ selector: 'button[lib-btn], a[lib-btn]', standalone: true })
export class LibBtnDirective {
  /** Visual variant of the button. */
  @Input() variant: 'primary' | 'secondary' = 'primary';
}
