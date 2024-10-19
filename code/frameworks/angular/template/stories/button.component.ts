import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'storybook-button-component',
  template: ` <button (click)="onClick.emit($event)">{{ text }}</button> `,
  styles: [
    `
      button {
        cursor: pointer;
        margin: 10px;
        border: 1px solid #eee;
        border-radius: 3px;
        background-color: #ffffff;
        padding: 3px 10px;
        font-size: 15px;
      }
    `,
  ],
})
export default class ButtonComponent {
  @Input()
  text = '';

  @Output()
  onClick = new EventEmitter<any>();
}
