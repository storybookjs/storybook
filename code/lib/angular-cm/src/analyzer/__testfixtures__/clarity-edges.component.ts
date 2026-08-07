// Edge cases found on vmware-clarity/ng-clarity and geonetwork/geonetwork-ui during the
// community evaluations.
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { subscribe } from './clarity-edges-helper.ts';

@Component({ selector: 'sb-clarity-edges', template: '' })
export class ClarityEdgesComponent {
  private readonly clicks = new EventEmitter<number[]>();

  /** Emitted when map features are clicked. */
  @Output() get featuresClick(): EventEmitter<number[]> {
    return this.clicks;
  }

  @Output('renamedChange') get internalChange(): EventEmitter<string> {
    return new EventEmitter<string>();
  }

  /*****
   * property cells
   *
   * @description
   * A query list of the cells in this row.
   */
  @Input() cells = 3;

  private get internalState(): string {
    return 'hidden';
  }

  protected get errorPresent(): boolean {
    return false;
  }

  get publicPair(): number {
    return 1;
  }

  set publicPair(value: number) {
    void value;
  }

  /**
   * @deprecated Will be removed in v15. Use `openNav` instead.
   */
  toggleNav(navLevel: number): void {
    void navLevel;
  }

  listen() {
    return subscribe();
  }
}
