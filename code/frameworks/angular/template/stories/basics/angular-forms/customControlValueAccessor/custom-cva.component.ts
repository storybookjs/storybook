import { Component, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const NOOP = () => {};

@Component({
  standalone: false,
  selector: 'storybook-custom-cva-component',
  template: ` <div>{{ value }}</div>
<input type="text" [(ngModel)]="value" /> `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomCvaComponent),
      multi: true,
    },
  ],
})
export class CustomCvaComponent implements ControlValueAccessor {
  disabled?: boolean;

  protected onChange: (value: any) => void = NOOP;

  protected onTouch: () => void = NOOP;

  protected internalValue: any;

  get value(): any {
    return this.internalValue;
  }

  set value(value: any) {
    if (value !== this.internalValue) {
      this.internalValue = value;
      this.onChange(value);
    }
  }

  writeValue(value: any): void {
    if (value !== this.internalValue) {
      this.internalValue = value;
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouch = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
