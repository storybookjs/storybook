import { Component, input } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <button type="button">{{ label() }}</button>
  `,
})
export class AppComponent {
  readonly label = input('Angular');
}
