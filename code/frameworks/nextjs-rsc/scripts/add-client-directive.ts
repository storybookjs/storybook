import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function addClientDirective() {
  const filePath = resolve('./dist/client.mjs');
  const content = await readFile(filePath, 'utf8');

  if (!content.startsWith("'use client';")) {
    await writeFile(filePath, `'use client';\n${content}`);
  }
}

addClientDirective();
