import { Component, Input } from '@angular/core';

@Component({
  standalone: false,
  selector: 'storybook-with-pipe',
  template: ` <h1>{{ field | customPipe }}</h1> `,
})
export class WithPipeComponent {
  @Input()
  field: any;
}
