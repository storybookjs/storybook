```js filename="my-addon/src/preset.js" renderer="common" language="js"
import { lstat, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { EVENTS } from './constants';

export const experimental_serverChannel = async (channel) => {
  channel.on(EVENTS.SAVE_NOTES, async (payload) => {
    const { file, notes } = payload ?? {};
    if (typeof file !== 'string' || typeof notes !== 'string') {
      return;
    }
    // Only write the addon's own files
    if (!file.endsWith('.notes.md')) {
      return;
    }
    try {
      // Follow symlinked directories, then reject paths outside the project
      const root = await realpath(getProjectRoot());
      const target = resolve(root, file);
      const realTarget = join(await realpath(dirname(target)), basename(target));
      const fromRoot = relative(root, realTarget);
      if (isAbsolute(fromRoot) || fromRoot.split(sep)[0] === '..') {
        return;
      }
      // A symlinked notes file could still point anywhere
      const stats = await lstat(realTarget).catch(() => null);
      if (stats?.isSymbolicLink()) {
        return;
      }
      await writeFile(realTarget, notes);
    } catch (error) {
      logger.error(`Could not save notes to ${file}: ${error}`);
    }
  });

  return channel;
};
```

```ts filename="my-addon/src/preset.ts" renderer="common" language="ts"
import { lstat, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import type { Channel } from 'storybook/internal/channels';
import { getProjectRoot } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { EVENTS } from './constants';

export const experimental_serverChannel = async (channel: Channel) => {
  channel.on(EVENTS.SAVE_NOTES, async (payload: unknown) => {
    const { file, notes } = (payload ?? {}) as { file?: unknown; notes?: unknown };
    if (typeof file !== 'string' || typeof notes !== 'string') {
      return;
    }
    // Only write the addon's own files
    if (!file.endsWith('.notes.md')) {
      return;
    }
    try {
      // Follow symlinked directories, then reject paths outside the project
      const root = await realpath(getProjectRoot());
      const target = resolve(root, file);
      const realTarget = join(await realpath(dirname(target)), basename(target));
      const fromRoot = relative(root, realTarget);
      if (isAbsolute(fromRoot) || fromRoot.split(sep)[0] === '..') {
        return;
      }
      // A symlinked notes file could still point anywhere
      const stats = await lstat(realTarget).catch(() => null);
      if (stats?.isSymbolicLink()) {
        return;
      }
      await writeFile(realTarget, notes);
    } catch (error) {
      logger.error(`Could not save notes to ${file}: ${error}`);
    }
  });

  return channel;
};
```
