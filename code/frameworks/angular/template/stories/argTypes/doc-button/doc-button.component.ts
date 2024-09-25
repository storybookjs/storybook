/* eslint-disable no-underscore-dangle */
import {
  Component,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
  ViewChild,
  ElementRef,
} from '@angular/core';

export const exportedConstant = 'An exported constant';

export type ButtonSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface ISomeInterface {
  one: string;
  two: boolean;
  three: any[];
}

export enum ButtonAccent {
  'Normal' = 'Normal',
  'High' = 'High',
}

/**
 * This is a simple button that demonstrates various JSDoc handling in Storybook Docs for Angular.
 *
 * It supports [markdown](https://en.wikipedia.org/wiki/Markdown), so you can embed formatted text,
 * like **bold**, _italic_, and `inline code`.> How you like dem apples?! It's never been easier to
 * document all your components.
 *
 * @string Hello world
 * @link [Example](http://example.com)
 * @code `ThingThing`
 * @html <span class="badge">aaa</span>
 */
@Component({
  selector: 'my-button',
  templateUrl: './doc-button.component.html',
  styleUrls: ['./doc-button.component.scss'],
})
export class DocButtonComponent<T> {
  @ViewChild('buttonRef', { static: false }) buttonRef!: ElementRef;

  /** Test default value. */
  @Input()
  public theDefaultValue = 'Default value in component';

  /**
   * Setting default value here because compodoc won't get the default value for accessors
   *
   * @default Another default value
   */
  @Input()
  get anotherDefaultValue() {
    return this._anotherDefaultValue;
  }

  set anotherDefaultValue(v: string) {
    this._anotherDefaultValue = v;
  }

  _anotherDefaultValue = 'Another default value';

  /** Test null default value. */
  @Input()
  public aNullValue: string | null = null;

  /** Test null default value. */
  @Input()
  public anUndefinedValue: undefined;

  /** Test numeric default value. */
  @Input()
  public aNumericValue = 123;

  /** Appearance style of the button. */
  @Input()
  public appearance: 'primary' | 'secondary' = 'secondary';

  /** Sets the button to a disabled state. */
  @Input()
  public isDisabled = false;

  /** Specify the accent-type of the button */
  @Input()
  public accent: ButtonAccent = ButtonAccent.Normal;

  /**
   * Specifies some arbitrary object. This comment is to test certain chars like apostrophes - it's
   * working
   */
  @Input() public someDataObject!: ISomeInterface;

  /**
   * The inner text of the button.
   *
   * @required
   */
  @Input()
  public label!: string;

  /** Size of the button. */
  @Input()
  public size?: ButtonSize = 'medium';

  /**
   * Some input you shouldn't use.
   *
   * @deprecated
   */
  @Input()
  public somethingYouShouldNotUse = false;

  /**
   * Handler to be called when the button is clicked by a user.
   *
   * Will also block the emission of the event if `isDisabled` is true.
   */
  @Output()
  public onClick = new EventEmitter<Event>();

  /**
   * This is an internal method that we don't want to document and have added the `ignore`
   * annotation to.
   *
   * @ignore
   */
  public handleClick(event: Event) {
    event.stopPropagation();

    if (!this.isDisabled) {
      this.onClick.emit(event);
    }
  }

  private _inputValue = 'some value';

  /** Setter for `inputValue` that is also an `@Input`. */
  @Input()
  public set inputValue(value: string) {
    this._inputValue = value;
  }

  /** Getter for `inputValue`. */
  public get inputValue() {
    return this._inputValue;
  }

  @HostListener('click', ['$event'])
  onClickListener(event: Event) {
    console.log('button', event.target);
    this.handleClick(event);
  }

  @HostBinding('class.focused') focus = false;

  /**
   * Returns all the CSS classes for the button.
   *
   * @ignore
   */
  public get classes(): string[] {
    return [this.appearance, this.size]
      .filter((_class) => !!_class)
      .map((_class) => `btn-${_class}`);
  }

  /** @ignore */
  public ignoredProperty = 'Ignore me';

  /** Public value. */
  public internalProperty = 'Public hello';

  /** Private value. */
  private _value = 'Private hello';

  /** Set the private value. */
  public set value(value: string | number) {
    this._value = `${value}`;
  }

  /** Get the private value. */
  public get value(): string | number {
    return this._value;
  }

  /**
   * An internal calculation method which adds `x` and `y` together.
   *
   * @param x Some number you'd like to use.
   * @param y Some other number or string you'd like to use, will have `parseInt()` applied before
   *   calculation.
   */
  public calc(x: number, y: string | number): number {
    return x + parseInt(`${y}`, 10);
  }

  /** A public method using an interface. */
  public publicMethod(things: ISomeInterface) {
    console.log(things);
  }

  /**
   * A protected method.
   *
   * @param id Some `id`.
   */
  protected protectedMethod(id?: number) {
    console.log(id);
  }

  /**
   * A private method.
   *
   * @param password Some `password`.
   */
  private privateMethod(password: string) {
    console.log(password);
  }

  @Input('showKeyAlias')
  public showKey!: keyof T;

  @Input()
  public set item(item: T[]) {
    this.processedItem = item;
  }

  public processedItem!: T[];
}
