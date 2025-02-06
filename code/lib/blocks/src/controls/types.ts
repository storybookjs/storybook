import type { InputType } from '@storybook/csf';

export interface ControlProps<T> {
  name: string;
  value?: T;
  defaultValue?: T;
  argType?: InputType;
  onChange: (value?: T) => T | void;
  onFocus?: (evt: any) => void;
  onBlur?: (evt: any) => void;
}

export type BooleanValue = boolean;
export interface BooleanConfig {}

export type ColorValue = string;
export type PresetColor = ColorValue | { color: ColorValue; title?: string };
export interface ColorConfig {
  presetColors?: PresetColor[];
  /**
   * Whether the color picker should be open by default when rendered.
   *
   * @default false
   */
  startOpen?: boolean;
}

export type DateValue = Date | number;
export interface DateConfig {}

export type NumberValue = number;
export interface NumberConfig {
  min?: number;
  max?: number;
  step?: number;
}

export type RangeConfig = NumberConfig;

export type ObjectValue = any;
export interface ObjectConfig {}

export type OptionsSingleSelection = any;
export type OptionsMultiSelection = any[];
export type OptionsSelection = OptionsSingleSelection | OptionsMultiSelection;
export type OptionsArray = any[];
export type OptionsObject = Record<string, any>;
export type Options = OptionsArray | OptionsObject;
export type OptionsControlType =
  | 'radio'
  | 'inline-radio'
  | 'check'
  | 'inline-check'
  | 'select'
  | 'multi-select';

export interface OptionsConfig {
  labels?: Record<any, string>;
  type: OptionsControlType;
}

export interface NormalizedOptionsConfig {
  options: OptionsObject;
}

export type TextValue = string;
export interface TextConfig {
  maxLength?: number;
}

export type ControlType =
  | 'array'
  | 'boolean'
  | 'color'
  | 'date'
  | 'number'
  | 'range'
  | 'object'
  | OptionsControlType
  | 'text';

export type Control =
  | BooleanConfig
  | ColorConfig
  | DateConfig
  | NumberConfig
  | ObjectConfig
  | OptionsConfig
  | RangeConfig
  | TextConfig;

export const isControlObject = (control: Control): control is Control & object =>
  typeof control === 'object' && control !== null && control !== undefined;
