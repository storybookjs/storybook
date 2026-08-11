import { Component, Input } from '@angular/core';

@Component({
  selector: 'sb-default-card',
  template: '<div>{{ heading }}</div>',
})
export default class DefaultCardComponent {
  @Input() heading = '';
}
