/**
 * Records or verifies per-component docgen baselines captured from a built sandbox.
 *
 * Run from code/lib/docgen-harness:
 *   yarn baselines:sandbox                              # verify every server-docgen template
 *   yarn baselines:sandbox --update                     # re-record after reviewing the diff
 *   yarn baselines:sandbox --template angular-vite/docgen-server-ts
 *
 * Requires a built sandbox:
 *   yarn task build --template <template> --start-from auto
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { docgenServerTemplates } from '../../../cli-storybook/src/sandbox-templates.ts';
import { SANDBOX_DIRECTORY } from '../perf/docgen-shared/paths.ts';
import { compareBaselines, formatFindings, stableStringify } from './compare-baselines.ts';
import type { SandboxBaselines } from './read-static-docgen.ts';
import { readStaticDocgen } from './read-static-docgen.ts';

const BASELINES_ROOT = join(dirname(fileURLToPath(import.meta.url)), '__baselines__');

interface Options {
  templates: string[];
  sandboxDir?: string;
  update: boolean;
}

function parseArgs(argv: string[]): Options {
  const valueOf = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };

  const template = valueOf('--template');
  return {
    templates: template ? [template] : docgenServerTemplates(),
    sandboxDir: valueOf('--sandbox'),
    update: argv.includes('--update') || argv.includes('-u'),
  };
}

const sandboxDirFor = (template: string, override?: string): string =>
  override ?? join(SANDBOX_DIRECTORY, template.replace('/', '-'));

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

/** Returns true when the template is in good standing, false when it should fail the run. */
function runTemplate(template: string, sandboxDirOverride: string | undefined, update: boolean) {
  const sandboxDir = sandboxDirFor(template, sandboxDirOverride);
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
    return true;
  }

  const committed = readCommitted(baselineDir);
  if (Object.keys(committed).length === 0) {
    console.error(
      `No baselines committed for ${template}. Record them with:\n  yarn baselines:sandbox --template ${template} --update`
    );
    return false;
  }

  const findings = compareBaselines(committed, candidate);
  if (findings.length === 0) {
    console.log(`${template}: baselines match.`);
    return true;
  }

  console.error(`\n${template}: docgen baselines drifted.\n${formatFindings(findings)}`);
  console.error(
    `\nRegressions mean docgen got worse and want a fix, not a re-record. Once the diff is understood:\n  yarn baselines:sandbox --template ${template} --update`
  );
  return false;
}

function main(): void {
  const { templates, sandboxDir, update } = parseArgs(process.argv.slice(2));

  if (templates.length === 0) {
    // Silence here would read as "everything passed" while nothing had been checked.
    console.error(
      'No sandbox template enables server docgen, so there is nothing to baseline. Set ' +
        'features.experimentalDocgenServer and features.componentsManifest on a template first.'
    );
    process.exitCode = 1;
    return;
  }

  const failed = templates.filter((template) => !runTemplate(template, sandboxDir, update));
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main();
