import * as path from 'node:path';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/node-logger';
import type { IndexEntry } from 'storybook/internal/types';
import { dedent } from 'ts-dedent';

import { ComponentMetaManager } from '../componentManifest/componentMeta/ComponentMetaManager.ts';
import type { ComponentDoc } from '../componentManifest/componentMeta/componentMetaExtractor.ts';
import {
  cleanup,
  createTempDir,
  tsconfigJSON,
  writeFiles,
} from '../componentManifest/componentMeta/test-helpers.ts';
import { resolveStoryFileComponents } from '../componentManifest/resolveComponents.ts';
import { loadTestTypeScript } from '@storybook/component-meta-typescript/testing';
import {
  buildDocgenPayload,
  buildDocgenPayloads,
  extractArgTypesFromComponentMeta,
} from './buildDocgen.ts';

vi.mock('../componentManifest/resolveComponents.ts', { spy: true });

const typescript = await loadTestTypeScript();

let tempDir: string | undefined;
let componentMetaManager: ComponentMetaManager | undefined;

function makeStoryIndexEntry(importPath: string, title: string): IndexEntry {
  const componentId = title.split('/').at(-1)!.replace(/\s+/g, '').toLowerCase();
  return {
    id: `${componentId}--primary`,
    name: 'Primary',
    title,
    type: 'story',
    subtype: 'story',
    importPath,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  componentMetaManager?.dispose();
  componentMetaManager = undefined;
  if (tempDir) {
    cleanup(tempDir);
    tempDir = undefined;
  }
});

describe('buildDocgenPayload', () => {
  it(
    'extracts name, description, props, argTypes, and a snippet for one component',
    { timeout: 30_000 },
    async () => {
      tempDir = createTempDir('docgen-build');

      const files = writeFiles(tempDir, {
        'tsconfig.json': tsconfigJSON(),
        'Button.tsx': dedent`
          import React from 'react';
          /**
           * A clickable button.
           * @summary The primary action button.
           */
          export const Button = (_props: { label: string; disabled?: boolean }) => <button />;
        `,
        'Button.stories.tsx': dedent`
          import { Button } from './Button';
          export default { component: Button, title: 'Forms/Button' };
          export const Primary = () => <Button label="hi" />;
        `,
      });

      componentMetaManager = new ComponentMetaManager(typescript);
      const importPath = files['Button.stories.tsx'];

      const payload = await buildDocgenPayload(
        { entry: makeStoryIndexEntry(importPath, 'Forms/Button') },
        {
          componentMetaManager,
          resolvePath: (p) => (path.isAbsolute(p) ? p : path.join(tempDir!, p)),
        }
      );

      expect(payload).toBeDefined();
      expect(payload!.id).toBe('button');
      expect(payload!.name).toBe('Button');
      expect(payload!.path).toBe(importPath);
      expect(payload!.description).toContain('clickable button');
      expect(payload!.summary).toBe('The primary action button.');
      const meta = payload!.reactComponentMeta as ComponentDoc | undefined;
      expect(Object.keys(meta?.props ?? {}).sort()).toEqual(['disabled', 'label']);
      expect(meta?.props.label.required).toBe(true);
      expect(payload!.argTypes?.label).toMatchObject({
        name: 'label',
        type: { name: 'string', required: true },
      });
      expect(payload!.argTypes?.disabled).toMatchObject({
        name: 'disabled',
        type: { name: 'boolean', required: false },
      });
    }
  );

  it(
    'preserves inherited callback parameter and return descriptions in argTypes',
    { timeout: 30_000 },
    async () => {
      tempDir = createTempDir('docgen-build');

      const files = writeFiles(tempDir, {
        'tsconfig.json': tsconfigJSON(),
        'Button.tsx': dedent`
        import React from 'react';
        interface Callbacks {
          /**
           * Called when the value changes.
           * @param {string} value - The new value.
           * @param {boolean} committed - Whether the change is final.
           * @returns {boolean} Whether the change was accepted.
           */
          onChange: (value: string, committed: boolean) => boolean;
          /**
           * Called when the value resets.
           * @param {React.SyntheticEvent} event React's original event.
           * @returns {void}
           */
          onReset: (event: React.SyntheticEvent) => void;
        }
        interface ButtonProps extends Callbacks {
          /** The button label. */
          label: string;
        }
        export const Button = (_props: ButtonProps) => <button />;
      `,
        'Button.stories.tsx': dedent`
        import { Button } from './Button';
        export default { component: Button, title: 'Forms/Button' };
        export const Primary = {};
      `,
      });

      componentMetaManager = new ComponentMetaManager(typescript);
      const payload = await buildDocgenPayload(
        { entry: makeStoryIndexEntry(files['Button.stories.tsx'], 'Forms/Button') },
        {
          componentMetaManager,
          resolvePath: (p) => (path.isAbsolute(p) ? p : path.join(tempDir!, p)),
        }
      );

      expect(payload?.argTypes?.onChange).toMatchObject({
        description: 'Called when the value changes.',
        table: {
          jsDocTags: {
            params: [
              { name: 'value', description: 'The new value.' },
              { name: 'committed', description: 'Whether the change is final.' },
            ],
            returns: { description: 'Whether the change was accepted.' },
          },
        },
      });
      expect(payload?.argTypes?.onReset.table?.jsDocTags).toEqual({
        params: [{ name: 'event', description: "React's original event." }],
        returns: { description: null },
      });
      expect(payload?.argTypes?.label.description).toBe('The button label.');
      expect(payload?.argTypes?.label.table?.jsDocTags).toBeUndefined();
    }
  );

  it('keeps string defaults quoted once in argTypes', { timeout: 30_000 }, async () => {
    tempDir = createTempDir('docgen-build');

    const files = writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON(),
      'Button.tsx': dedent`
        import React from 'react';
        export const Button = ({ label = 'a', size = "small" }: { label?: string; size?: 'small' | 'large' }) => <button />;
      `,
      'Button.stories.tsx': dedent`
        import { Button } from './Button';
        export default { component: Button, title: 'Forms/Button' };
        export const Primary = () => <Button />;
      `,
    });

    componentMetaManager = new ComponentMetaManager(typescript);

    const payload = await buildDocgenPayload(
      { entry: makeStoryIndexEntry(files['Button.stories.tsx'], 'Forms/Button') },
      {
        componentMetaManager,
        resolvePath: (p) => (path.isAbsolute(p) ? p : path.join(tempDir!, p)),
      }
    );

    expect(payload!.argTypes?.label.table?.defaultValue).toEqual({ summary: "'a'" });
    expect(payload!.argTypes?.size.table?.defaultValue).toEqual({ summary: '"small"' });
  });

  it(
    'shows a default the checker cannot resolve as written, not as a string',
    { timeout: 30_000 },
    async () => {
      tempDir = createTempDir('docgen-build');

      const files = writeFiles(tempDir, {
        'tsconfig.json': tsconfigJSON(),
        'imported.js': `export const imported = 'imported-value';`,
        'Button.tsx': dedent`
          import React from 'react';
          // @ts-ignore a JS module the project does not type-check
          import { imported } from './imported';
          export const Button = ({ label = imported }: { label?: string }) => <button />;
        `,
        'Button.stories.tsx': dedent`
          import { Button } from './Button';
          export default { component: Button, title: 'Forms/Button' };
          export const Primary = () => <Button />;
        `,
      });

      componentMetaManager = new ComponentMetaManager(typescript);

      const payload = await buildDocgenPayload(
        { entry: makeStoryIndexEntry(files['Button.stories.tsx'], 'Forms/Button') },
        {
          componentMetaManager,
          resolvePath: (p) => (path.isAbsolute(p) ? p : path.join(tempDir!, p)),
        }
      );

      expect(payload!.argTypes?.label.table?.defaultValue).toEqual({ summary: 'imported' });
    }
  );

  it.each([
    {
      name: 'string[]',
      input: { name: 'string[]', element: { name: 'string' } },
      expected: {
        type: { name: 'array', raw: 'string[]', value: { name: 'string' } },
        summary: 'string[]',
      },
    },
    {
      name: 'readonly string[]',
      input: { name: 'readonly string[]', element: { name: 'string' } },
      expected: {
        type: { name: 'array', raw: 'readonly string[]', value: { name: 'string' } },
        summary: 'readonly string[]',
      },
    },
    {
      name: 'string[] | null',
      input: { name: 'string[] | null', element: { name: 'string' } },
      expected: {
        type: { name: 'array', raw: 'string[] | null', value: { name: 'string' } },
        summary: 'string[] | null',
      },
    },
    {
      name: 'number[][]',
      input: { name: 'number[][]', element: { name: 'number[]', element: { name: 'number' } } },
      expected: {
        type: {
          name: 'array',
          raw: 'number[][]',
          value: { name: 'array', raw: 'number[]', value: { name: 'number' } },
        },
        summary: 'number[][]',
      },
    },
    {
      name: '(string | number)[]',
      input: { name: '(string | number)[]', element: { name: 'string | number' } },
      expected: {
        type: {
          name: 'array',
          raw: '(string | number)[]',
          value: { name: 'other', value: 'string | number' },
        },
        summary: '(string | number)[]',
      },
    },
    {
      name: '("a" | "b")[]',
      input: {
        name: '("a" | "b")[]',
        element: { name: 'enum', raw: '"a" | "b"', value: [{ value: '"a"' }, { value: '"b"' }] },
      },
      expected: {
        type: {
          name: 'array',
          raw: '("a" | "b")[]',
          value: { name: 'enum', raw: '"a" | "b"', value: ['a', 'b'] },
        },
        summary: '("a" | "b")[]',
      },
    },
    {
      name: 'boolean[]',
      input: { name: 'boolean[]', element: { name: 'boolean' } },
      expected: {
        type: { name: 'array', raw: 'boolean[]', value: { name: 'boolean' } },
        summary: 'boolean[]',
      },
    },
    {
      name: '(() => void)[]',
      input: { name: '(() => void)[]', element: { name: '() => void' } },
      expected: {
        type: {
          name: 'array',
          raw: '(() => void)[]',
          value: { name: 'function', value: '() => void' },
        },
        summary: '(() => void)[]',
      },
    },
    {
      name: '[string, number]',
      input: { name: '[string, number]' },
      expected: { type: { name: 'other', value: '[string, number]' }, summary: '[string, number]' },
    },
  ])('converts a $name prop to argTypes', ({ input, expected }) => {
    const argType = extractArgTypesFromComponentMeta({
      exportName: 'List',
      filePath: '/List.tsx',
      description: '',
      props: {
        items: { name: 'items', required: false, description: '', defaultValue: null, type: input },
      },
    })?.items;

    expect({ type: argType?.type, summary: argType?.table?.type?.summary }).toEqual({
      type: { required: false, ...expected.type },
      summary: expected.summary,
    });
  });

  it('gives a real array prop the array type', { timeout: 30_000 }, async () => {
    tempDir = createTempDir('docgen-build');

    const files = writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON(),
      'List.tsx': dedent`
        import React from 'react';
        export const List = (_props: { items: string[]; tags?: string[] }) => <ul />;
      `,
      'List.stories.tsx': dedent`
        import { List } from './List';
        export default { component: List, title: 'Data/List' };
        export const Primary = () => <List items={[]} />;
      `,
    });

    componentMetaManager = new ComponentMetaManager(typescript);

    const payload = await buildDocgenPayload(
      { entry: makeStoryIndexEntry(files['List.stories.tsx'], 'Data/List') },
      {
        componentMetaManager,
        resolvePath: (p) => (path.isAbsolute(p) ? p : path.join(tempDir!, p)),
      }
    );

    expect(payload!.argTypes?.items.type).toEqual({
      name: 'array',
      raw: 'string[]',
      value: { name: 'string' },
      required: true,
    });
    expect(payload!.argTypes?.tags.type).toEqual({
      name: 'array',
      raw: 'string[]',
      value: { name: 'string' },
      required: false,
    });
    expect(payload!.argTypes?.items.table?.type).toEqual({ summary: 'string[]' });
  });

  it(
    "leaves React's own ref and key out of argTypes, like builder docgen did",
    { timeout: 30_000 },
    async () => {
      tempDir = createTempDir('docgen-build');

      const files = writeFiles(tempDir, {
        'tsconfig.json': tsconfigJSON(),
        'Button.tsx': dedent`
          import React from 'react';
          export const Button = React.forwardRef<HTMLButtonElement, { label: string }>(
            (props, ref) => <button ref={ref} />
          );
        `,
        'Button.stories.tsx': dedent`
          import { Button } from './Button';
          export default { component: Button, title: 'Forms/Button' };
          export const Primary = () => <Button label="hi" />;
        `,
      });

      componentMetaManager = new ComponentMetaManager(typescript);

      const payload = await buildDocgenPayload(
        { entry: makeStoryIndexEntry(files['Button.stories.tsx'], 'Forms/Button') },
        {
          componentMetaManager,
          resolvePath: (p) => (path.isAbsolute(p) ? p : path.join(tempDir!, p)),
        }
      );

      expect(Object.keys(payload!.argTypes ?? {})).toEqual(['label']);
    }
  );

  it('returns undefined when the story file is missing', { timeout: 15_000 }, async () => {
    tempDir = createTempDir('docgen-build');
    componentMetaManager = new ComponentMetaManager(typescript);

    const payload = await buildDocgenPayload(
      {
        entry: makeStoryIndexEntry('does-not-exist.stories.tsx', 'Missing/Component'),
      },
      {
        componentMetaManager,
        resolvePath: (p) => path.join(tempDir!, p),
      }
    );

    expect(payload).toBeUndefined();
  });

  it('walks declared subcomponents into the subcomponents field', { timeout: 30_000 }, async () => {
    tempDir = createTempDir('docgen-build');

    const files = writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON(),
      'Card.tsx': dedent`
          import React from 'react';
          export const Card = (_props: { title: string }) => <div />;
          export const CardHeader = (_props: { level?: number }) => <header />;
        `,
      'Card.stories.tsx': dedent`
          import { Card, CardHeader } from './Card';
          export default {
            component: Card,
            subcomponents: { CardHeader },
            title: 'Layout/Card',
          };
          // Render CardHeader so RCM can extract its props from the JSX.
          export const Default = () => (
            <Card title="x">
              <CardHeader level={1} />
            </Card>
          );
        `,
    });

    componentMetaManager = new ComponentMetaManager(typescript);

    const payload = await buildDocgenPayload(
      { entry: makeStoryIndexEntry(files['Card.stories.tsx'], 'Layout/Card') },
      {
        componentMetaManager,
        resolvePath: (p) => (path.isAbsolute(p) ? p : path.join(tempDir!, p)),
      }
    );

    expect(payload).toBeDefined();
    expect(payload!.id).toBe('card');
    expect(payload!.name).toBe('Card');
    expect(payload!.subcomponents).toBeDefined();
    expect(Object.keys(payload!.subcomponents ?? {})).toEqual(['CardHeader']);
    const cardHeaderMeta = payload!.subcomponents?.CardHeader.reactComponentMeta as
      | ComponentDoc
      | undefined;
    expect(Object.keys(cardHeaderMeta?.props ?? {})).toContain('level');
    expect(payload!.subcomponents?.CardHeader.argTypes?.level).toMatchObject({
      name: 'level',
      type: { name: 'number', required: false },
    });
  });

  it(
    'documents a component and subcomponent a barrel exports as namespace members',
    { timeout: 30_000 },
    async () => {
      tempDir = createTempDir('docgen-build');

      const files = writeFiles(tempDir, {
        'tsconfig.json': tsconfigJSON(),
        'ui.tsx': dedent`
          import React from 'react';
          export const Icon = (_props: { glyph: string }) => <i />;
          export const Button = (_props: { label: string }) => <button />;
        `,
        'lib.ts': `export * as UI from './ui';`,
        'Button.stories.tsx': dedent`
          import { UI } from './lib';
          export default { component: UI.Button, subcomponents: { Icon: UI.Icon }, title: 'Button' };
          export const Primary = {};
        `,
      });

      componentMetaManager = new ComponentMetaManager(typescript);

      const payload = await buildDocgenPayload(
        { entry: makeStoryIndexEntry(files['Button.stories.tsx'], 'Button') },
        {
          componentMetaManager,
          resolvePath: (p) => (path.isAbsolute(p) ? p : path.join(tempDir!, p)),
        }
      );

      expect(Object.keys(payload?.argTypes ?? {})).toEqual(['label']);
      expect(Object.keys(payload?.subcomponents?.Icon?.argTypes ?? {})).toEqual(['glyph']);
    }
  );

  it('extracts argTypes through React.memo', { timeout: 30_000 }, async () => {
    tempDir = createTempDir('docgen-build');

    const files = writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON(),
      'Button.tsx': dedent`
        import React from 'react';
        function Button({ label, onClick }: { label: string; onClick: () => void }) {
          return <button onClick={onClick}>{label}</button>;
        }
        const MemoButton = React.memo(Button);
        export const component = MemoButton;
      `,
      'Button.stories.tsx': dedent`
        import { component } from './Button';
        export default { component, title: 'Forms/Button' };
        export const Primary = () => <component label="hi" onClick={() => {}} />;
      `,
    });

    componentMetaManager = new ComponentMetaManager(typescript);

    const payload = await buildDocgenPayload(
      { entry: makeStoryIndexEntry(files['Button.stories.tsx'], 'Forms/Button') },
      {
        componentMetaManager,
        resolvePath: (p) => (path.isAbsolute(p) ? p : path.join(tempDir!, p)),
      }
    );

    expect(Object.keys(payload!.argTypes ?? {}).sort()).toEqual(['label', 'onClick']);
    expect(payload!.argTypes?.label).toMatchObject({
      name: 'label',
      type: { name: 'string', required: true },
    });
    expect(payload!.argTypes?.onClick).toMatchObject({
      name: 'onClick',
      type: { name: 'function', required: true },
    });
  });

  it(
    'extracts JSDoc-typed argTypes through React.memo in a JavaScript component',
    { timeout: 30_000 },
    async () => {
      tempDir = createTempDir('docgen-build');

      // No tsconfig: a JavaScript project is served by the inferred project, which allows JS.
      const files = writeFiles(tempDir, {
        'Button.jsx': dedent`
          import React from 'react';

          /**
           * @param {object} props
           * @param {string} props.label
           * @param {() => void} props.onClick
           */
          function Button({ label, onClick }) {
            return <button onClick={onClick}>{label}</button>;
          }

          const MemoButton = React.memo(Button);
          export const component = MemoButton;
        `,
        'Button.stories.jsx': dedent`
          import { component } from './Button';
          export default { component, title: 'Forms/Button' };
          export const Primary = () => <component label="hi" onClick={() => {}} />;
        `,
      });

      componentMetaManager = new ComponentMetaManager(typescript);

      const payload = await buildDocgenPayload(
        { entry: makeStoryIndexEntry(files['Button.stories.jsx'], 'Forms/Button') },
        {
          componentMetaManager,
          resolvePath: (p) => (path.isAbsolute(p) ? p : path.join(tempDir!, p)),
        }
      );

      expect(Object.keys(payload!.argTypes ?? {}).sort()).toEqual(['label', 'onClick']);
      expect(payload!.argTypes?.label).toMatchObject({
        name: 'label',
        type: { name: 'string', required: true },
      });
      expect(payload!.argTypes?.onClick).toMatchObject({
        name: 'onClick',
        type: { name: 'function', required: true },
      });
    }
  );
});

describe('buildDocgenPayloads', () => {
  const setup = (names: string[]) => {
    tempDir = createTempDir('docgen-batch');
    const dir = tempDir;
    writeFiles(
      dir,
      Object.fromEntries(
        names.flatMap((name) => [
          [
            `${name}.tsx`,
            `import React from 'react';\nexport const ${name} = (_props: { label: string }) => <div />;`,
          ],
          [
            `${name}.stories.tsx`,
            `import { ${name} } from './${name}';\nexport default { component: ${name}, title: '${name}' };\nexport const Primary = {};`,
          ],
        ])
      )
    );
    const manager = new ComponentMetaManager(typescript);
    componentMetaManager = manager;
    return {
      manager,
      inputs: names.map((name) => ({
        entry: makeStoryIndexEntry(`./${name}.stories.tsx`, name),
      })),
      context: { componentMetaManager: manager, resolvePath: (p: string) => path.join(dir, p) },
      file: (name: string) => path.join(dir, name),
    };
  };

  it(
    'gives every file of the inputs to its project at the first extraction',
    { timeout: 30_000 },
    async () => {
      const { manager, inputs, context, file } = setup(['Button', 'Card']);
      const batchExtract = manager.batchExtract.bind(manager);
      const heldAfterFirstExtraction: boolean[] = [];
      vi.spyOn(manager, 'batchExtract').mockImplementation((entries, batchFiles) => {
        batchExtract(entries, batchFiles);
        if (heldAfterFirstExtraction.length === 0) {
          const project = manager.getProjectForFile(file('Button.stories.tsx'));
          heldAfterFirstExtraction.push(
            ...['Card.stories.tsx', 'Card.tsx'].map((name) => project.hasSourceFile(file(name)))
          );
        }
      });

      const results = await buildDocgenPayloads(inputs, context);

      expect(heldAfterFirstExtraction).toEqual([true, true]);
      expect(results).toMatchObject([
        { status: 'fulfilled', value: { name: 'Button' } },
        { status: 'fulfilled', value: { name: 'Card' } },
      ]);
    }
  );

  it(
    'stops adding the batch`s files once holding them forced a heap-pressure recycle',
    { timeout: 30_000 },
    async () => {
      const { manager, inputs, context, file } = setup(['Button', 'Card', 'Icon']);
      vi.spyOn(once, 'warn').mockImplementation(() => undefined);
      vi.spyOn(process, 'memoryUsage').mockReturnValueOnce({
        heapUsed: Number.POSITIVE_INFINITY,
      } as NodeJS.MemoryUsage);

      const results = await buildDocgenPayloads(inputs, context);

      const project = manager.getProjectForFile(file('Icon.stories.tsx'));
      expect(project.hasSourceFile(file('Icon.tsx'))).toBe(true);
      expect(project.hasSourceFile(file('Button.tsx'))).toBe(false);
      expect(results.map((result) => result.status)).toEqual([
        'fulfilled',
        'fulfilled',
        'fulfilled',
      ]);
    }
  );

  it('extracts every input when grouping the batch files fails', { timeout: 30_000 }, async () => {
    const { manager, inputs, context } = setup(['Button', 'Card']);
    vi.spyOn(manager, 'groupFilesByProject').mockImplementation(() => {
      throw new Error('TypeScript dropped the program');
    });

    const results = await buildDocgenPayloads(inputs, context);

    expect(results).toMatchObject([
      { status: 'fulfilled', value: { name: 'Button' } },
      { status: 'fulfilled', value: { name: 'Card' } },
    ]);
  });

  it('parses the story file of a single input once', { timeout: 30_000 }, async () => {
    const { inputs, context } = setup(['Button', 'Card']);

    const results = await buildDocgenPayloads(inputs.slice(0, 1), context);

    expect(resolveStoryFileComponents).toHaveBeenCalledTimes(1);
    expect(results).toMatchObject([{ status: 'fulfilled', value: { name: 'Button' } }]);
  });

  it(
    'holds no parsed story file of another input while it extracts one',
    { timeout: 30_000 },
    async () => {
      setFlagsFromString('--expose-gc');
      const gc = runInNewContext('gc') as () => void;
      const { manager, inputs, context } = setup(['Button', 'Card', 'Icon']);
      const { resolveStoryFileComponents: resolve } = await vi.importActual<
        typeof import('../componentManifest/resolveComponents.ts')
      >('../componentManifest/resolveComponents.ts');
      const parsed: WeakRef<object>[] = [];
      vi.mocked(resolveStoryFileComponents).mockImplementation(async (options) => {
        const resolved = await resolve(options);
        parsed.push(new WeakRef(resolved.csf));
        // A `WeakRef` keeps its target alive until the current job ends.
        await new Promise((resolve) => setTimeout(resolve, 0));
        return resolved;
      });
      const batchExtract = manager.batchExtract.bind(manager);
      const heldDuringLastExtraction: number[] = [];
      vi.spyOn(manager, 'batchExtract').mockImplementation((entries, batchFiles) => {
        batchExtract(entries, batchFiles);
        if (entries[0].component?.importName === 'Icon') {
          vi.mocked(resolveStoryFileComponents).mockClear();
          gc();
          heldDuringLastExtraction.push(parsed.filter((ref) => ref.deref()).length);
        }
      });

      await buildDocgenPayloads(inputs, context);

      expect(heldDuringLastExtraction).toEqual([1]);
    }
  );
});
