import { Component, HostListener, Input, input } from '@angular/core';

import { Side, Status } from './checker-misc-types.ts';

@Component({
  selector: 'sb-checker-misc',
  template: '',
})
export class CheckerMiscComponent {
  // Unannotated: the enum type only becomes known through checker inference.
  @Input() status = Status.Active;

  // No generic: the alias only becomes known through the InputSignal<T> unwrap.
  align = input('left' as Side);

  @Input() dir: 'a"b' | 'c' = 'c';

  static defaults = input('nope');

  @HostListener('window:resize')
  onResize(): void {}

  format(value: string): string;
  format(value: number): number;
  format(value: string | number): string | number {
    return value;
  }
}
