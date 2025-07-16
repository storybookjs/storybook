/*
This script updates `lib/*.js` files from rule's meta data.
*/
import fs from 'node:fs/promises';
import path from 'node:path';

import { update as updateLegacyConfigs } from './update-lib-configs';
import { update as updateFlatConfigs } from './update-lib-flat-configs';
import { update as updateIndex } from './update-lib-index';

const ROOT_CONFIG_DIR = path.resolve(import.meta.dirname, '../src/configs/');

async function run() {
  // cleanup
  await fs.rm(ROOT_CONFIG_DIR, { recursive: true });

  // updates
  await updateLegacyConfigs();
  await updateFlatConfigs();
  await updateIndex();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
