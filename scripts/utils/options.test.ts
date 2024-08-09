import { describe, expect, it } from 'vitest';

import { createCommand } from 'commander';

import { areOptionsSatisfied, createOptions, getCommand, getOptions } from './options';

const allOptions = createOptions({
  first: {
    type: 'boolean',
    description: 'first',
  },
  second: {
    type: 'boolean',
    description: 'second',
    inverse: true,
  },
  third: {
    type: 'string',
    description: 'third',
    values: ['one', 'two', 'three'] as const,
    required: true as const,
  },
  fourth: {
    type: 'string',
    description: 'fourth',
  },
  fifth: {
    type: 'string[]',
    description: 'fifth',
    values: ['a', 'b', 'c'] as const,
  },
  sixth: {
    type: 'string[]',
    description: 'sixth',
  },
});

describe('getOptions', () => {
  it('deals with boolean options', () => {
    expect(getOptions(createCommand(), allOptions, ['command', 'name', '--first'])).toMatchObject({
      first: true,
      second: true,
    });
  });

  it('deals with inverse boolean options', () => {
    expect(
      getOptions(createCommand(), allOptions, ['command', 'name', '--no-second'])
    ).toMatchObject({
      first: false,
      second: false,
    });
  });

  it('deals with short options', () => {
    expect(getOptions(createCommand(), allOptions, ['command', 'name', '-f', '-S'])).toMatchObject({
      first: true,
      second: false,
    });
  });

  it('deals with string options', () => {
    expect(
      getOptions(createCommand(), allOptions, ['command', 'name', '--third', 'one'])
    ).toMatchObject({
      third: 'one',
    });
  });

  it('disallows invalid string options', () => {
    expect(() =>
      getOptions(createCommand(), allOptions, ['command', 'name', '--third', 'random'])
    ).toThrow(/Unexpected value/);
  });

  it('allows arbitrary string options when values are not specified', () => {
    expect(
      getOptions(createCommand(), allOptions, ['command', 'name', '--fourth', 'random'])
    ).toMatchObject({
      fourth: 'random',
    });
  });

  it('deals with multiple string options', () => {
    expect(
      getOptions(createCommand(), allOptions, ['command', 'name', '--fifth', 'a'])
    ).toMatchObject({
      fifth: ['a'],
    });

    expect(
      getOptions(createCommand(), allOptions, ['command', 'name', '--fifth', 'a', '--fifth', 'b'])
    ).toMatchObject({
      fifth: ['a', 'b'],
    });
  });

  it('disallows invalid multiple string options', () => {
    expect(() =>
      getOptions(createCommand(), allOptions, ['command', 'name', '--fifth', 'random'])
    ).toThrow(/Unexpected value/);
  });

  it('allows arbitrary multiple string options when values are not specified', () => {
    expect(
      getOptions(createCommand(), allOptions, ['command', 'name', '--sixth', 'random'])
    ).toMatchObject({
      sixth: ['random'],
    });
  });
});

describe('areOptionsSatisfied', () => {
  it('checks each required string option has a value', () => {
    expect(
      areOptionsSatisfied(allOptions, {
        first: true,
        second: true,
        third: undefined,
        fourth: undefined,
        fifth: ['a', 'c'],
        sixth: [],
      })
    ).toBe(false);
    expect(
      areOptionsSatisfied(allOptions, {
        first: true,
        second: true,
        third: 'one',
        fourth: undefined,
        fifth: [],
        sixth: [],
      })
    ).toBe(true);
  });
});

describe('getCommand', () => {
  const { first, second, third, fifth } = allOptions;
  it('works with boolean options', () => {
    expect(getCommand('node foo', { first, second }, { first: true, second: true })).toBe(
      'node foo --first'
    );
  });

  it('works with inverse boolean options', () => {
    expect(getCommand('node foo', { first, second }, { first: false, second: false })).toBe(
      'node foo --no-second'
    );
  });

  it('works with string options', () => {
    expect(getCommand('node foo', { third }, { third: 'one' })).toBe('node foo --third one');
  });

  it('works with multiple string options', () => {
    expect(getCommand('node foo', { fifth }, { fifth: ['a', 'b'] })).toBe(
      'node foo --fifth a --fifth b'
    );
  });

  // This is for convenience
  it('works with partial options', () => {
    expect(getCommand('node foo', allOptions, { third: 'one' })).toBe(
      'node foo --no-second --third one'
    );
  });

  it('works with combinations string options', () => {
    expect(
      getCommand('node foo', allOptions, {
        first: true,
        second: false,
        third: 'one',
        fifth: ['a', 'b'],
      })
    ).toBe('node foo --first --no-second --third one --fifth a --fifth b');
  });
});
