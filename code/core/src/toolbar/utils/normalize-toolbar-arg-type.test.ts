import { describe, expect, it } from 'vitest';

import type { GlobalTypes } from '../../csf/story.ts';

import { normalizeArgType } from './normalize-toolbar-arg-type.ts';

describe('normalizeArgType', () => {
  it('returns null when the argType has no toolbar config', () => {
    expect(normalizeArgType('locale', { description: 'Internationalization locale' })).toBeNull();
  });

  it('converts string items to { value, title }', () => {
    const result = normalizeArgType('locale', {
      toolbar: { items: ['English'] },
    });

    expect(result?.toolbar.items).toEqual([{ value: 'English', title: 'English' }]);
  });

  it('gives a reset item the toolbar icon, hides it, and clears its value', () => {
    const result = normalizeArgType('locale', {
      toolbar: { icon: 'user', items: [{ type: 'reset', title: 'Reset locale' }] },
    });
    const [resetItem] = result?.toolbar.items ?? [];

    expect(resetItem?.icon).toBe('user');
    expect(resetItem?.hideIcon).toBe(true);
    expect(resetItem?.value).toBeUndefined();
  });

  it('passes a reset item through when the toolbar has no icon', () => {
    const result = normalizeArgType('locale', {
      toolbar: { items: [{ type: 'reset', title: 'Reset locale' }] },
    });

    expect(result?.toolbar.items).toEqual([{ type: 'reset', title: 'Reset locale' }]);
  });

  it('forwards user-provided name and description untouched', () => {
    const result = normalizeArgType('locale', {
      name: 'Language',
      description: 'Internationalization locale',
      toolbar: { items: ['English'] },
    });

    expect(result?.name).toBe('Language');
    expect(result?.description).toBe('Internationalization locale');
  });

  it('does not fall back to the id for missing name or description', () => {
    const result = normalizeArgType('locale', {
      toolbar: { items: ['English'] },
    });

    expect(result?.name).toBeUndefined();
    expect(result?.description).toBeUndefined();
  });

  it('does not inject default type or value into items', () => {
    const result = normalizeArgType('locale', {
      toolbar: { items: [{ title: 'Untitled option' }] },
    });

    expect(result?.toolbar.items).toEqual([{ title: 'Untitled option' }]);
  });
});

// A minimal toolbar entry must satisfy the public contract.
const minimalGlobalTypes = {
  locale: {
    description: 'Internationalization locale',
    toolbar: { items: ['en', 'es'] },
  },
} satisfies GlobalTypes;

const globalTypesWithExtraKey = {
  locale: {
    description: 'Internationalization locale',
    toolbar: { items: ['en', 'es'] },
    // @ts-expect-error undocumented extra keys in globalTypes toolbar entries fail typecheck
    myAddonData: 'stored on the entry',
  },
} satisfies GlobalTypes;

describe('globalTypes toolbar entry contract', () => {
  it('accepts a minimal entry and rejects undocumented keys at the type level', () => {
    expect(Object.keys(minimalGlobalTypes)).toEqual(['locale']);
    expect(Object.keys(globalTypesWithExtraKey)).toEqual(['locale']);
  });
});
