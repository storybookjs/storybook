import { describe, expect, it } from 'vitest';

import { mergeServiceArgTypes } from './docgenServiceArgTypes.ts';

describe('mergeServiceArgTypes', () => {
  const payload = {
    id: 'button',
    name: 'Button',
    path: './Button.tsx',
    jsDocTags: {},
    stories: [],
    argTypes: {
      size: {
        name: 'size',
        type: { name: 'enum' as const, value: ['small', 'medium', 'large'] },
      },
      label: {
        name: 'label',
        type: { name: 'string' as const },
      },
    },
  };

  it('preserves enum control when story args include an enum value', () => {
    const result = mergeServiceArgTypes({
      payload,
      storyId: 'example-button--large',
      parameters: { __isArgsStory: true },
      initialArgs: { size: 'large', label: 'Button' },
      customArgTypes: {
        backgroundColor: { control: 'color' },
        // prepareStory already ran inferArgTypes with size in initialArgs
        size: { name: 'size', type: { name: 'string' }, control: { type: 'text' } },
      },
    });

    expect(result.size?.type).toEqual({ name: 'enum', value: ['small', 'medium', 'large'] });
    expect(result.size?.control).toEqual({ type: 'radio' });
  });

  it('keeps user-authored argType overrides that are not type inference', () => {
    const result = mergeServiceArgTypes({
      payload,
      storyId: 'example-button--large',
      parameters: { __isArgsStory: true },
      initialArgs: { size: 'large', label: 'Button' },
      customArgTypes: {
        size: {
          name: 'size',
          type: { name: 'string' },
          control: { type: 'text' },
          description: 'How large should the button be?',
        },
      },
    });

    expect(result.size?.type).toEqual({ name: 'enum', value: ['small', 'medium', 'large'] });
    expect(result.size?.control).toEqual({ type: 'radio' });
    expect(result.size?.description).toBe('How large should the button be?');
  });

  it('preserves enum control when story args omit the enum prop', () => {
    const result = mergeServiceArgTypes({
      payload,
      storyId: 'example-button--primary',
      parameters: { __isArgsStory: true },
      initialArgs: { label: 'Button', primary: true },
      customArgTypes: {
        backgroundColor: { control: 'color' },
      },
    });

    expect(result.size?.type).toEqual({ name: 'enum', value: ['small', 'medium', 'large'] });
    expect(result.size?.control).toEqual({ type: 'radio' });
  });
});
