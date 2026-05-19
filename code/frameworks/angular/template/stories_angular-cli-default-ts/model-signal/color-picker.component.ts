import { Component, model } from '@angular/core';

@Component({
  standalone: false,
  // Needs a unique selector so it does not clash with other template components
  selector: 'storybook-color-picker',
  template: ` <div>
  <span data-testid="current-color">{{ color() }}</span>
  <button type="button" data-testid="emit-green" (click)="color.set('#00FF00')">Set green</button>
</div>`,
  styleUrls: ['./color-picker.css'],
})
export default class ColorPickerComponent {
  /**
   * The currently selected color.
   *
   * `model()` creates a two-way binding: an input `color` plus a compiler-synthesized
   * `colorChange` output. Native `@storybook/angular` `model()` support means this no longer
   * requires a hand-written `Args` interface or manual `argTypes` workaround.
   */
  color = model<string>('#345F92');
}
