import { readFile, rm, writeFile } from 'node:fs/promises';
import { join, parse, relative, resolve } from 'node:path';

import { logger } from 'storybook/internal/node-logger';
import {
  ConfigValidationError,
  MainFileEvaluationError,
  StorybookError,
} from 'storybook/internal/server-errors';
import type { StorybookConfig } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { importModule } from '../../shared/utils/module.ts';
import { validateStorybookConfig } from './validate-storybook-config.ts';
import { getInterpretedFile } from './interpret-files.ts';
import { validateConfigurationFiles } from './validate-configuration-files.ts';

export async function loadMainConfig({
  configDir = '.storybook',
  cwd,
  skipCache,
  strict,
}: {
  configDir: string;
  cwd?: string;
  skipCache?: boolean;
  /**
   * Enable strict validation of Storybook config.
   * When enabled, config properties are validated against the expected types.
   * Default: false (for backward compatibility)
   */
  strict?: boolean;
}): Promise<StorybookConfig> {
  await validateConfigurationFiles(configDir, cwd);

  const mainPath = getInterpretedFile(resolve(configDir, 'main')) as string;

  try {
    const out = await importModule(mainPath, { skipCache });
    
    // Validate config if strict mode is enabled or env var is set
    const enableStrictValidation = strict ?? process.env.STORYBOOK_STRICT_CONFIG === 'true';
    if (enableStrictValidation) {
      const validationErrors = validateStorybookConfig(out, true);
      if (validationErrors.length > 0) {
        throw new ConfigValidationError({
          location: relative(process.cwd(), mainPath),
          errors: validationErrors,
        });
      }
    }
    
    return out;
  } catch (e) {
    // Re-throw StorybookError subclasses as-is
    if (e instanceof StorybookError) {
      throw e;
    }
    
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
