import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  invalidateParser,
  matchComponentDoc,
  parseWithReactDocgenTypescript,
} from './reactDocgenTypescript';
import { invalidateCache } from './utils';

// Create a temporary directory with a tsconfig and component files
// to exercise RDT against real files on disk (memfs can't be used with RDT).
function createTempProject(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'sb-rdt-test-'));
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(dir, name);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
  }
  return dir;
}

afterEach(() => {
  invalidateParser();
  invalidateCache();
  vi.restoreAllMocks();
});

describe('parseWithReactDocgenTypescript', () => {
  test('parses a simple component with props', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { jsx: 'react-jsx', strict: true },
        include: ['*.tsx'],
      }),
      'Button.tsx': `
        interface ButtonProps {
          /** The button label */
          label: string;
          disabled?: boolean;
        }
        export function Button(props: ButtonProps) {
          return null;
        }
      `,
    });

    vi.spyOn(process, 'cwd').mockReturnValue(dir);

    const docs = await parseWithReactDocgenTypescript(path.join(dir, 'Button.tsx'));

    expect(docs).toHaveLength(1);
    expect(docs[0].exportName).toBe('Button');
    expect(docs[0].props.label).toBeDefined();
    expect(docs[0].props.label.required).toBe(true);
    expect(docs[0].props.disabled).toBeDefined();
    expect(docs[0].props.disabled.required).toBe(false);

    // The output must be JSON-serializable (no circular refs, no non-serializable values)
    expect(() => JSON.stringify(docs[0])).not.toThrow();
  });

  test('parses union/enum prop types', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { jsx: 'react-jsx', strict: true },
        include: ['*.tsx'],
      }),
      'Tag.tsx': `
        interface TagProps {
          variant: 'primary' | 'secondary' | 'danger';
          size?: 'small' | 'large';
        }
        export function Tag(props: TagProps) {
          return null;
        }
      `,
    });

    vi.spyOn(process, 'cwd').mockReturnValue(dir);

    const docs = await parseWithReactDocgenTypescript(path.join(dir, 'Tag.tsx'));

    expect(docs).toHaveLength(1);
    expect(docs[0].exportName).toBe('Tag');
    expect(docs[0].props.variant).toBeDefined();
    expect(docs[0].props.variant.type.name).toBe('enum');

    // Must be JSON-serializable
    expect(() => JSON.stringify(docs[0])).not.toThrow();
  });

  test('parses component with default values', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { jsx: 'react-jsx', strict: true },
        include: ['*.tsx'],
      }),
      'Alert.tsx': `
        interface AlertProps {
          message: string;
          severity?: string;
        }
        export function Alert({ message, severity = 'info' }: AlertProps) {
          return null;
        }
      `,
    });

    vi.spyOn(process, 'cwd').mockReturnValue(dir);

    const docs = await parseWithReactDocgenTypescript(path.join(dir, 'Alert.tsx'));

    expect(docs).toHaveLength(1);
    expect(docs[0].props.severity?.defaultValue?.value).toBe('info');
  });

  test('output is compatible with manifest JSON serialization round-trip', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { jsx: 'react-jsx', strict: true },
        include: ['*.tsx'],
      }),
      'Button.tsx': `
        interface ButtonProps {
          label: string;
          disabled?: boolean;
          onClick?: () => void;
          variant?: 'primary' | 'secondary';
        }
        /** Primary UI component */
        export function Button(props: ButtonProps) {
          return null;
        }
      `,
    });

    vi.spyOn(process, 'cwd').mockReturnValue(dir);

    const docs = await parseWithReactDocgenTypescript(path.join(dir, 'Button.tsx'));
    const doc = docs[0];

    // Simulate what the manifest pipeline does: include the full RDT output in a manifest object
    const manifest = {
      id: 'test-button',
      name: 'Button',
      path: './src/Button.tsx',
      stories: [],
      import: 'import { Button } from "./Button";',
      jsDocTags: {},
      reactDocgenTypescript: doc,
    };

    // JSON.stringify must work without errors
    const json = JSON.stringify(manifest);
    expect(json).toBeDefined();

    // Round-trip must preserve the data
    const parsed = JSON.parse(json);
    expect(parsed.reactDocgenTypescript.exportName).toBe('Button');
    expect(parsed.reactDocgenTypescript.props.label).toBeDefined();
    expect(parsed.reactDocgenTypescript.props.label.required).toBe(true);
  });

  test('matchComponentDoc finds the right component', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { jsx: 'react-jsx', strict: true },
        include: ['*.tsx'],
      }),
      'Multi.tsx': `
        interface AProps { a: string; }
        interface BProps { b: number; }
        export function CompA(props: AProps) { return null; }
        export function CompB(props: BProps) { return null; }
      `,
    });

    vi.spyOn(process, 'cwd').mockReturnValue(dir);

    const docs = await parseWithReactDocgenTypescript(path.join(dir, 'Multi.tsx'));
    expect(docs).toHaveLength(2);

    const match = matchComponentDoc(docs, { importName: 'CompB' });
    expect(match?.exportName).toBe('CompB');
    expect(match?.props.b).toBeDefined();
  });

  test('large non-user prop sources are filtered out', async () => {
    // Create a component that extends HTMLButtonElement props (>30 props from a .d.ts)
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { jsx: 'react-jsx', strict: true },
        include: ['*.tsx'],
      }),
      'FancyButton.tsx': `
        import React from 'react';
        interface FancyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
          /** Custom label */
          label: string;
        }
        export function FancyButton(props: FancyButtonProps) {
          return null;
        }
      `,
    });

    vi.spyOn(process, 'cwd').mockReturnValue(dir);

    const docs = await parseWithReactDocgenTypescript(path.join(dir, 'FancyButton.tsx'));
    expect(docs).toHaveLength(1);

    // The user-defined 'label' prop should be present
    expect(docs[0].props.label).toBeDefined();

    // Bulk React/DOM props should be filtered (onClick, className, style, etc.)
    // These come from @types/react which has >30 props from a single .d.ts source
    const propNames = Object.keys(docs[0].props);
    expect(propNames).not.toContain('className');
    expect(propNames).not.toContain('style');
  });

  test('handles Vite-style project references tsconfig (files: [], references: [...])', async () => {
    // Modern Vite projects have a tsconfig.json with only project references:
    // { "files": [], "references": [{ "path": "./tsconfig.app.json" }] }
    // The actual include/compilerOptions are in tsconfig.app.json.
    // This test verifies that parseWithReactDocgenTypescript still finds components.
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        files: [],
        references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
      }),
      'tsconfig.app.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2023',
          jsx: 'react-jsx',
          strict: true,
          module: 'ESNext',
          moduleResolution: 'bundler',
          noEmit: true,
        },
        include: ['src'],
      }),
      'tsconfig.node.json': JSON.stringify({
        compilerOptions: { target: 'ES2023', module: 'ESNext' },
        include: ['vite.config.ts'],
      }),
      'src/Button.tsx': `
        interface ButtonProps {
          /** The button label */
          label: string;
          primary?: boolean;
          onClick?: () => void;
        }
        /** Primary UI component for user interaction */
        export const Button = ({ label, primary = false }: ButtonProps) => {
          return null;
        };
      `,
    });

    vi.spyOn(process, 'cwd').mockReturnValue(dir);

    const docs = await parseWithReactDocgenTypescript(path.join(dir, 'src/Button.tsx'));

    // With the Vite-style references tsconfig, RDT must still find the component.
    // Before the fix: docs was [] because tsconfig.json has files:[] and no include.
    expect(docs).toHaveLength(1);
    expect(docs[0].exportName).toBe('Button');
    expect(docs[0].props.label).toBeDefined();
    expect(docs[0].props.label.required).toBe(true);
    expect(docs[0].props.primary).toBeDefined();
    expect(docs[0].description).toBe('Primary UI component for user interaction');
  });
});
