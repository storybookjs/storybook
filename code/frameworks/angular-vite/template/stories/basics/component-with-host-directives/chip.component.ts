import { Component, Directive, input } from '@angular/core';

import { TooltipDirective } from './tooltip.directive';

@Directive({
  selector: '[storybookTooltipHost]',
  hostDirectives: [
    {
      directive: TooltipDirective,
      inputs: ['text: tooltip', 'open: expanded'],
      outputs: ['shown', 'openChange: expandedChange'],
    },
  ],
})
export class TooltipHostDirective {}

@Component({
  selector: 'storybook-chip',
  template: `<span>{{ label() }}</span>`,
})
export class ChipComponent extends TooltipHostDirective {
  label = input('');
}
