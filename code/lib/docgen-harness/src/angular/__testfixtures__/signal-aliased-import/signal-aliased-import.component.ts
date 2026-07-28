import { Component, input as ngInput } from '@angular/core';

@Component({
  selector: 'sb-signal-aliased-import',
  template: '<span>{{ aliased() }}</span>',
})
export class SignalAliasedImportComponent {
  aliased = ngInput('hello');
}
