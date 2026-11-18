import { Component, Input } from '@angular/core';

import { ButtonKind, type ToneOption } from './types.ts';

@Component({
  selector: 'sb-decorator-union-enum',
  template: '<span>{{ size }} {{ tone }} {{ kind }}</span>',
})
export class DecoratorUnionEnumComponent {
  @Input() size: 'small' | 'large' = 'small';

  @Input() tone: ToneOption = 'info';

  @Input() kind: ButtonKind = ButtonKind.Primary;
}
