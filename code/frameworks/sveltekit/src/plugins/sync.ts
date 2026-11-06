import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolvePackageDir } from 'storybook/internal/common';

import type { Plugin } from 'vite';

export function syncSvelteKit() {
  return {
    name: 'storybook:sveltekit-sync',
    apply: 'build',
    // Builds need the files that `svelte-kit sync` writes, such as `$app/tsconfig`. SvelteKit's
    // compile plugin writes them, but Storybook removes that plugin
    configResolved({ root }) {
      const kitDir = resolvePackageDir(
        '@sveltejs/kit',
        pathToFileURL(join(root, 'package.json')).href
      );
      const { bin } = JSON.parse(readFileSync(join(kitDir, 'package.json'), 'utf-8'));
      execFileSync(process.execPath, [join(kitDir, bin['svelte-kit']), 'sync'], {
        cwd: root,
        stdio: 'pipe',
      });
    },
  } satisfies Plugin;
}
