// @vitest-environment node
import { mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { buildDocgenPayload } from './build-docgen.ts';
import { SvelteComponentMetaManager } from './component-meta/svelte-project-manager.ts';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const payloadFor = (importPath: string) =>
  buildDocgenPayload(
    {
      entry: {
        id: 'button--primary',
        name: 'Primary',
        title: 'Button',
        type: 'story',
        subtype: 'story',
        importPath,
        tags: [],
      },
    },
    { componentMetaManager: new SvelteComponentMetaManager() }
  );

it('documents the subcomponents a meta lists', async () => {
  const payload = await payloadFor(join(fixtures, 'subcomponents/svelte-csf.stories.svelte'));
  expect(payload?.subcomponents?.Icon).toMatchObject({
    name: 'Icon',
    argTypes: { name: { name: 'name', type: { name: 'string', required: true } } },
  });
  expect(payload?.subcomponents?.Icon?.path).toBe(
    join(fixtures, 'subcomponents/Icon.svelte').replaceAll('\\', '/')
  );
});

it('gives a subcomponent a path inside a symlinked story folder', async () => {
  const linked = join(mkdtempSync(join(tmpdir(), 'svelte-docgen-')), 'stories');
  symlinkSync(join(fixtures, 'subcomponents'), linked, 'junction');

  const payload = await payloadFor(join(linked, 'svelte-csf.stories.svelte'));

  expect(payload?.subcomponents?.Icon?.path).toBe(
    join(linked, 'Icon.svelte').replaceAll('\\', '/')
  );
});
