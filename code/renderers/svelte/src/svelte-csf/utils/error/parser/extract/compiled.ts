import dedent from 'dedent';

import { StorybookSvelteCSFError } from '#utils/error';
import type { extractStoriesNodesFromExportDefaultFn } from '#parser/extract/compiled/stories';

export class MissingImportedDefineMetaError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractCompiled;
  readonly code = 1;

  constructor(filename?: StorybookSvelteCSFError['filename']) {
    super({ filename });
  }

  template() {
    return dedent`
      Could not find 'defineMeta' imported from the "${StorybookSvelteCSFError.packageName}" in the compiled output of: ${this.filepathURL}
    `;
  }
}

export class MissingDefineMetaVariableDeclarationError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserExtractCompiled;
  readonly code = 2;

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
      Failed to extract compiled Story component attributes (props) as object expression in the compiled output of stories file: ${this.filepathURL}
    `;
  }
}
