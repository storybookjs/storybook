import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = join(import.meta.dirname, '../../../..');
const TYPESCRIPT_PEERS = [
  'code/frameworks/angular/package.json',
  'code/frameworks/angular-vite/package.json',
  'code/frameworks/react-vite/package.json',
  'code/frameworks/react-webpack5/package.json',
  'code/frameworks/svelte-vite/package.json',
  'code/frameworks/vue3-vite/package.json',
  'code/renderers/react/package.json',
  'code/renderers/svelte/package.json',
  'code/renderers/vue3/package.json',
];

describe('TypeScript support policy', () => {
  it('requires TypeScript 5.9 from every affected framework and renderer', () => {
    for (const packagePath of TYPESCRIPT_PEERS) {
      expect(readFileSync(join(REPOSITORY_ROOT, packagePath), 'utf-8')).toMatch(
        /"peerDependencies":\s*\{[\s\S]*?"typescript": ">= 5\.9\.0"/
      );
    }
  });
});
