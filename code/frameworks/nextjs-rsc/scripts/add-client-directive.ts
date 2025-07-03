import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function addClientDirective(path: string) {
  const filePath = resolve(path);
  const content = await readFile(filePath, 'utf8');

  if (!content.startsWith("'use client';")) {
    await writeFile(filePath, `'use client';\n${content}`);
  }
}

addClientDirective('./dist/client.mjs');
addClientDirective('./dist/images/next-image.mjs');
