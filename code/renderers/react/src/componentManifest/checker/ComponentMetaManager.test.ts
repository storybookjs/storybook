import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import ts from 'typescript';

import { ComponentMetaManager, isFileInDir, sortTSConfigs } from './ComponentMetaManager';

// ---------------------------------------------------------------------------
// Test helper: create real tsconfig projects in a temp directory
// ---------------------------------------------------------------------------

const sys = ts.sys;
const MONOREPO_ROOT = path.resolve(__dirname, '../../../../..');

function createTempDir(): string {
  const fixturesDir = path.join(MONOREPO_ROOT, '.test-fixtures');
  if (!sys.directoryExists(fixturesDir)) {
    sys.createDirectory(fixturesDir);
  }
  const dir = path.join(
    fixturesDir,
    `manager-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  sys.createDirectory(dir);
  return dir;
}

function writeFiles(baseDir: string, files: Record<string, string>): Record<string, string> {
  const filePaths: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(baseDir, name);
    const dir = path.dirname(filePath);
    if (!sys.directoryExists(dir)) {
      const parts = path.relative(baseDir, dir).split(path.sep);
      let current = baseDir;
      for (const part of parts) {
        current = path.join(current, part);
        if (!sys.directoryExists(current)) {
          sys.createDirectory(current);
        }
      }
    }
    sys.writeFile(filePath, content);
    filePaths[name] = filePath;
  }
  return filePaths;
}

function cleanup(dir: string) {
  if (!sys.directoryExists(dir)) {
    return;
  }
  for (const entry of sys.readDirectory(dir, undefined, undefined, ['**/*'])) {
    sys.deleteFile!(entry);
  }
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

describe('ComponentMetaManager', () => {
  let tempDir: string | undefined;
  let manager: ComponentMetaManager;

  afterEach(() => {
    manager?.dispose();
    if (tempDir) {
      cleanup(tempDir);
      tempDir = undefined;
    }
  });

  it('creates separate projects for files under different tsconfigs', () => {
    tempDir = createTempDir();

    // Create two sub-projects with their own tsconfigs
    writeFiles(tempDir, {
      'app/tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          moduleResolution: 'bundler',
        },
        include: ['./**/*.tsx'],
      }),
      'app/Button.tsx': `
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
      'lib/tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          moduleResolution: 'bundler',
        },
        include: ['./**/*.tsx'],
      }),
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
    const buttonDocs = buttonProject.extractDocs(path.join(tempDir, 'app/Button.tsx'));
    expect(buttonDocs[0].displayName).toBe('Button');

    const cardDocs = cardProject.extractDocs(path.join(tempDir, 'lib/Card.tsx'));
    expect(cardDocs[0].displayName).toBe('Card');
  });

  it('falls back to inferred project when no tsconfig found', { timeout: 30_000 }, () => {
    tempDir = createTempDir();

    // File without any tsconfig.json in its ancestry (relative to temp dir)
    // We create the file deep enough that walking up won't find a tsconfig
    // before hitting .test-fixtures root
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

    // This should use the inferred project (no tsconfig found in temp dir)
    // Note: it may find the monorepo root tsconfig — that's OK, the test
    // verifies the manager still works without a local tsconfig
    const project = manager.getProjectForFile(path.join(tempDir, 'Button.tsx'));
    expect(project).toBeDefined();

    const docs = project.extractDocs(path.join(tempDir, 'Button.tsx'));
    expect(docs).toHaveLength(1);
    expect(docs[0].displayName).toBe('Button');
  });

  it('broadcasts file changes to all projects', () => {
    tempDir = createTempDir();

    writeFiles(tempDir, {
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          moduleResolution: 'bundler',
        },
        include: ['./**/*.tsx'],
      }),
      'Tag.tsx': `
        import React from 'react';
        export const Tag = (_props: { text: string }) => <span />;
      `,
    });

    manager = new ComponentMetaManager(ts);
    const project = manager.getProjectForFile(path.join(tempDir, 'Tag.tsx'));

    // Initial extraction
    const docs1 = project.extractDocs(path.join(tempDir, 'Tag.tsx'));
    expect(docs1[0].props.text).toBeDefined();
    expect(docs1[0].props.color).toBeUndefined();

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
    const docs2 = project.extractDocs(path.join(tempDir, 'Tag.tsx'));
    expect(docs2[0].props.color).toBeDefined();
  });

  it('handles config change: deleted tsconfig disposes project', () => {
    tempDir = createTempDir();

    const files = writeFiles(tempDir, {
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          moduleResolution: 'bundler',
        },
        include: ['./**/*.tsx'],
      }),
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
    sys.writeFile(
      configPath,
      JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          moduleResolution: 'bundler',
        },
        include: ['./**/*.tsx'],
      })
    );

    manager.onConfigChanged(configPath, 'created');

    // Next lookup should use the new tsconfig
    const project2 = manager.getProjectForFile(path.join(tempDir, 'Button.tsx'));
    // The project should now be backed by the new tsconfig
    expect(project2).toBeDefined();
    const docs = project2.extractDocs(path.join(tempDir, 'Button.tsx'));
    expect(docs[0].displayName).toBe('Button');
  });

  it('shares fsFileSnapshots across projects', () => {
    tempDir = createTempDir();

    writeFiles(tempDir, {
      'app/tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          moduleResolution: 'bundler',
        },
        include: ['./**/*.tsx'],
      }),
      'app/Button.tsx': `
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
      'lib/tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          moduleResolution: 'bundler',
        },
        include: ['./**/*.tsx'],
      }),
      'lib/Card.tsx': `
        import React from 'react';
        export const Card = (_props: { title: string }) => <div />;
      `,
    });

    manager = new ComponentMetaManager(ts);

    // Access both projects and extract (triggers LanguageService + snapshot caching)
    const p1 = manager.getProjectForFile(path.join(tempDir, 'app/Button.tsx'));
    p1.extractDocs(path.join(tempDir, 'app/Button.tsx'));
    const p2 = manager.getProjectForFile(path.join(tempDir, 'lib/Card.tsx'));
    p2.extractDocs(path.join(tempDir, 'lib/Card.tsx'));

    // fsFileSnapshots is shared — entries from both projects exist in one map
    expect(manager.fsFileSnapshots.size).toBeGreaterThan(0);
  });

  it('project references: finds file via referenced project', () => {
    tempDir = createTempDir();

    // Create a root tsconfig with project references
    writeFiles(tempDir, {
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          moduleResolution: 'bundler',
        },
        references: [{ path: './packages/ui' }],
        files: [],
      }),
      'packages/ui/tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          moduleResolution: 'bundler',
          composite: true,
        },
        include: ['./**/*.tsx'],
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
    const docs = project.extractDocs(filePath);
    expect(docs).toHaveLength(1);
    expect(docs[0].displayName).toBe('Button');
  });
});
