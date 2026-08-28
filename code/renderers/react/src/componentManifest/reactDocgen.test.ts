import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import { matchPath, parseWithReactDocgen } from './reactDocgen.ts';
import { invalidateCache } from './utils.ts';

const tempDirs: string[] = [];

beforeEach(() => {
  invalidateCache();
});

afterEach(() => {
  vi.restoreAllMocks();

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function parse(code: string, name = 'Component.tsx') {
  const filename = `/virtual/${name}`;
  return parseWithReactDocgen(code, filename);
}

describe('parseWithReactDocgen exportName coverage', () => {
  test('inline default export function declaration', async () => {
    const code = dedent /* tsx */ `
      import React from 'react';
      export default function Foo() { return <></> }
    `;
    expect(await parse(code)).toMatchInlineSnapshot(`
      [
        {
          "actualName": "Foo",
          "definedInFile": "/virtual/Component.tsx",
          "description": "",
          "displayName": "Foo",
          "exportName": "default",
          "methods": [],
        },
      ]
    `);
  });

  test('inline default export class declaration', async () => {
    const code = dedent /* tsx */ `
      import React from 'react';
      export default class Foo extends React.Component { render(){ return null } }
    `;
    expect(await parse(code)).toMatchInlineSnapshot(`
      [
        {
          "actualName": "Foo",
          "definedInFile": "/virtual/Component.tsx",
          "description": "",
          "displayName": "Foo",
          "exportName": "default",
          "methods": [],
        },
      ]
    `);
  });

  test('inline anonymous default export (arrow function)', async () => {
    const code = dedent /* tsx */ `
      export default () => <div/>;
    `;
    expect(await parse(code)).toMatchInlineSnapshot(`
      [
        {
          "actualName": "",
          "definedInFile": "/virtual/Component.tsx",
          "description": "",
          "exportName": "default",
          "methods": [],
        },
      ]
    `);
  });

  test('separate default export identifier', async () => {
    const code = dedent /* tsx */ `
      const Foo = () => <div/>;
      export default Foo;
    `;
    expect(await parse(code)).toMatchInlineSnapshot(`
      [
        {
          "actualName": "Foo",
          "definedInFile": "/virtual/Component.tsx",
          "description": "",
          "displayName": "Foo",
          "exportName": "default",
          "methods": [],
        },
      ]
    `);
  });

  test('named export: export const Foo = ...', async () => {
    const code = dedent /* tsx */ `
      export const Foo = () => <div/>;
    `;
    expect(await parse(code)).toMatchInlineSnapshot(`
      [
        {
          "actualName": "Foo",
          "definedInFile": "/virtual/Component.tsx",
          "description": "",
          "displayName": "Foo",
          "exportName": "Foo",
          "methods": [],
        },
      ]
    `);
  });

  test('named export: export function Foo() {}', async () => {
    const code = dedent /* tsx */ `
      export function Foo() { return <div/> }
    `;
    expect(await parse(code)).toMatchInlineSnapshot(`
      [
        {
          "actualName": "Foo",
          "definedInFile": "/virtual/Component.tsx",
          "description": "",
          "displayName": "Foo",
          "exportName": "Foo",
          "methods": [],
        },
      ]
    `);
  });

  test('export list: export { Foo }', async () => {
    const code = dedent /* tsx */ `
      const Foo = () => <div/>;
      export { Foo };
    `;
    expect(await parse(code)).toMatchInlineSnapshot(`
      [
        {
          "actualName": "Foo",
          "definedInFile": "/virtual/Component.tsx",
          "description": "",
          "displayName": "Foo",
          "exportName": "Foo",
          "methods": [],
        },
      ]
    `);
  });

  test('aliased named export: export { Foo as Bar }', async () => {
    const code = dedent /* tsx */ `
      const Foo = () => <div/>;
      export { Foo as Bar };
    `;
    expect(await parse(code)).toMatchInlineSnapshot(`
      [
        {
          "actualName": "Foo",
          "definedInFile": "/virtual/Component.tsx",
          "description": "",
          "displayName": "Foo",
          "exportName": "Bar",
          "methods": [],
        },
      ]
    `);
  });

  test('aliased to default: export { Foo as default }', async () => {
    const code = dedent /* tsx */ `
      const Foo = () => <div/>;
      export { Foo as default };
    `;
    expect(await parse(code)).toMatchInlineSnapshot(`
      [
        {
          "actualName": "Foo",
          "definedInFile": "/virtual/Component.tsx",
          "description": "",
          "displayName": "Foo",
          "exportName": "default",
          "methods": [],
        },
      ]
    `);
  });

  test('multiple components with different export styles', async () => {
    const code = dedent /* tsx */ `
      export function A(){ return null }
      const B = () => <div/>;
      export { B as Beta };
      const C = () => <div/>;
      export default C;
    `;
    expect(await parse(code)).toMatchInlineSnapshot(`
      [
        {
          "actualName": "B",
          "definedInFile": "/virtual/Component.tsx",
          "description": "",
          "displayName": "B",
          "exportName": "Beta",
          "methods": [],
        },
        {
          "actualName": "C",
          "definedInFile": "/virtual/Component.tsx",
          "description": "",
          "displayName": "C",
          "exportName": "default",
          "methods": [],
        },
      ]
    `);
  });

  test('matchPath resolves aliases from a referenced app tsconfig', () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        files: [],
        references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
      }),
      'tsconfig.app.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@ui/*': ['src/*'],
          },
        },
        include: ['src'],
      }),
      'tsconfig.node.json': JSON.stringify({
        include: ['vite.config.ts'],
      }),
      'src/Button.tsx': 'export const Button = () => null;',
      'src/Entry.tsx': 'export * from "@ui/Button";',
    });

    const entryPath = join(dir, 'src/Entry.tsx');
    vi.spyOn(process, 'cwd').mockReturnValue(dir);

    expect(matchPath('@ui/Button', entryPath)).toBe(join(dir, 'src/Button'));
  });

  test('matchPath resolves aliases inherited from a parent tsconfig without baseUrl', () => {
    const dir = createTempProject({
      'tsconfig.base.json': JSON.stringify({
        compilerOptions: {
          paths: {
            '@tools/my-plugin': ['./tools/my-plugin/src'],
            '@tools/my-plugin/*': ['./tools/my-plugin/src/*'],
          },
        },
      }),
      'test-app/tsconfig.json': JSON.stringify({
        extends: '../tsconfig.base.json',
        compilerOptions: {
          module: 'esnext',
        },
        include: ['src'],
      }),
      'test-app/src/Component.tsx': 'export const Component = () => null;',
      'tools/my-plugin/src/const.ts': 'export const MY_CONST = "hello";',
      'tools/my-plugin/src/index.ts': 'export const MY_CONST = "hello";',
    });

    const importerPath = join(dir, 'test-app/src/Component.tsx');
    vi.spyOn(process, 'cwd').mockReturnValue(join(dir, 'test-app'));

    expect(matchPath('@tools/my-plugin', importerPath)).toBe(join(dir, 'tools/my-plugin/src'));
    expect(matchPath('@tools/my-plugin/const', importerPath)).toBe(
      join(dir, 'tools/my-plugin/src/const')
    );
  });
});

function createTempProject(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'storybook-react-docgen-'));
  tempDirs.push(dir);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(dir, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
  }

  return dir;
}
