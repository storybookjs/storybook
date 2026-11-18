import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadCatalog } from './catalog.ts';
import { cycleRepo } from './cycle.ts';
import { canPushTo, pushTokenEnv } from './push-targets.ts';

describe('pushTokenEnv', () => {
  it('names only variables that the file job sets for the filer', () => {
    const workflow = readFileSync(
      new URL('../../.github/workflows/ecosystem-qa.yml', import.meta.url),
      'utf8'
    );
    const fileJob = workflow.slice(workflow.indexOf('\n  file:\n'));
    const set = [...fileJob.matchAll(/^ {10}(ECOSYSTEM_QA_APP_TOKEN_\w+): /gm)].map(
      ([, name]) => name
    );
    const needed = loadCatalog().map((entry) => pushTokenEnv(cycleRepo(entry)));
    expect(set).toEqual(expect.arrayContaining(needed));
  });

  it.each(['twentyhq/twenty', 'toString/x'])(
    'throws for %s, whose owner has no App token',
    (repo) => {
      expect(() => pushTokenEnv(repo)).toThrow(/No push token is configured/);
      expect(canPushTo(repo)).toBe(false);
    }
  );
});
