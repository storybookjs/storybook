import { describe, expect, it } from 'vitest';

import { canPushTo, pushTokenEnv } from './push-targets.ts';

describe('pushTokenEnv', () => {
  it('names the secret of the repo owner', () => {
    expect(pushTokenEnv('storybookjs/mealdrop')).toBe('ECOSYSTEM_QA_PUSH_TOKEN');
    expect(pushTokenEnv('storybook-tmp/twenty')).toBe('ECOSYSTEM_QA_PUSH_TOKEN_STORYBOOK_TMP');
  });

  it.each(['twentyhq/twenty', 'toString/x'])('throws for %s, whose owner has no secret', (repo) => {
    expect(() => pushTokenEnv(repo)).toThrow(/No push token is configured/);
    expect(canPushTo(repo)).toBe(false);
  });
});
