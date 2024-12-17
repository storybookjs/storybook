import dedent from 'dedent';

import { StorybookSvelteCSFError } from '$lib/utils/error.js';
import type { extractStoriesNodesFromExportDefaultFn } from '$lib/parser/extract/compiled/stories.js';

export class MissingImportedDefineMetaError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractCompiled;
  readonly code = 1;
  readonly documentation = true;

  constructor(filename?: StorybookSvelteCSFError['filename']) {
    super({ filename });
  }

  template() {
    return dedent`
      Could not find the import statement of 'defineMeta' from the "${StorybookSvelteCSFError.packageName}" in the compiled output of: ${this.filepathURL}
    `;
  }
}

export class MissingDefineMetaVariableDeclarationError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractCompiled;
  readonly code = 2;
  readonly documentation = true;

  constructor(filename?: StorybookSvelteCSFError['filename']) {
    super({ filename });
  }

  template() {
    return dedent`
			Could not find variable declaration from 'defineMeta' call in the compiled output of the stories file: ${this.filepathURL}
    `;
  }
}

export class NoExportDefaultError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractCompiled;
  readonly code = 3;
  readonly documentation = true;

  constructor(filename?: StorybookSvelteCSFError['filename']) {
    super({ filename });
  }

  template() {
    return dedent`
			Could not find 'export default' in the compiled output of the stories file: ${this.filepathURL}
    `;
  }
}

export class NoStoryIdentifierFoundError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractCompiled;
  readonly code = 4;
  readonly documentation = true;

  constructor(filename?: StorybookSvelteCSFError['filename']) {
    super({ filename });
  }

  template() {
    return dedent`
			Could not find a 'Story' identifier in the compiled output of the stories file: ${this.filepathURL}
    `;
  }
}

export class NoStoriesFunctionDeclarationError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractCompiled;
  readonly code = 5;
  readonly documentation = true;

  constructor(filename?: StorybookSvelteCSFError['filename']) {
    super({ filename });
  }

  template() {
    return dedent`
			Could not find the stories component '*.stories.svelte' function declaration compiled output of the stories file: ${this.filepathURL}
    `;
  }
}

export class NoCompiledStoryPropsObjectExpression extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractCompiled;
  readonly code = 6;
  readonly documentation = true;

  public node: Awaited<ReturnType<typeof extractStoriesNodesFromExportDefaultFn>>[number];

  constructor({
    filename,
    node,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    node: NoCompiledStoryPropsObjectExpression['node'];
  }) {
    super({ filename });
    this.node = node;
  }

  template() {
    return dedent`
      Failed to extract compiled Story component props as object expression in the compiled output of stories file: ${this.filepathURL}
    `;
  }
}
