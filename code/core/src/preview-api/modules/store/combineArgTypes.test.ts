import { describe, expect, it } from 'vitest';

import type { ArgTypes } from '@storybook/csf';

import { combineArgTypes } from './combineArgTypes';

describe('combineArgTypes', () => {
  it('should combine argTypes', () => {
    const argTypes1: Partial<ArgTypes> = {
      a: { name: 'a', control: { type: 'text' } },
      b: { name: 'b', control: { type: 'boolean' } },
      d: { name: 'd', control: { disable: true } },
    };
    const argTypes2: Partial<ArgTypes> = {
      a: { name: 'a', control: { type: 'text' } },
      c: { name: 'c', control: { type: 'text' } },
    };
    const combinedArgTypes = combineArgTypes(argTypes1, argTypes2);
    expect(combinedArgTypes).toEqual({
      a: { name: 'a', control: { type: 'text' } },
      b: { name: 'b', control: { type: 'boolean' } },
      c: { name: 'c', control: { type: 'text' } },
      d: { name: 'd', control: { disable: true } },
    });
  });

  it('should remove disable property if control type is defined', () => {
    const argTypes1: Partial<ArgTypes> = {
      a: { name: 'a', control: { type: 'text', disable: true } },
    };
    const argTypes2: Partial<ArgTypes> = {
      a: { name: 'a', control: { type: 'text' } },
    };
    const combinedArgTypes = combineArgTypes(argTypes1, argTypes2);
    expect(combinedArgTypes).toEqual({
      a: { name: 'a', control: { type: 'text' } },
    });
  });
});
