import { Component, Input } from '@angular/core';

@Component({
  selector: 'sb-decorator-generic',
  template: '<ul>@for (item of items; track $index) {<li>{{ item }}</li>}</ul>',
})
export class DecoratorGenericComponent<T> {
  @Input() items: T[] = [];

  @Input() selected?: T;
}
