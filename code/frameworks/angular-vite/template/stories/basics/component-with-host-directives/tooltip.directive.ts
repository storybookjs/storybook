import { Directive, input, model, output } from '@angular/core';

@Directive({
  selector: '[storybookTooltip]',
  host: {
    '[attr.title]': 'text()',
    '(click)': 'shown.emit()',
  },
})
export class TooltipDirective {
  /** Text the tooltip shows. */
  text = input('');

  position = input<'above' | 'below'>('above');

  /** Whether the tooltip is open. */
  open = model(false);

  shown = output<void>();
}
