import { Component, Input } from '@angular/core';

/**
 * Default export docs.
 *
 * @summary Named default summary.
 */
@Component({
  selector: 'sb-default-card',
  template: '<div>{{ heading }}</div>',
})
export default class DefaultCardComponent {
  @Input() heading = '';
}
