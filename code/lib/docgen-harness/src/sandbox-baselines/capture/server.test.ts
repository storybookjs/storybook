import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { captureServer } from './server.ts';

it('records indexed stories without static snippets as null and excludes test entries', () => {
  const root = mkdtempSync(join(tmpdir(), 'server-capture-'));
  const staticDir = join(root, 'storybook-static');
  try {
    for (const service of ['docgen', 'story-docs'])
      mkdirSync(join(staticDir, 'services/core', service), { recursive: true });
    const story = {
      type: 'story',
      title: 'Button',
      importPath: './Button.stories.ts',
      name: 'Primary',
    };
    writeFileSync(
      join(staticDir, 'index.json'),
      JSON.stringify({
        entries: {
          primary: { ...story, id: 'button--primary' },
          missing: { ...story, id: 'button--missing' },
          test: { ...story, id: 'button--test', subtype: 'test' },
        },
      })
    );
    writeFileSync(
      join(staticDir, 'services/core/docgen/button.json'),
      JSON.stringify({
        components: {
          button: { id: 'button', name: 'Button', path: root + '/Button.svelte', argTypes: {} },
        },
      })
    );
    writeFileSync(
      join(staticDir, 'services/core/story-docs/button.json'),
      JSON.stringify({
        components: {
          button: { stories: { 'button--primary': { snippet: '<Button primary />' } } },
        },
      })
    );
    expect(captureServer(staticDir)).toEqual({
      button: {
        id: 'button',
        name: 'Button',
        description: undefined,
        argTypes: {},
        stories: {
          'button--primary': { snippet: '<Button primary />' },
          'button--missing': { snippet: null },
        },
      },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
