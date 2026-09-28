import { describe, expect, it } from 'vitest';

import { ArgTypesRemovedFromStoryContextError } from 'storybook/internal/preview-errors';
import type { StoryContextForRender } from 'storybook/internal/types';

import { hideArgTypes } from './hideArgTypes.ts';

const createContext = () => {
  const context = {
    id: 'component--a',
    args: { label: 'hello' },
    argTypes: { label: { name: 'label' } },
    loaded: {},
  } as unknown as StoryContextForRender;
  context.context = context;
  return context;
};

describe('hideArgTypes', () => {
  it('throws a descriptive error when argTypes is read', () => {
    const hidden = hideArgTypes(createContext());

    expect(() => hidden.argTypes).toThrow(ArgTypesRemovedFromStoryContextError);
  });

  it('omits argTypes from enumeration and membership checks', () => {
    const hidden = hideArgTypes(createContext());

    expect('argTypes' in hidden).toBe(false);
    expect(Object.keys(hidden)).toEqual(['id', 'args', 'loaded', 'context']);
    expect({ ...hidden }).not.toHaveProperty('argTypes');
  });

  it('passes other reads through and writes back to the original context', () => {
    const context = createContext();
    const hidden = hideArgTypes(context);

    expect(hidden.args).toBe(context.args);

    hidden.loaded = { user: 'me' };
    expect(context.loaded).toEqual({ user: 'me' });
  });

  it('returns itself for the self reference so argTypes stays hidden', () => {
    const hidden = hideArgTypes(createContext());

    expect(hidden.context).toBe(hidden);
    expect(() => hidden.context.argTypes).toThrow(ArgTypesRemovedFromStoryContextError);
  });
});
