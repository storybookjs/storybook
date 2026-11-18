// @vitest-environment node
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

import { dirname, join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/node-logger';

import { createDocgenCache, generateDocgen } from '../svelte2tsx/generate-docgen.ts';
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

describe('library props in the server docgen', () => {
  const docgenOf = (files: Record<string, string>, path: string) => {
    const root = project({ 'tsconfig.json': TSCONFIG, ...files });
    return new SvelteComponentMetaManager().generateDocgen(join(root, path), { server: true });
  };

  it('drops the attribute props of a union of library types, as `WithoutChild<CalendarRootProps>` gives', () => {
    const docgen = docgenOf(
      {
        'src/lib.d.ts': `import type { HTMLAttributes } from 'svelte/elements';\ntype Div = Omit<HTMLAttributes<HTMLDivElement>, 'children'>;\ntype Snippets = { child?: () => void };\nexport type RootProps = ({ type: 'single'; value?: string } & Snippets & Div) | ({ type: 'multiple'; value?: string[] } & Snippets & Div);\n`,
        // shadcn-svelte's helper, which distributes over the union.
        'src/utils.ts': `export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;\n`,
        'src/Calendar.svelte': `<script lang="ts">\n  import type { RootProps } from './lib';\n  import type { WithoutChild } from './utils';\n  let { ...rest }: WithoutChild<RootProps> = $props();\n</script>\n`,
      },
      'src/Calendar.svelte'
    );

    expect(docgen.props.map((prop) => prop.name)).toEqual(['type', 'value']);
    expect(docgen.omittedTypes).toMatchInlineSnapshot(`
      [
        "(Omit<{ type: "single"; value?: string | undefined; } & Snippets & Div, "child"> | Omit<{ type: "multiple"; value?: string[] | undefined; } & Snippets & Div, "child">)",
      ]
    `);
  });

  it('reads the type params of a Svelte 4 `$$Generic`', () => {
    const root = project({
      'tsconfig.json': TSCONFIG,
      'src/List.svelte': `<script lang="ts">\n  type T = $$Generic<string>;\n  export let items: T[] = [];\n</script>\n`,
    });
    const path = join(root, 'src/List.svelte');
    const docgen = new SvelteComponentMetaManager().generateDocgen(path, {
      server: true,
      documentationSource: readFileSync(path, 'utf8'),
    });

    expect(docgen.typeParams).toBe('T extends string');
  });
});

describe('SvelteComponentMetaManager batches', () => {
  const outsideTsconfig = () => {
    const root = project({
      'tsconfig.json': TSCONFIG,
      'src/Button.svelte': component('{ label: string }'),
      'other/Alert.svelte': component('{ title: string }'),
      'other/Badge.svelte': component('{ count: number }'),
      'other/Chip.svelte': component('{ tone: string }'),
    });
    return ['Alert', 'Badge', 'Chip'].map((name) => join(root, `other/${name}.svelte`));
  };

  it('gives the project every component of a batch in one call at its first extraction', () => {
    const paths = outsideTsconfig();
    const componentMetaManager = new SvelteComponentMetaManager();
    const batchFiles = componentMetaManager.groupFilesByProject(paths);
    const [project] = batchFiles.keys();
    const ensureFiles = vi.spyOn(project, 'ensureFiles');

    const first = componentMetaManager.generateDocgen(paths[0], { server: true }, batchFiles);

    expect(ensureFiles).toHaveBeenNthCalledWith(1, paths);
    expect(paths.map((path) => project.hasSourceFile(path))).toEqual([true, true, true]);
    expect(first.props.map((prop) => prop.name)).toEqual(['title']);
    expect(
      paths
        .slice(1)
        .map((path) =>
          componentMetaManager
            .generateDocgen(path, { server: true }, batchFiles)
            .props.map((prop) => prop.name)
        )
    ).toEqual([['count'], ['tone']]);
  });

  describe('under heap pressure', () => {
    beforeEach(() => {
      vi.spyOn(once, 'warn').mockImplementation(() => undefined);
      vi.spyOn(process, 'memoryUsage').mockReturnValueOnce({
        heapUsed: Number.POSITIVE_INFINITY,
      } as NodeJS.MemoryUsage);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('drops the batch when recycling its projects', () => {
      const paths = outsideTsconfig();
      const componentMetaManager = new SvelteComponentMetaManager();
      const batchFiles = componentMetaManager.groupFilesByProject(paths);

      componentMetaManager.generateDocgen(paths[0], { server: true }, batchFiles);

      expect(batchFiles.size).toBe(0);
    });
  });
});

describe('server docgen in declaration order', () => {
  it('lists union members and props as declared, whatever the program extracted before', () => {
    const root = project({
      'tsconfig.json': TSCONFIG,
      'src/Sizes.svelte': component(`{ size?: 'sm' | 'md' | 'lg'; tone?: 'quiet' | 'loud' }`),
      'src/Avatar.svelte': `<script lang="ts">
  interface Base { label?: string; tone?: 'loud' | 'quiet'; ring?: 'thin' | 'thick' }
  type Props = Omit<Base, 'label'> & { size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; count?: 3 | 1 | 2 };
  let { ...rest }: Props = $props();
</script>
`,
    });
    const avatar = join(root, 'src/Avatar.svelte');
    const shared = new SvelteComponentMetaManager();
    shared.generateDocgen(join(root, 'src/Sizes.svelte'), { server: true });

    const afterSizes = shared.generateDocgen(avatar, { server: true });
    const alone = new SvelteComponentMetaManager().generateDocgen(avatar, { server: true });

    expect(afterSizes).toEqual(alone);
    expect(afterSizes.props.map(({ name, typeText }) => `${name}: ${typeText}`))
      .toMatchInlineSnapshot(`
        [
          "tone: "loud" | "quiet" | undefined",
          "ring: "thin" | "thick" | undefined",
          "size: "xs" | "sm" | "md" | "lg" | "xl" | undefined",
          "count: 3 | 1 | 2 | undefined",
        ]
      `);
  });

  it('lists the members a prop reads through keys, elements, aliases and enums as declared', () => {
    const root = project({
      'tsconfig.json': TSCONFIG,
      'src/tone.ts': `export enum Tone { Warn = 'warn', Info = 'info' }\n`,
      'src/Warmup.svelte': component(
        `{ size?: 'sm' | 'xl' | 'md'; tone?: 'loud' | 'quiet'; placement?: 'bottom-end' | 'top-start'; status?: 'custom' }`
      ),
      'src/Computed.svelte': `<script lang="ts">
  import type { Tone } from './tone';
  type Side = 'top' | 'bottom';
  const sizes = { md: 1, xl: 2, sm: 3 } as const;
  const tones = ['quiet', 'loud'] as const;
  let { ...rest }: {
    size?: keyof typeof sizes;
    tone?: (typeof tones)[number];
    placement?: Side | \`\${Side}-\${'start' | 'end'}\`;
    status?: Tone | 'custom';
  } = $props();
</script>
`,
    });
    const computed = join(root, 'src/Computed.svelte');
    const shared = new SvelteComponentMetaManager();
    shared.generateDocgen(join(root, 'src/Warmup.svelte'), { server: true });

    const afterWarmup = shared.generateDocgen(computed, { server: true });
    const alone = new SvelteComponentMetaManager().generateDocgen(computed, { server: true });

    expect(afterWarmup).toEqual(alone);
    expect(afterWarmup.props.map(({ name, typeText }) => `${name}: ${typeText}`))
      .toMatchInlineSnapshot(`
        [
          "size: "md" | "xl" | "sm" | undefined",
          "tone: "quiet" | "loud" | undefined",
          "placement: Side | "top-start" | "top-end" | "bottom-start" | "bottom-end" | undefined",
          "status: Tone | "custom" | undefined",
        ]
      `);
  });
});

describe('legacy docgen', () => {
  it('keeps union members and props in the order the checker prints them', () => {
    const root = project({
      'tsconfig.json': TSCONFIG,
      'src/Placement.svelte': `<script lang="ts">
  type Side = 'top' | 'bottom';
  let { ...rest }: { early?: 'top' | 'left'; placement?: 'left' | Side } = $props();
</script>
`,
    });

    const docgen = generateDocgen(join(root, 'src/Placement.svelte'), createDocgenCache());

    expect(docgen.props.map(({ name, typeText }) => `${name}: ${typeText}`)).toMatchInlineSnapshot(`
      [
        "early: "top" | "left" | undefined",
        "placement: "left" | Side | undefined",
      ]
    `);
  });
});
