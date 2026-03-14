import { readFile, rm, writeFile } from 'node:fs/promises';
import { join, parse, relative, resolve } from 'node:path';

import { logger } from 'storybook/internal/node-logger';
import { MainFileEvaluationError } from 'storybook/internal/server-errors';
import type { StorybookConfig } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { importModule } from '../../shared/utils/module';
import { getInterpretedFile } from './interpret-files';
import { validateConfigurationFiles } from './validate-configuration-files';

export async function loadMainConfig({
  configDir = '.storybook',
  cwd,
  skipCache,
}: {
  configDir: string;
  cwd?: string;
  skipCache?: boolean;
}): Promise<StorybookConfig> {
  await validateConfigurationFiles(configDir, cwd);

  const mainPath = getInterpretedFile(resolve(configDir, 'main')) as string;

  try {
    const out = await importModule(mainPath, { skipCache });
    return out;
  } catch (e) {
    if (!(e instanceof Error)) {
      throw e;
    }
    if (e.message.includes('not defined in ES module scope')) {
      logger.info(
        'Loading main config failed as the file does not seem to be valid ESM. Trying a temporary fix, please ensure the main config is valid ESM.'
      );
      const comment =
        '// end of Storybook 10 migration assistant header, you can delete the above code';
      const content = await readFile(mainPath, 'utf-8');

      if (!content.includes(comment)) {
        const header = dedent`
          import { createRequire } from "node:module";
          import { dirname } from "node:path";
          import { fileURLToPath } from "node:url";
    
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = dirname(__filename);
          const require = createRequire(import.meta.url);
        `;

        const { ext, name, dir } = parse(mainPath);
        const modifiedMainPath = join(dir, `${name}.tmp.${ext}`);
        await writeFile(modifiedMainPath, [header, comment, content].join('\n\n'));
        let out;
        try {
          out = await importModule(modifiedMainPath);
        } finally {
          await rm(modifiedMainPath);
        }
        return out;
      }
    }

    throw new MainFileEvaluationError({
      location: relative(process.cwd(), mainPath),
      error: e,
    });
  }
}
