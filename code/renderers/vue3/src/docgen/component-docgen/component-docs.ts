import { readFileSync } from 'node:fs';

import { readDeclarationDocs } from 'storybook/internal/common';
import {
  type ReferenceModule,
  SourceEditor,
  parseReferenceModule,
} from 'storybook/internal/csf-tools';

import { parse as parseSfc } from '@vue/language-core';

// A `.vue` file as the module its importers see: its `<script>` block, ending in the default
// export Vue's language tools add where the block writes none.
function readSfcModule(filePath: string): ReferenceModule | undefined {
  try {
    const script = parseSfc(readFileSync(filePath, 'utf8')).descriptor.script?.content ?? '';
    const editor = new SourceEditor(script, filePath);
    return {
      filePath,
      editor: editor.program.body.some(({ type }) => type === 'ExportDefaultDeclaration')
        ? editor
        : new SourceEditor(`${script}\nexport default {};`, filePath),
    };
  } catch {
    return undefined;
  }
}

// The docs in the docblock on a component's declaration. For a `.vue` file that is the default
// export of its `<script>` block.
export const readComponentDocs = (component: { path: string; exportName: string }) =>
  readDeclarationDocs(component, (filePath) =>
    (filePath.endsWith('.vue') ? readSfcModule : parseReferenceModule)(filePath)
  );
