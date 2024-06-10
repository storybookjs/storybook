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
      Could not find 'defineMeta' imported from the "${StorybookSvelteCSFError.packageName}" in the compiled output.

      This is most likely a bug in the parser of addon - "${StorybookSvelteCSFError.packageName}".

      If you see this error, please report it using the link below:
      https://github.com/storybookjs/addon-svelte-csf/issues/new

      While you create an issue, please provide original code of the following stories file: ${this.filepathURL}
      It will help us invegistate the occured issue better.
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
			Could not find variable declartion from 'defineMeta' call in the compiled output of the stories file.
l
      This is most likely a bug in the parser of addon - "${StorybookSvelteCSFError.packageName}".

      If you see this error, please report it using the link below:
      https://github.com/storybookjs/addon-svelte-csf/issues/new

      While you create an issue, please provide original code of the following stories file: ${this.filepathURL}
      It will help us invegistate the occured issue better.
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
			Could not find 'export default' in the compiled output of the stories file.

      This is most likely a bug in the parser of addon - "${StorybookSvelteCSFError.packageName}".

      If you see this error, please report it using the link below:
      https://github.com/storybookjs/addon-svelte-csf/issues/new

      While you create an issue, please provide original code of the following stories file: ${this.filepathURL}
      It will help us invegistate the occured issue better.
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
			Could not find a 'Story' identifier in the compiled output of the stories file.

      This is most likely a bug in the parser of addon - "${StorybookSvelteCSFError.packageName}".

      If you see this error, please report it using the link below:
      https://github.com/storybookjs/addon-svelte-csf/issues/new

      While you create an issue, please provide original code of the following stories file: ${this.filepathURL}
      It will help us invegistate the occured issue better.
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
			Could not find the stories component '*.stories.svelte' function declaration compiled output of the stories file.

      This is most likely a bug in the parser of addon - "${StorybookSvelteCSFError.packageName}".

      If you see this error, please report it using the link below:
      https://github.com/storybookjs/addon-svelte-csf/issues/new

      While you create an issue, please provide original code of the following stories file: ${this.filepathURL}
      It will help us invegistate the occured issue better.
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
      Failed to extract compiled Story component attributes (props) as object expression.

      This is most likely a bug in the parser of addon - "${StorybookSvelteCSFError.packageName}".

      If you see this error, please report it using the link below:
      https://github.com/storybookjs/addon-svelte-csf/issues/new

      While you create an issue, please provide original code of the following stories file: ${this.filepathURL}
      It will help us invegistate the occured issue better.
    `;
  }
}
