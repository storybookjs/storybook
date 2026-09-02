// The compare CLI's grammar, on the shared selection vocabulary
// (lib/agentic-reference/selection.ts): --cases/--experiments and
// --workflows/--evals are the same flags the runner and analyzer take, with
// the same comma splitting and AGENTIC_REF_* environment fallbacks.
import { selectionFlags } from '../selection.ts';

export interface CompareOptions {
  control: string | undefined;
  /** Treatment cases; empty means every case with recorded data. */
  cases: string[];
  /** Workflows; empty means auto-select the complete ones. */
  workflows: string[];
  /** Plan config to scope the comparison to, by path or bare plan name. */
  plan: string | undefined;
  /** Unset means: the plan's target sample size, then 10. */
  minRuns: number | undefined;
  out: string | undefined;
  /** Pool every treatment into one bundled arm against the control. */
  bundle: boolean;
}

/**
 * The compare CLI's parser, exposed apart from parseCompareArgs so tests can
 * chain test-friendly failure handling before parsing.
 */
export function compareParser(argv: readonly string[], env?: NodeJS.ProcessEnv) {
  const flags = selectionFlags(env);
  return flags.parser(
    argv,
    {
      scriptName: 'results:compare',
      usage: 'Usage: yarn workspace agent-eval run results:compare [flags]',
    },
    {
      control: flags.text('control', 'Control case (default cc-control-none-opus-high)'),
      experiments: {
        ...flags.experiments,
        describe: 'Treatment cases to compare, by name, or "all" (default: every case with data)',
      },
      evals: {
        ...flags.evals,
        describe: 'Workflows to compare, by name or number (default: auto-select complete ones)',
      },
      plan: flags.text('plan', "Compare one collection plan's cases and workflows (name or path)"),
      minRuns: flags.count(
        'minRuns',
        "Usable runs required per cell (default: the plan's runs, then 10)"
      ),
      out: flags.text('out', 'Output directory (default comparisons/<slug>)'),
      bundle: flags.switch(
        'bundle',
        'Pool every treatment into one bundled arm against the control'
      ),
    }
  );
}

type ParsedCompareArgs = ReturnType<ReturnType<typeof compareParser>['parseSync']>;

/** The parsed flags in the comparison pipeline's vocabulary. */
export function toCompareOptions(parsed: ParsedCompareArgs): CompareOptions {
  return {
    control: parsed.control,
    cases: parsed.experiments,
    workflows: parsed.evals,
    plan: parsed.plan,
    minRuns: parsed.minRuns,
    out: parsed.out,
    bundle: parsed.bundle,
  };
}

export function parseCompareArgs(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env
): CompareOptions {
  return toCompareOptions(compareParser(argv, env).parseSync());
}
