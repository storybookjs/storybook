import { describe, expect, it } from 'vitest';

import { normalizeInputType, normalizeInputTypes } from './normalizeInputTypes';

describe('normalizeInputType', () => {
  it('does nothing to strict types', () => {
    expect(
      normalizeInputType(
        {
          name: 'name',
          type: { name: 'string' },
          control: { type: 'text' },
          description: 'description',
          defaultValue: 'defaultValue',
        },
        'arg'
      )
    ).toEqual({
      name: 'name',
      type: { name: 'string' },
      control: { type: 'text' },
      description: 'description',
      defaultValue: 'defaultValue',
    });
  });

  it('fills in unstrict types', () => {
    expect(
      normalizeInputType(
        {
          type: 'string',
          control: 'text',
          description: 'description',
          defaultValue: 'defaultValue',
        },
        'arg'
      )
    ).toEqual({
      name: 'arg',
      type: { name: 'string' },
      control: { type: 'text' },
      description: 'description',
      defaultValue: 'defaultValue',
    });
  });

  it('preserves disabled control via shortcut', () => {
    expect(
      normalizeInputType(
        {
          type: 'string',
          control: false,
          description: 'description',
          defaultValue: 'defaultValue',
        },
        'arg'
      )
    ).toEqual({
      name: 'arg',
      type: { name: 'string' },
      control: { disable: true },
      description: 'description',
      defaultValue: 'defaultValue',
    });
  });
});

describe('normalizeInputTypes', () => {
  it('maps over keys', () => {
    expect(
      normalizeInputTypes({
        a: { type: 'string' },
        b: { type: 'number' },
      })
    ).toEqual({
      a: { name: 'a', type: { name: 'string' } },
      b: { name: 'b', type: { name: 'number' } },
    });
  });
});
