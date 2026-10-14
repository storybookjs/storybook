import { describe, expect, it } from 'vitest';

import { babelParse, traverse } from 'storybook/internal/babel';
import { collectImportBindings, type ImportBinding } from 'storybook/internal/csf-tools';

import { buildSnippetImportBlock } from './snippet-imports.ts';

function bindings(source: string) {
  const result = new Map<string, ImportBinding>();
  traverse(babelParse(source), {
    Program(path) {
      for (const [name, binding] of collectImportBindings(path)) result.set(name, binding);
      path.stop();
    },
  });
  return result;
}

describe('snippet imports', () => {
  it.each(['./Button.svelte', '$lib/Button.svelte', 'my-ds'])('keeps the source %s', (source) => {
    expect(
      buildSnippetImportBlock('<Button label="Save" />', {
        bindings: bindings(`import Button from '${source}';`),
      })
    ).toEqual({ block: `<script>\n  import Button from '${source}';\n</script>`, unresolved: [] });
  });

  it('applies the meta import override while keeping the local binding', () => {
    expect(
      buildSnippetImportBlock('<LocalButton />', {
        bindings: bindings("import LocalButton from './Button.svelte';"),
        importOverride: "import { Button } from 'my-ds';",
      })
    ).toEqual({
      block: "<script>\n  import { Button as LocalButton } from 'my-ds';\n</script>",
      unresolved: [],
    });
  });

  it('includes nested components and deduplicates namespace bindings', () => {
    expect(
      buildSnippetImportBlock(
        '<UI.Root><UI.Trigger />{#snippet children()}<Child /><Child />{/snippet}</UI.Root>',
        {
          bindings: bindings("import * as UI from 'ui'; import { Child } from 'children';"),
        }
      )
    ).toEqual({
      block:
        "<script>\n  import * as UI from 'ui';\n  import { Child } from 'children';\n</script>",
      unresolved: [],
    });
  });

  it('reports unresolved components and imports the resolved components', () => {
    expect(
      buildSnippetImportBlock('<Button><Local /></Button>', {
        bindings: bindings("import Button from './Button.svelte';"),
      })
    ).toEqual({
      block: "<script>\n  import Button from './Button.svelte';\n</script>",
      unresolved: ['Local'],
    });
  });

  it('omits the block when no component resolves', () => {
    expect(buildSnippetImportBlock('<Local />', { bindings: bindings('') })).toEqual({
      unresolved: ['Local'],
    });
  });

  it('does not import tags mentioned in comments or string expressions', () => {
    expect(
      buildSnippetImportBlock('<!-- <Local /> --><Button>{"<Child />"}</Button>', {
        bindings: bindings("import Button from './Button.svelte';"),
      })
    ).toEqual({
      block: "<script>\n  import Button from './Button.svelte';\n</script>",
      unresolved: [],
    });
  });
});
