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

it('copies referenced TypeScript state and transitive dependencies in source order', () => {
  expect(
    buildSnippetImportBlock('<Button bind:value={value} />', {
      bindings: bindings("import Button from './Button.svelte';"),
      instanceScript: {
        typescript: true,
        code: "const initial: string = ''; let value = $state(initial); const unused = 1;",
      },
    })
  ).toEqual({
    block: `<script lang="ts">\n  import Button from './Button.svelte';\n\n  const initial: string = '';\n  let value = $state(initial);\n</script>`,
    unresolved: [],
  });
});

it('reports unknown references without treating property names or callback parameters as free', () => {
  expect(
    buildSnippetImportBlock(
      '<Button value={missing.label} onclick={(event) => event.preventDefault()} />',
      {
        bindings: bindings("import Button from './Button.svelte';"),
      }
    )
  ).toEqual({
    block: "<script>\n  import Button from './Button.svelte';\n</script>",
    unresolved: [],
    unresolvedIdentifiers: ['missing'],
  });
});

it('keeps snippet and each parameters local', () => {
  expect(
    buildSnippetImportBlock(
      '{#each items as item, index}{#snippet child(label)}{label}{item.name}{index}{/snippet}{/each}',
      {
        bindings: bindings(''),
      }
    )
  ).toEqual({ unresolved: [], unresolvedIdentifiers: ['items'] });
});

it('copies type declarations used by copied state', () => {
  expect(
    buildSnippetImportBlock('{value}', {
      bindings: bindings(''),
      instanceScript: { typescript: true, code: 'type Value = string; let value: Value = "";' },
    })
  ).toEqual({
    block: '<script lang="ts">\n  type Value = string;\n  let value: Value = "";\n</script>',
    unresolved: [],
  });
});

it('keeps await results and const declarations local', () => {
  expect(
    buildSnippetImportBlock(
      '{#await promise then result}{@const label = result.name}{label}{:catch error}{error.message}{/await}',
      {
        bindings: bindings(''),
      }
    )
  ).toEqual({ unresolved: [], unresolvedIdentifiers: ['promise'] });
});

it.each([
  '{#each items as { name }}{name}{/each}',
  '{#each items as [name]}{name}{/each}',
  '{#snippet row({ name })}{name}{/snippet}',
  '{#snippet row([name])}{name}{/snippet}',
  '{#await items then { name }}{name}{/await}',
  '{#await items then [name]}{name}{/await}',
])('keeps destructured block bindings local: %s', (markup) => {
  const result = buildSnippetImportBlock(markup, { bindings: bindings('') });
  expect(result).toEqual({
    unresolved: [],
    ...(markup.includes('items') ? { unresolvedIdentifiers: ['items'] } : {}),
  });
});

it('resolves browser globals without hiding unknown identifiers', () => {
  expect(
    buildSnippetImportBlock(
      '<button onclick={() => { console.log(window, document); alert("x"); setTimeout(() => missing, 0); }} />',
      { bindings: bindings('') }
    )
  ).toEqual({ unresolved: [], unresolvedIdentifiers: ['missing'] });
});

it.each(['let:item', 'let:value={item}', 'let:value={{ item }}', 'let:value={[item]}'])(
  'keeps slot bindings local: %s',
  (directive) => {
    expect(
      buildSnippetImportBlock(`<Comp ${directive}>{item}</Comp>`, {
        bindings: bindings("import Comp from './Comp.svelte';"),
      })
    ).toEqual({
      block: "<script>\n  import Comp from './Comp.svelte';\n</script>",
      unresolved: [],
    });
  }
);

it('includes imports and state referenced by directives', () => {
  expect(
    buildSnippetImportBlock('<div use:tooltip transition:fade animate:flip />', {
      bindings: bindings(
        "import { fade } from 'svelte/transition'; import { flip } from 'svelte/animate';"
      ),
      instanceScript: { code: 'function tooltip() {}', typescript: false },
    })
  ).toEqual({
    block:
      "<script>\n  import { fade } from 'svelte/transition';\n  import { flip } from 'svelte/animate';\n\n  function tooltip() {}\n</script>",
    unresolved: [],
  });
});
