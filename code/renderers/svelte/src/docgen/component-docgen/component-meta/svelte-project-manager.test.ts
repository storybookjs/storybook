// @vitest-environment node
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

import { dirname, join } from 'pathe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SvelteComponentMetaManager } from './svelte-project-manager.ts';

const require = createRequire(import.meta.url);

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

// Real files: TypeScript reads the disk through its own `fs`. `svelte` is linked in so svelte2tsx
// output resolves its imports.
function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'svelte-component-meta-'));
  roots.push(root);
  mkdirSync(join(root, 'node_modules'));
  symlinkSync(
    dirname(require.resolve('svelte/package.json')),
    join(root, 'node_modules', 'svelte'),
    'junction'
  );
  for (const [path, content] of Object.entries(files)) {
    write(join(root, path), content);
  }
  return root;
}

let tick = 0;
// Each write gets an mtime of its own, so a save inside the same millisecond still counts.
function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  const time = new Date(Date.now() + ++tick * 1000);
  utimesSync(path, time, time);
}

const component = (props: string) =>
  `<script lang="ts">\n  let { ...rest }: ${props} = $props();\n</script>\n`;

const TSCONFIG = JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] });

const propNames = (componentMetaManager: SvelteComponentMetaManager, path: string) =>
  componentMetaManager.generateDocgen(path, { server: true }).props.map((prop) => prop.name);

describe('SvelteComponentMetaManager', () => {
  it('documents a save the file watcher has not reported yet', () => {
    const root = project({
      'tsconfig.json': TSCONFIG,
      'src/Button.svelte': component('{ label: string }'),
    });
    const componentMetaManager = new SvelteComponentMetaManager();
    const button = join(root, 'src/Button.svelte');
    expect(propNames(componentMetaManager, button)).toEqual(['label']);

    write(button, component('{ label: string; size: string }'));

    expect(propNames(componentMetaManager, button)).toEqual(['label', 'size']);
  });

  it('documents a changed type file once the file watcher reports it', () => {
    const root = project({
      'tsconfig.json': TSCONFIG,
      'src/types.ts': 'export interface Props { label: string }\n',
      'src/Button.svelte': `<script lang="ts">\n  import type { Props } from './types';\n  let { ...rest }: Props = $props();\n</script>\n`,
    });
    const componentMetaManager = new SvelteComponentMetaManager();
    const button = join(root, 'src/Button.svelte');
    expect(propNames(componentMetaManager, button)).toEqual(['label']);

    const types = join(root, 'src/types.ts');
    write(types, 'export interface Props { label: string; size: string }\n');
    componentMetaManager.onFilesChanged([{ filePath: types, type: 'changed' }]);

    expect(propNames(componentMetaManager, button)).toEqual(['label', 'size']);
  });

  it('documents a component created after its program was built with its tsconfig', () => {
    const root = project({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { strict: true, paths: { '#types': ['./src/types.ts'] } },
        include: ['src'],
      }),
      'src/types.ts': 'export interface IconProps { name: string }\n',
      'src/Button.svelte': component('{ label: string }'),
    });
    const componentMetaManager = new SvelteComponentMetaManager();
    expect(propNames(componentMetaManager, join(root, 'src/Button.svelte'))).toEqual(['label']);

    const icon = join(root, 'src/Icon.svelte');
    write(
      icon,
      `<script lang="ts">\n  import type { IconProps } from '#types';\n  let { ...rest }: IconProps = $props();\n</script>\n`
    );
    componentMetaManager.onFilesChanged([{ filePath: icon, type: 'created' }]);

    expect(propNames(componentMetaManager, icon)).toEqual(['name']);
  });

  it.each(['created', 'deleted and created again'])(
    'resolves a type import once its file is %s',
    (action) => {
      const root = project({
        'tsconfig.json': TSCONFIG,
        ...(action === 'created'
          ? {}
          : { 'src/types.ts': 'export interface Props { old: string }\n' }),
        'src/Button.svelte': `<script lang="ts">\n  import type { Props } from './types';\n  let { ...rest }: Props = $props();\n</script>\n`,
      });
      const componentMetaManager = new SvelteComponentMetaManager();
      const button = join(root, 'src/Button.svelte');
      const types = join(root, 'src/types.ts');
      propNames(componentMetaManager, button);
      if (action !== 'created') {
        unlinkSync(types);
        componentMetaManager.onFilesChanged([{ filePath: types, type: 'deleted' }]);
        expect(propNames(componentMetaManager, button)).toEqual([]);
      }

      write(types, 'export interface Props { label: string }\n');
      componentMetaManager.onFilesChanged([{ filePath: types, type: 'created' }]);

      expect(propNames(componentMetaManager, button)).toEqual(['label']);
    }
  );

  it('documents a component through a solution-style tsconfig and its references', () => {
    const root = project({
      'tsconfig.json': JSON.stringify({ files: [], references: [{ path: './tsconfig.app.json' }] }),
      'tsconfig.app.json': JSON.stringify({
        compilerOptions: { strict: true, paths: { '#types': ['./src/types.ts'] } },
        include: ['src'],
      }),
      'src/types.ts': 'export interface IconProps { name: string }\n',
      'src/Icon.svelte': `<script lang="ts">\n  import type { IconProps } from '#types';\n  let { ...rest }: IconProps = $props();\n</script>\n`,
    });
    const componentMetaManager = new SvelteComponentMetaManager();

    expect(propNames(componentMetaManager, join(root, 'src/Icon.svelte'))).toEqual(['name']);
  });

  it('watches a type file outside the tsconfig directory once the component is documented', async () => {
    const root = project({
      'packages/shared/package.json': '{ "name": "shared" }',
      'packages/shared/types.ts': 'export interface Props { label: string }\n',
      'packages/app/tsconfig.json': JSON.stringify({
        compilerOptions: { strict: true, paths: { '#shared': ['../shared/types.ts'] } },
        include: ['src'],
      }),
      'packages/app/src/Button.svelte': `<script lang="ts">\n  import type { Props } from '#shared';\n  let { ...rest }: Props = $props();\n</script>\n`,
    });
    const componentMetaManager = new SvelteComponentMetaManager();
    componentMetaManager.startWatching();
    try {
      const button = join(root, 'packages/app/src/Button.svelte');
      expect(propNames(componentMetaManager, button)).toEqual(['label']);

      write(
        join(root, 'packages/shared/types.ts'),
        'export interface Props { label: string; size: string }\n'
      );

      await vi.waitFor(
        () => expect(propNames(componentMetaManager, button)).toEqual(['label', 'size']),
        {
          timeout: 3000,
        }
      );
    } finally {
      componentMetaManager.dispose();
    }
  });

  it('documents a component its tsconfig does not include', () => {
    const root = project({
      'tsconfig.json': TSCONFIG,
      'src/Button.svelte': component('{ label: string }'),
      'other/Outside.svelte': component('{ title: string }'),
    });
    const componentMetaManager = new SvelteComponentMetaManager();

    expect(propNames(componentMetaManager, join(root, 'other/Outside.svelte'))).toEqual(['title']);
  });

  it('documents a component in a project without a tsconfig', () => {
    const root = project({ 'src/Button.svelte': component('{ label: string }') });
    const componentMetaManager = new SvelteComponentMetaManager();

    expect(propNames(componentMetaManager, join(root, 'src/Button.svelte'))).toEqual(['label']);
  });
});
