import { readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import { MainFileEvaluationError } from 'storybook/internal/server-errors';
import type { StorybookConfig } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { importModule } from '../../shared/utils/module';
import { getInterpretedFile } from './interpret-files';
import { validateConfigurationFiles } from './validate-configuration-files';

export async function loadMainConfig({
  configDir = '.storybook',
  cwd,
}: {
  configDir: string;
  cwd?: string;
}): Promise<StorybookConfig> {
  await validateConfigurationFiles(configDir, cwd);

  const mainPath = getInterpretedFile(resolve(configDir, 'main')) as string;

  try {
    const out = await importModule(mainPath);
    return out;
  } catch (e) {
    if (!(e instanceof Error)) {
      throw e;
    }
    if (e.message.includes('require is not defined')) {
      const header = dedent`
      import { createRequire } from "node:module";
      import { dirname } from "node:path";
      import { fileURLToPath } from "node:url";

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const require = createRequire(import.meta.url);
      // end of storybook 10 migration assistant header, you can delete the above code
    `;
      const content = await readFile(mainPath, 'utf-8');
      await writeFile(mainPath, [header, content].join('\n\n'));
      return loadMainConfig({ configDir, cwd });
    }

    throw new MainFileEvaluationError({
      location: relative(process.cwd(), mainPath),
      error: e,
    });
  }
}
