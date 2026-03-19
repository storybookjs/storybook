import { describe, expect, test } from 'vitest';

import { dedent } from 'ts-dedent';

import { parseWithReactDocgen } from './reactDocgen';

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
});
