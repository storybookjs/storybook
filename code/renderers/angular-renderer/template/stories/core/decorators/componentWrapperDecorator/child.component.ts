import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  standalone: false,
  selector: 'child-component',
  template: `
    Child<br />
Input text: {{ childText }} <br />
Output : <button (click)="onClickChild.emit($event)">Click here !</button> <br />
Private text: {{ childPrivateText }} <br />
  `,
})
export default class ChildComponent {
  @Input()
  childText = '';

  childPrivateText = '';

  @Output()
  onClickChild = new EventEmitter<any>();
}
