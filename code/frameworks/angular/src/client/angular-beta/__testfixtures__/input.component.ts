import { Component, EventEmitter, Input, Output } from '@angular/core';

export const exportedConstant = 'An exported constant';

export enum ButtonAccent {
  'Normal' = 'Normal',
  'High' = 'High',
}

export interface ISomeInterface {
  one: string;
  two: boolean;
  three: any[];
  ref?: ISomeInterface;
}

@Component({
  selector: 'doc-button',
  template: '<button>{{ label }}</button>',
})
export class InputComponent<T> {
  /** Appearance style of the button. */
  @Input()
  public appearance: 'primary' | 'secondary' = 'secondary';

  @Input()
  public counter: number;

  /** Specify the accent-type of the button */
  @Input()
  public accent: ButtonAccent;

  /** To test source-generation with overridden propertyname */
  @Input('color') public foregroundColor: string;

  /** Sets the button to a disabled state. */
  @Input()
  public isDisabled = false;

  @Input()
  public label: string;

  @Input('aria-label') public ariaLabel: string;

  /** Specifies some arbitrary object */
  @Input() public someDataObject: ISomeInterface;

  @Output()
  public onClick = new EventEmitter<Event>();

  @Output('dash-out') public dashOut = new EventEmitter<any>();
}
