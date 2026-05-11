import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RN_STORYBOOK_DIR } from '../../../../../core/src/shared/constants/config-folder.ts';
import { SupportedLanguage } from 'storybook/internal/types';

const ENTRYPOINT_TEMPLATE_DIR = join(
  dirname(fileURLToPath(import.meta.resolve('create-storybook/package.json'))),
  'templates',
  'react-native'
);

export type ReactNativeEntrypointTemplateVariant = 'default' | 'expo';

export const getEntrypointExtension = (language: SupportedLanguage) => {
  return language === SupportedLanguage.TYPESCRIPT ? 'ts' : 'js';
};

export const getEntrypointTemplatePath = (
  templateVariant: ReactNativeEntrypointTemplateVariant = 'default'
) => {
  const templateFileName = templateVariant === 'expo' ? 'index.expo.js' : 'index.js';
  return join(ENTRYPOINT_TEMPLATE_DIR, templateFileName);
};

export const generateReactNativeEntrypoint = async ({
  language,
  templateVariant = 'default',
  cwd = process.cwd(),
}: {
  language: SupportedLanguage;
  templateVariant?: ReactNativeEntrypointTemplateVariant;
  cwd?: string;
}) => {
  const extension = getEntrypointExtension(language);
  const templatePath = getEntrypointTemplatePath(templateVariant);
  const targetDir = path.join(cwd, RN_STORYBOOK_DIR);
  const targetPath = path.join(targetDir, `index.${extension}`);

  const templateContents = await readFile(templatePath, 'utf-8');

  await mkdir(targetDir, { recursive: true });
  await writeFile(targetPath, templateContents, 'utf-8');

  return {
    targetPath,
    extension,
  };
};
