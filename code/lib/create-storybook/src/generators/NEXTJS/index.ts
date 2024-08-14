import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { CoreBuilder } from 'storybook/internal/cli';

import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';

const generator: Generator = async (packageManager, npmOptions, options) => {
  let staticDir;
  if (existsSync(join(process.cwd(), 'public'))) staticDir = 'public';

  await baseGenerator(
    packageManager,
    npmOptions,
    { ...options, builder: CoreBuilder.Webpack5 },
    'react',
    {
      staticDir,
      extraAddons: [`@storybook/addon-onboarding`],
      webpackCompiler: ({ builder }) => undefined,
    },
    'nextjs'
  );
};

export default generator;
