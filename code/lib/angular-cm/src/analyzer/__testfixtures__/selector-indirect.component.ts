import { Component, Directive } from '@angular/core';

const CHIP_SELECTOR = 'sb-indirect-chip';

@Component({ selector: CHIP_SELECTOR, template: '<span></span>' })
export class IndirectSelectorComponent {}

function computeSelector(): string {
  return 'sb-dynamic';
}

@Directive({ selector: computeSelector() })
export class DynamicSelectorDirective {}

@Component({ template: '<span></span>' })
export class NoSelectorComponent {}
