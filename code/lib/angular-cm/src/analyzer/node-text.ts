import type * as tsModule from 'typescript';
import type { DocgenTypeScript } from '@storybook/component-meta-typescript';

export const memberName = (ts: DocgenTypeScript, name: tsModule.PropertyName): string =>
  ts.isComputedPropertyName(name) ? name.getText() : name.text;
