/**
 * Records or verifies per-component docgen baselines captured from a built sandbox.
 *
 * A sandbox is temporary and machine-specific, but `build-storybook` under
 * `features.experimentalDocgenServer` writes one docgen snapshot per component to
 * `storybook-static/services/core/docgen/`. This reads that directory, strips the machine-specific
 * and engine-specific parts, and keeps the result in the repository so a provider change shows up
 * as a reviewable diff instead of being noticed by hand.
 *
 * Run from code/lib/docgen-harness:
 *   yarn baselines:sandbox                              # verify angular-vite/default-ts
 *   yarn baselines:sandbox --update                     # re-record after reviewing the diff
 *   yarn baselines:sandbox --template vue3-vite/default-ts
 *
 * Requires a built sandbox:
 *   yarn task build --template angular-vite/default-ts --start-from auto
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SANDBOX_DIRECTORY } from '../perf/docgen-shared/paths.ts';
import { compareBaselines, formatFindings, stableStringify } from './compare-baselines.ts';
import type { SandboxBaselines } from './read-static-docgen.ts';
import { readStaticDocgen } from './read-static-docgen.ts';

const BASELINES_ROOT = join(dirname(fileURLToPath(import.meta.url)), '__baselines__');
const DEFAULT_TEMPLATE = 'angular-vite/default-ts';

interface Options {
  template: string;
  sandboxDir: string;
  update: boolean;
}

function parseArgs(argv: string[]): Options {
  const valueOf = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };

  const template = valueOf('--template') ?? DEFAULT_TEMPLATE;
  return {
    template,
    sandboxDir: valueOf('--sandbox') ?? join(SANDBOX_DIRECTORY, template.replace('/', '-')),
    update: argv.includes('--update') || argv.includes('-u'),
  };
}

const baselineDirFor = (template: string): string =>
  join(BASELINES_ROOT, template.replace('/', '-'));

function readCommitted(baselineDir: string): SandboxBaselines {
  if (!existsSync(baselineDir)) {
    return {};
  }
  const committed: SandboxBaselines = {};
  for (const file of readdirSync(baselineDir).filter((name) => name.endsWith('.json'))) {
    committed[file.slice(0, -'.json'.length)] = JSON.parse(
      readFileSync(join(baselineDir, file), 'utf8')
    );
  }
  return committed;
}

function write(baselineDir: string, baselines: SandboxBaselines): void {
  rmSync(baselineDir, { recursive: true, force: true });
  mkdirSync(baselineDir, { recursive: true });
  for (const [component, payload] of Object.entries(baselines)) {
    writeFileSync(join(baselineDir, `${component}.json`), `${stableStringify(payload)}\n`);
  }
}

function main(): void {
  const { template, sandboxDir, update } = parseArgs(process.argv.slice(2));
  const staticDir = join(sandboxDir, 'storybook-static');
  const baselineDir = baselineDirFor(template);

  const candidate = readStaticDocgen({ staticDir, sandboxDir });
  const documented = Object.values(candidate).filter((entry) => entry.argTypes).length;
  console.log(
    `${template}: read ${Object.keys(candidate).length} component(s) from ${staticDir} (${documented} documented)`
  );

  if (update) {
    write(baselineDir, candidate);
    console.log(`Recorded ${Object.keys(candidate).length} baseline(s) into ${baselineDir}`);
    return;
  }

  const committed = readCommitted(baselineDir);
  if (Object.keys(committed).length === 0) {
    console.error(
      `No baselines committed for ${template}. Record them with:\n  yarn baselines:sandbox --template ${template} --update`
    );
    process.exitCode = 1;
    return;
  }

  const findings = compareBaselines(committed, candidate);
  if (findings.length === 0) {
    console.log(`${template}: baselines match.`);
    return;
  }

  console.error(`\n${template}: docgen baselines drifted.\n${formatFindings(findings)}`);
  console.error(
    `\nRegressions mean docgen got worse and want a fix, not a re-record. Once the diff is understood:\n  yarn baselines:sandbox --template ${template} --update`
  );
  process.exitCode = 1;
}

main();
