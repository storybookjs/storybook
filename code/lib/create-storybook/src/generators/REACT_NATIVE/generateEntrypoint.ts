import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SupportedLanguage } from 'storybook/internal/types';

const ENTRYPOINT_TEMPLATE_DIR = join(
  dirname(fileURLToPath(import.meta.resolve('create-storybook/package.json'))),
  'templates',
  'react-native'
);
const RN_STORYBOOK_DIR = '.rnstorybook';

export const getEntrypointExtension = (language: SupportedLanguage) => {
  return language === SupportedLanguage.TYPESCRIPT ? 'ts' : 'js';
};

export const getEntrypointTemplatePath = () => {
  return join(ENTRYPOINT_TEMPLATE_DIR, 'index.js');
};

export const generateReactNativeEntrypoint = async ({
  language,
  cwd = process.cwd(),
}: {
  language: SupportedLanguage;
  cwd?: string;
}) => {
  const extension = getEntrypointExtension(language);
  const templatePath = getEntrypointTemplatePath();
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
