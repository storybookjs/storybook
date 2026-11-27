import * as fs from 'node:fs';
import * as path from 'node:path';

import { once } from 'storybook/internal/node-logger';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import type { StoryRef } from '../getComponentImports.ts';
import { ComponentMetaManager, isFileInDir, sortTSConfigs } from './ComponentMetaManager.ts';
import { cleanup, createTempDir, tsconfigJSON, writeFiles } from './test-helpers.ts';
import { DOCGEN_TS_API, loadTestTypeScript } from '@storybook/component-meta-typescript/testing';

const typescript = await loadTestTypeScript();

// ---------------------------------------------------------------------------
// Unit tests: sortTSConfigs and isFileInDir
// ---------------------------------------------------------------------------

describe('isFileInDir', () => {
  it('returns true for a file inside the directory', () => {
    expect(isFileInDir('/project/src/Button.tsx', '/project')).toBe(true);
    expect(isFileInDir('/project/src/Button.tsx', '/project/src')).toBe(true);
  });

  it('returns false for a file outside the directory', () => {
    expect(isFileInDir('/other/Button.tsx', '/project')).toBe(false);
    expect(isFileInDir('/project/../other/Button.tsx', '/project')).toBe(false);
  });

  it('returns false for the directory itself', () => {
    expect(isFileInDir('/project', '/project')).toBe(false);
  });
});

describe('sortTSConfigs', () => {
  it('prefers tsconfig whose directory contains the file', () => {
    const result = sortTSConfigs(
      '/project/src/Button.tsx',
      '/project/tsconfig.json',
      '/other/tsconfig.json'
    );
    // a contains file, b does not → a should come first (negative result)
    expect(result).toBeLessThan(0);
  });

  it('prefers deeper tsconfig when both contain the file', () => {
    const result = sortTSConfigs(
      '/project/src/components/Button.tsx',
      '/project/tsconfig.json',
      '/project/src/tsconfig.json'
    );
    // b is deeper → b should come first (positive result)
    expect(result).toBeGreaterThan(0);
  });

  it('prefers tsconfig.json over jsconfig.json at same depth', () => {
    const result = sortTSConfigs(
      '/project/src/Button.tsx',
      '/project/tsconfig.json',
      '/project/jsconfig.json'
    );
    // Same depth, a is tsconfig.json → a should come first (negative result)
    expect(result).toBeLessThan(0);
  });

  it('returns 0 for identical configs', () => {
    const result = sortTSConfigs(
      '/project/src/Button.tsx',
      '/project/tsconfig.json',
      '/project/tsconfig.json'
    );
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ComponentMetaManager: multi-project scenarios
// ---------------------------------------------------------------------------

describe('multi-project management', () => {
  let tempDir: string | undefined;
  let manager: ComponentMetaManager;

  afterEach(() => {
    vi.restoreAllMocks();
    manager?.dispose();
    if (tempDir) {
      cleanup(tempDir);
      tempDir = undefined;
    }
  });

  it('creates separate projects for files under different tsconfigs', { timeout: 30_000 }, () => {
    tempDir = createTempDir();

    writeFiles(tempDir, {
      'app/tsconfig.json': tsconfigJSON(),
      'app/Button.tsx': dedent`
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
      'lib/tsconfig.json': tsconfigJSON(),
      'lib/Card.tsx': dedent`
        import React from 'react';
        export const Card = (_props: { title: string }) => <div />;
      `,
    });

    manager = new ComponentMetaManager(typescript);

    const buttonProject = manager.getProjectForFile(path.join(tempDir, 'app/Button.tsx'));
    const cardProject = manager.getProjectForFile(path.join(tempDir, 'lib/Card.tsx'));

    // Different tsconfigs → different project instances
    expect(buttonProject).not.toBe(cardProject);
  });

  it('reuses parsed source files across projects', { timeout: 30_000 }, () => {
    tempDir = createTempDir();

    // Two projects that both reach shared.ts, neither having the other's component as a root file.
    writeFiles(tempDir, {
      'shared.ts': `export type Variant = 'primary' | 'secondary';`,
      'app/tsconfig.json': tsconfigJSON(),
      'app/Button.tsx': dedent`
        import React from 'react';
        import type { Variant } from '../shared.ts';
        export const Button = (_props: { variant: Variant }) => <button />;
      `,
      'lib/tsconfig.json': tsconfigJSON(),
      'lib/Card.tsx': dedent`
        import React from 'react';
        import type { Variant } from '../shared.ts';
        export const Card = (_props: { variant: Variant }) => <div />;
      `,
    });

    manager = new ComponentMetaManager(typescript);

    const buttonProject = manager.getProjectForFile(path.join(tempDir, 'app/Button.tsx'));
    const cardProject = manager.getProjectForFile(path.join(tempDir, 'lib/Card.tsx'));
    expect(buttonProject).not.toBe(cardProject);

    const sharedPath = path.join(tempDir, 'shared.ts');
    const fromButton = buttonProject.getSourceFile(sharedPath);
    const fromCard = cardProject.getSourceFile(sharedPath);

    expect(fromButton).toBeDefined();
    // Identity, not equality. Without a shared DocumentRegistry each LanguageService parses its own
    // copy of every file it reaches, and the extracted docgen is unchanged either way, so the shared
    // instance is the only observable difference.
    expect(fromButton).toBe(fromCard);
  });

  it(
    'reads a shared file that changed after another project parsed it',
    { timeout: 30_000 },
    () => {
      tempDir = createTempDir();
      const component = (name: string) => dedent`
      import React from 'react';
      import type { Props } from '../shared.ts';
      export const ${name} = (_props: Props) => <div />;
    `;
      const files = writeFiles(tempDir, {
        'shared.ts': `export interface Props { label: string }`,
        'app/tsconfig.json': tsconfigJSON(),
        'app/Button.tsx': component('Button'),
        'app/Button.stories.tsx': `import { Button } from './Button';\nexport default {};`,
        'lib/tsconfig.json': tsconfigJSON(),
        'lib/Card.tsx': component('Card'),
        'lib/Card.stories.tsx': `import { Card } from './Card';\nexport default {};`,
      });
      const toRef = (dir: string, name: string): StoryRef => ({
        storyPath: files[`${dir}/${name}.stories.tsx`],
        component: {
          componentName: name,
          importId: `./${name}`,
          importName: name,
          path: files[`${dir}/${name}.tsx`],
          isPackage: false,
        },
      });
      manager = new ComponentMetaManager(typescript);
      manager.batchExtract([toRef('app', 'Button')]);
      fs.writeFileSync(
        files['shared.ts'],
        `export interface Props { label: string; size: number }`
      );
      const later = new Date(Date.now() + 10_000);
      fs.utimesSync(files['shared.ts'], later, later);

      const card = toRef('lib', 'Card');
      manager.batchExtract([card]);

      expect(Object.keys(card.component?.reactComponentMeta?.props ?? {})).toEqual(
        expect.arrayContaining(['label', 'size'])
      );
    }
  );

  it('falls back to inferred project when no tsconfig found', { timeout: 30_000 }, () => {
    tempDir = createTempDir();

    writeFiles(tempDir, {
      'Button.tsx': dedent`
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
    });

    // Remove the tsconfig that createTempDir might have created
    const possibleTsconfig = path.join(tempDir, 'tsconfig.json');
    if (fs.existsSync(possibleTsconfig)) {
      fs.unlinkSync(possibleTsconfig);
    }

    manager = new ComponentMetaManager(typescript);

    const project = manager.getProjectForFile(path.join(tempDir, 'Button.tsx'));
    expect(project).toBeDefined();
  });

  it('broadcasts file changes to all projects', { timeout: 30_000 }, () => {
    tempDir = createTempDir();

    const files = writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON(),
      'Tag.tsx': dedent`
        import React from 'react';
        export const Tag = (_props: { text: string }) => <span />;
      `,
      'Tag.stories.tsx': dedent`
        import { Tag } from './Tag';
        export default { component: Tag };
      `,
    });

    manager = new ComponentMetaManager(typescript);
    const tagPath = path.join(tempDir, 'Tag.tsx');
    const project = manager.getProjectForFile(tagPath);

    // Initial extraction
    const entries1: StoryRef[] = [
      {
        storyPath: files['Tag.stories.tsx'],
        component: {
          componentName: 'Tag',
          importName: 'Tag',
          path: tagPath,
          isPackage: false,
        },
      },
    ];
    project.extractPropsFromStories(entries1);
    expect(entries1[0].component?.reactComponentMeta).toMatchObject({
      props: { text: expect.anything() },
    });
    expect(entries1[0].component?.reactComponentMeta?.props?.color).toBeUndefined();

    // Modify the file
    fs.writeFileSync(
      tagPath,
      dedent`
        import React from 'react';
        export const Tag = (_props: { text: string; color?: string }) => <span />;
      `
    );

    // Broadcast change via manager (not project directly)
    manager.onFilesChanged([{ filePath: tagPath, type: 'changed' }]);

    // Re-extract — should see the new prop
    const entries2: StoryRef[] = [
      {
        storyPath: files['Tag.stories.tsx'],
        component: {
          componentName: 'Tag',
          importName: 'Tag',
          path: tagPath,
          isPackage: false,
        },
      },
    ];
    project.extractPropsFromStories(entries2);
    expect(entries2[0].component?.reactComponentMeta).toMatchObject({
      props: { color: expect.anything() },
    });
  });

  it(
    're-extracts a rewrite whose mtime is unchanged after onFilesChanged',
    { timeout: 30_000 },
    () => {
      tempDir = createTempDir();

      const files = writeFiles(tempDir, {
        'tsconfig.json': tsconfigJSON(),
        'Tag.tsx': dedent`
          import React from 'react';
          export const Tag = (_props: { text: string }) => <span />;
        `,
        'Tag.stories.tsx': dedent`
          import { Tag } from './Tag';
          export default { component: Tag };
        `,
      });

      manager = new ComponentMetaManager(typescript);
      const tagPath = files['Tag.tsx'];

      // Pin a whole-second mtime so both writes land on the identical timestamp, reproducing a
      // second write within one mtime tick (scripted codegen, coarse-mtime filesystems).
      const pinned = new Date(Math.floor(Date.now() / 1000) * 1000);
      fs.utimesSync(tagPath, pinned, pinned);

      const project = manager.getProjectForFile(tagPath);
      const before: StoryRef[] = [
        {
          storyPath: files['Tag.stories.tsx'],
          component: { componentName: 'Tag', importName: 'Tag', path: tagPath, isPackage: false },
        },
      ];
      project.extractPropsFromStories(before);
      expect(before[0].component?.reactComponentMeta?.props?.text).toBeDefined();
      expect(before[0].component?.reactComponentMeta?.props?.color).toBeUndefined();

      fs.writeFileSync(
        tagPath,
        dedent`
          import React from 'react';
          export const Tag = (_props: { text: string; color?: string }) => <span />;
        `
      );
      fs.utimesSync(tagPath, pinned, pinned);
      expect(fs.statSync(tagPath).mtime.valueOf()).toBe(pinned.valueOf());

      manager.onFilesChanged([{ filePath: tagPath, type: 'changed' }]);

      const after: StoryRef[] = [
        {
          storyPath: files['Tag.stories.tsx'],
          component: { componentName: 'Tag', importName: 'Tag', path: tagPath, isPackage: false },
        },
      ];
      project.extractPropsFromStories(after);
      expect(after[0].component?.reactComponentMeta?.props?.color).toBeDefined();
    }
  );

  it('handles config change: deleted tsconfig disposes project', () => {
    tempDir = createTempDir();

    const files = writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON(),
      'Button.tsx': dedent`
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
    });

    manager = new ComponentMetaManager(typescript);
    const configPath = files['tsconfig.json'];

    // Create project by looking up file
    const project1 = manager.getProjectForFile(files['Button.tsx']);
    expect(project1).toBeDefined();

    // Delete the tsconfig
    manager.onConfigChanged(configPath, 'deleted');

    // Next lookup should create a new project (or inferred)
    const project2 = manager.getProjectForFile(files['Button.tsx']);
    // Should be a different instance (old one was disposed)
    expect(project2).not.toBe(project1);
  });

  it('handles config change: created tsconfig is discovered', { timeout: 30_000 }, () => {
    tempDir = createTempDir();

    writeFiles(tempDir, {
      'Button.tsx': dedent`
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
    });

    manager = new ComponentMetaManager(typescript);
    const configPath = path.join(tempDir, 'tsconfig.json');

    // First lookup (no tsconfig yet — may use inferred or find monorepo root)
    const project1 = manager.getProjectForFile(path.join(tempDir, 'Button.tsx'));
    expect(project1).toBeDefined();

    // Now write a tsconfig and notify the manager
    fs.writeFileSync(configPath, tsconfigJSON());

    manager.onConfigChanged(configPath, 'created');

    // Next lookup should use the new tsconfig
    const project2 = manager.getProjectForFile(path.join(tempDir, 'Button.tsx'));
    expect(project2).toBeDefined();
  });

  it.skipIf(DOCGEN_TS_API === 'native')(
    'shares fsFileSnapshots across projects',
    { timeout: 30_000 },
    () => {
      tempDir = createTempDir();

      const files = writeFiles(tempDir, {
        'app/tsconfig.json': tsconfigJSON(),
        'app/Button.tsx': dedent`
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
        'app/Button.stories.tsx': dedent`
        import { Button } from './Button';
        export default { component: Button };
      `,
        'lib/tsconfig.json': tsconfigJSON(),
        'lib/Card.tsx': dedent`
        import React from 'react';
        export const Card = (_props: { title: string }) => <div />;
      `,
        'lib/Card.stories.tsx': dedent`
        import { Card } from './Card';
        export default { component: Card };
      `,
      });

      manager = new ComponentMetaManager(typescript);

      // Access both projects and trigger extraction (populates fsFileSnapshots)
      const p1 = manager.getProjectForFile(path.join(tempDir, 'app/Button.tsx'));
      p1.extractPropsFromStories([
        {
          storyPath: files['app/Button.stories.tsx'],
          component: {
            componentName: 'Button',
            importName: 'Button',
            path: files['app/Button.tsx'],
            isPackage: false,
          },
        },
      ]);
      const p2 = manager.getProjectForFile(path.join(tempDir, 'lib/Card.tsx'));
      p2.extractPropsFromStories([
        {
          storyPath: files['lib/Card.stories.tsx'],
          component: {
            componentName: 'Card',
            importName: 'Card',
            path: files['lib/Card.tsx'],
            isPackage: false,
          },
        },
      ]);

      // fsFileSnapshots is shared — entries from both projects exist in one map
      expect(manager.fsFileSnapshots.size).toBeGreaterThan(0);
    }
  );

  it('project references: follows a reference added after the first lookup', () => {
    tempDir = createTempDir();

    const files = writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON({ include: ['unused/**/*'] }),
      'configs/tsconfig.lib.json': tsconfigJSON({ include: ['../src/**/*'] }),
      'src/Button.tsx': dedent`
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
    });

    manager = new ComponentMetaManager(typescript);
    const inferred = manager.getProjectForFile(files['src/Button.tsx']);

    fs.writeFileSync(
      files['tsconfig.json'],
      tsconfigJSON({
        include: ['unused/**/*'],
        references: [{ path: './configs/tsconfig.lib.json' }],
      })
    );
    manager.onConfigChanged(files['tsconfig.json'], 'changed');

    expect(manager.getProjectForFile(files['src/Button.tsx'])).not.toBe(inferred);
  });

  it('project references: finds file via referenced project', () => {
    tempDir = createTempDir();

    writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON({ references: [{ path: './packages/ui' }], files: [] }),
      'packages/ui/tsconfig.json': tsconfigJSON({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          moduleResolution: 'bundler',
          composite: true,
        },
      }),
      'packages/ui/Button.tsx': dedent`
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
    });

    manager = new ComponentMetaManager(typescript);
    const filePath = path.join(tempDir, 'packages/ui/Button.tsx');
    const project = manager.getProjectForFile(filePath);

    expect(project).toBeDefined();
  });

  it(
    'project references: extracts props when the component lives in a referenced project',
    { timeout: 30_000 },
    () => {
      tempDir = createTempDir();
      const compilerOptions = {
        target: 'ES2020',
        module: 'ESNext',
        jsx: 'react-jsx',
        strict: true,
        esModuleInterop: true,
        moduleResolution: 'bundler',
      };

      const files = writeFiles(tempDir, {
        'tsconfig.json': tsconfigJSON({
          compilerOptions,
          include: ['src/**/*'],
          references: [{ path: './tsconfig.src.json' }],
        }),
        'tsconfig.src.json': tsconfigJSON({
          compilerOptions: {
            ...compilerOptions,
            composite: true,
            emitDeclarationOnly: true,
            outDir: 'dist-types',
          },
          include: ['src/**/*'],
          exclude: ['src/**/*.stories.tsx'],
        }),
        'src/Button.tsx': dedent`
          import React from 'react';
          export interface ButtonProps {
            label: string;
            variant?: 'primary' | 'secondary';
          }
          export const Button = (_props: ButtonProps) => <button />;
        `,
        'src/Button.stories.tsx': dedent`
          import { Button } from './Button';
          export default { component: Button };
        `,
      });

      manager = new ComponentMetaManager(typescript);
      const entries: StoryRef[] = [
        {
          storyPath: files['src/Button.stories.tsx'],
          component: {
            componentName: 'Button',
            importId: './Button',
            importName: 'Button',
            path: files['src/Button.tsx'],
            isPackage: false,
          },
        },
      ];
      manager.batchExtract(entries);

      expect(entries[0].component?.reactComponentMeta).toMatchObject({
        props: { label: expect.anything(), variant: expect.anything() },
      });
    }
  );

  it(
    'recycles the shared program when heap usage crosses the threshold',
    { timeout: 30_000 },
    () => {
      tempDir = createTempDir();

      const files = writeFiles(tempDir, {
        'tsconfig.json': tsconfigJSON(),
        'Button.tsx': dedent`
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
        'Button.stories.tsx': dedent`
        import { Button } from './Button';
        export default { component: Button };
      `,
      });

      // ratio 0 → threshold 0 → heapUsed is always ≥ 0 → recycle fires after every batchExtract.
      manager = new ComponentMetaManager(typescript, 0);
      const componentPath = path.join(tempDir, 'Button.tsx');
      const before = manager.getProjectForFile(componentPath);

      const entries: StoryRef[] = [
        {
          storyPath: files['Button.stories.tsx'],
          component: {
            componentName: 'Button',
            importName: 'Button',
            path: componentPath,
            isPackage: false,
          },
        },
      ];
      manager.batchExtract(entries);

      // The disposed program was cleared, so the next lookup rebuilds a fresh instance.
      const after = manager.getProjectForFile(componentPath);
      expect(after).not.toBe(before);
    }
  );

  it(
    'warns once, with guidance to raise the memory limit, when it recycles under pressure',
    { timeout: 30_000 },
    () => {
      tempDir = createTempDir();

      const files = writeFiles(tempDir, {
        'tsconfig.json': tsconfigJSON(),
        'Button.tsx': dedent`
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
        'Button.stories.tsx': dedent`
        import { Button } from './Button';
        export default { component: Button };
      `,
      });

      // Spy on the one-time `once.warn` channel: routing the warning through it is what makes it
      // surface once per process (the dedupe itself is node-logger's responsibility, tested there).
      const onceWarnSpy = vi.spyOn(once, 'warn').mockImplementation(() => undefined);
      try {
        // ratio 0 → threshold 0 → recycle fires on every batchExtract.
        manager = new ComponentMetaManager(typescript, 0);
        const componentPath = path.join(tempDir, 'Button.tsx');
        manager.getProjectForFile(componentPath);

        const entries: StoryRef[] = [
          {
            storyPath: files['Button.stories.tsx'],
            component: {
              componentName: 'Button',
              importName: 'Button',
              path: componentPath,
              isPackage: false,
            },
          },
        ];

        manager.batchExtract(entries);

        expect(onceWarnSpy).toHaveBeenCalled();
        expect(onceWarnSpy.mock.calls[0][0]).toContain('--max-old-space-size');
      } finally {
        onceWarnSpy.mockRestore();
        once.clear();
      }
    }
  );

  it(
    'keeps the shared program while heap usage stays below the threshold',
    { timeout: 30_000 },
    () => {
      tempDir = createTempDir();

      const files = writeFiles(tempDir, {
        'tsconfig.json': tsconfigJSON(),
        'Button.tsx': dedent`
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
        'Button.stories.tsx': dedent`
        import { Button } from './Button';
        export default { component: Button };
      `,
      });

      // ratio Infinity → threshold Infinity → heapUsed is always below it → recycle never fires.
      manager = new ComponentMetaManager(typescript, Number.POSITIVE_INFINITY);
      const componentPath = path.join(tempDir, 'Button.tsx');
      const before = manager.getProjectForFile(componentPath);

      const entries: StoryRef[] = [
        {
          storyPath: files['Button.stories.tsx'],
          component: {
            componentName: 'Button',
            importName: 'Button',
            path: componentPath,
            isPackage: false,
          },
        },
      ];
      manager.batchExtract(entries);

      // No recycle → the same program instance is reused across extractions.
      const after = manager.getProjectForFile(componentPath);
      expect(after).toBe(before);
    }
  );

  describe('groupFilesByProject', () => {
    const setup = () => {
      tempDir = createTempDir();
      const files = Object.fromEntries(
        ['Button', 'Card'].flatMap((name) => [
          [
            `${name}.tsx`,
            `import React from 'react';\nexport const ${name} = (_props: { label: string }) => <div />;`,
          ],
          [`${name}.stories.tsx`, `import { ${name} } from './${name}';\nexport default {};`],
        ])
      );
      writeFiles(tempDir, files);
      const toRef = (name: string): StoryRef => ({
        storyPath: path.join(tempDir!, `${name}.stories.tsx`),
        component: {
          componentName: name,
          importId: `./${name}`,
          importName: name,
          path: path.join(tempDir!, `${name}.tsx`),
          isPackage: false,
        },
      });
      manager = new ComponentMetaManager(typescript);
      return { button: toRef('Button'), card: toRef('Card') };
    };

    it(
      'gives a project every file of the batch at its first extraction',
      { timeout: 30_000 },
      () => {
        const { button, card } = setup();

        const batchFiles = manager.groupFilesByProject(
          [button, card].map(({ storyPath, component }) => ({
            projectFile: storyPath,
            files: [storyPath, component!.path!],
          }))
        );
        manager.batchExtract([button], batchFiles);

        const project = manager.getProjectForFile(button.storyPath);
        expect(project.hasSourceFile(card.component!.path!)).toBe(true);
        expect(button.component?.reactComponentMeta).toMatchObject({ displayName: 'Button' });
      }
    );

    it('extracts the entries when adding the batch files fails', { timeout: 30_000 }, () => {
      const { button, card } = setup();
      const batchFiles = manager.groupFilesByProject(
        [button, card].map(({ storyPath, component }) => ({
          projectFile: storyPath,
          files: [storyPath, component!.path!],
        }))
      );
      const project = manager.getProjectForFile(button.storyPath);
      const ensureFiles = project.ensureFiles.bind(project);
      vi.spyOn(project, 'ensureFiles').mockImplementation((files) => {
        const isBatchCall = files.includes(card.component!.path!);
        if (isBatchCall) {
          throw new Error('TypeScript dropped the program');
        }
        ensureFiles(files);
      });

      manager.batchExtract([button], batchFiles);

      expect(button.component?.reactComponentMeta).toMatchObject({ displayName: 'Button' });
    });

    it('gives each project its files just before that project`s first extraction', () => {
      tempDir = createTempDir();
      const source = (name: string) =>
        `import React from 'react';\nexport const ${name} = (_props: { label: string }) => <div />;`;
      const files = writeFiles(tempDir, {
        'app/tsconfig.json': tsconfigJSON(),
        'app/Button.tsx': source('Button'),
        'app/Button.stories.tsx': `import { Button } from './Button';\nexport default {};`,
        'lib/tsconfig.json': tsconfigJSON(),
        'lib/Card.tsx': source('Card'),
        'lib/Card.stories.tsx': `import { Card } from './Card';\nexport default {};`,
      });
      manager = new ComponentMetaManager(typescript);
      const toRef = (dir: string, name: string): StoryRef => ({
        storyPath: files[`${dir}/${name}.stories.tsx`],
        component: {
          componentName: name,
          importId: `./${name}`,
          importName: name,
          path: files[`${dir}/${name}.tsx`],
          isPackage: false,
        },
      });
      const entries = [toRef('app', 'Button'), toRef('lib', 'Card')];
      const batchFiles = manager.groupFilesByProject(
        entries.map(({ storyPath, component }) => ({
          projectFile: storyPath,
          files: [storyPath, component!.path!],
        }))
      );
      const steps: string[] = [];
      for (const [name, entry] of [
        ['app', entries[0]],
        ['lib', entries[1]],
      ] as const) {
        const project = manager.getProjectForFile(entry.storyPath);
        const filesOfBatch = batchFiles.get(project);
        const ensureFiles = project.ensureFiles.bind(project);
        const extract = project.extractPropsFromStories.bind(project);
        vi.spyOn(project, 'ensureFiles').mockImplementation((given) => {
          if (given === filesOfBatch) {
            steps.push(`${name}: batch files`);
          }
          ensureFiles(given);
        });
        vi.spyOn(project, 'extractPropsFromStories').mockImplementation((given) => {
          steps.push(`${name}: extraction`);
          extract(given);
        });
      }

      manager.batchExtract(entries, batchFiles);

      expect(steps).toEqual([
        'app: batch files',
        'app: extraction',
        'lib: batch files',
        'lib: extraction',
      ]);
      expect(entries.map((entry) => entry.component?.reactComponentMeta?.displayName)).toEqual([
        'Button',
        'Card',
      ]);
    });

    it('gives a component under another tsconfig to the project of its story', () => {
      tempDir = createTempDir();
      const files = writeFiles(tempDir, {
        'app/tsconfig.json': tsconfigJSON(),
        'app/Button.stories.tsx': `import { Button } from '../lib/Button';\nexport default {};`,
        'lib/tsconfig.json': tsconfigJSON(),
        'lib/Button.tsx': `import React from 'react';\nexport const Button = (_props: { label: string }) => <div />;`,
      });
      manager = new ComponentMetaManager(typescript);

      const batchFiles = manager.groupFilesByProject([
        {
          projectFile: files['app/Button.stories.tsx'],
          files: [files['app/Button.stories.tsx'], files['lib/Button.tsx']],
        },
      ]);

      const storyProject = manager.getProjectForFile(files['app/Button.stories.tsx']);
      expect(storyProject).not.toBe(manager.getProjectForFile(files['lib/Button.tsx']));
      expect(batchFiles.get(storyProject)).toContain(files['lib/Button.tsx']);
    });

    it.each([{ order: ['pkg', 'docs'] }, { order: ['docs', 'pkg'] }])(
      'gives a story to the tsconfig elsewhere that includes it, for the order $order',
      ({ order }) => {
        tempDir = createTempDir();
        const files = writeFiles(tempDir, {
          'pkg/Button.tsx': `import React from 'react';\nexport const Button = (_props: { label: string }) => <div />;`,
          'pkg/Button.stories.tsx': `import { Button } from './Button';\nexport default {};`,
          'docs/tsconfig.json': tsconfigJSON({
            include: ['./**/*.tsx', '../pkg/**/*.stories.tsx'],
          }),
          'docs/Intro.tsx': `import React from 'react';\nexport const Intro = (_props: { text: string }) => <div />;`,
          'docs/Intro.stories.tsx': `import { Intro } from './Intro';\nexport default {};`,
        });
        manager = new ComponentMetaManager(typescript);
        const groups = {
          pkg: {
            projectFile: files['pkg/Button.stories.tsx'],
            files: [files['pkg/Button.stories.tsx'], files['pkg/Button.tsx']],
          },
          docs: {
            projectFile: files['docs/Intro.stories.tsx'],
            files: [files['docs/Intro.stories.tsx'], files['docs/Intro.tsx']],
          },
        };

        const batchFiles = manager.groupFilesByProject(
          order.map((name) => groups[name as keyof typeof groups])
        );

        const docsProject = manager.getProjectForFile(files['docs/Intro.stories.tsx']);
        expect(batchFiles.get(docsProject)).toContain(files['pkg/Button.tsx']);
      }
    );

    it('lets go of the batch`s projects when it recycles them', { timeout: 30_000 }, () => {
      tempDir = createTempDir();
      const toRef = (dir: string, name: string): StoryRef => ({
        storyPath: path.join(tempDir!, dir, `${name}.stories.tsx`),
        component: {
          componentName: name,
          importId: `./${name}`,
          importName: name,
          path: path.join(tempDir!, dir, `${name}.tsx`),
          isPackage: false,
        },
      });
      writeFiles(
        tempDir,
        Object.fromEntries(
          ['a/Button', 'b/Card'].flatMap((file) => {
            const name = file.split('/')[1];
            return [
              [`${file.split('/')[0]}/tsconfig.json`, tsconfigJSON()],
              [
                `${file}.tsx`,
                `import React from 'react';\nexport const ${name} = (_props: { label: string }) => <div />;`,
              ],
              [`${file}.stories.tsx`, `import { ${name} } from './${name}';\nexport default {};`],
            ];
          })
        )
      );
      manager = new ComponentMetaManager(typescript);
      const [button, card] = [toRef('a', 'Button'), toRef('b', 'Card')];
      const batchFiles = manager.groupFilesByProject(
        [button, card].map(({ storyPath, component }) => ({
          projectFile: storyPath,
          files: [storyPath, component!.path!],
        }))
      );
      vi.spyOn(once, 'warn').mockImplementation(() => undefined);
      vi.spyOn(process, 'memoryUsage').mockReturnValueOnce({
        heapUsed: Number.POSITIVE_INFINITY,
      } as NodeJS.MemoryUsage);

      manager.batchExtract([button], batchFiles);

      expect(batchFiles.size).toBe(0);
    });

    it('leaves later files out of the project without it', { timeout: 30_000 }, () => {
      const { button, card } = setup();

      manager.batchExtract([button]);

      const project = manager.getProjectForFile(button.storyPath);
      expect(project.hasSourceFile(card.component!.path!)).toBe(false);
    });
  });

  describe('heap-pressure recycle', () => {
    const setup = ({ keepParsedFilesOnRecycle = true } = {}) => {
      tempDir = createTempDir();
      const source = (name: string) =>
        `import React from 'react';\nexport const ${name} = (_props: { label: string }) => <div />;`;
      const files = writeFiles(tempDir, {
        'app/tsconfig.json': tsconfigJSON(),
        'app/Button.tsx': source('Button'),
        'app/Button.stories.tsx': `import { Button } from './Button';\nexport default {};`,
        'lib/tsconfig.json': tsconfigJSON(),
        'lib/Card.tsx': source('Card'),
        'lib/Card.stories.tsx': `import { Card } from './Card';\nexport default {};`,
      });
      manager = new ComponentMetaManager(typescript, undefined, { keepParsedFilesOnRecycle });
      const toRef = (dir: string, name: string) => ({
        storyPath: files[`${dir}/${name}.stories.tsx`],
        component: {
          componentName: name,
          importId: `./${name}`,
          importName: name,
          path: files[`${dir}/${name}.tsx`],
          isPackage: false,
        },
      });
      vi.spyOn(once, 'warn').mockImplementation(() => undefined);
      return { button: toRef('app', 'Button'), card: toRef('lib', 'Card') };
    };

    const extractUnderHeapPressure = (entries: StoryRef[]) => {
      vi.spyOn(process, 'memoryUsage').mockReturnValueOnce({
        heapUsed: Number.POSITIVE_INFINITY,
      } as NodeJS.MemoryUsage);
      manager.batchExtract(entries);
    };

    it.skipIf(DOCGEN_TS_API === 'native')(
      'keeps the parsed files of the project the batch used',
      { timeout: 30_000 },
      () => {
        const { button } = setup();
        manager.batchExtract([button]);
        const project = manager.getProjectForFile(button.storyPath);
        const parsed = project.getSourceFile(button.component.path);

        extractUnderHeapPressure([button]);

        const rebuilt = manager.getProjectForFile(button.storyPath);
        expect(rebuilt).not.toBe(project);
        expect(parsed).toBeDefined();
        expect(rebuilt.getSourceFile(button.component.path)).toBe(parsed);
      }
    );

    it.skipIf(DOCGEN_TS_API === 'native')(
      'keeps the parsed files across two recycles in a row',
      { timeout: 30_000 },
      () => {
        const { button } = setup();
        manager.batchExtract([button]);
        const parsed = manager
          .getProjectForFile(button.storyPath)
          .getSourceFile(button.component.path);

        extractUnderHeapPressure([button]);
        const afterFirst = manager.getProjectForFile(button.storyPath);
        extractUnderHeapPressure([button]);

        const afterSecond = manager.getProjectForFile(button.storyPath);
        expect(afterSecond).not.toBe(afterFirst);
        expect(parsed).toBeDefined();
        expect(afterSecond.getSourceFile(button.component.path)).toBe(parsed);
      }
    );

    it.skipIf(DOCGEN_TS_API === 'native')(
      'parses the files of a project the batch did not use again',
      { timeout: 30_000 },
      () => {
        const { button, card } = setup();
        manager.batchExtract([card]);
        const parsed = manager.getProjectForFile(card.storyPath).getSourceFile(card.component.path);

        extractUnderHeapPressure([button]);

        const rebuilt = manager.getProjectForFile(card.storyPath);
        expect(parsed).toBeDefined();
        expect(rebuilt.getSourceFile(card.component.path)).not.toBe(parsed);
      }
    );

    it.skipIf(DOCGEN_TS_API === 'native')(
      'parses the files again unless the manager keeps them',
      { timeout: 30_000 },
      () => {
        const { button } = setup({ keepParsedFilesOnRecycle: false });
        manager.batchExtract([button]);
        const parsed = manager
          .getProjectForFile(button.storyPath)
          .getSourceFile(button.component.path);

        extractUnderHeapPressure([button]);

        const rebuilt = manager.getProjectForFile(button.storyPath);
        expect(parsed).toBeDefined();
        expect(rebuilt.getSourceFile(button.component.path)).not.toBe(parsed);
      }
    );

    it('reads a file that changed since the recycled project read it', { timeout: 30_000 }, () => {
      const { button } = setup();
      const propsFile = path.join(path.dirname(button.component.path), 'props.ts');
      fs.writeFileSync(propsFile, `export interface Props { label: string }`);
      fs.writeFileSync(
        button.component.path,
        `import React from 'react';\nimport type { Props } from './props';\nexport const Button = (_props: Props) => <div />;`
      );
      manager.batchExtract([button]);
      fs.writeFileSync(propsFile, `export interface Props { label: string; size: number }`);
      const later = new Date(Date.now() + 10_000);
      fs.utimesSync(propsFile, later, later);

      extractUnderHeapPressure([button]);
      manager.batchExtract([button]);

      const extracted: StoryRef = button;
      expect(Object.keys(extracted.component?.reactComponentMeta?.props ?? {})).toEqual(
        expect.arrayContaining(['label', 'size'])
      );
    });

    it('extracts the same props from the project it rebuilt', { timeout: 30_000 }, () => {
      const { button } = setup();
      manager.batchExtract([button]);
      const before = structuredClone(button.component);

      extractUnderHeapPressure([button]);
      manager.batchExtract([button]);

      expect(button.component).toEqual(before);
      expect(button.component).toMatchObject({ reactComponentMeta: { displayName: 'Button' } });
    });
  });

  it('extracts via Path 1 (importId + JSX in story file)', { timeout: 30_000 }, () => {
    tempDir = createTempDir();

    writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON(),
      'Button.tsx': dedent`
        import React from 'react';
        export const Button = (_props: { label: string; disabled?: boolean }) => <button />;
      `,
      'Button.stories.tsx': dedent`
        import { Button } from './Button';
        const _story = () => <Button label="click me" />;
      `,
    });

    manager = new ComponentMetaManager(typescript);
    const componentPath = path.join(tempDir, 'Button.tsx');
    const storyPath = path.join(tempDir, 'Button.stories.tsx');
    const project = manager.getProjectForFile(componentPath);

    project.ensureFiles([storyPath]);

    const entries: StoryRef[] = [
      {
        storyPath,
        component: {
          componentName: 'Button',
          importId: './Button',
          importName: 'Button',
          path: componentPath,
          isPackage: false,
        },
      },
    ];
    project.extractPropsFromStories(entries);

    expect(entries[0].component?.reactComponentMeta).toMatchObject({
      displayName: 'Button',
      props: {
        label: expect.anything(),
        disabled: expect.anything(),
      },
    });
  });
});
