import { Component, Input } from '@angular/core';

@Component({
  standalone: false,
  selector: 'storybook-pre',
  template: `<pre data-testid="pre" [ngStyle]="style">{{ finalText }}</pre>`,
})
export default class PreComponent {
  /** Styles to apply to the component */
  @Input()
  style?: Object;

  /** An object to render */
  @Input()
  object?: Object;

  /** The code to render */
  @Input()
  text?: string;

  get finalText() {
    return this.object ? JSON.stringify(this.object, null, 2) : this.text;
  }
}
