import { Component, Input, input, output } from '@angular/core';

@Component({
  // Needs to be a different name to the CLI template button
  selector: 'storybook-signal-button',
  template: ` <button
  type="button"
  (click)="onClick.emit($event)"
  [ngClass]="classes"
  [ngStyle]="{ 'background-color': backgroundColor }"
>
  {{ label() }}
</button>`,
  styleUrls: ['./button.css'],
})
export default class SignalButtonComponent {
  /** Is this the principal call to action on the page? */
  primary = input(false);

  /** What background color to use */
  @Input()
  backgroundColor?: string;

  /** How large should the button be? */
  size = input('medium', {
    transform: (val: 'small' | 'medium') => val,
  });

  /** Button contents */
  label = input.required({ transform: (val: string) => val.trim() });

  /** Optional click handler */
  onClick = output<Event>();

  public get classes(): string[] {
    const mode = this.primary() ? 'storybook-button--primary' : 'storybook-button--secondary';

    return ['storybook-button', `storybook-button--${this.size()}`, mode];
  }
}
