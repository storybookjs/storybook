import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

import { collectImportBindings, parseModule } from 'storybook/internal/csf-tools';

import { buildSnippetImportBlock as build } from './snippet-imports.ts';

const buildSnippetImportBlock = (...args: Parameters<typeof build>) => {
  const { declared: _declared, ...result } = build(...args);
  return result;
};

const bindings = (source: string) => collectImportBindings(parseModule(source).program);

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
        importOverride: { name: 'LocalButton', statement: "import { Button } from 'my-ds';" },
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
      instanceScript: "const initial: string = ''; let value = $state(initial); const unused = 1;",
      typescript: true,
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
      instanceScript: 'type Value = string; let value: Value = "";',
      typescript: true,
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
      instanceScript: 'function tooltip() {}',
    })
  ).toEqual({
    block:
      "<script>\n  import { fade } from 'svelte/transition';\n  import { flip } from 'svelte/animate';\n\n  function tooltip() {}\n</script>",
    unresolved: [],
  });
});

it('selects declarators without executing unrelated initializers', () => {
  const result = buildSnippetImportBlock('{label}', {
    bindings: bindings(''),
    instanceScript: "const label = 'ok', secret = loadSecret();",
  });
  expect(result.block).toContain("const label = 'ok';");
  expect(result.block).not.toContain('loadSecret');
  expect(result.unresolvedIdentifiers).toBeUndefined();
});

it('reports unknown dependencies inside selected initializers', () => {
  const result = buildSnippetImportBlock('{label}', {
    bindings: bindings(''),
    instanceScript: 'const label = loadLabel();',
  });
  expect(result.block).toContain('const label = loadLabel();');
  expect(result.unresolvedIdentifiers).toEqual(['loadLabel']);
});

it('copies local component aliases and their imported dependencies', () => {
  const result = buildSnippetImportBlock('<Alias />', {
    bindings: bindings(''),
    instanceScript: "import Button from './Button.svelte'; const Alias = Button;",
  });
  expect(result.block).toContain("import Button from './Button.svelte';");
  expect(result.block).toContain('const Alias = Button;');
  expect(result.unresolved).toEqual([]);
});

it('resolves instance bindings before module bindings and keeps dependency scopes', () => {
  const result = buildSnippetImportBlock('{label}{moduleLabel}', {
    bindings: bindings(''),
    moduleScript: "const label = 'module'; const moduleLabel = label;",
    instanceScript: "let label = 'instance';",
  });
  expect(result.block).toContain(
    "<script module>\n  const label = 'module';\n  const moduleLabel = label;"
  );
  expect(result.block).toContain("<script>\n  let label = 'instance';");
  expect(() => parse(result.block + '\n{label}{moduleLabel}', { modern: true })).not.toThrow();
});

it('copies exported bindings at declarator granularity', () => {
  const result = buildSnippetImportBlock('{label}', {
    bindings: bindings(''),
    moduleScript: "export const label = 'ok', secret = loadSecret();",
  });
  expect(result.block).toContain("const label = 'ok';");
  expect(result.block).not.toContain('loadSecret');
  expect(result.unresolvedIdentifiers).toBeUndefined();
});

it('selects type imports without copying unrelated value specifiers', () => {
  const result = buildSnippetImportBlock('<Badge>{label}</Badge>', {
    bindings: bindings("import { Badge } from './ui';"),
    instanceScript: "import { Badge, type Label } from './ui'; const label: Label = 'ok';",
    typescript: true,
  });
  expect(result.block?.match(/\bBadge\b/g)).toHaveLength(1);
  expect(result.block).toContain('type Label');
  expect(() => parse(result.block + '\n<Badge>{label}</Badge>', { modern: true })).not.toThrow();
});

it('copies a variable that a copied function assigns', () => {
  const result = buildSnippetImportBlock('<button onclick={bump}>+</button>', {
    bindings: bindings(''),
    instanceScript: 'let count = $state(0); function bump() { count += 1; }',
  });
  expect(result.block).toBe(
    '<script>\n  let count = $state(0);\n  function bump() { count += 1; }\n</script>'
  );
});

it('imports what the printed arg values need', () => {
  expect(
    buildSnippetImportBlock('<Button onclick={fn()} />', {
      bindings: bindings(
        "import Button from './Button.svelte'; import { fn } from 'storybook/test';"
      ),
    }).block
  ).toBe(
    "<script>\n  import Button from './Button.svelte';\n  import { fn } from 'storybook/test';\n</script>"
  );
});

it('imports what an attachment reads', () => {
  const { block } = buildSnippetImportBlock('<div {@attach tooltip(label)}></div>', {
    bindings: bindings("import { tooltip } from './tooltip';"),
    instanceScript: "let label = 'Save';",
  });
  expect(block).toContain("import { tooltip } from './tooltip';");
  expect(block).toContain("let label = 'Save';");
});

it('copies a destructuring declaration once for all the names it declares', () => {
  expect(
    buildSnippetImportBlock('<Button {label} {disabled} />', {
      bindings: bindings("import Button from './Button.svelte';"),
      instanceScript: 'const { label, disabled } = settings;',
    })
  ).toEqual({
    block:
      "<script>\n  import Button from './Button.svelte';\n\n  const { label, disabled } = settings;\n</script>",
    unresolved: [],
    unresolvedIdentifiers: ['settings'],
  });
});

it('copies the store that a `$store` subscription reads', () => {
  expect(
    buildSnippetImportBlock('<p>{$count}</p>', {
      bindings: bindings(''),
      instanceScript: "import { writable } from 'svelte/store'; const count = writable(0);",
    }).block
  ).toBe(
    "<script>\n  import { writable } from 'svelte/store';\n\n  const count = writable(0);\n</script>"
  );
});

it('copies the interface that a copied interface extends', () => {
  const result = buildSnippetImportBlock('{value}', {
    bindings: bindings(''),
    instanceScript:
      "interface Base { id: string } interface Props extends Base {} let value: Props = { id: 'a' };",
    typescript: true,
  });
  expect(result.block).toContain('interface Base { id: string }');
  expect(result.block).toContain('interface Props extends Base {}');
});

it('applies the meta import override to the meta component only', () => {
  expect(
    buildSnippetImportBlock('<LocalButton><Icon /></LocalButton>', {
      bindings: bindings(
        "import LocalButton from './Button.svelte'; import Icon from './Icon.svelte';"
      ),
      importOverride: { name: 'LocalButton', statement: "import { Button } from 'my-ds';" },
    }).block
  ).toBe(
    "<script>\n  import { Button as LocalButton } from 'my-ds';\n  import Icon from './Icon.svelte';\n</script>"
  );
});
