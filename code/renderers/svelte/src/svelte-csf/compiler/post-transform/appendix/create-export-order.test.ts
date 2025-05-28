import { print } from 'esrap';
import { describe, it } from 'vitest';

import { createExportOrderVariableDeclaration } from './create-export-order.js';

describe(createExportOrderVariableDeclaration.name, () => {
  it('correctly creates a variable with named exports order', ({ expect }) => {
    const stringified = print(
      createExportOrderVariableDeclaration({
        storiesIdentifiers: [
          { exportName: 'Default', name: 'Default' },
          { exportName: 'SomeComponent', name: 'Some Component' },
          { exportName: 'ThisNameIsWeird', name: 'This-Name-Is-Weird' },
        ],
      })
    ).code;

    expect(stringified).toMatchInlineSnapshot(
      `
			"export const __namedExportsOrder = [
				"Default",
				"SomeComponent",
				"ThisNameIsWeird"
			];"
		`
    );
  });
});
