import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'parent-component',
  template: `
    Parent<br />
Input text: {{ parentText }} <br />
Output : <button (click)="onClickParent.emit($event)">Click here !</button> <br />
<div style="margin: 3em; border: solid"><ng-content></ng-content></div>
  `,
})
export default class ParentComponent {
  @Input()
  parentText = '';

  @Output()
  onClickParent = new EventEmitter<any>();
}
