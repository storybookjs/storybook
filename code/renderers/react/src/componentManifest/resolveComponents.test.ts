import { afterEach, describe, expect, it, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import { cleanup, createTempDir, tsconfigJSON, writeFiles } from './componentMeta/test-helpers.ts';
import type { ComponentRef, DocgenEngine } from './getComponentImports.ts';
import { invalidateParser } from './reactDocgenTypescript.ts';
import { resolveStoryFileComponents } from './resolveComponents.ts';
import { invalidateCache } from './utils.ts';

let tempDir: string | undefined;

afterEach(() => {
  vi.restoreAllMocks();
  invalidateCache();
  invalidateParser();
  if (tempDir) {
    cleanup(tempDir);
    tempDir = undefined;
  }
});

// Two components behind one namespace, so the engines cannot fall back to the only component.
const givenBarrelProject = (stories: string) => {
  tempDir = createTempDir('resolve-components');
  // react-docgen-typescript reads the tsconfig of the working directory.
  vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  return writeFiles(tempDir, {
    'tsconfig.json': tsconfigJSON(),
    'ui.tsx': dedent`
      import React from 'react';
      export const Icon = (_props: { glyph: string }) => <i />;
      export const Button = (_props: { label: string }) => <button />;
    `,
    'lib.ts': `export * as UI from './ui';`,
    'Button.stories.tsx': stories,
  });
};

// The display name the engine documented for a component ref.
const docName = (engine: DocgenEngine, ref: ComponentRef | undefined) =>
  engine === 'react-docgen'
    ? ref?.reactDocgen?.type === 'success'
      ? ref.reactDocgen.data.displayName
      : undefined
    : ref?.reactDocgenTypescript?.displayName;

describe('resolveStoryFileComponents', () => {
  it.each<DocgenEngine>(['react-docgen', 'react-docgen-typescript'])(
    'documents a component a barrel exports as a namespace member and keeps its import, with %s',
    { timeout: 30_000 },
    async (docgenEngine) => {
      const files = givenBarrelProject(dedent`
        import { UI } from './lib';
        export default { component: UI.Button, subcomponents: { Icon: UI.Icon } };
        export const Primary = {};
      `);

      const resolved = await resolveStoryFileComponents({
        storyPath: files['Button.stories.tsx'],
        title: 'Button',
        docgenEngine,
      });

      expect(docName(docgenEngine, resolved.component)).toBe('Button');
      expect(docName(docgenEngine, resolved.subcomponents[0]?.component)).toBe('Icon');
      expect(resolved.component).toMatchObject({
        importId: './lib',
        importName: 'UI',
        path: files['lib.ts'],
      });
    }
  );

  it.each<DocgenEngine>(['react-docgen', 'react-docgen-typescript'])(
    'documents the file a `storybook` export condition points at, with %s',
    { timeout: 30_000 },
    async (docgenEngine) => {
      tempDir = createTempDir('resolve-components');
      vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
      const files = writeFiles(tempDir, {
        'tsconfig.json': tsconfigJSON(),
        'package.json': JSON.stringify({
          name: 'app',
          private: true,
          imports: { '#ui': { storybook: './src/ui.tsx', default: './dist/ui.tsx' } },
        }),
        'src/ui.tsx': dedent`
          import React from 'react';
          export const Button = (_props: { label: string }) => <button />;
        `,
        'dist/ui.tsx': dedent`
          import React from 'react';
          export const Button = (_props: { built: boolean }) => <button />;
        `,
        'Button.stories.tsx': dedent`
          import { Button } from '#ui';
          export default { component: Button };
          export const Primary = {};
        `,
      });

      const resolved = await resolveStoryFileComponents({
        storyPath: files['Button.stories.tsx'],
        title: 'Button',
        docgenEngine,
      });

      const props =
        docgenEngine === 'react-docgen'
          ? resolved.component?.reactDocgen?.type === 'success'
            ? resolved.component.reactDocgen.data.props
            : undefined
          : resolved.component?.reactDocgenTypescript?.props;
      expect(Object.keys(props ?? {})).toEqual(['label']);
    }
  );

  // Base UI's layout: a namespace over a parts module that renames each component it re-exports.
  const givenPartsProject = (stories: string) => {
    tempDir = createTempDir('resolve-components');
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    return writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON(),
      'acc/AccordionHeader.tsx': dedent`
        import React from 'react';
        export const AccordionHeader = (_props: { level: number }) => <h3 />;
      `,
      'acc/AccordionRoot.tsx': dedent`
        import React from 'react';
        export const AccordionRoot = (_props: { multiple: boolean }) => <div />;
      `,
      'acc/index.parts.ts': dedent`
        export { AccordionHeader as Header } from './AccordionHeader';
        export { AccordionRoot as Root } from './AccordionRoot';
      `,
      'acc/index.ts': `export * as Accordion from './index.parts';`,
      'Accordion.stories.tsx': stories,
    });
  };

  it.each<DocgenEngine>(['react-docgen', 'react-docgen-typescript'])(
    'documents a member that a parts module renames, with %s',
    { timeout: 30_000 },
    async (docgenEngine) => {
      const files = givenPartsProject(dedent`
        import { Accordion } from './acc';
        export default { component: Accordion.Root };
        export const Primary = {};
      `);

      const resolved = await resolveStoryFileComponents({
        storyPath: files['Accordion.stories.tsx'],
        title: 'Accordion',
        docgenEngine,
      });

      expect(docName(docgenEngine, resolved.component)).toBe('AccordionRoot');
    }
  );

  it.each<DocgenEngine>(['react-docgen', 'react-docgen-typescript'])(
    'reports a member the namespace does not export instead of documenting another, with %s',
    { timeout: 30_000 },
    async (docgenEngine) => {
      const files = givenPartsProject(dedent`
        import { Accordion } from './acc';
        export default { component: Accordion.Nope };
        export const Primary = {};
      `);

      const resolved = await resolveStoryFileComponents({
        storyPath: files['Accordion.stories.tsx'],
        title: 'Accordion',
        docgenEngine,
      });

      const error =
        docgenEngine === 'react-docgen'
          ? resolved.component?.reactDocgen?.type === 'error'
            ? resolved.component.reactDocgen.error
            : undefined
          : resolved.component?.reactDocgenTypescriptError;
      expect(error).toMatchObject({ name: 'Component export not found' });
      expect(docName(docgenEngine, resolved.component)).toBeUndefined();
    }
  );

  it(
    'documents the same file as the import lines when `ui.js` sits next to `ui.tsx`',
    { timeout: 30_000 },
    async () => {
      tempDir = createTempDir('resolve-components');
      vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
      const files = writeFiles(tempDir, {
        'tsconfig.json': tsconfigJSON(),
        'ui.tsx': dedent`
          import React from 'react';
          export const Button = (_props: { label: string }) => <button />;
        `,
        'ui.js': dedent`
          import React from 'react';
          export const Button = (_props) => React.createElement('button');
        `,
        'Button.stories.tsx': dedent`
          import { Button } from './ui';
          export default { component: Button };
          export const Primary = {};
        `,
      });

      const resolved = await resolveStoryFileComponents({
        storyPath: files['Button.stories.tsx'],
        title: 'Button',
        docgenEngine: 'react-docgen',
      });

      expect(resolved.component?.path).toBe(files['ui.js']);
      expect(
        resolved.component?.reactDocgen?.type === 'success'
          ? Object.keys(resolved.component.reactDocgen.data.props ?? {})
          : undefined
      ).toEqual([]);
    }
  );

  // A namespace named after one of its own components, as `export * as Menu` over a file that
  // exports `Menu` and `Item`.
  const givenMenuProject = (stories: string) => {
    tempDir = createTempDir('resolve-components');
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    return writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON(),
      'menu.tsx': dedent`
        import React from 'react';
        export const Menu = (_props: { open: boolean }) => <div />;
        export const Item = (_props: { value: string }) => <div />;
      `,
      'lib.ts': `export * as Menu from './menu';`,
      'Menu.stories.tsx': stories,
    });
  };

  it.each<[DocgenEngine, string]>([
    ['react-docgen', `import { Menu } from './lib';`],
    ['react-docgen-typescript', `import { Menu } from './lib';`],
    ['react-docgen', `import * as Menu from './menu';`],
    ['react-docgen-typescript', `import * as Menu from './menu';`],
  ])(
    'documents the member of a namespace that shares its name with another export, with %s and %s',
    { timeout: 30_000 },
    async (docgenEngine, importLine) => {
      const files = givenMenuProject(dedent`
        ${importLine}
        export default { component: Menu.Item, subcomponents: { Root: Menu.Menu } };
        export const Primary = {};
      `);

      const resolved = await resolveStoryFileComponents({
        storyPath: files['Menu.stories.tsx'],
        title: 'Menu',
        docgenEngine,
      });

      expect(docName(docgenEngine, resolved.component)).toBe('Item');
      expect(docName(docgenEngine, resolved.subcomponents[0]?.component)).toBe('Menu');
    }
  );

  it.each<DocgenEngine>(['react-docgen', 'react-docgen-typescript'])(
    'documents a component behind a tsconfig path only core resolves, with %s',
    { timeout: 30_000 },
    async (docgenEngine) => {
      tempDir = createTempDir('resolve-components');
      vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
      const files = writeFiles(tempDir, {
        // TypeScript 5.5 expands `${configDir}` to the folder of the tsconfig that extends this one.
        'tsconfig.base.json': JSON.stringify({
          compilerOptions: {
            jsx: 'react-jsx',
            strict: true,
            paths: { '@/*': ['${configDir}/src/*'] },
          },
        }),
        'tsconfig.json': JSON.stringify({ extends: './tsconfig.base.json' }),
        'src/ui.tsx': dedent`
          import React from 'react';
          export const Icon = (_props: { glyph: string }) => <i />;
          export const Button = (_props: { label: string }) => <button />;
        `,
        'Button.stories.tsx': dedent`
          import { Button } from '@/ui';
          export default { component: Button };
          export const Primary = {};
        `,
      });

      const resolved = await resolveStoryFileComponents({
        storyPath: files['Button.stories.tsx'],
        title: 'Button',
        docgenEngine,
      });

      expect(docName(docgenEngine, resolved.component)).toBe('Button');
      // React's own lookup cannot read `${configDir}`, so `path` falls back to core's file.
      expect(resolved.component).toMatchObject({
        importId: '@/ui',
        importName: 'Button',
        path: files['src/ui.tsx'],
      });
    }
  );

  it.each<DocgenEngine>(['react-docgen', 'react-docgen-typescript'])(
    'documents a component the meta reaches through a local object, with %s',
    { timeout: 30_000 },
    async (docgenEngine) => {
      const files = givenBarrelProject(dedent`
        import { Button, Icon } from './ui';
        const parts = { Button, Icon };
        export default { component: parts.Button, subcomponents: { Icon: parts.Icon } };
        export const Primary = {};
      `);

      const resolved = await resolveStoryFileComponents({
        storyPath: files['Button.stories.tsx'],
        title: 'Button',
        docgenEngine,
      });

      expect(docName(docgenEngine, resolved.component)).toBe('Button');
      expect(docName(docgenEngine, resolved.subcomponents[0]?.component)).toBe('Icon');
      expect(resolved.component?.componentName).toBe('Button');
      expect(resolved.subcomponents[0]?.component?.componentName).toBe('Icon');
    }
  );
});
