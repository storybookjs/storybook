import { Component, Input } from '@angular/core';

import { Numeric, Weird, type LoopA, type Outer } from './misc-types.ts';

/**
 * Shows misc collection.
 *
 * @summary A summary line.
 */
@Component({
  selector: 'sb-misc',
  template: '',
})
export class MiscComponent {
  @Input() tone: Outer = 'x';

  @Input() level: Numeric = Numeric.One;

  @Input() loop?: LoopA;

  @Input() weird?: Weird;

  /**
   * Callback invoked on change.
   *
   * @default 'none'
   */
  @Input() onChange?: string;

  formatter = (value: number) => `${value}`;

  /** @ignore */
  secret = 'hidden';

  private cache: string[] = [];

  protected shield = true;

  static counter = 0;

  get zoom(): number {
    return 1;
  }

  set zoom(value: number) {
    void value;
  }

  ngOnInit(): void {}
}
