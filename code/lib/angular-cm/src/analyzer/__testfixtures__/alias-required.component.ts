import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'sb-alias-required',
  template: '<span>{{ label }}</span>',
})
export class AliasRequiredComponent {
  @Input('buttonLabel') label = '';

  @Input({ alias: 'tone', required: true }) kind!: string;

  @Input({ required: false }) hint?: string;

  /**
   * Accessor input whose default only exists as documentation.
   *
   * @default Another default value
   */
  @Input()
  get anotherDefaultValue() {
    return this.#anotherDefaultValue;
  }

  set anotherDefaultValue(value: string) {
    this.#anotherDefaultValue = value;
  }

  #anotherDefaultValue = 'Another default value';

  @Output('saved') persisted = new EventEmitter<number>();
}
