/**
 * Records or verifies per-component docgen baselines captured from a built sandbox.
 *
 * A sandbox is temporary and machine-specific, but `build-storybook` under
 * `features.experimentalDocgenServer` writes one docgen snapshot per component to
 * `storybook-static/services/core/docgen/`. This reads that directory, strips the machine-specific
 * and engine-specific parts, and keeps the result in the repository so a provider change shows up
 * as a reviewable diff instead of being noticed by hand.
 *
 * Which templates are covered is derived from the sandbox templates that enable server docgen, so
 * there is no list here to keep in sync: turning the flags on for a template brings it in.
 *
 * Run from code/lib/docgen-harness:
 *   yarn baselines:sandbox                              # verify every server-docgen template
 *   yarn baselines:sandbox --update                     # re-record after reviewing the diff
 *   yarn baselines:sandbox --template angular-vite/docgen-server-ts
 *
 * Requires a built sandbox:
 *   yarn task build --template <template> --start-from auto
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

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

/** Strict parsing, so `--template` with no value errors instead of silently running all of them. */
function readOptions(argv: string[]): Options {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      template: { type: 'string' },
      sandbox: { type: 'string' },
      update: { type: 'boolean', short: 'u', default: false },
    },
  });

  return {
    templates: values.template ? [values.template] : docgenServerTemplates(),
    sandboxDir: values.sandbox,
    update: values.update,
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

/**
 * Replaces the recorded set for a template. Written into a sibling directory and swapped in, so a
 * throw mid-write leaves the committed baselines untouched rather than half-deleted.
 */
function write(baselineDir: string, baselines: SandboxBaselines): void {
  const stagingDir = `${baselineDir}.staging`;
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });
  try {
    for (const [component, payload] of Object.entries(baselines)) {
      writeFileSync(join(stagingDir, `${component}.json`), `${stableStringify(payload)}\n`);
    }
    rmSync(baselineDir, { recursive: true, force: true });
    renameSync(stagingDir, baselineDir);
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
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
  const { templates, sandboxDir, update } = readOptions(process.argv.slice(2));

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
