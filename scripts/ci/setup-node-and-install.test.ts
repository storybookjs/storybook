import { readFileSync, readdirSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { COREPACK_VERSION } from './utils/helpers.ts';

const repoRoot = join(import.meta.dirname, '../..');
const ACTION = '.github/actions/setup-node-and-install';

const read = (file: string) => readFileSync(join(repoRoot, file), 'utf8');

type Step = { uses?: string; with?: Record<string, unknown> };
type Job = { permissions?: Record<string, string>; steps?: Step[] };

const workflowFiles = readdirSync(join(repoRoot, '.github/workflows'))
  .filter((file) => file.endsWith('.yml'))
  .map((file) => `.github/workflows/${file}`);

/** Every job that installs through the shared action, with what it can reach besides the checkout. */
const installingJobs = workflowFiles.flatMap((file) => {
  const workflow = parse(read(file));
  return Object.entries<Job>(workflow.jobs ?? {}).flatMap(([id, job]) => {
    const step = job.steps?.find(({ uses }) => uses?.endsWith(ACTION));
    if (!step) {
      return [];
    }
    // Workflow-level env reaches every job.
    const reachable = JSON.stringify({ env: workflow.env, job });
    const credentials = [...reachable.matchAll(/secrets\.(\w+)/g)]
      .map(([, name]) => name)
      .filter((name) => name !== 'GITHUB_TOKEN');
    if (job.permissions?.['id-token'] === 'write') {
      credentials.push('id-token');
    }
    return [{ name: `${file} ${id}`, cache: step.with?.cache ?? 'read-only', credentials }];
  });
});

describe(ACTION, () => {
  it.each([`${ACTION}/action.yml`, '.github/workflows/generate-sandboxes.yml'])(
    'installs the corepack that the CircleCI jobs pin, in %s',
    (file) => {
      const pins = [...read(file).matchAll(/corepack@(\S+)/g)].map(([, version]) => version);

      expect(pins).toEqual([COREPACK_VERSION]);
    }
  );

  it('is used by the jobs this test checks', () => {
    expect(installingJobs).toContainEqual(
      expect.objectContaining({
        name: '.github/workflows/publish.yml publish-normal',
        credentials: expect.arrayContaining(['GH_TOKEN', 'id-token']),
      })
    );
  });

  // pnpm links a restored store's files without hashing them again, so a tampered store would run
  // with these credentials.
  it.each(installingJobs.filter(({ credentials }) => credentials.length > 0))(
    'skips the cache in $name, which can reach $credentials',
    ({ cache }) => {
      expect(cache).toBe('none');
    }
  );
});
