import dedent from 'dedent';
import type { Attribute } from 'svelte/compiler';

import { StorybookSvelteCSFError } from '#utils/error';
import type { SvelteASTNodes } from '#parser/extract/svelte/nodes';

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

  constructor(filename?: StorybookSvelteCSFError['storiesFilename']) {
    super({ filename });
  }

  template() {
    return dedent`
      Stories file: ${this.filepathURL}
      is using the default/namespace import from "${StorybookSvelteCSFError.packageName}".
      Please change it to named imports.
      Take a look at the below snippet for an example usage on how to start writing stories file:

      ${BASE_INITIAL_SNIPPET}
    `;
  }
}

export class MissingDefineMetaImportError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 3;

  constructor(filename?: StorybookSvelteCSFError['storiesFilename']) {
    super({ filename });
  }

  template() {
    return dedent`
      Stories file: ${this.filepathURL}
      doesn't have a 'defineMeta' imported from the "${StorybookSvelteCSFError.packageName}" package inside the module tag.
      ('<script context="module"> <!-- ... --> </script>').

      Make sure this stories file has initial code snippet in order for this addon to work correctly:

      ${BASE_INITIAL_SNIPPET}
    `;
  }
}

export class MissingDefineMetaVariableDeclarationError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 4;

  constructor(filename?: StorybookSvelteCSFError['storiesFilename']) {
    super({ filename });
  }

  template() {
    return dedent`
      Stories file: ${this.filepathURL}
      doesn't have 'defineMeta' call used for variable declaration inside the module tag ('<script context="module"> <!-- ... --> </script>').

      Make sure this stories file has initial code snippet in order for this addon to work correctly:

      ${BASE_INITIAL_SNIPPET}
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
    filename?: StorybookSvelteCSFError['storiesFilename'];
    defineMetaImport: NoStoryComponentDestructuredError['defineMetaImport'];
  }) {
    super({ filename });
    this.defineMetaImport = defineMetaImport;
  }

  template() {
    return dedent`
      Stories file: ${this.filepathURL}
      has no component 'Story' destructured from the '${this.defineMetaImport.local.name}({ ... })' function call.

      Make sure this stories file has initial code snippet in order for this addon to work correctly:

      ${BASE_INITIAL_SNIPPET}
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
    filename?: StorybookSvelteCSFError['storiesFilename'];
    defineMetaVariableDeclaration: SvelteASTNodes['defineMetaVariableDeclaration'];
  }) {
    super({ filename });
    this.defineMetaVariableDeclaration = defineMetaVariableDeclaration;
  }

  template() {
    return dedent`
      Addon's parser had a problem extracting the first argument from the 'defineMeta' call
      in the stories file: ${this.filepathURL}

      Make sure it is a valid object expression which follows the 'Meta' interface from '@storybook/svelte'.

      If you verified that this is valid object, please report it using the link below:
      https://github.com/storybookjs/addon-svelte-csf/issues/new
    `;
  }
}

export class InvalidStoryChildrenAttributeError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;
  readonly code = 7;

  public childrenAttribute: Attribute;

  constructor({
    filename,
    storyComponent,
    childrenAttribute,
  }: {
    filename?: StorybookSvelteCSFError['storiesFilename'];
    storyComponent: NonNullable<StorybookSvelteCSFError['storyComponent']>;
    childrenAttribute: InvalidStoryChildrenAttributeError['childrenAttribute'];
  }) {
    super({ filename, storyComponent });
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
    filename?: StorybookSvelteCSFError['storiesFilename'];
    setTemplateCall: InvalidSetTemplateFirstArgumentError['setTemplateCall'];
  }) {
    super({ filename });
    this.setTemplateCall = setTemplateCall;
  }

  template() {
    return dedent`
      In the stories file: ${this.filepathURL}
      'setTemplate()' first argument should be a valid identifier with a reference to a Svelte snippet existing at the roof of fragment.

      Below is a demonstration of correct usage:

      <script>
        setTemplate(template);
      </script>

      {#snippet template()}
        <!-- ... -->
      {/snippet}
    `;
  }
}
