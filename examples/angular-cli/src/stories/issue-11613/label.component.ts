import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'storybook-label-component',
  template: `
    <div [style.background-color]="bgColor">{{ text }}</div>
    <div>{{ localText }}</div>
  `,
  styles: [
    `
      button {
        border: 1px solid #eee;
        border-radius: 3px;
        background-color: #ffffff;
        cursor: pointer;
        font-size: 15px;
        padding: 3px 10px;
        margin: 10px;
      }
    `,
  ],
})
export default class LabelComponent implements OnInit {
  /**
   * Specify the Label text
   */
  @Input()
  text = '';

  /**
   * Specify the label's bgColor
   */
  @Input()
  bgColor: string;

  localText = 'Original localText';

  ngOnInit() {
    this.localText = 'Updated localText';
  }
}
