import type { ActionOptions } from './ActionOptions';
import type { ActionsMap } from './ActionsMap';

export interface ActionsFunction {
  <T extends string>(handlerMap: Record<T, string>, options?: ActionOptions): ActionsMap<T>;
  <T extends string>(...handlers: T[]): ActionsMap<T>;

  <T extends string>(handler1: T, options?: ActionOptions): ActionsMap<T>;
  <T extends string>(handler1: T, handler2: T, options?: ActionOptions): ActionsMap<T>;
  <T extends string>(handler1: T, handler2: T, handler3: T, options?: ActionOptions): ActionsMap<T>;
  <T extends string>(
    handler1: T,
    handler2: T,
    handler3: T,
    handler4: T,
    options?: ActionOptions
  ): ActionsMap<T>;
  <T extends string>(
    handler1: T,
    handler2: T,
    handler3: T,
    handler4: T,
    handler5: T,
    options?: ActionOptions
  ): ActionsMap<T>;
  <T extends string>(
    handler1: T,
    handler2: T,
    handler3: T,
    handler4: T,
    handler5: T,
    handler6: T,
    options?: ActionOptions
  ): ActionsMap<T>;
  <T extends string>(
    handler1: T,
    handler2: T,
    handler3: T,
    handler4: T,
    handler5: T,
    handler6: T,
    handler7: T,
    options?: ActionOptions
  ): ActionsMap<T>;
  <T extends string>(
    handler1: T,
    handler2: T,
    handler3: T,
    handler4: T,
    handler5: T,
    handler6: T,
    handler7: T,
    handler8: T,
    options?: ActionOptions
  ): ActionsMap<T>;
  <T extends string>(
    handler1: T,
    handler2: T,
    handler3: T,
    handler4: T,
    handler5: T,
    handler6: T,
    handler7: T,
    handler8: T,
    handler9: T,
    options?: ActionOptions
  ): ActionsMap<T>;
  <T extends string>(
    handler1: T,
    handler2: T,
    handler3: T,
    handler4: T,
    handler5: T,
    handler6: T,
    handler7: T,
    handler8: T,
    handler9: T,
    handler10: T,
    options?: ActionOptions
  ): ActionsMap<T>;
}
