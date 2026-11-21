/*
This script updates `lib/*.js` files from rule's meta data.
*/
import fs from 'fs/promises';
import path from 'path';

import { update as updateLegacyConfigs } from './update-lib-configs.ts';
import { update as updateFlatConfigs } from './update-lib-flat-configs.ts';
import { update as updateIndex } from './update-lib-index.ts';

const ROOT_CONFIG_DIR = path.resolve(__dirname, '../src/configs/');

async function run() {
  // cleanup generated configs while preserving test files
  const entries = await fs.readdir(ROOT_CONFIG_DIR, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name.endsWith('.test-d.ts')) {
      continue;
    }
    await fs.rm(path.join(ROOT_CONFIG_DIR, entry.name), { recursive: true, force: true });
  }

  // updates
  await updateLegacyConfigs();
  await updateFlatConfigs();
  await updateIndex();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
