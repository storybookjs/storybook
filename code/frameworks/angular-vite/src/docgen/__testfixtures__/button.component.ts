/** Fixture: a component in its own file, imported by name from a story file. */
import { Component, Input } from '@angular/core';

/**
 * Renders with {@link IconButton} in prose.
 * Use together with @see ButtonGroup for accessibility.
 *
 * @deprecated Use NewButton.
 * @example
 * <sb-button label="Save">
 *   Save
 * </sb-button>
 */
@Component({ selector: 'sb-button', template: '<button>{{ label }}</button>' })
export class ButtonComponent {
  @Input() label = 'Click me';
}
