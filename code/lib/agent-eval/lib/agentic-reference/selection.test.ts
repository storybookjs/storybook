import { describe, expect, it } from 'vitest';

import {
  envNameFor,
  matchesAnySelector,
  parsePlannedEvalCount,
  parsePositiveInteger,
  resolveEvalSelection,
  selectionFlags,
  toBoolean,
} from './selection.ts';

const REGISTRY = [
  '701-new-ui-flow',
  '702-rework-ui-flow',
  '703-fix-bug-flow',
  '704-fix-a11y-flow',
  '706-new-ui-scheduled-flow',
];

/**
 * The runner's option set, over an injected environment.
 *
 * `.fail(false)` turns yargs' print-and-exit into a throw, which is what the
 * scripts' own top-level catch relies on too.
 */
function parse(argv: string[], env: NodeJS.ProcessEnv = {}) {
  const flags = selectionFlags(env);
  return flags
    .parser(
      argv,
      { scriptName: 'test', usage: '' },
      {
        experiments: flags.experiments,
        evals: flags.evals,
        runs: flags.count('runs', ''),
        since: flags.text('since', ''),
        force: flags.switch('force', ''),
        dry: flags.switch('dry', ''),
        ackFailures: flags.switch('ackFailures', ''),
        // Mirrors the analyzer's --recompute/--force pairing, to pin down which
        // spelling the env fallback keys off.
        recompute: { ...flags.switch('recompute', ''), alias: ['force2'] },
      }
    )
    .fail(false)
    .exitProcess(false)
    .parseSync();
}

describe('flag parsing', () => {
  it('accepts both value syntaxes', () => {
    expect(parse(['--runs=5']).runs).toBe(5);
    expect(parse(['--runs', '5']).runs).toBe(5);
  });

  it('accumulates a list across commas and repeats alike', () => {
    expect(parse(['--evals', '703,704']).evals).toEqual(['703', '704']);
    expect(parse(['--evals', '703', '--evals', '704']).evals).toEqual(['703', '704']);
  });

  // The research wording and the harness wording are both in daily use here;
  // neither should be the spelling that errors.
  it.each([
    ['--cases', 'experiments'],
    ['--case', 'experiments'],
    ['--experiment', 'experiments'],
  ])('resolves %s to %s', (spelling, canonical) => {
    expect(parse([spelling, 'x'])[canonical]).toEqual(['x']);
  });

  it.each([['--flows'], ['--flow'], ['--eval'], ['--workflows'], ['--workflow']])(
    'resolves %s to evals',
    (spelling) => {
      expect(parse([spelling, 'x']).evals).toEqual(['x']);
    }
  );

  it('reads a switch, its absence, and its negation', () => {
    expect(parse([]).force).toBe(false);
    expect(parse(['--force']).force).toBe(true);
    expect(parse(['--no-force']).force).toBe(false);
  });

  // A real boolean type, so a switch does not swallow the token after it and
  // leave a stale positional looking like a valid value.
  it('rejects a positional that follows a switch', () => {
    expect(() => parse(['--dry', 'agentic-ref-cc-full'])).toThrow(/Unknown argument/);
  });

  // A yargs boolean reads only the literal 'true' as on, so --force=1 would
  // quietly mean *off* — and '=1' is this repo's idiom everywhere else.
  it.each([
    ['--force=1', true],
    ['--force=true', true],
    ['--force=yes', true],
    ['--force=on', true],
    ['--force=0', false],
    ['--force=false', false],
    ['--force=no', false],
    ['--no-force=1', false],
    ['--no-force=0', true],
  ])('reads %s as %s', (token, expected) => {
    expect(parse([token]).force).toBe(expected);
  });

  it('rejects an explicit switch value that means nothing', () => {
    expect(() => parse(['--force=maybe'])).toThrow(/Expected one of/);
  });

  // The dashed spelling has to normalize too, or --ack-failures=1 slips past.
  it('normalizes a dashed switch spelling', () => {
    expect(parse(['--ack-failures=1']).ackFailures).toBe(true);
  });

  // Silently analysing or running everything is the wrong answer to a typo.
  it('rejects a value flag with no value', () => {
    expect(() => parse(['--runs'])).toThrow(/not enough arguments|requires an argument/i);
    expect(() => parse(['--evals'])).toThrow(/not enough arguments|requires an argument/i);
  });

  // Selection used to ride on positionals; a leftover one must not quietly
  // widen a paid run instead of selecting anything.
  it('rejects a bare positional', () => {
    expect(() => parse(['agentic-ref-cc-docs'])).toThrow(/Unknown argument/);
  });

  // A direct `node scripts/run-agentic-ref.ts -- --dry` (or a package runner
  // that forwards the separator) hands `--` to the script, and yargs would
  // otherwise sweep everything after it into positionals.
  it('ignores a forwarded -- separator', () => {
    expect(parse(['--', '--force']).force).toBe(true);
  });

  it('rejects an unknown flag', () => {
    expect(() => parse(['--flowz', 'x'])).toThrow(/Unknown argument/);
  });
});

describe('env fallbacks', () => {
  it('uses the env var only when the flag is absent', () => {
    const env = { AGENTIC_REF_EVALS: '701-new-ui-flow' };
    expect(parse([], env).evals).toEqual(['701-new-ui-flow']);
    expect(parse(['--evals', '703'], env).evals).toEqual(['703']);
  });

  it('splits a comma-separated env var, as CI passes it', () => {
    expect(parse([], { AGENTIC_REF_EVALS: '703,704' }).evals).toEqual(['703', '704']);
  });

  it('maps a dashed flag to its underscored env var', () => {
    expect(parse([], { AGENTIC_REF_ACK_FAILURES: 'true' }).ackFailures).toBe(true);
  });

  // yargs reads only the literal 'true' from the environment and would make
  // AGENTIC_REF_FORCE=1 a silent no-op — but '=1' is how every other env flag
  // in this repo is spelled.
  it.each(['1', 'true', 'yes', 'on'])('reads %s as on', (raw) => {
    expect(parse([], { AGENTIC_REF_FORCE: raw }).force).toBe(true);
  });

  it.each(['0', 'false', 'no', 'off', ''])('reads %s as off', (raw) => {
    expect(parse([], { AGENTIC_REF_FORCE: raw }).force).toBe(false);
  });

  it('throws on a boolean typo rather than reading it as off', () => {
    expect(() => parse([], { AGENTIC_REF_FORCE: 'ture' })).toThrow(/Expected one of/);
  });

  it('lets the flag override the env var', () => {
    expect(parse(['--no-force'], { AGENTIC_REF_FORCE: '1' }).force).toBe(false);
  });

  // A string flag with no fallback would be the one flag silently ignoring its
  // variable, which is the whole class of bug this grammar exists to remove.
  it('falls back for a plain string flag too', () => {
    expect(parse([], { AGENTIC_REF_SINCE: '2026-01-01' }).since).toBe('2026-01-01');
    expect(parse(['--since', '2026-02-02'], { AGENTIC_REF_SINCE: '2026-01-01' }).since).toBe(
      '2026-02-02'
    );
  });

  // Otherwise an AGENTIC_REF_FORCE exported to re-run a case would also rebuild
  // every committed baseline on the next analysis pass.
  it('keys off the canonical flag name, never an alias', () => {
    expect(parse([], { AGENTIC_REF_RECOMPUTE: '1' }).recompute).toBe(true);
    expect(parse([], { AGENTIC_REF_FORCE2: '1' }).recompute).toBe(false);
    expect(parse(['--force2']).recompute).toBe(true);
  });

  it('treats an empty count as unset, since that is how CI passes an omitted input', () => {
    expect(parse([], { AGENTIC_REF_RUNS: '' }).runs).toBeUndefined();
  });

  it.each(['0', '5x', '5.9', '-1'])('rejects "%s" as a repetition count', (raw) => {
    expect(() => parse([], { AGENTIC_REF_RUNS: raw })).toThrow(/positive integer/);
  });

  it('names the flag in a bad-count message', () => {
    expect(() => parse(['--runs=0'])).toThrow(/--runs must be a positive integer/);
  });
});

describe('envNameFor', () => {
  it('derives the env var from the flag, so there is no table to drift', () => {
    expect(envNameFor('evals')).toBe('AGENTIC_REF_EVALS');
    expect(envNameFor('ackFailures')).toBe('AGENTIC_REF_ACK_FAILURES');
  });
});

describe('toBoolean', () => {
  it('passes through what yargs already decided for a switch', () => {
    expect(toBoolean(true)).toBe(true);
    expect(toBoolean(false)).toBe(false);
    expect(toBoolean(undefined)).toBe(false);
  });
});

describe('parsePositiveInteger', () => {
  it('reads a count, and treats blank as unset', () => {
    expect(parsePositiveInteger('--runs', '10')).toBe(10);
    expect(parsePositiveInteger('--runs', '')).toBeUndefined();
    expect(parsePositiveInteger('--runs', undefined)).toBeUndefined();
  });
});

describe('resolveEvalSelection', () => {
  it('expands a bare number to every eval carrying it', () => {
    expect(resolveEvalSelection(['703'], REGISTRY)).toEqual(['703-fix-bug-flow']);
  });

  it('expands a glob', () => {
    expect(resolveEvalSelection(['70*-new-ui*'], REGISTRY)).toEqual([
      '701-new-ui-flow',
      '706-new-ui-scheduled-flow',
    ]);
  });

  it('takes an exact name', () => {
    expect(resolveEvalSelection(['704-fix-a11y-flow'], REGISTRY)).toEqual(['704-fix-a11y-flow']);
  });

  // However the tokens were typed, the plan should read the same.
  it('dedupes overlapping tokens and returns registry order', () => {
    expect(resolveEvalSelection(['704', '701', '70*-fix*'], REGISTRY)).toEqual([
      '701-new-ui-flow',
      '703-fix-bug-flow',
      '704-fix-a11y-flow',
    ]);
  });

  // A fixture can sit in evals/ while parked out of the registry — 705 is,
  // today. Resolving it to nothing would report a successful run of zero evals.
  it('throws on a token that matches nothing, naming what is active', () => {
    expect(() => resolveEvalSelection(['705'], REGISTRY)).toThrow(/matches no active eval/);
    expect(() => resolveEvalSelection(['705'], REGISTRY)).toThrow(/701-new-ui-flow/);
  });
});

describe('matchesAnySelector', () => {
  it('selects everything when nothing was asked for', () => {
    expect(matchesAnySelector('agentic-ref-cc-full-opus-high', [])).toBe(true);
  });

  it('matches by exact name, glob and bare number', () => {
    expect(matchesAnySelector('agentic-ref-cc-full-opus-high', ['agentic-ref-cc-*'])).toBe(true);
    expect(matchesAnySelector('703-fix-bug-flow', ['703'])).toBe(true);
    expect(matchesAnySelector('703-fix-bug-flow', ['704'])).toBe(false);
  });
});

describe('parsePlannedEvalCount', () => {
  it('reads the count from a plan with work left', () => {
    expect(parsePlannedEvalCount('  12 evals to run, 3 cached\n')).toBe(12);
    expect(parsePlannedEvalCount('  1 eval to run, 0 cached\n')).toBe(1);
  });

  // The runner switches message entirely at zero, so matching only the
  // "N evals to run" shape made `--expect 0` impossible to satisfy.
  it('reads a fully cached plan as zero', () => {
    expect(
      parsePlannedEvalCount('  All 40 evals cached across 4 experiments. Nothing to run.\n')
    ).toBe(0);
  });

  it('returns null when the plan is unrecognizable, so the guard can fail loudly', () => {
    expect(parsePlannedEvalCount('Discovered 4 experiment(s):\n')).toBeNull();
  });
});
