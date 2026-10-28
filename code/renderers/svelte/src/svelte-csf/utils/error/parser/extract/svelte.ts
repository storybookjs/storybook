import { inspect } from 'node:util';

import { logger } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';

import type { SvelteAST } from '../../../../parser/ast.ts';
import {
  StorybookSvelteCSFError,
  filepathURL,
  quickStoryRawCodeIdentifier,
  storyNameFromAttribute,
} from '../../../error.ts';

const BASE_INITIAL_SNIPPET = dedent`
<script module>
  import { defineMeta } from "${StorybookSvelteCSFError.importSource}";

  const { Story } = defineMeta({});
</script>

In a SvelteKit project, import defineMeta from "${StorybookSvelteCSFError.sveltekitImportSource}".
With CSF factories, call preview.meta() in place of defineMeta(), with preview imported from '#.storybook/preview'.
`;

const category = StorybookSvelteCSFError.CATEGORY.parserExtractSvelte;

export class MissingModuleTagError extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({
      name: 'MissingModuleTagError',
      category,
      code: 1,
      message: dedent`
        The file '${filepathURL(filename)}'
        does not have a module context (<script module> ... </script>).

        defineMeta(...) or preview.meta(...) should be called inside a module script tag, like so:

        ${BASE_INITIAL_SNIPPET}
      `,
    });
  }
}

export class DefaultOrNamespaceImportUsedError extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({
      name: 'DefaultOrNamespaceImportUsedError',
      category,
      code: 2,
      message: dedent`
        The file '${filepathURL(filename)}'
        is using a default or namespace import of ${StorybookSvelteCSFError.importSourcesText},
        and doesn't import defineMeta by name. Import it with a named import, like so:

        import { defineMeta } from "${StorybookSvelteCSFError.importSource}";

        In a SvelteKit project, import defineMeta from "${StorybookSvelteCSFError.sveltekitImportSource}".
      `,
    });
  }
}

export class MissingDefineMetaImportError extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({
      name: 'MissingDefineMetaImportError',
      category,
      code: 3,
      message: dedent`
        The file '${filepathURL(filename)}'
        does not import defineMeta from ${StorybookSvelteCSFError.importSourcesText}, or the preview from .storybook/preview, inside the module context.

        Make sure to import defineMeta from the package and use it inside the module context like so:

        ${BASE_INITIAL_SNIPPET}
      `,
    });
  }
}

export class MissingDefineMetaVariableDeclarationError extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({
      name: 'MissingDefineMetaVariableDeclarationError',
      category,
      code: 4,
      message: dedent`
        The file '${filepathURL(filename)}'
        does not store the result of calling defineMeta() or preview.meta(). While it might have been called,
        it's return value needs to be stored and destructured for the parsing to succeed, eg.:

        ${BASE_INITIAL_SNIPPET}
      `,
    });
  }
}

export class NoStoryComponentDestructuredError extends StorybookSvelteCSFError {
  constructor({
    filename,
    metaFunctionName,
  }: {
    filename?: string;
    // The meta function, such as `defineMeta` or `preview.meta`
    metaFunctionName: string;
  }) {
    super({
      name: 'NoStoryComponentDestructuredError',
      category,
      code: 5,
      message: dedent`
        The file '${filepathURL(filename)}'
        does not destructure the Story component from the '${metaFunctionName}({ ... })' function call.
        eg.:

        ${BASE_INITIAL_SNIPPET}
      `,
    });
  }
}

export class GetDefineMetaFirstArgumentError extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({
      name: 'GetDefineMetaFirstArgumentError',
      category,
      code: 6,
      message: dedent`
        The file '${filepathURL(filename)}'
        passes an invalid first argument to the 'defineMeta' or 'preview.meta' call.

        The first argument must be an object expression with the meta properties set.
      `,
    });
  }
}

export class InvalidStoryTemplateAttributeError extends StorybookSvelteCSFError {
  constructor({ filename, component }: { filename?: string; component: SvelteAST.Component }) {
    super({
      name: 'InvalidStoryTemplateAttributeError',
      category,
      code: 7,
      message: dedent`
        Component '${quickStoryRawCodeIdentifier(component)}' in the stories file '${filepathURL(filename)}'
        has an invalid 'template'-prop.

        When set, the 'template'-prop must be an expression with reference to a root-level snippet.

        Eg.:

        {#snippet template()}
          ...
        {/snippet}

        <Story name="${storyNameFromAttribute(component)}" template={template} />
      `,
    });
  }
}

const describeCause = (cause: unknown) => {
  if (cause instanceof Error) {
    return logger.shouldLog('debug') && cause.stack
      ? cause.stack
      : `${cause.name}: ${cause.message}`;
  }
  if (typeof cause === 'string') {
    return cause;
  }
  // A thrown value can be anything, and `inspect` runs its custom inspect function.
  try {
    return inspect(cause);
  } catch {
    return '<the original error could not be printed>';
  }
};

export class IndexerParseError extends StorybookSvelteCSFError {
  constructor(filename: string | undefined, { cause }: { cause: unknown }) {
    super({
      name: 'IndexerParseError',
      category,
      code: 9,
      cause,
      message: dedent`
        Storybook stories indexer parser threw an unrecognized error while indexing the file '${filepathURL(filename)}':

        ${describeCause(cause)}

        The indexer doesn't run Svelte preprocessors. It ignores the content of <style> blocks, but the rest of a stories file must be standard Svelte syntax.

        If the original error doesn't point to a problem in the stories file, please report it on the issue tracker on GitHub at https://github.com/storybookjs/storybook/issues/new?template=bug_report.yml.
      `,
    });
  }
}

export class MixedMetaError extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({
      name: 'MixedMetaError',
      category,
      code: 10,
      message: dedent`
        The file '${filepathURL(filename)}'
        calls both defineMeta() and preview.meta(). A stories file can only have one meta.
        Use preview.meta() for CSF factories, or defineMeta() otherwise.
      `,
    });
  }
}

export class PreviewNotImportedError extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({
      name: 'PreviewNotImportedError',
      category,
      code: 11,
      message: dedent`
        The file '${filepathURL(filename)}'
        calls preview.meta(), but it doesn't import preview from the preview file of Storybook. Import it like so:

        <script module>
          import preview from '#.storybook/preview';

          const { Story } = preview.meta({});
        </script>

        The import path must end with '/preview', with or without a file extension.
      `,
    });
  }
}

export class MultipleMetaError extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({
      name: 'MultipleMetaError',
      category,
      code: 12,
      message: dedent`
        The file '${filepathURL(filename)}'
        calls preview.meta() more than once. A stories file can only have one meta.
        Move the stories of each meta to their own stories file.
      `,
    });
  }
}
