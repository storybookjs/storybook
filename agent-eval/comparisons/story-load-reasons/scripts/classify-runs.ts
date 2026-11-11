// Classifies every stored run as current or superseded using the harness's own rules.
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeStoredRun } from '/Users/steve/Development/storybook/agent-eval/lib/agentic-reference/comparability.ts';
import { readRunOutcome } from '/Users/steve/Development/storybook/agent-eval/lib/agentic-reference/collected-runs.ts';

const RESULTS = '/Users/steve/Development/storybook/agent-eval/results';
const out: unknown[] = [];
for (const experiment of readdirSync(RESULTS)) {
  const expDir = join(RESULTS, experiment);
  if (!experiment.startsWith('agentic-ref-')) continue;
  for (const ts of readdirSync(expDir)) {
    const tsDir = join(expDir, ts);
    if (!existsSync(tsDir) || ts.startsWith('.')) continue;
    for (const evalName of readdirSync(tsDir)) {
      const evalDir = join(tsDir, evalName);
      if (evalName.startsWith('.')) continue;
      let runs: string[] = [];
      try { runs = readdirSync(evalDir).filter((n) => /^run-\d+$/.test(n)); } catch { continue; }
      for (const run of runs) {
        const runDir = join(evalDir, run);
        const outcome = readRunOutcome(runDir);
        let current = false; let measurement: unknown = null; let err: string | null = null;
        try { const d = describeStoredRun(runDir, { experiment, evalName }); current = d.current; measurement = d.measurement; }
        catch (e) { err = String(e); }
        out.push({ experiment, ts, evalName, run, runDir, collected: outcome.collected, error: outcome.error, current, measurement, err });
      }
    }
  }
}
writeFileSync(process.argv[2], JSON.stringify(out));
const tally: Record<string, number> = {};
for (const r of out as any[]) { const k = `current=${r.current} collected=${r.collected} error=${r.error ? 'y' : 'n'} classifyErr=${r.err ? 'y' : 'n'}`; tally[k] = (tally[k] ?? 0) + 1; }
console.log(tally);
console.log((out as any[]).find((r) => r.err)?.err ?? 'no classify errors');
