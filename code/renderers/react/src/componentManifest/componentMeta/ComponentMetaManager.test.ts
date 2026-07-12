import * as fs from 'node:fs';
import * as path from 'node:path';

import { once } from 'storybook/internal/node-logger';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { dedent } from 'ts-dedent';
import ts from 'typescript';

import type { StoryRef } from '../getComponentImports.ts';
import { ComponentMetaManager, isFileInDir, sortTSConfigs } from './ComponentMetaManager.ts';
import { cleanup, createTempDir, tsconfigJSON, writeFiles } from './test-helpers.ts';

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

    manager = new ComponentMetaManager(ts);

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

    manager = new ComponentMetaManager(ts);

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

    manager = new ComponentMetaManager(ts);

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

    manager = new ComponentMetaManager(ts);
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

  it('handles config change: deleted tsconfig disposes project', () => {
    tempDir = createTempDir();

    const files = writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON(),
      'Button.tsx': dedent`
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
    });

    manager = new ComponentMetaManager(ts);
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

    manager = new ComponentMetaManager(ts);
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

  it('shares fsFileSnapshots across projects', { timeout: 30_000 }, () => {
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

    manager = new ComponentMetaManager(ts);

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

    manager = new ComponentMetaManager(ts);
    const filePath = path.join(tempDir, 'packages/ui/Button.tsx');
    const project = manager.getProjectForFile(filePath);

    expect(project).toBeDefined();
  });

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
      manager = new ComponentMetaManager(ts, 0);
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
        manager = new ComponentMetaManager(ts, 0);
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
      manager = new ComponentMetaManager(ts, Number.POSITIVE_INFINITY);
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

    manager = new ComponentMetaManager(ts);
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
