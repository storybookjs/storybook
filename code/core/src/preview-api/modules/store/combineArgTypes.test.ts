import { describe, expect, it } from 'vitest';

import type { ArgTypes } from '@storybook/csf';

import { combineArgTypes } from './combineArgTypes';

describe('combineArgTypes', () => {
  it('should combine argTypes', () => {
    const projectArgTypes: Partial<ArgTypes> = {
      a: { name: 'a', control: { type: 'text' } },
      b: { name: 'b', control: { type: 'boolean' } },
      d: { name: 'd', control: { disable: true } },
    };
    const componentArgTypes: Partial<ArgTypes> = {
      a: { name: 'a', control: { type: 'text' } },
      c: { name: 'c', control: { type: 'text' } },
      e: { name: 'e', control: { disable: true } },
    };
    const storyArgTypes: Partial<ArgTypes> = {
      f: { name: 'f', control: { type: 'text' } },
    };
    const combinedArgTypes = combineArgTypes(projectArgTypes, componentArgTypes, storyArgTypes);
    expect(combinedArgTypes).toEqual({
      a: { name: 'a', control: { type: 'text' } },
      b: { name: 'b', control: { type: 'boolean' } },
      c: { name: 'c', control: { type: 'text' } },
      d: { name: 'd', control: { disable: true } },
      e: { name: 'e', control: { disable: true } },
      f: { name: 'f', control: { type: 'text' } },
    });
  });

  it('should enable control if story is enable', () => {
    const projectArgTypes: Partial<ArgTypes> = {
      a: { name: 'a', control: { type: 'text' } },
    };
    const componentArgTypes: Partial<ArgTypes> = {
      a: { name: 'a', control: { type: 'text', disable: true } },
    };
    const storyArgTypes: Partial<ArgTypes> = {
      a: { name: 'a', control: { type: 'text' } },
    };
    const combinedArgTypes = combineArgTypes(projectArgTypes, componentArgTypes, storyArgTypes);
    expect(combinedArgTypes).toEqual({
      a: { name: 'a', control: { type: 'text' } },
    });
  });

  it('should disable control if story is disable', () => {
    const projectArgTypes: Partial<ArgTypes> = {
      a: { name: 'a', control: { type: 'text' } },
    };
    const componentArgTypes: Partial<ArgTypes> = {
      a: { name: 'a', control: { type: 'text' } },
    };
    const storyArgTypes: Partial<ArgTypes> = {
      a: { name: 'a', control: { type: 'text', disable: true } },
    };
    const combinedArgTypes = combineArgTypes(projectArgTypes, componentArgTypes, storyArgTypes);
    expect(combinedArgTypes).toEqual({
      a: { name: 'a', control: { type: 'text', disable: true } },
    });
  });

  it('should enable control if component is disable and story is enable', () => {
    const projectArgTypes: Partial<ArgTypes> = {
      a: { name: 'a', control: { type: 'text' } },
    };
    const componentArgTypes: Partial<ArgTypes> = {
      a: { name: 'a', control: { type: 'text', disable: true } },
    };
    const storyArgTypes: Partial<ArgTypes> = {
      a: { name: 'a', control: { type: 'text', disable: false } },
    };
    const combinedArgTypes = combineArgTypes(projectArgTypes, componentArgTypes, storyArgTypes);
    expect(combinedArgTypes).toEqual({
      a: { name: 'a', control: { type: 'text', disable: false } },
    });
  });
});
