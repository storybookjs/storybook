import { extname } from 'node:path';

import { findConfigFile } from '../../common/utils/get-storybook-info.ts';
import { isCsfFactoryPreview, readConfig } from '../../csf-tools/index.ts';
import type { AIInstructionContext, Options } from '../../types/index.ts';

export async function resolveAIInstructions(
  options: Options,
  framework: string,
  context?: AIInstructionContext
) {
  if (!context) {
    const configDir = options.configDir;
    const previewFile = findConfigFile('preview', configDir);
    const configFile = previewFile ?? findConfigFile('main', configDir);
    context = {
      framework,
      configDir,
      language: configFile && /\.[cm]?jsx?$/.test(extname(configFile)) ? 'js' : 'ts',
      hasCsfFactoryPreview: previewFile
        ? isCsfFactoryPreview(await readConfig(previewFile))
        : false,
    };
  }
  return options.presets.apply('experimental_aiInstructions', {}, { aiContext: context });
}
