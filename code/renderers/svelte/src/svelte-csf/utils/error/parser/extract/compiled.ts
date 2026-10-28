import { dedent } from 'ts-dedent';

import { StorybookSvelteCSFError, filepathURL } from '../../../error.ts';

const category = StorybookSvelteCSFError.CATEGORY.parserExtractCompiled;

export class MissingImportedDefineMetaError extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({
      name: 'MissingImportedDefineMetaError',
      category,
      code: 1,
      message: dedent`
        Could not find the import statement of 'defineMeta' from ${StorybookSvelteCSFError.importSourcesText}, or of the preview from .storybook/preview, in the compiled output of: ${filepathURL(filename)}
      `,
    });
  }
}

export class MissingDefineMetaVariableDeclarationError extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({
      name: 'MissingDefineMetaVariableDeclarationError',
      category,
      code: 2,
      message: dedent`
        Could not find variable declaration from 'defineMeta' or 'preview.meta' call in the compiled output of the stories file: ${filepathURL(filename)}
      `,
    });
  }
}

export class NoExportDefaultError extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({
      name: 'NoExportDefaultError',
      category,
      code: 3,
      message: dedent`
        Could not find 'export default' in the compiled output of the stories file: ${filepathURL(filename)}
      `,
    });
  }
}

export class NoStoryIdentifierFoundError extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({
      name: 'NoStoryIdentifierFoundError',
      category,
      code: 4,
      message: dedent`
        Could not find a 'Story' identifier in the compiled output of the stories file: ${filepathURL(filename)}
      `,
    });
  }
}

export class NoStoriesFunctionDeclarationError extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({
      name: 'NoStoriesFunctionDeclarationError',
      category,
      code: 5,
      message: dedent`
        Could not find the stories component '*.stories.svelte' function declaration compiled output of the stories file: ${filepathURL(filename)}
      `,
    });
  }
}

export class NoCompiledStoryPropsObjectExpression extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({
      name: 'NoCompiledStoryPropsObjectExpression',
      category,
      code: 6,
      message: dedent`
        Failed to extract compiled Story component props as object expression in the compiled output of stories file: ${filepathURL(filename)}
      `,
    });
  }
}
