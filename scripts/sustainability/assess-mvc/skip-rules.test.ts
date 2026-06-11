import { describe, expect, it } from 'vitest';

import { evaluateSkip } from './skip-rules.ts';

const baseCtx = {
  isDraft: false,
  labels: [] as string[],
  author: 'someone',
};

describe('evaluateSkip', () => {
  it('skips drafts', async () => {
    const r = await evaluateSkip(
      { ...baseCtx, isDraft: true },
      { isMaintainer: async () => false }
    );
    expect(r).toMatchObject({ skip: true, reason: 'draft' });
  });

  it('skips already-verdict-labeled PRs', async () => {
    expect(
      (
        await evaluateSkip(
          { ...baseCtx, labels: ['mvc:success'] },
          { isMaintainer: async () => false }
        )
      ).reason
    ).toBe('already-assessed');
    expect(
      (
        await evaluateSkip(
          { ...baseCtx, labels: ['mvc:failed'] },
          { isMaintainer: async () => false }
        )
      ).reason
    ).toBe('already-assessed');
  });

  it('skips mvc:skip', async () => {
    expect(
      (
        await evaluateSkip(
          { ...baseCtx, labels: ['mvc:skip'] },
          { isMaintainer: async () => false }
        )
      ).reason
    ).toBe('explicit-skip');
  });

  it('skips maintainer-authored PRs', async () => {
    const r = await evaluateSkip(baseCtx, { isMaintainer: async () => true });
    expect(r).toMatchObject({ skip: true, reason: 'maintainer' });
  });

  it('does not skip otherwise', async () => {
    const r = await evaluateSkip(baseCtx, { isMaintainer: async () => false });
    expect(r.skip).toBe(false);
  });
});
