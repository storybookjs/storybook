import { dedent } from 'ts-dedent';

import { createBlocker } from './types.ts';

export const blocker = createBlocker({
  id: 'ember',
  async check({ packageManager }) {
    // A listed-but-uninstalled @storybook/ember reports no installed version; treat the listing as intent to upgrade.
    if (packageManager.isDependencyInstalled('@storybook/ember')) {
      return true;
    }

    return (await packageManager.getInstalledVersion('@storybook/ember')) !== null;
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
