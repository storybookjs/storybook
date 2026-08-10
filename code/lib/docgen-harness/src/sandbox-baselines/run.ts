// Records or verifies per-component docgen baselines captured from a built sandbox, so a provider
// change shows up as a reviewable diff instead of being noticed by hand. Which templates are covered
// is derived from the templates that enable server docgen, so there is no list here to keep in sync.
//
// Run from code/lib/docgen-harness, against a sandbox built with
// `yarn task build --template <template> --start-from auto`:
//   yarn baselines:sandbox                              # verify every server-docgen template
//   yarn baselines:sandbox --update                     # re-record after reviewing the diff
//   yarn baselines:sandbox --template angular-vite/docgen-server-ts
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

import { docgenServerTemplates } from '../../../cli-storybook/src/sandbox-templates.ts';
import { SANDBOX_DIRECTORY } from '../perf/docgen-shared/paths.ts';
import { compareBaselines, formatFindings } from './compare-baselines.ts';
import { parseBaselineRunOptions } from './options.ts';
import type { SandboxBaselines } from './read-static-docgen.ts';
import { readStaticDocgen } from './read-static-docgen.ts';
import { stableStringify } from './stable-stringify.ts';

const BASELINES_ROOT = join(dirname(fileURLToPath(import.meta.url)), '__baselines__');

const sandboxDirFor = (template: string, override?: string): string =>
  override ?? join(SANDBOX_DIRECTORY, template.replace('/', '-'));

const baselineDirFor = (template: string): string =>
  join(BASELINES_ROOT, template.replace('/', '-'));

function readCommittedBaselines(baselineDir: string): SandboxBaselines {
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

// Replaces the recorded set for a template without ever having the committed baselines only
// half-present: the new set is built in a sibling directory, the old one is moved aside rather than
// deleted, and it is put back if the swap itself fails.
function write(baselineDir: string, baselines: SandboxBaselines): void {
  const stagingDir = `${baselineDir}.staging`;
  const backupDir = `${baselineDir}.backup`;
  rmSync(stagingDir, { recursive: true, force: true });
  rmSync(backupDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });
  try {
    for (const [component, payload] of Object.entries(baselines)) {
      writeFileSync(join(stagingDir, `${component}.json`), `${stableStringify(payload)}\n`);
    }
    const committedExists = existsSync(baselineDir);
    if (committedExists) {
      renameSync(baselineDir, backupDir);
    }
    try {
      renameSync(stagingDir, baselineDir);
    } catch (error) {
      if (committedExists) {
        renameSync(backupDir, baselineDir);
      }
      throw error;
    }
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
    rmSync(backupDir, { recursive: true, force: true });
  }
}

// Returns true when the template is in good standing, false when it should fail the run.
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

  const committed = readCommittedBaselines(baselineDir);
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
  const { template, sandboxDir, update } = parseBaselineRunOptions(process.argv.slice(2));
  const templates = template ? [template] : docgenServerTemplates();

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
