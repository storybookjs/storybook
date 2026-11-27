import * as fs from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { join, normalize, relative } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reactDocgen } from './react-docgen.ts';

vi.mock('node:fs', { spy: true });

let projectDir: string;
let externalDir: string;

type AddWatchFile = (id: string) => void;
type ReactDocgenPlugin = {
  transform: (
    this: { addWatchFile: AddWatchFile },
    src: string,
    id: string
  ) => Promise<{ code: string } | void>;
  watchChange: (id: string, change: { event: 'update' | 'create' | 'delete' }) => void;
};

async function createReactDocgenTestPlugin() {
  const plugin = (await reactDocgen()) as ReactDocgenPlugin;
  const addWatchFile = vi.fn<AddWatchFile>();

  return {
    addWatchFile,
    transform(src: string, id: string, watchFile = addWatchFile) {
      return plugin.transform.call({ addWatchFile: watchFile }, src, id);
    },
    watchChange: plugin.watchChange.bind(plugin),
  };
}

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

    const { addWatchFile, transform, watchChange } = await createReactDocgenTestPlugin();
    const readFile = vi.mocked(fs.readFileSync);
    const source = (name: string) => `
import type { SharedProps } from '${relative(projectDir, sharedProps)}';

export const ${name} = ({ label }: SharedProps) => <button>{label}</button>;
`;

    const firstWatchFile = vi.fn<AddWatchFile>();
    const first = await transform(
      source('PrimaryButton'),
      join(projectDir, 'PrimaryButton.tsx'),
      firstWatchFile
    );
    const second = await transform(
      source('SecondaryButton'),
      join(projectDir, 'SecondaryButton.tsx')
    );

    expect(first?.code).toContain('"label"');
    expect(second?.code).toContain('"label"');
    expect(firstWatchFile.mock.calls.map(([filename]) => normalize(filename))).toContain(
      sharedProps
    );
    expect(addWatchFile.mock.calls.map(([filename]) => normalize(filename))).toContain(sharedProps);
    expect(
      readFile.mock.calls.filter(([filename]) => normalize(filename) === sharedProps)
    ).toHaveLength(1);

    await writeFile(sharedProps, 'export interface SharedProps { disabled: boolean; }');
    watchChange(sharedProps, { event: 'update' });

    const changed = await transform(
      source('TertiaryButton'),
      join(projectDir, 'TertiaryButton.tsx')
    );

    expect(changed?.code).toContain('"disabled"');
    expect(
      readFile.mock.calls.filter(([filename]) => normalize(filename) === sharedProps)
    ).toHaveLength(2);
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

    const { addWatchFile, transform, watchChange } = await createReactDocgenTestPlugin();
    const source = (name: string) => `
import type { SharedProps } from '@props';

export const ${name} = (props: SharedProps) => <button>{JSON.stringify(props)}</button>;
`;
    const first = await transform(source('FirstButton'), join(projectDir, 'FirstButton.tsx'));
    expect(first?.code).toContain('"first"');
    expect(addWatchFile.mock.calls.map(([filename]) => normalize(filename))).toContain(
      tsconfigPath
    );

    await writeFile(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: { baseUrl: '.', paths: { '@props': ['./second-props'] } },
      })
    );
    watchChange(tsconfigPath, { event: 'update' });

    const second = await transform(source('SecondButton'), join(projectDir, 'SecondButton.tsx'));
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

    const { transform } = await createReactDocgenTestPlugin();
    const source = (name: string) => `
import type { SharedProps } from '@props';

export const ${name} = (props: SharedProps) => <button>{JSON.stringify(props)}</button>;
`;

    const first = await transform(source('FirstButton'), join(firstDir, 'FirstButton.tsx'));
    const second = await transform(source('SecondButton'), join(secondDir, 'SecondButton.tsx'));

    expect(first?.code).toContain('"first"');
    expect(second?.code).toContain('"second"');
  });

  it('refreshes failed resolutions when imported files are added or deleted', async () => {
    const propsPath = join(projectDir, 'generated-props.ts');
    const { transform, watchChange } = await createReactDocgenTestPlugin();
    const source = (name: string) => `
import type { GeneratedProps } from './generated-props';

export const ${name} = (props: GeneratedProps) => <button>{JSON.stringify(props)}</button>;
`;

    const beforeCreate = await transform(
      source('BeforeCreate'),
      join(projectDir, 'BeforeCreate.tsx')
    );
    expect(beforeCreate?.code).not.toContain('"generated"');

    await writeFile(propsPath, 'export interface GeneratedProps { generated: string; }');
    watchChange(propsPath, { event: 'create' });

    const afterCreate = await transform(source('AfterCreate'), join(projectDir, 'AfterCreate.tsx'));
    expect(afterCreate?.code).toContain('"generated"');

    await rm(propsPath);
    watchChange(propsPath, { event: 'delete' });

    const afterDelete = await transform(source('AfterDelete'), join(projectDir, 'AfterDelete.tsx'));
    expect(afterDelete?.code).not.toContain('"generated"');
  });
});
