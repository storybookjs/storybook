import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  template: `<button (click)="buttonClick()">{{ label }}</button>`,
  selector: 'rendering-bug-component',
})
export default class RenderingBugComponent {
  @Input() label = 'button';

  buttonClick() {
    this.sample123('Original Message');
  }

  private sample123(someArgument: string) {
    console.log(someArgument);
  }
}
