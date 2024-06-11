import dedent from 'dedent';
import type { Attribute } from 'svelte/compiler';

import type { SvelteASTNodes } from '#parser/extract/svelte/nodes';
import { StorybookSvelteCSFError } from '#utils/error';

const BASE_INITIAL_SNIPPET = dedent`
<script context="module">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  
  const { Story } = defineMeta({});
</script>
`;

export class MissingModuleTagError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 1;

  constructor(filename?: string) {
    super({ filename });
  }

  template() {
    return dedent`
      Stories file: ${this.filepathURL}
      doesn't have a module tag _(\`<script context="module"> <!-- ... --> </script>\`)_.

      Make sure this stories file has initial code snippet in order for this addon to work correctly:

      ${BASE_INITIAL_SNIPPET}
    `;
  }
}

export class DefaultOrNamespaceImportUsedError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 2;

  constructor(filename?: StorybookSvelteCSFError['filename']) {
    super({ filename });
  }

  template() {
    return dedent`
      Stories file: ${this.filepathURL}
      is using the default/namespace import from "${StorybookSvelteCSFError.packageName}".
      Please change it to a named import.
    `;
  }
}

export class MissingDefineMetaImportError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 3;

  constructor(filename?: StorybookSvelteCSFError['filename']) {
    super({ filename });
  }

  template() {
    return dedent`
      Stories file: ${this.filepathURL}
      doesn't have a 'defineMeta' imported from the "${StorybookSvelteCSFError.packageName}" package inside the module tag.
      ('<script context="module"> <!-- ... --> </script>').
    `;
  }
}

export class MissingDefineMetaVariableDeclarationError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 4;

  constructor(filename?: StorybookSvelteCSFError['filename']) {
    super({ filename });
  }

  template() {
    return dedent`
      Stories file: ${this.filepathURL}
      doesn't have 'defineMeta' call used for variable declaration inside the module tag ('<script context="module"> <!-- ... --> </script>').
    `;
  }
}

export class NoStoryComponentDestructuredError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 5;

  public defineMetaImport: SvelteASTNodes['defineMetaImport'];

  constructor({
    filename,
    defineMetaImport,
  }: {
    filename?: StorybookSvelteCSFError['filename'];
    defineMetaImport: NoStoryComponentDestructuredError['defineMetaImport'];
  }) {
    super({ filename });
    this.defineMetaImport = defineMetaImport;
  }

  template() {
    return dedent`
      Stories file: ${this.filepathURL}
      has no component 'Story' destructured from the '${this.defineMetaImport.local.name}({ ... })' function call.
    `;
  }
}

export class GetDefineMetaFirstArgumentError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 6;

  public defineMetaVariableDeclaration: SvelteASTNodes['defineMetaVariableDeclaration'];

  constructor({
    filename,
    defineMetaVariableDeclaration,
  }: {
    filename?: StorybookSvelteCSFError['filename'];
    defineMetaVariableDeclaration: SvelteASTNodes['defineMetaVariableDeclaration'];
  }) {
    super({ filename });
    this.defineMetaVariableDeclaration = defineMetaVariableDeclaration;
  }

  template() {
    return dedent`
      Failed to extract the first argument from the 'defineMeta' call as object expression in the stories file: ${this.filepathURL}
    `;
  }
}

export class InvalidStoryChildrenAttributeError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 7;

  public childrenAttribute: Attribute;

  constructor({
    filename,
    component,
    childrenAttribute,
  }: {
    filename?: StorybookSvelteCSFError['filename'];
    component: NonNullable<StorybookSvelteCSFError['component']>;
    childrenAttribute: InvalidStoryChildrenAttributeError['childrenAttribute'];
  }) {
    super({ filename, component });
    this.childrenAttribute = childrenAttribute;
  }

  template() {
    return dedent`
      Component '${this.quickStoryRawCodeIdentifier}' in the stories file: ${this.filepathURL}
      has an invalid 'children' attribute (prop).

      It's supposed to be an expression with reference to a Svelte snippet existing at the roof of fragment.

      Below is a demonstration of correct usage:

      {#snippet template()}
        <!-- ... -->
      {/snippet}

      <Story name="${this.storyNameFromAtttribute}" children={template} />
    `;
  }
}

export class InvalidSetTemplateFirstArgumentError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 8;

  public setTemplateCall: SvelteASTNodes['setTemplateCall'];

  constructor({
    filename,
    setTemplateCall,
  }: {
    filename?: StorybookSvelteCSFError['filename'];
    setTemplateCall: InvalidSetTemplateFirstArgumentError['setTemplateCall'];
  }) {
    super({ filename });
    this.setTemplateCall = setTemplateCall;
  }

  template() {
    return dedent`
      'setTemplate()' first argument should be a valid identifier with a reference to a Svelte snippet existing at the root of fragment.
      This issue happened in the stories file: ${this.filepathURL}
    `;
  }
}
