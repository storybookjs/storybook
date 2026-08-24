import { Component, Input } from '@angular/core';

/**
 * A component published under a different path than it is developed at.
 *
 * @import import { OverrideComponent } from '@design-system/components';
 */
@Component({
  selector: 'sb-import-override',
  template: '<span>{{ heading }}</span>',
})
export class OverrideComponent {
  @Input() heading = 'Overridden';
}
