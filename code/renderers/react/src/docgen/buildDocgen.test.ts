import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';
import { dedent } from 'ts-dedent';
import ts from 'typescript';

import { ComponentMetaManager } from '../componentManifest/componentMeta/ComponentMetaManager.ts';
import type {
  ComponentDoc,
  PropItemType,
} from '../componentManifest/componentMeta/componentMetaExtractor.ts';
import {
  cleanup,
  createTempDir,
  tsconfigJSON,
  writeFiles,
} from '../componentManifest/componentMeta/test-helpers.ts';
import { buildDocgenPayload, extractArgTypesFromComponentMeta } from './buildDocgen.ts';

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

function componentDoc(
  props: Record<string, { type: PropItemType; required?: boolean }>
): ComponentDoc {
  return {
    exportName: 'List',
    filePath: '/List.tsx',
    description: '',
    props: Object.fromEntries(
      Object.entries(props).map(([name, { type, required = true }]) => [
        name,
        { name, required, description: '', defaultValue: null, type },
      ])
    ),
  };
}

afterEach(() => {
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

      componentMetaManager = new ComponentMetaManager(ts);
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

    componentMetaManager = new ComponentMetaManager(ts);

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

      componentMetaManager = new ComponentMetaManager(ts);

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

  it('gives array props the array type in argTypes', () => {
    const argTypes = extractArgTypesFromComponentMeta(
      componentDoc({
        items: { type: { name: 'string[]', elements: [{ name: 'string' }] } },
        tags: {
          type: { name: 'readonly string[]', elements: [{ name: 'string' }] },
          required: false,
        },
        values: { type: { name: '(string | number)[]', elements: [{ name: 'string | number' }] } },
        matrix: {
          type: {
            name: 'number[][]',
            elements: [{ name: 'number[]', elements: [{ name: 'number' }] }],
          },
        },
        selected: { type: { name: 'string[] | null', elements: [{ name: 'string' }] } },
        pair: { type: { name: '[string, number]' } },
      })
    );

    expect(argTypes?.items.type).toEqual({
      name: 'array',
      raw: 'string[]',
      value: { name: 'string' },
      required: true,
    });
    expect(argTypes?.tags.type).toEqual({
      name: 'array',
      raw: 'readonly string[]',
      value: { name: 'string' },
      required: false,
    });
    expect(argTypes?.values.type).toEqual({
      name: 'array',
      raw: '(string | number)[]',
      value: { name: 'other', value: 'string | number' },
      required: true,
    });
    expect(argTypes?.matrix.type).toEqual({
      name: 'array',
      raw: 'number[][]',
      value: { name: 'array', raw: 'number[]', value: { name: 'number' } },
      required: true,
    });
    expect(argTypes?.selected.type).toEqual({
      name: 'array',
      raw: 'string[] | null',
      value: { name: 'string' },
      required: true,
    });
    expect(argTypes?.pair.type).toEqual({
      name: 'other',
      value: '[string, number]',
      required: true,
    });
    expect(argTypes?.items.table?.type).toEqual({ summary: 'string[]' });
    expect(argTypes?.tags.table?.type).toEqual({ summary: 'readonly string[]' });
    expect(argTypes?.values.table?.type).toEqual({ summary: '(string | number)[]' });
    expect(argTypes?.selected.table?.type).toEqual({ summary: 'string[] | null' });
  });

  it('converts the element type of array props', () => {
    const argTypes = extractArgTypesFromComponentMeta(
      componentDoc({
        kinds: {
          type: {
            name: '("a" | "b")[]',
            elements: [
              { name: 'enum', raw: '"a" | "b"', value: [{ value: '"a"' }, { value: '"b"' }] },
            ],
          },
        },
        flags: { type: { name: 'boolean[]', elements: [{ name: 'boolean' }] } },
        handlers: { type: { name: '(() => void)[]', elements: [{ name: '() => void' }] } },
      })
    );

    expect(argTypes?.kinds.type).toEqual({
      name: 'array',
      raw: '("a" | "b")[]',
      value: { name: 'enum', raw: '"a" | "b"', value: ['a', 'b'] },
      required: true,
    });
    expect(argTypes?.flags.type).toEqual({
      name: 'array',
      raw: 'boolean[]',
      value: { name: 'boolean' },
      required: true,
    });
    expect(argTypes?.handlers.type).toEqual({
      name: 'array',
      raw: '(() => void)[]',
      value: { name: 'function', value: '() => void' },
      required: true,
    });
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

      componentMetaManager = new ComponentMetaManager(ts);

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
    componentMetaManager = new ComponentMetaManager(ts);

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

    componentMetaManager = new ComponentMetaManager(ts);

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

    componentMetaManager = new ComponentMetaManager(ts);

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

      componentMetaManager = new ComponentMetaManager(ts);

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
