import * as fs from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reactDocgen } from './react-docgen.ts';

vi.mock('node:fs', { spy: true });

let projectDir: string;
let externalDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'sb-react-docgen-cache-'));
  externalDir = await mkdtemp(join(tmpdir(), 'sb-react-docgen-external-'));
  vi.spyOn(process, 'cwd').mockReturnValue(projectDir);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all([
    rm(projectDir, { recursive: true, force: true }),
    rm(externalDir, { recursive: true, force: true }),
  ]);
});

describe('react-docgen cache', () => {
  it('reuses parsed shared props and invalidates them after an edit', async () => {
    const sharedProps = join(externalDir, 'shared-props.ts');
    await writeFile(
      sharedProps,
      `export interface SharedProps {
  /** The button label */
  label: string;
}`
    );

    const plugin = (await reactDocgen()) as {
      transform: (
        this: { addWatchFile: (id: string) => void },
        src: string,
        id: string
      ) => Promise<{
        code: string;
      } | void>;
      watchChange: (id: string, change: { event: 'update' | 'create' | 'delete' }) => void;
    };
    const addWatchFile = vi.fn();
    const readFile = vi.mocked(fs.readFileSync);
    const source = (name: string) => `
import type { SharedProps } from '${relative(projectDir, sharedProps).replaceAll('\\', '/')}';

export const ${name} = ({ label }: SharedProps) => <button>{label}</button>;
`;

    const first = await plugin.transform.call(
      { addWatchFile },
      source('PrimaryButton'),
      join(projectDir, 'PrimaryButton.tsx')
    );
    const second = await plugin.transform.call(
      { addWatchFile },
      source('SecondaryButton'),
      join(projectDir, 'SecondaryButton.tsx')
    );

    expect(first?.code).toContain('"label"');
    expect(second?.code).toContain('"label"');
    expect(addWatchFile).toHaveBeenCalledWith(sharedProps);
    expect(readFile.mock.calls.filter(([filename]) => filename === sharedProps)).toHaveLength(1);

    await writeFile(sharedProps, 'export interface SharedProps { disabled: boolean; }');
    plugin.watchChange(sharedProps, { event: 'update' });

    const changed = await plugin.transform.call(
      { addWatchFile },
      source('TertiaryButton'),
      join(projectDir, 'TertiaryButton.tsx')
    );

    expect(changed?.code).toContain('"disabled"');
    expect(readFile.mock.calls.filter(([filename]) => filename === sharedProps)).toHaveLength(2);
  });

  it('refreshes tsconfig path resolution after its configuration changes', async () => {
    const tsconfigPath = join(projectDir, 'tsconfig.json');
    const firstProps = join(projectDir, 'first-props.ts');
    const secondProps = join(projectDir, 'second-props.ts');
    await Promise.all([
      writeFile(firstProps, 'export interface SharedProps { first: string; }'),
      writeFile(secondProps, 'export interface SharedProps { second: boolean; }'),
      writeFile(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: { baseUrl: '.', paths: { '@props': ['./first-props'] } },
        })
      ),
    ]);

    const plugin = (await reactDocgen()) as {
      transform: (
        this: { addWatchFile: (id: string) => void },
        src: string,
        id: string
      ) => Promise<{
        code: string;
      } | void>;
      watchChange: (id: string, change: { event: 'update' | 'create' | 'delete' }) => void;
    };
    const source = (name: string) => `
import type { SharedProps } from '@props';

export const ${name} = (props: SharedProps) => <button>{JSON.stringify(props)}</button>;
`;
    const addWatchFile = vi.fn();

    const first = await plugin.transform.call(
      { addWatchFile },
      source('FirstButton'),
      join(projectDir, 'FirstButton.tsx')
    );
    expect(first?.code).toContain('"first"');
    expect(addWatchFile).toHaveBeenCalledWith(tsconfigPath);

    await writeFile(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: { baseUrl: '.', paths: { '@props': ['./second-props'] } },
      })
    );
    plugin.watchChange(tsconfigPath, { event: 'update' });

    const second = await plugin.transform.call(
      { addWatchFile: vi.fn() },
      source('SecondButton'),
      join(projectDir, 'SecondButton.tsx')
    );
    expect(second?.code).toContain('"second"');
  });

  it('keeps resolutions separate for different tsconfig path mappings', async () => {
    const firstDir = join(projectDir, 'first');
    const secondDir = join(projectDir, 'second');
    await Promise.all([mkdir(firstDir), mkdir(secondDir)]);
    await Promise.all([
      writeFile(join(firstDir, 'props.ts'), 'export interface SharedProps { first: string; }'),
      writeFile(join(secondDir, 'props.ts'), 'export interface SharedProps { second: boolean; }'),
      writeFile(
        join(firstDir, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@props': ['./props'] } } })
      ),
      writeFile(
        join(secondDir, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@props': ['./props'] } } })
      ),
    ]);

    const plugin = (await reactDocgen()) as {
      transform: (
        this: { addWatchFile: (id: string) => void },
        src: string,
        id: string
      ) => Promise<{
        code: string;
      } | void>;
    };
    const source = (name: string) => `
import type { SharedProps } from '@props';

export const ${name} = (props: SharedProps) => <button>{JSON.stringify(props)}</button>;
`;

    const first = await plugin.transform.call(
      { addWatchFile: vi.fn() },
      source('FirstButton'),
      join(firstDir, 'FirstButton.tsx')
    );
    const second = await plugin.transform.call(
      { addWatchFile: vi.fn() },
      source('SecondButton'),
      join(secondDir, 'SecondButton.tsx')
    );

    expect(first?.code).toContain('"first"');
    expect(second?.code).toContain('"second"');
  });

  it('refreshes failed resolutions when imported files are added or deleted', async () => {
    const propsPath = join(projectDir, 'generated-props.ts');
    const plugin = (await reactDocgen()) as {
      transform: (
        this: { addWatchFile: (id: string) => void },
        src: string,
        id: string
      ) => Promise<{
        code: string;
      } | void>;
      watchChange: (id: string, change: { event: 'update' | 'create' | 'delete' }) => void;
    };
    const source = (name: string) => `
import type { GeneratedProps } from './generated-props';

export const ${name} = (props: GeneratedProps) => <button>{JSON.stringify(props)}</button>;
`;

    const beforeCreate = await plugin.transform.call(
      { addWatchFile: vi.fn() },
      source('BeforeCreate'),
      join(projectDir, 'BeforeCreate.tsx')
    );
    expect(beforeCreate?.code).not.toContain('"generated"');

    await writeFile(propsPath, 'export interface GeneratedProps { generated: string; }');
    plugin.watchChange(propsPath, { event: 'create' });

    const afterCreate = await plugin.transform.call(
      { addWatchFile: vi.fn() },
      source('AfterCreate'),
      join(projectDir, 'AfterCreate.tsx')
    );
    expect(afterCreate?.code).toContain('"generated"');

    await rm(propsPath);
    plugin.watchChange(propsPath, { event: 'delete' });

    const afterDelete = await plugin.transform.call(
      { addWatchFile: vi.fn() },
      source('AfterDelete'),
      join(projectDir, 'AfterDelete.tsx')
    );
    expect(afterDelete?.code).not.toContain('"generated"');
  });
});
