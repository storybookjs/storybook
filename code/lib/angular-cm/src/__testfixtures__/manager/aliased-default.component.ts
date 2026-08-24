import { Component, Input } from '@angular/core';

/**
 * Aliased default docs.
 *
 * @summary Aliased default summary.
 */
@Component({
  selector: 'sb-aliased-card',
  template: '<div>{{ note }}</div>',
})
class AliasedCardComponent {
  @Input() note = '';
}

export { AliasedCardComponent as default };
