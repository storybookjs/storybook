```js filename="my-addon/src/preset.js" renderer="common" language="js"
import { writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';

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
    // Reject paths that resolve outside the project
    const root = getProjectRoot();
    const target = resolve(root, file);
    const fromRoot = relative(root, target);
    if (isAbsolute(fromRoot) || fromRoot.split(sep)[0] === '..') {
      return;
    }
    await writeFile(target, notes);
  });

  return channel;
};
```

```ts filename="my-addon/src/preset.ts" renderer="common" language="ts"
import { writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import type { Channel } from 'storybook/internal/channels';
import { getProjectRoot } from 'storybook/internal/common';

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
    // Reject paths that resolve outside the project
    const root = getProjectRoot();
    const target = resolve(root, file);
    const fromRoot = relative(root, target);
    if (isAbsolute(fromRoot) || fromRoot.split(sep)[0] === '..') {
      return;
    }
    await writeFile(target, notes);
  });

  return channel;
};
```
