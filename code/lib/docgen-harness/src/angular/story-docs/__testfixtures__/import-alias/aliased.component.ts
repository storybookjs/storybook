import { Component, Input } from '@angular/core';

@Component({
  selector: 'sb-import-alias',
  template: '<span>{{ heading }}</span>',
})
export class ImportAliasComponent {
  @Input() heading = 'Aliased';
}
