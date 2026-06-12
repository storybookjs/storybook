import { describe, expect, it } from 'vitest';

import { setupMsw } from '../../utils/test-helpers/msw.ts';
import { evaluateSkip, type EvaluateSkipOpts } from './skip-rules.ts';

const baseOpts: EvaluateSkipOpts = { force: false, reassess: false };

const basePr = {
  isDraft: false,
  labels: [] as string[],
  author: 'someone',
};

describe('evaluateSkip', () => {
  const { server, http, HttpResponse } = setupMsw();

  // Default: every team-membership probe returns 404 ("not a member of this
  // team"). Individual tests override with 200 to simulate a maintainer.
  const stubNonMaintainer = () => {
    server.use(
      http.get('https://api.github.com/orgs/storybookjs/teams/:team/memberships/:user', () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 })
      )
    );
  };

  it('does not skip when --force is set, regardless of any other condition', async () => {
    stubNonMaintainer();
    const r = await evaluateSkip(
      {
        ...basePr,
        isDraft: true,
        labels: ['mvc:success', 'mvc:skip'],
        author: 'github-actions[bot]',
      },
      { force: true, reassess: false }
    );
    expect(r.skip).toBe(false);
  });

  it('skips PRs authored by github-actions[bot] as release-pr', async () => {
    stubNonMaintainer();
    const r = await evaluateSkip({ ...basePr, author: 'github-actions[bot]' }, baseOpts);
    expect(r).toMatchObject({ skip: true, reason: 'release-pr' });
  });

  it('does NOT skip Copilot PRs — operator detection rewrites author to the human', async () => {
    stubNonMaintainer();
    const r = await evaluateSkip({ ...basePr, author: 'Sidnioulz' }, baseOpts);
    expect(r.skip).toBe(false);
  });

  it('skips already-assessed PRs by default', async () => {
    stubNonMaintainer();
    expect((await evaluateSkip({ ...basePr, labels: ['mvc:success'] }, baseOpts)).reason).toBe(
      'already-assessed'
    );
    expect((await evaluateSkip({ ...basePr, labels: ['mvc:failed'] }, baseOpts)).reason).toBe(
      'already-assessed'
    );
  });

  it('does not skip already-assessed PRs when --reassess is set', async () => {
    stubNonMaintainer();
    const r = await evaluateSkip(
      { ...basePr, labels: ['mvc:success'] },
      { force: false, reassess: true }
    );
    expect(r.skip).toBe(false);
  });

  it('skips drafts', async () => {
    stubNonMaintainer();
    const r = await evaluateSkip({ ...basePr, isDraft: true }, baseOpts);
    expect(r).toMatchObject({ skip: true, reason: 'draft' });
  });

  it('skips mvc:skip', async () => {
    stubNonMaintainer();
    expect((await evaluateSkip({ ...basePr, labels: ['mvc:skip'] }, baseOpts)).reason).toBe(
      'explicit-skip'
    );
  });

  it('skips maintainer-authored PRs', async () => {
    // First team returns 200 → maintainer detected.
    server.use(
      http.get(
        'https://api.github.com/orgs/storybookjs/teams/:team/memberships/:user',
        ({ params }) => {
          if (params.team === 'core') {
            return HttpResponse.json({ state: 'active' });
          }
          return HttpResponse.json({ message: 'Not Found' }, { status: 404 });
        }
      )
    );
    const r = await evaluateSkip(basePr, baseOpts);
    expect(r).toMatchObject({ skip: true, reason: 'maintainer' });
  });

  it('does not skip otherwise', async () => {
    stubNonMaintainer();
    const r = await evaluateSkip(basePr, baseOpts);
    expect(r.skip).toBe(false);
  });
});
