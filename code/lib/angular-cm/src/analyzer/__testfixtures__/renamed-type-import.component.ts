import { Component, Input } from '@angular/core';

import { Choice as ButtonChoice, Level as ButtonLevel } from './renamed-type-import-types.ts';

// The props table shows the local spelling, so `miscellaneous` has to answer to it too.
@Component({ selector: 'sb-renamed-type-import', template: '' })
export class RenamedTypeImportComponent {
  @Input() choice: ButtonChoice = 'x';
  @Input() level: ButtonLevel = ButtonLevel.Low;
}
