import { Component, Input, Output, EventEmitter, Inject, HostBinding } from '@angular/core';
import { CHIP_COLOR } from './chip-color.token';

@Component({
  selector: 'storybook-chip',
  template: `
    <span class="text">{{ displayText | chipText }}</span>
<div class="remove" (click)="removeClicked.emit()">
  <span class="x">✕</span>
</div>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        cursor: default;
        border: solid 0.1rem transparent;
        border-radius: 1rem;
        padding: 0.2rem 0.5rem;
      }
      :host:hover {
        border-color: black;
      }
      .text {
        font-family: inherit;
      }
      .remove {
        margin-left: 1rem;
        border-radius: 50%;
        background-color: lightgrey;
        width: 1rem;
        height: 1rem;
        text-align: center;
      }
      .remove:hover {
        background-color: palevioletred;
      }
      .x {
        display: inline-block;
        vertical-align: baseline;
        color: #eeeeee;
        line-height: 1rem;
        text-align: center;
      }
    `,
  ],
})
export class ChipComponent {
  @Input() displayText?: string;

  @Output() removeClicked = new EventEmitter();

  @HostBinding('style.background-color') backgroundColor: string;

  constructor(@Inject(CHIP_COLOR) chipColor: string) {
    this.backgroundColor = chipColor;
  }
}
