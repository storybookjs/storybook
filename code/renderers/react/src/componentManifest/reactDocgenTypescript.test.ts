import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  invalidateParser,
  matchComponentDoc,
  parseWithReactDocgenTypescript,
} from './reactDocgenTypescript.ts';
import { invalidateCache } from './utils.ts';

const tempDirs: string[] = [];

/**
 * Create a temporary directory with a tsconfig and component files. RDT builds a real TypeScript
 * program, so memfs cannot be used here — files must exist on disk.
 */
function createTempProject(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'sb-rdt-test-'));
  tempDirs.push(dir);
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
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
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

    // Manifest pipeline JSON-stringifies RDT output — keep it serializable.
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

    const manifest = {
      id: 'test-button',
      name: 'Button',
      path: './src/Button.tsx',
      stories: [],
      import: 'import { Button } from "./Button";',
      jsDocTags: {},
      reactDocgenTypescript: doc,
    };

    const json = JSON.stringify(manifest);
    expect(json).toBeDefined();

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

    expect(docs[0].props.label).toBeDefined();

    // Bulk React/DOM props come from @types/react (>30 props from one .d.ts) and should be dropped.
    const propNames = Object.keys(docs[0].props);
    expect(propNames).not.toContain('className');
    expect(propNames).not.toContain('style');
  });

  test('handles Vite-style project references tsconfig (files: [], references: [...])', async () => {
    // Modern Vite projects use a root tsconfig that only lists project references; the real
    // include/compilerOptions live in tsconfig.app.json. Without following those references, RDT
    // builds an empty program and returns no component docs (see #34414).
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

    expect(docs).toHaveLength(1);
    expect(docs[0].exportName).toBe('Button');
    expect(docs[0].props.label).toBeDefined();
    expect(docs[0].props.label.required).toBe(true);
    expect(docs[0].props.primary).toBeDefined();
    expect(docs[0].description).toBe('Primary UI component for user interaction');
  });
});
