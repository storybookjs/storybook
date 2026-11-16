import { describe, expect, it } from 'vitest';

import { canPushTo, pushTokenEnv } from './push-targets.ts';

describe('pushTokenEnv', () => {
  it('names the App token variable of the repo owner', () => {
    expect(pushTokenEnv('storybookjs/mealdrop')).toBe('ECOSYSTEM_QA_APP_TOKEN_STORYBOOKJS');
    expect(pushTokenEnv('storybook-tmp/twenty')).toBe('ECOSYSTEM_QA_APP_TOKEN_STORYBOOK_TMP');
  });

  it.each(['twentyhq/twenty', 'toString/x'])(
    'throws for %s, whose owner has no App token',
    (repo) => {
      expect(() => pushTokenEnv(repo)).toThrow(/No push token is configured/);
      expect(canPushTo(repo)).toBe(false);
    }
  );
});
