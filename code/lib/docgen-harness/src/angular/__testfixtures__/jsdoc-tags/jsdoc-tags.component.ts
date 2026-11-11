import { Component, Input } from '@angular/core';

/**
 * Renders a colored status chip.
 *
 * @see https://example.com/design/chips
 */
@Component({
  selector: 'sb-jsdoc-tags',
  template: '<span [style.color]="accent">{{ text }}</span>',
})
export class JsdocTagsComponent {
  /**
   * Chip text.
   *
   * @deprecated Use `label` on the parent panel instead.
   * @see https://example.com/docs/chip-text
   * @sbCategory presentation
   */
  @Input() text = '';

  /**
   * Accent color applied to the chip text.
   *
   * @default 'steelblue'
   */
  @Input() accent?: string;
}
