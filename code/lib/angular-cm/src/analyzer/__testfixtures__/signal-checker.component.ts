import { Component, input, model, output } from '@angular/core';

@Component({
  selector: 'sb-signal-checker',
  template: '',
})
export class SignalCheckerComponent {
  // No generic and a non-literal default: only the checker's InputSignal<T> unwrap can type this.
  ratios = input([0.5, 1]);

  // Union literal default: the unwrap must keep the union spelling, not widen to string.
  align = model('left' as 'left' | 'right');

  tags = output<Set<string>>();
}
