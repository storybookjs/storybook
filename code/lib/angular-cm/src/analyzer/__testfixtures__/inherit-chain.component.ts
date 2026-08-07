import { Component, Input } from '@angular/core';

import { DtsBase } from './dts-base';

export class MidBase extends DtsBase {
  @Input() midFlag = false;

  hint = 'mid';

  midHelper(): void {}
}

@Component({
  selector: 'sb-inherit-chain',
  template: '',
})
export class InheritChainComponent extends MidBase {
  @Input() own = '';

  midHelper(): void {}
}
