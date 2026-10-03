import { describe, expect, it } from 'vitest';

import type { StoryContextForEnhancers } from 'storybook/internal/types';

import { argTypesEnhancers } from './inferControls.ts';

const [inferControls] = argTypesEnhancers;

/**
 * Regression coverage for https://github.com/storybookjs/storybook/issues/14739
 *
 * When using `parameters.controls.include` / `.exclude` together with `argType.table.category`,
 * filtered-out args should be removed entirely, not left as empty rows under empty section headers.
 */
describe('inferControls — bug #14739 (include/exclude with categories)', () => {
  const argTypesWithCategories = {
    // Props category
    modelValue: { name: 'modelValue', type: { name: 'string' as const }, table: { category: 'Props' } },
    disabled: { name: 'disabled', type: { name: 'boolean' as const }, table: { category: 'Props' } },
    size: { name: 'size', type: { name: 'string' as const }, table: { category: 'Props' } },
    // Attributes category
    placeholder: { name: 'placeholder', type: { name: 'string' as const }, table: { category: 'Attributes' } },
    autofocus: { name: 'autofocus', type: { name: 'boolean' as const }, table: { category: 'Attributes' } },
    // Events category
    onChange: { name: 'onChange', type: { name: 'function' as const }, table: { category: 'Events' } },
    onFocus: { name: 'onFocus', type: { name: 'function' as const }, table: { category: 'Events' } },
  };

  const ctx = (overrides: any = {}): StoryContextForEnhancers => ({
    id: '',
    title: '',
    kind: '',
    name: '',
    story: '',
    initialArgs: {},
    argTypes: argTypesWithCategories,
    ...overrides,
    parameters: {
      __isArgsStory: true,
      ...overrides.parameters,
    },
  });

  it('include=["disabled"] removes args from other categories entirely (no empty Attributes/Events sections)', () => {
    const result = inferControls(
      ctx({ parameters: { controls: { include: ['disabled'] } } })
    );

    expect(Object.keys(result)).toEqual(['disabled']);
    const remainingCategories = new Set(
      Object.values(result).map((a: any) => a?.table?.category)
    );
    expect(remainingCategories).toEqual(new Set(['Props']));
    expect(remainingCategories.has('Attributes')).toBe(false);
    expect(remainingCategories.has('Events')).toBe(false);
  });

  it('exclude=["onChange","onFocus"] removes Events category entirely', () => {
    const result = inferControls(
      ctx({ parameters: { controls: { exclude: ['onChange', 'onFocus'] } } })
    );

    expect(Object.keys(result).sort()).toEqual(
      ['autofocus', 'disabled', 'modelValue', 'placeholder', 'size']
    );
    const remainingCategories = new Set(
      Object.values(result).map((a: any) => a?.table?.category)
    );
    expect(remainingCategories.has('Events')).toBe(false);
  });

  it('include array and equivalent RegExp produce equivalent results (graup workaround should not be needed)', () => {
    const viaArray = inferControls(
      ctx({ parameters: { controls: { include: ['modelValue', 'disabled', 'size'] } } })
    );
    const viaRegex = inferControls(
      ctx({ parameters: { controls: { include: /^(modelValue|disabled|size)$/ } } })
    );
    expect(Object.keys(viaArray).sort()).toEqual(Object.keys(viaRegex).sort());
  });

  it('include with boolean-only field works (issue noted toggle exception)', () => {
    const result = inferControls(
      ctx({ parameters: { controls: { include: ['autofocus'] } } })
    );
    expect(Object.keys(result)).toEqual(['autofocus']);
  });

  it('applies include/exclude even when __isArgsStory=false (non-args stories with manual argTypes)', () => {
    const result = inferControls(
      ctx({
        parameters: {
          __isArgsStory: false,
          controls: { include: ['disabled'] },
        },
      })
    );

    // Filter is applied even though there's nothing to infer for a non-args story.
    expect(Object.keys(result)).toEqual(['disabled']);
  });
});
