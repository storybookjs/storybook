import { dedent } from 'ts-dedent';
import { getFrameworkPackageName } from '../helpers/mainConfigFile';
import type { Fix } from '../types';

// This fix is only relevant for projects using Storybook 8.0.0-alpha.4 or later
const minimumStorybookVersion = '8.0.0-alpha.4';

export const removeReactDependency: Fix<{}> = {
  id: 'remove-react-dependency',
  promptType: 'manual',

  versionRange: [`^7 || <${minimumStorybookVersion}`, `>=${minimumStorybookVersion}`],

  async check({ packageManager, mainConfig, storybookVersion }) {
    // when the user is using the react renderer, we should not prompt them to remove react
    const frameworkPackageName = getFrameworkPackageName(mainConfig);

    if (frameworkPackageName?.includes('react') || frameworkPackageName?.includes('nextjs')) {
      return null;
    }

    // if the user has no dependency on react, we can skip this fix
    const { react } = await packageManager.getAllDependencies();

    if (!react) {
      return null;
    }

    return true;
  },
  prompt() {
    return dedent`
      We detected that your project has a dependency for "react" that it might not need.
      Nothing breaks by having it, you can safely ignore this message, if you wish.

      Storybook asked you to add "react" as a direct dependency in the past when upgrading from Storybook 6 to 7.
      However, since version 8.0, Storybook no longer requires you to provide "react" as a dependency.
      Some community addons might still wrongfully list "react" and "react-dom" as required peer dependencies, but since Storybook 7.6 it should not be needed in the majority of cases.
      
      If you know you are not using React outside of Storybook, it should be safe to remove the "react" and "react-dom" dependencies from your project's package.json.
      Storybook cannot do this automatically as removing it might break your project, so it should be done manually with care.
    `;
  },
};
