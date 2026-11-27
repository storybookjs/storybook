import { describe, expect, it } from 'vitest';

import { FixStatus, getWarnedFixIds } from './types.ts';

describe('getWarnedFixIds', () => {
  it('includes a fix the user declined at the prompt, whose skip warning was printed', () => {
    expect(
      getWarnedFixIds(
        { 'declined-fix': FixStatus.SKIPPED, 'ran-fix': FixStatus.SUCCEEDED },
        { cancelledFixIds: [] }
      )
    ).toEqual(['declined-fix']);
  });

  it('does not include a fix that cancelled itself from run, which was skipped without a warning', () => {
    expect(
      getWarnedFixIds(
        {
          'cancelled-fix': FixStatus.SKIPPED,
          'declined-fix': FixStatus.SKIPPED,
        },
        { cancelledFixIds: ['cancelled-fix'] }
      )
    ).toEqual(['declined-fix']);
  });

  it('returns undefined on a dry run, where no skip warning was printed', () => {
    expect(
      getWarnedFixIds({ 'declined-fix': FixStatus.SKIPPED }, { dryRun: true })
    ).toBeUndefined();
  });

  it('ignores fixes that did not skip', () => {
    expect(
      getWarnedFixIds({
        'ok-fix': FixStatus.SUCCEEDED,
        'broken-fix': FixStatus.FAILED,
        'checked-off-fix': FixStatus.CHECK_FAILED,
        'unneeded-fix': FixStatus.UNNECESSARY,
        'declined-fix': FixStatus.SKIPPED,
      })
    ).toEqual(['declined-fix']);
  });
});
