import { dedent } from 'ts-dedent';

import { createBlocker } from './types.ts';

export const blocker = createBlocker({
  id: 'reactLegacyRootApi',
  async check({ mainConfig }) {
    const framework = mainConfig.framework;

    // `framework` is `string | { name, options }`; only the object form can carry options.
    if (typeof framework !== 'object' || framework === null) {
      return false;
    }

    // Block on presence, not truthiness: `legacyRootApi: false` must be removed too,
    // because the option no longer exists and would fail config validation.
    return 'legacyRootApi' in (framework.options ?? {});
  },
  log() {
    return {
      title: 'React legacy root API removed',
      message: dedent`
        Your Storybook config sets the \`framework.options.legacyRootApi\` option, which no longer exists.

        Storybook now always renders through React's new root API (\`react-dom/client\`), introduced in
        React 18 and required by React 19. Remove \`legacyRootApi\` from your \`.storybook/main.*\`
        framework options, whether it is set to \`true\` or \`false\`.

        If you set it to \`true\` to defer a React 18 migration, migrate your application code to the
        new root API before upgrading, and verify your stories still render as expected:
        https://react.dev/blog/2022/03/08/react-18-upgrade-guide

        This is a manual migration. Storybook cannot remove the option for you, because it cannot
        verify that your components behave correctly under the new root API.
      `,
      link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-require-v18-and-up',
    };
  },
});
