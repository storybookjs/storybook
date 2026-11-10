import { print } from 'esrap';
import ts from 'esrap/languages/ts';
import { describe, expect, it } from 'vitest';

import { createExportOrderVariableDeclaration } from './create-export-order.ts';

describe(createExportOrderVariableDeclaration.name, () => {
  it('correctly creates a variable with named exports order', () => {
    const stringified = print(
      createExportOrderVariableDeclaration({
        storiesIdentifiers: [
          { exportName: 'Default', name: 'Default' },
          { exportName: 'SomeComponent', name: 'Some Component' },
          { exportName: 'ThisNameIsWeird', name: 'This-Name-Is-Weird' },
        ],
      }),
      ts()
    ).code;

    expect(stringified).toMatchInlineSnapshot(
      `"export const __namedExportsOrder = ['Default', 'SomeComponent', 'ThisNameIsWeird'];"`
    );
  });
});
