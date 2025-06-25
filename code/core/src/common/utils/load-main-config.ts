import { relative, resolve } from 'node:path';

import { MainFileEvaluationError } from 'storybook/internal/server-errors';
import type { StorybookConfig } from 'storybook/internal/types';

import { importModule } from '../../shared/utils/module';
import { serverResolve } from './interpret-require';
import { validateConfigurationFiles } from './validate-configuration-files';

export async function loadMainConfig({
  configDir = '.storybook',
  cwd,
}: {
  configDir: string;
  cwd?: string;
}): Promise<StorybookConfig> {
  await validateConfigurationFiles(configDir, cwd);

  // pathToFileURL is a workaround for https://github.com/unjs/mlly/issues/297
  const mainPath = serverResolve(resolve(configDir, 'main')) as string;
  console.log({
    RESOLVED: resolve(configDir, 'main'),
  });

  console.log({
    MAIN_PATH: mainPath,
  });

  try {
    const out = await importModule(mainPath);
    return out;
  } catch (e) {
    if (!(e instanceof Error)) {
      throw e;
    }

    throw new MainFileEvaluationError({
      location: relative(process.cwd(), mainPath),
      error: e,
    });
  }
}
