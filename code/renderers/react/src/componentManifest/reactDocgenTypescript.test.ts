import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import {
  invalidateParser,
  matchComponentDoc,
  parseWithReactDocgenTypescript,
  readTsconfig,
} from './reactDocgenTypescript.ts';
import { invalidateCache } from './utils.ts';

const tempDirs: string[] = [];

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
      'Button.tsx': dedent`
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

    const docs = await parseWithReactDocgenTypescript(path.join(dir, 'Button.tsx'));

    expect(docs).toHaveLength(1);
    expect(docs[0].exportName).toBe('Button');
    expect(docs[0].props.label).toBeDefined();
    expect(docs[0].props.label.required).toBe(true);
    expect(docs[0].props.disabled).toBeDefined();
    expect(docs[0].props.disabled.required).toBe(false);
    expect(() => JSON.stringify(docs[0])).not.toThrow();
  });

  test('parses union and enum prop types', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { jsx: 'react-jsx', strict: true },
        include: ['*.tsx'],
      }),
      'Tag.tsx': dedent`
        interface TagProps {
          variant: 'primary' | 'secondary' | 'danger';
          size?: 'small' | 'large';
        }

        export function Tag(props: TagProps) {
          return null;
        }
      `,
    });

    const docs = await parseWithReactDocgenTypescript(path.join(dir, 'Tag.tsx'));

    expect(docs).toHaveLength(1);
    expect(docs[0].exportName).toBe('Tag');
    expect(docs[0].props.variant).toBeDefined();
    expect(docs[0].props.variant.type.name).toBe('enum');
    expect(() => JSON.stringify(docs[0])).not.toThrow();
  });

  test('parses component default values', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { jsx: 'react-jsx', strict: true },
        include: ['*.tsx'],
      }),
      'Alert.tsx': dedent`
        interface AlertProps {
          message: string;
          severity?: string;
        }

        export function Alert({ message, severity = 'info' }: AlertProps) {
          return null;
        }
      `,
    });

    const docs = await parseWithReactDocgenTypescript(path.join(dir, 'Alert.tsx'));

    expect(docs).toHaveLength(1);
    expect(docs[0].props.severity?.defaultValue?.value).toBe('info');
  });

  test('round-trips through manifest JSON serialization', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { jsx: 'react-jsx', strict: true },
        include: ['*.tsx'],
      }),
      'Button.tsx': dedent`
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

    const docs = await parseWithReactDocgenTypescript(path.join(dir, 'Button.tsx'));
    const manifest = {
      id: 'test-button',
      name: 'Button',
      path: './src/Button.tsx',
      stories: [],
      import: 'import { Button } from "./Button";',
      jsDocTags: {},
      reactDocgenTypescript: docs[0],
    };

    const json = JSON.stringify(manifest);
    const parsed = JSON.parse(json);

    expect(json).toBeDefined();
    expect(parsed.reactDocgenTypescript.exportName).toBe('Button');
    expect(parsed.reactDocgenTypescript.props.label).toBeDefined();
    expect(parsed.reactDocgenTypescript.props.label.required).toBe(true);
  });

  test('matchComponentDoc finds the requested component', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { jsx: 'react-jsx', strict: true },
        include: ['*.tsx'],
      }),
      'Multi.tsx': dedent`
        interface AProps {
          a: string;
        }

        interface BProps {
          b: number;
        }

        export function CompA(props: AProps) {
          return null;
        }

        export function CompB(props: BProps) {
          return null;
        }
      `,
    });

    const docs = await parseWithReactDocgenTypescript(path.join(dir, 'Multi.tsx'));
    const match = matchComponentDoc(docs, { importName: 'CompB' });

    expect(docs).toHaveLength(2);
    expect(match?.exportName).toBe('CompB');
    expect(match?.props.b).toBeDefined();
  });

  test('filters large non-user prop sources', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { jsx: 'react-jsx', strict: true },
        include: ['*.tsx'],
      }),
      'FancyButton.tsx': dedent`
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

    const docs = await parseWithReactDocgenTypescript(path.join(dir, 'FancyButton.tsx'));
    const propNames = Object.keys(docs[0].props);

    expect(docs).toHaveLength(1);
    expect(docs[0].props.label).toBeDefined();
    expect(propNames).not.toContain('className');
    expect(propNames).not.toContain('style');
  });

  test('handles Vite-style project references tsconfig files', async () => {
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
      'src/Button.tsx': dedent`
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

    const docs = await parseWithReactDocgenTypescript(path.join(dir, 'src/Button.tsx'));

    expect(docs).toHaveLength(1);
    expect(docs[0].exportName).toBe('Button');
    expect(docs[0].props.label).toBeDefined();
    expect(docs[0].props.label.required).toBe(true);
    expect(docs[0].props.primary).toBeDefined();
    expect(docs[0].description).toBe('Primary UI component for user interaction');
  });
});

describe('readTsconfig', () => {
  const projectDir = path.resolve('/project');
  const configPath = path.join(projectDir, 'tsconfig.json');
  const buttonPath = path.join(projectDir, 'Button.tsx');
  const cardPath = path.join(projectDir, 'Card.tsx');

  test('reuses tsconfig from cache when parse was successful', () => {
    const { typescript, readConfigFile, parseJsonConfigFileContent } = createTypescriptStub({
      [configPath]: { fileNames: [buttonPath] },
    });

    const first = readTsconfig(typescript, configPath);
    const second = readTsconfig(typescript, configPath);

    expect(second).toBe(first);
    expect(readConfigFile).toHaveBeenCalledTimes(1);
    expect(parseJsonConfigFileContent).toHaveBeenCalledTimes(1);
  });

  test('does not cache a config with errors', () => {
    const { typescript, readConfigFile } = createTypescriptStub({
      [configPath]: { readError: true },
    });

    expect(readTsconfig(typescript, configPath).error).toBeDefined();
    expect(readTsconfig(typescript, configPath).error).toBeDefined();
    expect(readConfigFile).toHaveBeenCalledTimes(2);
  });

  test('does not cache a config whose parse reports diagnostics', () => {
    const { typescript, parseJsonConfigFileContent } = createTypescriptStub({
      [configPath]: { parseError: true },
    });

    expect(readTsconfig(typescript, configPath).parsed.errors).toHaveLength(1);
    expect(readTsconfig(typescript, configPath).parsed.errors).toHaveLength(1);
    expect(parseJsonConfigFileContent).toHaveBeenCalledTimes(2);
  });

  test('reparses after cache invalidation', () => {
    const fixtures = { [configPath]: { fileNames: [buttonPath] } };
    const { typescript, readConfigFile } = createTypescriptStub(fixtures);

    expect(readTsconfig(typescript, configPath).parsed.fileNames).toEqual([buttonPath]);

    fixtures[configPath] = { fileNames: [cardPath] };

    expect(readTsconfig(typescript, configPath).parsed.fileNames).toEqual([buttonPath]);
    expect(readConfigFile).toHaveBeenCalledTimes(1);

    invalidateCache();

    expect(readTsconfig(typescript, configPath).parsed.fileNames).toEqual([cardPath]);
    expect(readConfigFile).toHaveBeenCalledTimes(2);
  });
});

type TsconfigFixture = { readError?: boolean; parseError?: boolean; fileNames?: string[] };

function createTypescriptStub(fixtures: Record<string, TsconfigFixture>) {
  const readConfigFile = vi.fn((filePath: string) => {
    if (fixtures[filePath]?.readError) {
      return { error: { messageText: `Cannot read file ${filePath}` } };
    }
    return { config: { filePath } };
  });

  const parseJsonConfigFileContent = vi.fn((config?: { filePath: string }) => {
    const fixture = config ? fixtures[config.filePath] : undefined;
    return {
      options: {},
      fileNames: fixture?.fileNames ?? [],
      errors: fixture?.parseError ? [{ messageText: 'File tsconfig.base.json not found' }] : [],
    };
  });

  return {
    typescript: {
      readConfigFile,
      parseJsonConfigFileContent,
      sys: { readFile: () => undefined, useCaseSensitiveFileNames: true },
    } as unknown as Parameters<typeof readTsconfig>[0],
    readConfigFile,
    parseJsonConfigFileContent,
  };
}

function createTempProject(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'sb-rdt-test-'));
  tempDirs.push(dir);

  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(dir, name);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
  }

  vi.spyOn(process, 'cwd').mockReturnValue(dir);
  return dir;
}
