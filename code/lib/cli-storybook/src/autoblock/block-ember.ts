import { dedent } from 'ts-dedent';

import { createBlocker } from './types.ts';

export const blocker = createBlocker({
  id: 'ember',
  async check({ packageManager }) {
    const emberVersion = await packageManager.getInstalledVersion('@storybook/ember');

    return emberVersion !== null;
  },
  log() {
    return {
      title: 'Ember: support removed in Storybook 11',
      message: dedent`
        Storybook 11 no longer supports the deprecated \`@storybook/ember\` integration.

        Support will return once the community ember-storybook package supports Storybook 11 —
        pending resolution of https://github.com/ember-integrations/ember-storybook/issues/123.

        In the meantime, migrate to the community-maintained ember-storybook package:
        https://github.com/ember-integrations/ember-storybook
      `,
      link: 'https://github.com/ember-integrations/ember-storybook/issues/123',
    };
  },
});
