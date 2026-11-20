import { describe, expect, it, vi } from 'vitest';

import { ArgTypesRemovedFromStoryContextError } from 'storybook/internal/preview-errors';
import type { StoryContext } from 'storybook/internal/types';

import { getStoryArgTypes, hideArgTypes } from './hideArgTypes.ts';

const createContext = () => {
  const context = {
    id: 'component--a',
    args: { label: 'hello' },
    argTypes: { label: { name: 'label' } },
    loaded: {},
  } as unknown as StoryContext;
  context.context = context;
  return context;
};

describe('hideArgTypes', () => {
  it('throws a descriptive error when argTypes is read', () => {
    const hidden = hideArgTypes(createContext());

    expect(() => hidden.argTypes).toThrow(ArgTypesRemovedFromStoryContextError);
    expect(() => hidden.argTypes).toThrow(/Story: component--a/);
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

  it('returns the same hidden context for the same context', () => {
    const context = createContext();
    const hidden = hideArgTypes(context);

    expect(hideArgTypes(context)).toBe(hidden);
    expect(hideArgTypes(hidden)).toBe(hidden);
  });

  it('hides argTypes on a frozen context', () => {
    const hidden = hideArgTypes(Object.freeze(createContext()));

    expect(() => hidden.argTypes).toThrow(ArgTypesRemovedFromStoryContextError);
    expect('argTypes' in hidden).toBe(false);
    expect(Object.keys(hidden)).toEqual(['id', 'args', 'loaded', 'context']);
    expect(hidden.args).toEqual({ label: 'hello' });
  });
});

describe('getStoryArgTypes', () => {
  const argTypes = { label: { name: 'label' } };

  it('reads the argTypes of a context that was never hidden', () => {
    expect(getStoryArgTypes(createContext())).toEqual(argTypes);
  });

  it('reads the argTypes of a hidden context', () => {
    expect(getStoryArgTypes(hideArgTypes(createContext()))).toEqual(argTypes);
  });

  it('reads the argTypes of a hidden frozen context', () => {
    expect(getStoryArgTypes(hideArgTypes(Object.freeze(createContext())))).toEqual(argTypes);
  });

  it('reads the argTypes of a copy of a hidden context', () => {
    const copy = { ...hideArgTypes(createContext()), args: { label: 'updated' } };

    expect(copy).not.toHaveProperty('argTypes');
    expect(getStoryArgTypes(copy)).toEqual(argTypes);
  });

  it('reads the argTypes of a copy that was hidden again', () => {
    const hidden = hideArgTypes({ ...hideArgTypes(createContext()) });

    expect(() => hidden.argTypes).toThrow(ArgTypesRemovedFromStoryContextError);
    expect(getStoryArgTypes(hidden)).toEqual(argTypes);
    expect(getStoryArgTypes({ ...hidden })).toEqual(argTypes);
  });

  it('reads the argTypes of a context hidden by another copy of the module', async () => {
    vi.resetModules();
    const otherCopy = await import('./hideArgTypes.ts');
    const hiddenTwice = hideArgTypes(otherCopy.hideArgTypes(createContext()));

    expect(() => hiddenTwice.argTypes).toThrow(ArgTypesRemovedFromStoryContextError);
    expect(getStoryArgTypes(hiddenTwice)).toEqual(argTypes);
    expect(otherCopy.getStoryArgTypes(hiddenTwice)).toEqual(argTypes);
  });
});
