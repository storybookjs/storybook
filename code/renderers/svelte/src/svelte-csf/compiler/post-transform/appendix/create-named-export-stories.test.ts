import { print } from 'esrap';
import ts from 'esrap/languages/ts';
import { describe, expect, it } from 'vitest';

import { createNamedExportStories } from './create-named-export-stories.ts';

describe(createNamedExportStories.name, () => {
  it('exports each story variable under its export name', () => {
    const namedExportDeclaration = createNamedExportStories({
      storiesIdentifiers: [
        {
          exportName: 'Default',
          name: undefined,
        },
        {
          exportName: 'Primary',
          name: 'Primary',
        },
        {
          exportName: 'Secondary',
          name: 'Secondary',
        },
        {
          exportName: 'Disabled',
          name: 'Disabled',
        },
      ],
    });

    expect(print(namedExportDeclaration, ts()).code).toMatchInlineSnapshot(`
      "export {
      	$__Default as Default,
      	$__Primary as Primary,
      	$__Secondary as Secondary,
      	$__Disabled as Disabled
      };"
    `);
  });
});
