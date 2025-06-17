import type { PackageJson } from '@storybook/core/types';
import { rendererPackages } from '@storybook/core/common';
import prompts from 'prompts';

export const detectRenderer = async (packageJson: PackageJson) => {
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
  };

  // Pull the viewlayer from dependencies in package.json
  const matches = Object.keys(rendererPackages).filter((pkg) => !!allDependencies[pkg]);
  let [rendererPackage] = matches;
  if (matches.length > 1) {
    const response = await prompts([
      {
        type: 'select',
        name: 'rendererPackage',
        hint: '> - Use arrow-keys. Return to submit. To automate this next time, you can pass the renderer to the CLI via the --renderer flag',
        message:
          'Tried to detect a Storybook renderer in your project but found multiple. This could happen in monorepos, when projects contain multiple Storybook packages in package.json. Please select the correct one:',
        choices: matches.map((type) => ({
          title: type,
          value: type,
        })),
      },
    ]);
    rendererPackage = response.rendererPackage;
  }

  return rendererPackage;
};
