import { describe, expect, it } from 'vitest';

import { normalizeInputType, normalizeInputTypes } from './normalizeInputTypes';

describe('normalizeInputType', () => {
  it('normalizes strict types and sets disable: false when type is present', () => {
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
      control: { type: 'text', disable: false },
      description: 'description',
      defaultValue: 'defaultValue',
    });
  });

  it('preserves strict types with explicit disable', () => {
    expect(
      normalizeInputType(
        {
          name: 'name',
          type: { name: 'string' },
          control: { type: 'text', disable: true },
        },
        'arg'
      )
    ).toEqual({
      name: 'name',
      type: { name: 'string' },
      control: { type: 'text', disable: true },
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
      control: { type: 'text', disable: false },
      description: 'description',
      defaultValue: 'defaultValue',
    });
  });

  it('sets disable: false when control type is specified to override inherited disable', () => {
    expect(
      normalizeInputType(
        {
          control: { type: 'select' },
        },
        'arg'
      )
    ).toEqual({
      name: 'arg',
      control: { type: 'select', disable: false },
    });
  });

  it('preserves explicit disable: true in control object', () => {
    expect(
      normalizeInputType(
        {
          control: { type: 'select', disable: true },
        },
        'arg'
      )
    ).toEqual({
      name: 'arg',
      control: { type: 'select', disable: true },
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
