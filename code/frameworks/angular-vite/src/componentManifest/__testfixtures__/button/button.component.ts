import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Primary UI component for user interaction.
 */
@Component({
  selector: 'app-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<button [disabled]="disabled">{{ label }}</button>',
})
export class ButtonComponent {
  /** Text displayed inside the button. */
  @Input() label = 'Click me';
  /** When true the button is non-interactive. */
  @Input() disabled = false;
  /** Emitted when the user clicks the button. */
  @Output() clicked = new EventEmitter<void>();
}
