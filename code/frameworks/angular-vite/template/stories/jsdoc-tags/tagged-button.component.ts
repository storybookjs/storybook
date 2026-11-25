import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Component docblock description.
 *
 * @summary Component summary
 * @describe Component describe text
 * @import import { TaggedButtonComponent } from '@example/tagged-button';
 * @deprecated Component deprecated note
 * @example <tagged-button label="Component example"></tagged-button>
 * @since 1.0.0
 */
@Component({
  selector: 'tagged-button',
  template: `<button type="button" [attr.data-size]="size" (click)="clicked.emit($event)">
    {{ label }}
  </button>`,
  standalone: true,
})
export class TaggedButtonComponent {
  /**
   * The button text.
   *
   * @deprecated Use content projection instead.
   */
  @Input() label?: string;

  /**
   * The button size.
   *
   * @default 'medium'
   */
  @Input() size: 'small' | 'medium' | 'large' = 'medium';

  /**
   * A member that docgen should hide.
   *
   * @ignore
   */
  @Input() internalId?: string;

  /**
   * A member that the API table should hide.
   *
   * @internal
   */
  @Input() internalNote?: string;

  /**
   * Text that the description tag replaces.
   *
   * @description The button style, from the description tag.
   * @example <tagged-button variant="primary"></tagged-button>
   * @since 1.0.0
   */
  @Input() variant: 'primary' | 'secondary' = 'primary';

  /** Emits when the button is clicked. */
  @Output() clicked = new EventEmitter<MouseEvent>();

  /**
   * Focuses the button.
   *
   * @param options The focus options.
   * @returns Nothing.
   */
  focus(options?: FocusOptions): void {
    void options;
  }
}
