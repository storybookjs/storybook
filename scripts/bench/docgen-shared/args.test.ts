import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { countOption, parseHarnessOptions } from './args.ts';

const OPTIONS = {
  components: { type: 'string' },
  scope: { type: 'string' },
  heavy: { type: 'boolean' },
  out: { type: 'string' },
  'components-per-package': { type: 'string' },
  'max-retained-growth': { type: 'string' },
} as const;

const SCHEMA = z.object({
  components: countOption(300),
  scope: z.enum(['all', 'changed']).default('changed'),
  heavy: z.boolean().default(false),
  outDir: z.string().default('/default'),
  componentsPerPackage: countOption(10),
  maxRetainedGrowthMb: countOption(400),
});

interface Options {
  components: number;
  scope: 'all' | 'changed';
  heavy: boolean;
  outDir: string;
  componentsPerPackage: number;
  maxRetainedGrowthMb: number;
}

const parse = (argv: string[]) =>
  parseHarnessOptions<Options>(argv, OPTIONS, SCHEMA, (values) => ({
    ...values,
    outDir: values.out,
    maxRetainedGrowthMb: values.maxRetainedGrowth,
  }));

describe('parseHarnessOptions', () => {
  it('applies defaults when nothing is passed', () => {
    expect(parse([])).toEqual({
      components: 300,
      scope: 'changed',
      heavy: false,
      outDir: '/default',
      componentsPerPackage: 10,
      maxRetainedGrowthMb: 400,
    });
  });

  it('coerces numeric flags', () => {
    expect(parse(['--components', '20']).components).toBe(20);
  });

  it('maps kebab-case flags onto the schema shape', () => {
    expect(parse(['--components-per-package', '5']).componentsPerPackage).toBe(5);
  });

  it('carries a flag whose schema key is not its camelCase', () => {
    // `--max-retained-growth` camel-cases to `maxRetainedGrowth`, but the schema names the unit.
    // Without the rename in `toInput` the flag is accepted and then silently ignored, which is how
    // the memory harness lost its threshold flag once already.
    expect(parse(['--max-retained-growth', '50']).maxRetainedGrowthMb).toBe(50);
  });

  it('reads boolean flags', () => {
    expect(parse(['--heavy']).heavy).toBe(true);
  });

  it('rejects an unknown flag', () => {
    // The reason for strict mode: `--component 5` would otherwise be dropped silently and the
    // harness would benchmark 300 components while reporting a run someone asked for at 5.
    expect(() => parse(['--component', '5'])).toThrow(/Unknown option/);
  });

  it('rejects a flag whose value is another flag', () => {
    expect(() => parse(['--components', '--out', 'x'])).toThrow(/ambiguous/);
  });

  it('rejects a flag with no value at all', () => {
    expect(() => parse(['--components'])).toThrow(/argument missing/);
  });

  it('rejects a value outside an enum, naming the flag', () => {
    expect(() => parse(['--scope', 'some'])).toThrow(/--scope/);
  });

  describe('countOption', () => {
    it('rejects a non-numeric value', () => {
      expect(() => parse(['--components', 'lots'])).toThrow(/--components/);
    });

    it('rejects a fraction', () => {
      expect(() => parse(['--components', '2.5'])).toThrow(/--components/);
    });

    it('rejects a negative', () => {
      expect(() => parse(['--components', '-3'])).toThrow(/--components/);
    });
  });
});
