import { Component, Input, ChangeDetectionStrategy, HostBinding } from '@angular/core';

@Component({
  standalone: false,
  selector: 'storybook-on-push-box',
  template: ` Word of the day: {{ word }} `,
  styles: [
    `
      :host {
        display: block;
        padding: 1rem;
        width: fit-content;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnPushBoxComponent {
  @Input() word?: string;

  @Input() @HostBinding('style.background-color') bgColor?: string;
}
