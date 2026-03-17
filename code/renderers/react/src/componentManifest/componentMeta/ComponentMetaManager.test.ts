import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import ts from 'typescript';

import type { StoryRef } from '../getComponentImports';
import { ComponentMetaManager, isFileInDir, sortTSConfigs } from './ComponentMetaManager';
import type { ComponentMetaProject } from './ComponentMetaProject';
import type { ComponentDoc } from './componentMetaExtractor';
import {
  cleanup,
  createTempDir,
  defaultImportName,
  sys,
  tsconfigJSON,
  writeFiles,
} from './test-helpers';

function extractDoc(
  project: ComponentMetaProject,
  componentPath: string,
  exportName: string
): ComponentDoc | undefined {
  const baseName = path.basename(componentPath, path.extname(componentPath));
  const componentName = exportName === 'default' ? defaultImportName(componentPath) : exportName;
  const importLine =
    exportName === 'default'
      ? `import ${componentName} from './${baseName}';`
      : `import { ${exportName} as ${componentName} } from './${baseName}';`;
  const storyPath = path.join(
    path.dirname(componentPath),
    `${baseName}.__story_${exportName}__.tsx`
  );

  sys.writeFile(storyPath, `${importLine}\nexport default { component: ${componentName} };`);
  project.ensureFiles([storyPath]);

  const entries: StoryRef[] = [
    {
      storyPath,
      component: { componentName, importName: exportName, path: componentPath, isPackage: false },
    },
  ];
  project.extractPropsFromStories(entries);
  return entries[0].component?.reactComponentMeta;
}

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
      'app/Button.tsx': `
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
      'lib/tsconfig.json': tsconfigJSON(),
      'lib/Card.tsx': `
        import React from 'react';
        export const Card = (_props: { title: string }) => <div />;
      `,
    });

    manager = new ComponentMetaManager(ts);

    const buttonProject = manager.getProjectForFile(path.join(tempDir, 'app/Button.tsx'));
    const cardProject = manager.getProjectForFile(path.join(tempDir, 'lib/Card.tsx'));

    // Different tsconfigs → different project instances
    expect(buttonProject).not.toBe(cardProject);

    // Both extract correctly
    const buttonDoc = extractDoc(buttonProject, path.join(tempDir, 'app/Button.tsx'), 'Button');
    expect(buttonDoc?.displayName).toBe('Button');

    const cardDoc = extractDoc(cardProject, path.join(tempDir, 'lib/Card.tsx'), 'Card');
    expect(cardDoc?.displayName).toBe('Card');
  });

  it('falls back to inferred project when no tsconfig found', { timeout: 30_000 }, () => {
    tempDir = createTempDir();

    writeFiles(tempDir, {
      'Button.tsx': `
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
    });

    // Remove the tsconfig that createTempDir might have created
    const possibleTsconfig = path.join(tempDir, 'tsconfig.json');
    if (sys.fileExists(possibleTsconfig)) {
      sys.deleteFile!(possibleTsconfig);
    }

    manager = new ComponentMetaManager(ts);

    const project = manager.getProjectForFile(path.join(tempDir, 'Button.tsx'));
    expect(project).toBeDefined();

    const doc = extractDoc(project, path.join(tempDir, 'Button.tsx'), 'Button');
    expect(doc?.displayName).toBe('Button');
  });

  it('broadcasts file changes to all projects', () => {
    tempDir = createTempDir();

    writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON(),
      'Tag.tsx': `
        import React from 'react';
        export const Tag = (_props: { text: string }) => <span />;
      `,
    });

    manager = new ComponentMetaManager(ts);
    const project = manager.getProjectForFile(path.join(tempDir, 'Tag.tsx'));

    // Initial extraction
    const doc1 = extractDoc(project, path.join(tempDir, 'Tag.tsx'), 'Tag');
    expect(doc1?.props.text).toBeDefined();
    expect(doc1?.props.color).toBeUndefined();

    // Modify the file
    sys.writeFile(
      path.join(tempDir, 'Tag.tsx'),
      `
      import React from 'react';
      export const Tag = (_props: { text: string; color?: string }) => <span />;
    `
    );

    // Broadcast change via manager (not project directly)
    manager.onFilesChanged([{ filePath: path.join(tempDir, 'Tag.tsx'), type: 'changed' }]);

    // Re-extract — should see the new prop
    const doc2 = extractDoc(project, path.join(tempDir, 'Tag.tsx'), 'Tag');
    expect(doc2?.props.color).toBeDefined();
  });

  it('handles config change: deleted tsconfig disposes project', () => {
    tempDir = createTempDir();

    const files = writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON(),
      'Button.tsx': `
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
      'Button.tsx': `
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
    sys.writeFile(configPath, tsconfigJSON());

    manager.onConfigChanged(configPath, 'created');

    // Next lookup should use the new tsconfig
    const project2 = manager.getProjectForFile(path.join(tempDir, 'Button.tsx'));
    expect(project2).toBeDefined();
    const doc = extractDoc(project2, path.join(tempDir, 'Button.tsx'), 'Button');
    expect(doc?.displayName).toBe('Button');
  });

  it('shares fsFileSnapshots across projects', () => {
    tempDir = createTempDir();

    writeFiles(tempDir, {
      'app/tsconfig.json': tsconfigJSON(),
      'app/Button.tsx': `
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
      'lib/tsconfig.json': tsconfigJSON(),
      'lib/Card.tsx': `
        import React from 'react';
        export const Card = (_props: { title: string }) => <div />;
      `,
    });

    manager = new ComponentMetaManager(ts);

    // Access both projects and extract (triggers LanguageService + snapshot caching)
    const p1 = manager.getProjectForFile(path.join(tempDir, 'app/Button.tsx'));
    extractDoc(p1, path.join(tempDir, 'app/Button.tsx'), 'Button');
    const p2 = manager.getProjectForFile(path.join(tempDir, 'lib/Card.tsx'));
    extractDoc(p2, path.join(tempDir, 'lib/Card.tsx'), 'Card');

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
      'packages/ui/Button.tsx': `
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
    });

    manager = new ComponentMetaManager(ts);
    const filePath = path.join(tempDir, 'packages/ui/Button.tsx');
    const project = manager.getProjectForFile(filePath);

    expect(project).toBeDefined();
    const doc = extractDoc(project, filePath, 'Button');
    expect(doc?.displayName).toBe('Button');
  });

  it('extracts via Path 1 (importId + JSX in story file)', { timeout: 30_000 }, () => {
    tempDir = createTempDir();

    writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON(),
      'Button.tsx': `
        import React from 'react';
        export const Button = (_props: { label: string; disabled?: boolean }) => <button />;
      `,
      'Button.stories.tsx': `
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

    const doc = entries[0].component?.reactComponentMeta;
    expect(doc).toMatchObject({
      displayName: 'Button',
      props: {
        label: expect.anything(),
        disabled: expect.anything(),
      },
    });
  });
});
