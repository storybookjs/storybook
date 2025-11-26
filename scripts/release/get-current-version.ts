import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { setOutput } from '@actions/core';
import picocolors from 'picocolors';

import { esMain } from '../utils/esmain';

const CODE_DIR_PATH = join(__dirname, '..', '..');
const CODE_PACKAGE_JSON_PATH = join(CODE_DIR_PATH, 'package.json');

export const getCurrentVersion = async () => {
  console.log(`📐 Reading current version of Storybook...`);
  const content = await readFile(CODE_PACKAGE_JSON_PATH, 'utf8');
  const { version } = JSON.parse(content) as { version: string };
  if (process.env.GITHUB_ACTIONS === 'true') {
    setOutput('current-version', version);
  }
  console.log(`📦 Current version is ${picocolors.green(version)}`);
  return version;
};

if (esMain(import.meta.url)) {
  getCurrentVersion().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
