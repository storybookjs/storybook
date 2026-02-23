import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import ts from 'typescript';

import { PropExtractionManager } from './PropExtractionManager';
import { PropExtractionProject } from './PropExtractionProject';

// ---------------------------------------------------------------------------
// Test helper: create a real tsconfig project in a temp directory
// ---------------------------------------------------------------------------

/**
 * Use ts.sys for all file I/O. The react vitest setup mocks node:fs with memfs,
 * but ts.sys uses the real filesystem (it imported fs before mocks were applied).
 */
const sys = ts.sys;

/** Path to the monorepo root where node_modules with @types/react lives */
const MONOREPO_ROOT = path.resolve(__dirname, '../../../../..');

/**
 * Creates a temp project directory UNDER the monorepo root so that
 * node_modules resolution naturally walks up and finds @types/react.
 */
function createTempProject(files: Record<string, string>): {
  projectDir: string;
  configPath: string;
  filePaths: Record<string, string>;
} {
  // Place under monorepo root so node_modules resolution works
  const fixturesDir = path.join(MONOREPO_ROOT, '.test-fixtures');
  if (!sys.directoryExists(fixturesDir)) sys.createDirectory(fixturesDir);
  const projectDir = path.join(
    fixturesDir,
    `prop-ls-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  sys.createDirectory(projectDir);

  // Write tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      jsx: 'react-jsx',
      strict: true,
      esModuleInterop: true,
      moduleResolution: 'bundler',
    },
    include: ['./**/*.ts', './**/*.tsx'],
  };
  const configPath = path.join(projectDir, 'tsconfig.json');
  sys.writeFile(configPath, JSON.stringify(tsconfig, null, 2));

  // Write component files
  const filePaths: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(projectDir, name);
    const dir = path.dirname(filePath);
    if (!sys.directoryExists(dir)) {
      const parts = path.relative(projectDir, dir).split(path.sep);
      let current = projectDir;
      for (const part of parts) {
        current = path.join(current, part);
        if (!sys.directoryExists(current)) sys.createDirectory(current);
      }
    }
    sys.writeFile(filePath, content);
    filePaths[name] = filePath;
  }

  return { projectDir, configPath, filePaths };
}

function cleanup(dir: string) {
  if (!sys.directoryExists(dir)) return;
  for (const entry of sys.readDirectory(dir, undefined, undefined, ['**/*'])) {
    sys.deleteFile!(entry);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PropExtractionProject', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      cleanup(tempDir);
      tempDir = undefined;
    }
  });

  it('extracts props from a simple component', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
      'Button.tsx': `
        import React from 'react';
        interface ButtonProps {
          /** The button label */
          label: string;
          disabled?: boolean;
        }
        export const Button = (props: ButtonProps) => <button>{props.label}</button>;
      `,
    });
    tempDir = projectDir;

    const parsed = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(configPath, ts.sys.readFile),
      ts.sys,
      projectDir,
      {},
      configPath
    );
    const project = new PropExtractionProject(ts, parsed, configPath);

    try {
      const docs = project.extractDocs(filePaths['Button.tsx']);

      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('Button');
      expect(docs[0].props.label).toBeDefined();
      expect(docs[0].props.label.type.name).toBe('string');
      expect(docs[0].props.label.required).toBe(true);
      expect(docs[0].props.label.description).toBe('The button label');
      expect(docs[0].props.disabled).toBeDefined();
      expect(docs[0].props.disabled.required).toBe(false);
    } finally {
      project.dispose();
    }
  });

  it('caches results on second call (same mtime)', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
      'Card.tsx': `
        import React from 'react';
        export const Card = (props: { title: string }) => <div>{props.title}</div>;
      `,
    });
    tempDir = projectDir;

    const parsed = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(configPath, ts.sys.readFile),
      ts.sys,
      projectDir,
      {},
      configPath
    );
    const project = new PropExtractionProject(ts, parsed, configPath);

    try {
      // First call — cold
      const docs1 = project.extractDocs(filePaths['Card.tsx']);
      expect(docs1).toHaveLength(1);

      // Second call — should be cached (same mtime)
      const t0 = Date.now();
      const docs2 = project.extractDocs(filePaths['Card.tsx']);
      const elapsed = Date.now() - t0;

      expect(docs2).toHaveLength(1);
      expect(docs2[0].displayName).toBe('Card');
      // Cached call should be very fast (sub-10ms)
      expect(elapsed).toBeLessThan(50);
    } finally {
      project.dispose();
    }
  });

  it('invalidates cache after onFileChanged', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
      'Tag.tsx': `
        import React from 'react';
        export const Tag = (props: { text: string }) => <span>{props.text}</span>;
      `,
    });
    tempDir = projectDir;

    const parsed = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(configPath, ts.sys.readFile),
      ts.sys,
      projectDir,
      {},
      configPath
    );
    const project = new PropExtractionProject(ts, parsed, configPath);

    try {
      const docs1 = project.extractDocs(filePaths['Tag.tsx']);
      expect(docs1).toHaveLength(1);
      expect(docs1[0].props.text).toBeDefined();

      // Simulate file change: add a new prop
      sys.writeFile(
        filePaths['Tag.tsx'],
        `
        import React from 'react';
        export const Tag = (props: { text: string; color?: string }) => <span>{props.text}</span>;
      `
      );

      // Notify the project
      project.onFileChanged(filePaths['Tag.tsx']);

      // Re-extract — should see the new prop
      const docs2 = project.extractDocs(filePaths['Tag.tsx']);
      expect(docs2).toHaveLength(1);
      expect(docs2[0].props.text).toBeDefined();
      expect(docs2[0].props.color).toBeDefined();
      expect(docs2[0].props.color.required).toBe(false);
    } finally {
      project.dispose();
    }
  });

  it('extracts multiple components from one file', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
      'Components.tsx': `
        import React from 'react';
        export const Button = (props: { label: string }) => <button>{props.label}</button>;
        export const Icon = (props: { name: string; size?: number }) => <span />;
      `,
    });
    tempDir = projectDir;

    const parsed = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(configPath, ts.sys.readFile),
      ts.sys,
      projectDir,
      {},
      configPath
    );
    const project = new PropExtractionProject(ts, parsed, configPath);

    try {
      const docs = project.extractDocs(filePaths['Components.tsx']);

      expect(docs).toHaveLength(2);
      const names = docs.map((d) => d.displayName).sort();
      expect(names).toEqual(['Button', 'Icon']);
    } finally {
      project.dispose();
    }
  });

  it('extracts enum props', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
      'Select.tsx': `
        import React from 'react';
        interface Props {
          size: 'small' | 'medium' | 'large';
          variant?: 'filled' | 'outline';
        }
        export const Select = (props: Props) => <select />;
      `,
    });
    tempDir = projectDir;

    const parsed = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(configPath, ts.sys.readFile),
      ts.sys,
      projectDir,
      {},
      configPath
    );
    const project = new PropExtractionProject(ts, parsed, configPath);

    try {
      const docs = project.extractDocs(filePaths['Select.tsx']);

      expect(docs).toHaveLength(1);
      expect(docs[0].props.size.type.name).toBe('enum');
      expect(docs[0].props.size.type.value).toEqual([
        { value: '"small"' },
        { value: '"medium"' },
        { value: '"large"' },
      ]);
      expect(docs[0].props.variant.type.name).toBe('enum');
    } finally {
      project.dispose();
    }
  });

  it('extracts from a file in a subdirectory', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
      'components/Button.tsx': `
        import React from 'react';
        export const Button = (props: { label: string }) => <button />;
      `,
    });
    tempDir = projectDir;

    const parsed = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(configPath, ts.sys.readFile),
      ts.sys,
      projectDir,
      {},
      configPath
    );
    const project = new PropExtractionProject(ts, parsed, configPath);

    try {
      const docs = project.extractDocs(filePaths['components/Button.tsx']);

      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('Button');
      expect(docs[0].props.label).toBeDefined();
    } finally {
      project.dispose();
    }
  });

  it('handles default export', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
      'Header.tsx': `
        import React from 'react';
        interface HeaderProps {
          title: string;
          subtitle?: string;
        }
        const Header = (props: HeaderProps) => <header>{props.title}</header>;
        export default Header;
      `,
    });
    tempDir = projectDir;

    const parsed = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(configPath, ts.sys.readFile),
      ts.sys,
      projectDir,
      {},
      configPath
    );
    const project = new PropExtractionProject(ts, parsed, configPath);

    try {
      const docs = project.extractDocs(filePaths['Header.tsx']);

      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('Header');
      expect(docs[0].exportName).toBe('default');
      expect(docs[0].props.title.required).toBe(true);
      expect(docs[0].props.subtitle.required).toBe(false);
    } finally {
      project.dispose();
    }
  });

  it('filters >30 HTML attribute props', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
      'FancyButton.tsx': `
        import React from 'react';
        interface FancyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
          variant: 'primary' | 'secondary';
          label: string;
        }
        export const FancyButton = (props: FancyButtonProps) => <button />;
      `,
    });
    tempDir = projectDir;

    const parsed = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(configPath, ts.sys.readFile),
      ts.sys,
      projectDir,
      {},
      configPath
    );
    const project = new PropExtractionProject(ts, parsed, configPath);

    try {
      const docs = project.extractDocs(filePaths['FancyButton.tsx']);

      expect(docs).toHaveLength(1);
      // User props survive
      expect(docs[0].props.variant).toBeDefined();
      expect(docs[0].props.label).toBeDefined();
      // HTML attrs filtered
      expect(docs[0].props.onClick).toBeUndefined();
      expect(docs[0].props.className).toBeUndefined();
    } finally {
      project.dispose();
    }
  });

  it('extracts from multiple files with same project', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
      'Button.tsx': `
        import React from 'react';
        export const Button = (props: { label: string }) => <button />;
      `,
      'Card.tsx': `
        import React from 'react';
        export const Card = (props: { title: string; body?: string }) => <div />;
      `,
    });
    tempDir = projectDir;

    const parsed = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(configPath, ts.sys.readFile),
      ts.sys,
      projectDir,
      {},
      configPath
    );
    const project = new PropExtractionProject(ts, parsed, configPath);

    try {
      const buttonDocs = project.extractDocs(filePaths['Button.tsx']);
      const cardDocs = project.extractDocs(filePaths['Card.tsx']);

      expect(buttonDocs).toHaveLength(1);
      expect(buttonDocs[0].displayName).toBe('Button');
      expect(buttonDocs[0].props.label).toBeDefined();

      expect(cardDocs).toHaveLength(1);
      expect(cardDocs[0].displayName).toBe('Card');
      expect(cardDocs[0].props.title).toBeDefined();
      expect(cardDocs[0].props.body).toBeDefined();
    } finally {
      project.dispose();
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: PropExtractionManager (same flow as generator.ts)
// ---------------------------------------------------------------------------

describe('PropExtractionManager integration', () => {
  let tempDir: string | undefined;
  let manager: PropExtractionManager;

  afterEach(() => {
    manager?.dispose();
    if (tempDir) {
      cleanup(tempDir);
      tempDir = undefined;
    }
  });

  it('discovers tsconfig and extracts props via getProjectForFile', () => {
    const { projectDir, filePaths } = createTempProject({
      'Button.tsx': `
        import React from 'react';
        interface ButtonProps {
          /** The button label */
          label: string;
          disabled?: boolean;
        }
        export const Button = (props: ButtonProps) => <button>{props.label}</button>;
      `,
    });
    tempDir = projectDir;
    manager = new PropExtractionManager(ts);

    // This is the exact flow from generator.ts:
    // 1. manager.getProjectForFile(componentPath)
    // 2. project.extractDocs(componentPath)
    // 3. docs.find(d => d.exportName === importName)
    const project = manager.getProjectForFile(filePaths['Button.tsx']);
    const docs = project.extractDocs(filePaths['Button.tsx']);
    const doc = docs.find((d) => d.exportName === 'Button');

    expect(doc).toBeDefined();
    expect(doc!.displayName).toBe('Button');
    expect(doc!.props.label.type.name).toBe('string');
    expect(doc!.props.label.required).toBe(true);
    expect(doc!.props.label.description).toBe('The button label');
    expect(doc!.props.disabled.required).toBe(false);
  });

  it('finds default export by exportName', () => {
    const { projectDir, filePaths } = createTempProject({
      'Header.tsx': `
        import React from 'react';
        const Header = (props: { title: string }) => <header>{props.title}</header>;
        export default Header;
      `,
    });
    tempDir = projectDir;
    manager = new PropExtractionManager(ts);

    const project = manager.getProjectForFile(filePaths['Header.tsx']);
    const docs = project.extractDocs(filePaths['Header.tsx']);

    // generator.ts uses: docs.find(d => d.exportName === (importName ?? 'default'))
    const doc = docs.find((d) => d.exportName === 'default');

    expect(doc).toBeDefined();
    expect(doc!.displayName).toBe('Header');
    expect(doc!.props.title).toBeDefined();
  });

  it('reuses the same project for files under the same tsconfig', () => {
    const { projectDir, filePaths } = createTempProject({
      'Button.tsx': `
        import React from 'react';
        export const Button = (props: { label: string }) => <button />;
      `,
      'Card.tsx': `
        import React from 'react';
        export const Card = (props: { title: string }) => <div />;
      `,
    });
    tempDir = projectDir;
    manager = new PropExtractionManager(ts);

    const project1 = manager.getProjectForFile(filePaths['Button.tsx']);
    const project2 = manager.getProjectForFile(filePaths['Card.tsx']);

    // Same tsconfig → same project instance (no duplicate LanguageServices)
    expect(project1).toBe(project2);

    // Both extract correctly from the shared project
    const buttonDoc = project1.extractDocs(filePaths['Button.tsx']);
    const cardDoc = project2.extractDocs(filePaths['Card.tsx']);
    expect(buttonDoc[0].displayName).toBe('Button');
    expect(cardDoc[0].displayName).toBe('Card');
  });
});
