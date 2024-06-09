import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import dedent from 'dedent';
import type { Identifier, ImportSpecifier, VariableDeclaration } from 'estree';
import type { Root, SvelteNode } from 'svelte/compiler';
import type { Visitors } from 'zimmerframe';

import { StorybookSvelteCSFError } from '#utils/error';

const AST_NODES_NAMES = {
  defineMeta: 'defineMeta',
  setTemplate: 'setTemplate',
  Story: 'Story',
} as const;

interface Result {
  /**
   * Import specifier for `defineMeta` imported from this addon package.
   * Could be renamed - e.g. `import { defineMeta as df } from "@storybook/addon-svelte-csf"`
   */
  defineMetaImport: ImportSpecifier;
  /**
   * Import specifier for `setTemplate` imported from this addon package.
   * Could be renamed - e.g. `import { setTemplate as st } from "@storybook/addon-svelte-csf"`
   */
  setTemplateImport: ImportSpecifier | undefined;
  /**
   * Variable declaration: `const { Story } = defineMeta({ })`
   * Could be destructured with rename - e.g. `const { Story: S } = defineMeta({ ... })`
   */
  defineMetaVariableDeclaration: VariableDeclaration;
  /**
   * An identifier for the addon's component `<Story />`.
   * It could be destructured with rename - e.g. `const { Story: S } = defineMeta({ ... })`
   */
  storyIdentifier: Identifier;
}

interface Params {
  module: Root['module'];
  filename?: string;
}

/**
 * Extract Svelte AST nodes via `svelte.compile`,
 * and from the module tag - `<script context=module>`.
 * They are needed for further code analysis/transformation.
 */
export async function extractModuleNodes(options: Params): Promise<Result> {
  const { module, filename } = options;

  if (!module) {
    throw new MissingModuleTagError(filename);
  }

  const { walk } = await import('zimmerframe');

  const state: Partial<Result> = {};
  const visitors: Visitors<SvelteNode, typeof state> = {
    ImportDeclaration(node, { state, visit }) {
      const { source, specifiers } = node;

      if (source.value === pkg.name) {
        for (const specifier of specifiers) {
          if (specifier.type !== 'ImportSpecifier') {
            throw new DefaultOrNamespaceImportUsedError(filename);
          }

          visit(specifier, state);
        }
      }
    },

    ImportSpecifier(node, {}) {
      if (node.imported.name === AST_NODES_NAMES.defineMeta) {
        state.defineMetaImport = node;
      }

      if (node.imported.name === AST_NODES_NAMES.setTemplate) {
        state.setTemplateImport = node;
      }
    },

    VariableDeclaration(node, { state }) {
      const { declarations } = node;
      const declaration = declarations[0];
      const { id, init } = declaration;

      if (
        id.type === 'ObjectPattern' &&
        init?.type === 'CallExpression' &&
        init.callee.type === 'Identifier' &&
        init.callee.name === state.defineMetaImport?.local.name
      ) {
        state.defineMetaVariableDeclaration = node;

        for (const property of id.properties) {
          if (
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === AST_NODES_NAMES.Story &&
            property.value.type === 'Identifier'
          ) {
            state.storyIdentifier = property.value;
          }
        }
      }
    },
  };

  walk(module.content, state, visitors);

  const { defineMetaImport, setTemplateImport, defineMetaVariableDeclaration, storyIdentifier } =
    state;

  if (!defineMetaImport) {
    throw new MissingDefineMetaImportError(filename);
  }

  if (!defineMetaVariableDeclaration) {
    throw new MissingDefineMetaVariableDeclarationError(filename);
  }

  if (!storyIdentifier) {
    throw new NoStoryComponentDestructuredError({ filename, defineMetaImport });
  }

  return {
    defineMetaImport,
    setTemplateImport,
    defineMetaVariableDeclaration,
    storyIdentifier,
  };
}

const BASE_INITIAL_SNIPPET = dedent`
\`\`\`svelte
<script context="module">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  
  const { Story } = defineMeta({});
</script>
\`\`\`
`;

class MissingModuleTagError extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({ filename });
  }
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 1;
  template() {
    return dedent`
      Stories file: ${this.filepathURL}
      doesn't have a module tag _(\`<script context="module"> <!-- ... --> </script>\`)_.

      Make sure this stories file has initial code snippet in order for this addon to work correctly:

      ${BASE_INITIAL_SNIPPET}
    `;
  }
}

class DefaultOrNamespaceImportUsedError extends StorybookSvelteCSFError {
  constructor(filename?: StorybookSvelteCSFError['storiesFilename']) {
    super({ filename });
  }
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 2;
  template() {
    return dedent`
      Stories file: ${this.filepathURL}
      is using the default/namespace import from "${pkg.name}".
      Please change it to named imports.
      Take a look at the below snippet for an example usage on how to start writing stories file:

      ${BASE_INITIAL_SNIPPET}
    `;
  }
}

class MissingDefineMetaImportError extends StorybookSvelteCSFError {
  constructor(filename?: StorybookSvelteCSFError['storiesFilename']) {
    super({ filename });
  }
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 3;
  template() {
    return dedent`
      Stories file: ${this.filepathURL}
      doesn't have a \`${AST_NODES_NAMES.defineMeta}\` imported from the "${pkg.name}" package inside the module tag.
      _(\`<script context="module"> <!-- ... --> </script>\`)_.

      Make sure this stories file has initial code snippet in order for this addon to work correctly:

      ${BASE_INITIAL_SNIPPET}
    `;
  }
}

class MissingDefineMetaVariableDeclarationError extends StorybookSvelteCSFError {
  constructor(filename?: StorybookSvelteCSFError['storiesFilename']) {
    super({ filename });
  }
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 4;
  template() {
    return dedent`
      Stories file: ${this.filepathURL}
      doesn't have a \`${AST_NODES_NAMES.defineMeta}\` variable declaration inside the module tag
      _(\`<script context="module"> <!-- ... --> </script>\`)_.

      Make sure this stories file has initial code snippet in order for this addon to work correctly:

      ${BASE_INITIAL_SNIPPET}
    `;
  }
}

class NoStoryComponentDestructuredError extends StorybookSvelteCSFError {
  public defineMetaImport: Result['defineMetaImport'];
  constructor({
    filename,
    defineMetaImport,
  }: {
    filename?: StorybookSvelteCSFError['storiesFilename'];
    defineMetaImport: Result['defineMetaImport'];
  }) {
    super({ filename });
    this.defineMetaImport = defineMetaImport;
  }
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 5;
  template() {
    return dedent`
      Stories file: ${this.filepathURL}
      has no component \`${AST_NODES_NAMES.Story}\` destructured from the '${this.defineMetaImport.local.name}({ ... })' function call.

      Make sure this stories file has initial code snippet in order for this addon to work correctly:

      ${BASE_INITIAL_SNIPPET}
    `;
  }
}
