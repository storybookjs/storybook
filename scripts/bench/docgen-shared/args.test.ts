import { describe, expect, it } from 'vitest';

import { Args } from './args.ts';

describe('Args', () => {
  it('reads a string value', () => {
    expect(new Args(['--parser', 'react-docgen']).string('parser', 'x')).toBe('react-docgen');
  });

  it('falls back when the flag is absent', () => {
    expect(new Args([]).string('parser', 'fallback')).toBe('fallback');
  });

  it('detects boolean flags', () => {
    expect(new Args(['--quick']).flag('quick')).toBe(true);
    expect(new Args([]).flag('quick')).toBe(false);
  });

  it('throws when a flag is followed by another flag instead of a value', () => {
    expect(() => new Args(['--saves', '--json', 'out.json']).count('saves', 1)).toThrow(
      '--saves requires a value'
    );
  });

  it('throws when a flag is the last argument', () => {
    expect(() => new Args(['--out']).string('out', 'x')).toThrow('--out requires a value');
  });

  it('collects every value of a repeated flag', () => {
    const args = new Args(['--engine', 'a', '--quick', '--engine', 'b']);
    expect(args.all('engine')).toEqual(['a', 'b']);
  });

  it('returns an empty list when a repeated flag is absent', () => {
    expect(new Args(['--quick']).all('engine')).toEqual([]);
  });

  describe('count', () => {
    it('parses an integer', () => {
      expect(new Args(['--saves', '20']).count('saves', 1)).toBe(20);
    });

    it('rejects a non-numeric value', () => {
      expect(() => new Args(['--saves', 'lots']).count('saves', 1)).toThrow(
        '--saves must be a non-negative integer, got "lots"'
      );
    });

    it('rejects a fraction', () => {
      expect(() => new Args(['--saves', '2.5']).count('saves', 1)).toThrow(
        'must be a non-negative integer'
      );
    });

    it('rejects a negative', () => {
      expect(() => new Args(['--saves', '-3']).count('saves', 1)).toThrow(
        'must be a non-negative integer'
      );
    });
  });

  describe('choice', () => {
    it('accepts an allowed value', () => {
      expect(new Args(['--scope', 'all']).choice('scope', ['all', 'changed'], 'changed')).toBe(
        'all'
      );
    });

    it('names the whole set when the value is not allowed', () => {
      expect(() =>
        new Args(['--scope', 'some']).choice('scope', ['all', 'changed'], 'changed')
      ).toThrow('--scope must be one of all, changed, got "some"');
    });
  });
});
