import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import ts from 'typescript';

import { ComponentMetaManager } from './ComponentMetaManager';
import { ComponentMetaProject } from './ComponentMetaProject';

// ---------------------------------------------------------------------------
// Test helper: create a real tsconfig project in a temp directory
// ---------------------------------------------------------------------------

/**
 * Use ts.sys for all file I/O. The react vitest setup mocks node:fs with memfs, but ts.sys uses the
 * real filesystem (it imported fs before mocks were applied).
 */
const sys = ts.sys;

/** Path to the monorepo root where node_modules with @types/react lives */
const MONOREPO_ROOT = path.resolve(__dirname, '../../../../..');

/**
 * Creates a temp project directory UNDER the monorepo root so that node_modules resolution
 * naturally walks up and finds @types/react.
 */
function createTempProject(files: Record<string, string>): {
  projectDir: string;
  configPath: string;
  filePaths: Record<string, string>;
} {
  // Place under monorepo root so node_modules resolution works
  const fixturesDir = path.join(MONOREPO_ROOT, '.test-fixtures');
  if (!sys.directoryExists(fixturesDir)) {
    sys.createDirectory(fixturesDir);
  }
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
        if (!sys.directoryExists(current)) {
          sys.createDirectory(current);
        }
      }
    }
    sys.writeFile(filePath, content);
    filePaths[name] = filePath;
  }

  return { projectDir, configPath, filePaths };
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
// Tests
// ---------------------------------------------------------------------------

describe('ComponentMetaProject', () => {
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
    const project = new ComponentMetaProject(ts, parsed, configPath);

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
    const project = new ComponentMetaProject(ts, parsed, configPath);

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
    const project = new ComponentMetaProject(ts, parsed, configPath);

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
    const project = new ComponentMetaProject(ts, parsed, configPath);

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
    const project = new ComponentMetaProject(ts, parsed, configPath);

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
    const project = new ComponentMetaProject(ts, parsed, configPath);

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
    const project = new ComponentMetaProject(ts, parsed, configPath);

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
    const project = new ComponentMetaProject(ts, parsed, configPath);

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
    const project = new ComponentMetaProject(ts, parsed, configPath);

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

  it('handles created event (new file added to project)', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
      'Button.tsx': `
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
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
    const getCommandLine = () =>
      ts.parseJsonSourceFileConfigFileContent(
        ts.readJsonConfigFile(configPath, ts.sys.readFile),
        ts.sys,
        projectDir,
        {},
        configPath
      );
    const project = new ComponentMetaProject(ts, parsed, configPath, new Map(), getCommandLine);

    try {
      // Initial: only Button
      const docs1 = project.extractDocs(filePaths['Button.tsx']);
      expect(docs1).toHaveLength(1);

      // Create a new file
      const cardPath = path.join(projectDir, 'Card.tsx');
      sys.writeFile(
        cardPath,
        `
        import React from 'react';
        export const Card = (_props: { title: string }) => <div />;
      `
      );

      // Notify as 'created' — should trigger shouldCheckRootFiles
      project.onFileChanged(cardPath, 'created');

      // Extract from the new file
      const docs2 = project.extractDocs(cardPath);
      expect(docs2).toHaveLength(1);
      expect(docs2[0].displayName).toBe('Card');
    } finally {
      project.dispose();
    }
  });

  it('handles deleted event (file removed from project)', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
      'Button.tsx': `
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
      'Card.tsx': `
        import React from 'react';
        export const Card = (_props: { title: string }) => <div />;
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
    const getCommandLine = () =>
      ts.parseJsonSourceFileConfigFileContent(
        ts.readJsonConfigFile(configPath, ts.sys.readFile),
        ts.sys,
        projectDir,
        {},
        configPath
      );
    const project = new ComponentMetaProject(ts, parsed, configPath, new Map(), getCommandLine);

    try {
      // Both files extract initially
      expect(project.extractDocs(filePaths['Button.tsx'])).toHaveLength(1);
      expect(project.extractDocs(filePaths['Card.tsx'])).toHaveLength(1);

      // Delete Card.tsx from disk
      sys.deleteFile!(filePaths['Card.tsx']);

      // Notify as 'deleted' — triggers shouldCheckRootFiles + breaks
      project.onFileChanged(filePaths['Card.tsx'], 'deleted');

      // Button should still work
      const docs = project.extractDocs(filePaths['Button.tsx']);
      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('Button');
    } finally {
      project.dispose();
    }
  });

  it('getSourceFilePaths returns non-node_modules files', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
      'Button.tsx': `
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
      'Card.tsx': `
        import React from 'react';
        export const Card = (_props: { title: string }) => <div />;
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
    const project = new ComponentMetaProject(ts, parsed, configPath);

    try {
      // Force program creation by extracting
      project.extractDocs(filePaths['Button.tsx']);

      const sourcePaths = project.getSourceFilePaths();
      // Should include our files
      expect(sourcePaths).toContain(filePaths['Button.tsx'].replace(/\\/g, '/'));
      expect(sourcePaths).toContain(filePaths['Card.tsx'].replace(/\\/g, '/'));
      // Should NOT include node_modules
      expect(sourcePaths.every((p) => !p.includes('node_modules'))).toBe(true);
    } finally {
      project.dispose();
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: ComponentMetaManager (same flow as generator.ts)
// ---------------------------------------------------------------------------

describe('ComponentMetaManager integration', () => {
  let tempDir: string | undefined;
  let manager: ComponentMetaManager;

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
    manager = new ComponentMetaManager(ts);

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
    manager = new ComponentMetaManager(ts);

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
    manager = new ComponentMetaManager(ts);

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

// ---------------------------------------------------------------------------
// Compound component detection via memberAccess
// ---------------------------------------------------------------------------

describe('extractPropsFromStories with memberAccess (compound components)', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      cleanup(tempDir);
      tempDir = undefined;
    }
  });

  it('extracts props for compound component sub-property via memberAccess', () => {
    // Simulates the Park UI / Ark UI pattern:
    // A namespace object `Accordion` with sub-components `.Root`, `.Item`, etc.
    // The story uses `<Accordion.Root>`, so memberAccess = 'Root'.
    const { projectDir, configPath, filePaths } = createTempProject({
      'accordion.tsx': `
        import React from 'react';

        interface RootProps {
          /** Allow multiple items open */
          multiple?: boolean;
          /** Default open items */
          defaultValue?: string[];
        }
        const Root = (props: RootProps) => <div />;

        interface ItemProps {
          value: string;
          disabled?: boolean;
        }
        const Item = (props: ItemProps) => <div />;

        interface TriggerProps {
          asChild?: boolean;
        }
        const Trigger = (props: TriggerProps) => <button />;

        export const Accordion = { Root, Item, Trigger };
      `,
      'accordion.stories.tsx': `
        import React from 'react';
        import { Accordion } from './accordion';
        export default { component: Accordion };
        export const Default = () => <Accordion.Root multiple><Accordion.Item value="a"><Accordion.Trigger /></Accordion.Item></Accordion.Root>;
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
    const project = new ComponentMetaProject(ts, parsed, configPath);

    try {
      // memberAccess='Root' → find <Accordion.Root /> in story, get Root's props
      const results = project.extractPropsFromStories([
        {
          storyFilePath: filePaths['accordion.stories.tsx'],
          componentPath: filePaths['accordion.tsx'],
          exportName: 'Accordion',
          importId: './accordion',
          memberAccess: 'Root',
        },
      ]);
      const docs = results.get(filePaths['accordion.stories.tsx'])?.get('Accordion');
      const doc = docs?.[0];

      expect(doc).toBeDefined();
      expect(doc!.props.multiple).toBeDefined();
      expect(doc!.props.multiple.required).toBe(false);
      expect(doc!.props.multiple.description).toBe('Allow multiple items open');
      expect(doc!.props.defaultValue).toBeDefined();
      // Should NOT have Item or Trigger props
      expect(doc!.props.value).toBeUndefined();
      expect(doc!.props.asChild).toBeUndefined();
    } finally {
      project.dispose();
    }
  });

  it('probes the member directly when memberAccess is set', () => {
    // When memberAccess is set (derived from outermost JSX like <Button.Aligner>),
    // the probe targets that member directly — no fallback needed.
    const { projectDir, configPath, filePaths } = createTempProject({
      'button.tsx': `
        import React from 'react';

        interface ButtonProps {
          /** Visual variant */
          variant?: 'solid' | 'outline';
          /** Color theme */
          color?: 'neutral' | 'primary';
          /** Disabled state */
          disabled?: boolean;
        }
        const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
          (props, ref) => <button ref={ref} />
        );

        interface AlignerProps {
          /** Side of the button to align */
          side?: 'start' | 'end';
          children?: React.ReactNode;
        }
        const Aligner = (props: AlignerProps) => <div />;

        interface GroupProps {
          /** Gap between buttons */
          gap?: number;
          children?: React.ReactNode;
        }
        const Group = (props: GroupProps) => <div />;

        const ButtonRoot = Button as typeof Button & {
          Aligner: typeof Aligner;
          Group: typeof Group;
        };
        ButtonRoot.Aligner = Aligner;
        ButtonRoot.Group = Group;

        export default ButtonRoot;
      `,
      'button.stories.tsx': `
        import React from 'react';
        import Button from './button';
        export default { component: Button };
        export const AlignerStory = () => <Button.Aligner side="start"><Button /></Button.Aligner>;
        export const ButtonStory = () => <Button variant="solid" />;
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
    const project = new ComponentMetaProject(ts, parsed, configPath);

    try {
      // memberAccess='Aligner' → find <Button.Aligner />, get Aligner's props
      const results = project.extractPropsFromStories([
        {
          storyFilePath: filePaths['button.stories.tsx'],
          componentPath: filePaths['button.tsx'],
          exportName: 'default',
          importId: './button',
          memberAccess: 'Aligner',
        },
      ]);

      const docs = results.get(filePaths['button.stories.tsx'])?.get('default');
      const doc = docs?.[0];
      expect(doc).toBeDefined();
      expect(doc!.props.side).toBeDefined();
      // Should NOT have Button's own props
      expect(doc!.props.variant).toBeUndefined();

      // Without memberAccess → find <Button />, get Button's own props
      const results2 = project.extractPropsFromStories([
        {
          storyFilePath: filePaths['button.stories.tsx'],
          componentPath: filePaths['button.tsx'],
          exportName: 'default',
          importId: './button',
        },
      ]);

      const docs2 = results2.get(filePaths['button.stories.tsx'])?.get('default');
      const doc2 = docs2?.[0];
      expect(doc2).toBeDefined();
      expect(doc2!.props.variant).toBeDefined();
      expect(doc2!.props.color).toBeDefined();
      // Should NOT have Aligner's props
      expect(doc2!.props.side).toBeUndefined();
    } finally {
      project.dispose();
    }
  });

  it('extracts props for different member accesses per entry', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
      'dialog.tsx': `
        import React from 'react';

        interface RootProps {
          open?: boolean;
          onOpenChange?: (open: boolean) => void;
        }
        const Root = (props: RootProps) => <div />;

        interface ContentProps {
          /** Trap focus inside dialog */
          trapFocus?: boolean;
        }
        const Content = (props: ContentProps) => <div />;

        export const Dialog = { Root, Content };
      `,
      'button.tsx': `
        import React from 'react';
        export interface ButtonProps {
          label: string;
          variant?: 'primary' | 'secondary';
        }
        export const Button = (props: ButtonProps) => <button />;
      `,
      'dialog.stories.tsx': `
        import React from 'react';
        import { Dialog } from './dialog';
        export default { component: Dialog };
        export const Default = () => <Dialog.Root open><Dialog.Content trapFocus /></Dialog.Root>;
      `,
      'button.stories.tsx': `
        import React from 'react';
        import { Button } from './button';
        export default { component: Button };
        export const Default = () => <Button label="Click" />;
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
    const project = new ComponentMetaProject(ts, parsed, configPath);

    try {
      // Mix: compound component with memberAccess + regular component
      const results = project.extractPropsFromStories([
        {
          storyFilePath: filePaths['dialog.stories.tsx'],
          componentPath: filePaths['dialog.tsx'],
          exportName: 'Dialog',
          importId: './dialog',
          memberAccess: 'Root',
        },
        {
          storyFilePath: filePaths['button.stories.tsx'],
          componentPath: filePaths['button.tsx'],
          exportName: 'Button',
          importId: './button',
        },
      ]);

      const dialogDocs = results.get(filePaths['dialog.stories.tsx'])?.get('Dialog');
      expect(dialogDocs?.[0]).toBeDefined();
      expect(dialogDocs![0].props.open).toBeDefined();
      expect(dialogDocs![0].props.onOpenChange).toBeDefined();

      const buttonDocs = results.get(filePaths['button.stories.tsx'])?.get('Button');
      expect(buttonDocs?.[0]).toBeDefined();
      expect(buttonDocs![0].props.label).toBeDefined();
      expect(buttonDocs![0].props.variant).toBeDefined();
    } finally {
      project.dispose();
    }
  });
});
