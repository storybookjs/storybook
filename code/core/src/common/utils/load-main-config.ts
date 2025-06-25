import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  MainFileESMOnlyImportError,
  MainFileEvaluationError,
} from 'storybook/internal/server-errors';
import type { StorybookConfig } from 'storybook/internal/types';

import { resolveSync } from 'mlly';
import { relative, resolve } from 'pathe';

import { importModule } from '../../shared/utils/module';
import { validateConfigurationFiles } from './validate-configuration-files';

export async function loadMainConfig({
  configDir = '.storybook',
  cwd,
}: {
  configDir: string;
  cwd?: string;
}): Promise<StorybookConfig> {
  await validateConfigurationFiles(configDir, cwd);

  const mainUrl = resolveSync(resolve(configDir, 'main'), {
    extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'],
  });

  try {
    const out = await importModule(mainUrl);
    return out;
  } catch (e) {
    if (!(e instanceof Error)) {
      throw e;
    }
    if (e.message.match(/Cannot use import statement outside a module/)) {
      const location = relative(process.cwd(), fileURLToPath(mainUrl));
      const numFromStack = e.stack?.match(new RegExp(`${location}:(\\d+):(\\d+)`))?.[1];
      let num;
      let line;

      if (numFromStack) {
        const contents = await readFile(mainUrl, 'utf-8');
        const lines = contents.split('\n');
        num = parseInt(numFromStack, 10) - 1;
        line = lines[num];
      }

      const out = new MainFileESMOnlyImportError({
        line,
        location,
        num,
      });

      delete out.stack;

      throw out;
    }

    throw new MainFileEvaluationError({
      location: relative(process.cwd(), fileURLToPath(mainUrl)),
      error: e,
    });
  }
}
