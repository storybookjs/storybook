import { print } from 'esrap';
import { describe, it } from 'vitest';

import { createExportOrderVariable } from './create-export-order';

describe(createExportOrderVariable.name, () => {
  it('correctly creates a variable with named exports order', ({ expect }) => {
    const stringified = print(
      createExportOrderVariable({
        storyIdentifiers: [
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
