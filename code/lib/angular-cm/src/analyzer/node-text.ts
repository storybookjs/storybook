import type * as tsModule from 'typescript';

export const memberName = (ts: typeof tsModule, name: tsModule.PropertyName): string =>
  ts.isComputedPropertyName(name) ? name.getText() : name.text;

export const initializerText = (ts: typeof tsModule, initializer: tsModule.Expression): string =>
  ts.isArrowFunction(initializer) ? '() => {...}' : initializer.getText();
