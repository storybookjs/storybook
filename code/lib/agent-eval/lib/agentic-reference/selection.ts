// One argument grammar for the agentic-reference line, shared by the runner
// (scripts/run-agentic-ref.ts) and the offline analyzer (scripts/analyze-results.ts).
//
// yargs does the parsing. What lives here is the vocabulary — which spellings
// mean the same flag — plus the three coercions where yargs' defaults are wrong
// for this repo, and the eval-selection semantics, which are not a parsing
// concern at all.
//
// Canonical vocabulary is experiment / eval / run, matching @vercel/agent-eval.
// The research wording — case for experiment, flow for eval — is accepted as an
// alias everywhere, because both are in daily use in this repo and neither
// spelling should be a mistake.
import picomatch from 'picomatch';
import yargs, { type Options } from 'yargs';

const ENV_PREFIX = 'AGENTIC_REF';

/** What a flag can arrive as, from the command line, the environment, or a default. */
export type FlagValue = string | number | boolean | undefined;

// --- coercions -------------------------------------------------------------

// Booleans reach us spelled three ways: GitHub passes 'true', this repo's other
// env flags are all '=1', and humans type 'yes'. yargs only reads the literal
// 'true' from the environment and silently makes '1' false, which would turn
// AGENTIC_REF_FORCE=1 into a quiet no-op, so booleans are declared untyped and
// normalized here instead.
const TRUTHY = new Set(['1', 'true', 'yes', 'on']);
const FALSY = new Set(['0', 'false', 'no', 'off', '']);

export function toBoolean(value: FlagValue): boolean {
  if (value === undefined || typeof value === 'boolean') {
    return value ?? false;
  }
  const normalized = String(value).trim().toLowerCase();
  if (TRUTHY.has(normalized)) {
    return true;
  }
  if (FALSY.has(normalized)) {
    return false;
  }
  throw new Error(
    `Expected one of ${[...TRUTHY, ...FALSY].filter(Boolean).join(', ')}; received "${value}".`
  );
}

/**
 * Reads a positive integer, or undefined when unset.
 *
 * Number.parseInt would accept "5x" and "5.9"; a knob that multiplies spend
 * should not. An empty string counts as unset: GitHub renders an omitted input
 * that way, and every such input here is optional.
 */
export function parsePositiveInteger(source: string, raw: FlagValue): number | undefined {
  if (raw === undefined || String(raw).trim() === '') {
    return undefined;
  }
  const normalized = String(raw).trim();
  if (!/^\d+$/.test(normalized) || Number(normalized) < 1) {
    throw new Error(`${source} must be a positive integer; received "${raw}".`);
  }
  return Number(normalized);
}

// yargs collects repeated flags into an array but never splits a value, so
// `--evals 703,704` would arrive as one entry — and so would the whole
// AGENTIC_REF_EVALS variable CI passes.
function splitCommas(values: readonly (string | number)[]): string[] {
  return values.flatMap((value) =>
    String(value)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

// --- option shapes ---------------------------------------------------------

/** The env var a flag falls back to: `ackFailures` -> AGENTIC_REF_ACK_FAILURES. */
export function envNameFor(flag: string): string {
  return `${ENV_PREFIX}_${flag.replaceAll(/(?<=[a-z0-9])(?=[A-Z])/g, '_').toUpperCase()}`;
}

/**
 * Option builders bound to an environment.
 *
 * Fallbacks are supplied as yargs `default`s rather than through `.env()`:
 * yargs reads only the literal 'true' from the environment, so `.env()` would
 * make AGENTIC_REF_FORCE=1 a silent no-op — and '=1' is how every other env flag
 * in this repo is spelled. Defaults also keep the precedence right, since a flag
 * always beats a default.
 *
 * Fallbacks key off the canonical flag name only, never an alias: --recompute
 * reads AGENTIC_REF_RECOMPUTE, and its --force spelling stays a command-line
 * convenience. Otherwise an AGENTIC_REF_FORCE exported for a run would also
 * rebuild every committed baseline on the next analysis pass.
 *
 * Pass no env to get a CLI with no environment fallback at all.
 */
export function selectionFlags(env?: NodeJS.ProcessEnv) {
  const fallback = (flag: string): string | undefined =>
    env === undefined ? undefined : env[envNameFor(flag)];
  // Recorded as options are built, so `parser` below can normalize
  // `--force=1` before yargs decides what it means.
  const switches = new Set<string>();

  return {
    /** Experiments (cases), by name or glob. */
    experiments: {
      type: 'array',
      string: true,
      requiresArg: true,
      alias: ['experiment', 'cases', 'case'],
      default: splitCommas([fallback('experiments') ?? '']),
      coerce: splitCommas,
      describe: 'Experiments to select, by name or glob',
    } as const,

    /** Evals (flows, workflows), by name, number or glob. */
    evals: {
      type: 'array',
      string: true,
      requiresArg: true,
      alias: ['eval', 'flows', 'flow', 'workflows', 'workflow'],
      default: splitCommas([fallback('evals') ?? '']),
      coerce: splitCommas,
      describe: 'Evals to select, by name, number (703) or glob (70*)',
    } as const,

    /**
     * An on/off flag. A real boolean type, so `--dry <token>` leaves the token
     * as a positional for `.strict()` to reject rather than swallowing it.
     */
    switch: (flag: string, describe: string) => {
      switches.add(flag);
      return { type: 'boolean', default: toBoolean(fallback(flag)), describe } as const;
    },

    /** A positive-integer flag, named so a bad value says where it came from. */
    count: (flag: string, describe: string) =>
      ({
        type: 'string',
        requiresArg: true,
        default: fallback(flag),
        coerce: (raw: FlagValue) => parsePositiveInteger(`--${flag}`, raw),
        describe,
      }) as const,

    /** A plain string flag. */
    text: (flag: string, describe: string) =>
      ({ type: 'string', requiresArg: true, default: fallback(flag), describe }) as const,

    /**
     * A yargs parser carrying this line's conventions, over the options built
     * above. Callers add nothing else and call `.parseSync()`.
     *
     * Strict, with no positionals at all: selection used to ride on them, and
     * silently ignoring a leftover `agentic-ref-cc-*` would widen a paid run.
     */
    parser<T extends Readonly<Record<string, Options>>>(
      argv: readonly string[],
      config: SelectionCliConfig,
      options: T
    ) {
      // A direct `node scripts/<script>.ts -- --dry` (or a package runner that
      // forwards the separator) hands `--` to the script, and yargs would sweep
      // everything after it into positionals.
      const tokens = normalizeSwitchValues(
        argv.filter((token) => token !== '--'),
        switches
      );

      return yargs(tokens)
        .scriptName(config.scriptName)
        .usage(config.usage)
        .options(options)
        .strict()
        .parserConfiguration({ 'strip-aliased': true, 'strip-dashed': true })
        .help()
        .version(false)
        .wrap(100);
    },
  };
}

export interface SelectionCliConfig {
  scriptName: string;
  usage: string;
}

function camelize(name: string): string {
  return name.replaceAll(/-([a-z0-9])/g, (_, character: string) => character.toUpperCase());
}

/**
 * Rewrites `--force=1` into `--force`, and `--force=0` into `--no-force`.
 *
 * A yargs boolean reads only the literal 'true' as on, so it would quietly turn
 * `--force=1` — this repo's idiom everywhere else — into off, and swallow
 * `--force=maybe` the same way. Booleans keep their real type despite that,
 * because an untyped flag swallows the token after it and turns a stale
 * positional into a nonsense value instead of an "unknown argument".
 */
function normalizeSwitchValues(argv: readonly string[], switches: ReadonlySet<string>): string[] {
  return argv.map((token) => {
    const match = /^--(no-)?([^=]+)=(.*)$/.exec(token);
    if (match === null) {
      return token;
    }
    const [, negation, name, value] = match;
    if (!switches.has(camelize(name!))) {
      return token;
    }
    return toBoolean(value) === (negation === undefined) ? `--${name}` : `--no-${name}`;
  });
}

// --- eval selection --------------------------------------------------------

/**
 * The glob a selection token stands for.
 *
 * A bare number is shorthand for the whole eval it numbers, so `703` selects
 * 703-fix-bug-flow without anyone having to type the suffix.
 */
function toSelectionPattern(token: string): string {
  return /^\d+$/.test(token) ? `${token}-*` : token;
}

/**
 * True when a name is selected by any of the tokens; an empty token list selects
 * everything, which is what "no --experiments flag" means.
 */
export function matchesAnySelector(name: string, tokens: readonly string[]): boolean {
  if (tokens.length === 0) {
    return true;
  }
  return tokens.some(
    (token) => name === token || picomatch.isMatch(name, toSelectionPattern(token))
  );
}

/**
 * Expands eval selection tokens against the active registry.
 *
 * Tokens resolve against the registry rather than the evals/ directory on
 * purpose: a fixture can sit on disk while parked out of the registry, and the
 * runner rejects those.
 *
 * A token matching nothing throws. The alternative — resolving to an empty set —
 * reads as a successful run of zero evals, which is the failure mode this line
 * can least afford.
 */
export function resolveEvalSelection(
  tokens: readonly string[],
  registry: readonly string[]
): string[] {
  const selected = new Set<string>();

  for (const token of tokens) {
    const matches = registry.filter((name) => matchesAnySelector(name, [token]));
    if (matches.length === 0) {
      throw new Error(`"${token}" matches no active eval. Active: ${registry.join(', ')}.`);
    }
    for (const match of matches) {
      selected.add(match);
    }
  }

  // Registry order, not selection order: the plan reads the same however the
  // tokens were typed.
  return registry.filter((name) => selected.has(name));
}

// --- dry-run plans ---------------------------------------------------------

// The runner prints one of two shapes depending on whether anything is left to
// run. Matching only the first would make `--expect 0` — "confirm this
// selection is fully cached" — impossible to satisfy.
const PLANNED_COUNT = /(\d+) evals? to run/;
const NOTHING_TO_RUN = /All \d+ evals? cached|Nothing to run/;

/**
 * Reads the eval count out of a dry-run plan, or null when the plan is unrecognizable.
 *
 * Colour codes need no stripping: chalk wraps whole lines, so its escapes never
 * land between the count and the words it is counted by.
 */
export function parsePlannedEvalCount(output: string): number | null {
  const counted = PLANNED_COUNT.exec(output);
  if (counted !== null) {
    return Number(counted[1]);
  }
  return NOTHING_TO_RUN.test(output) ? 0 : null;
}
