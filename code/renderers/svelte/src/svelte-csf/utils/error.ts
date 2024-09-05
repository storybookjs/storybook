import url from 'node:url';

import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };

import type { SvelteAST } from '#parser/ast';

/**
 * Adopted from: {@link https://github.com/storybookjs/storybook/blob/next/code/lib/core-events/src/errors/storybook-error.ts}
 * Copied because is not exposed in the `@storybook/core-events` package,
 * and modified for this addon needs.
 */
export abstract class StorybookSvelteCSFError extends Error {
  public static packageName = pkg.name;
  public static packageVersion = pkg.version;

  public static readonly CATEGORY = {
    parserExtractSvelte: 'PARSER_EXTRACT_SVELTE',
    parserExtractCompiled: 'PARSER_EXTRACT_COMPILED',
    parserAnalyseDefineMeta: 'PARSER_ANALYSE_DEFINE_META',
    parserAnalyseStory: 'PARSER_ANALYSE_STORY',
    compiler: 'COMPILER',
  } as const;

  /**
   * Category of the error. Used to classify the type of error, e.g., 'PREVIEW_API'.
   */
  abstract readonly category: (typeof StorybookSvelteCSFError)['CATEGORY'][keyof (typeof StorybookSvelteCSFError)['CATEGORY']];

  /**
   * Code representing the error. Used to uniquely identify the error, e.g., 1.
   */
  abstract readonly code: number;

  /**
   * A properly written error message template for this error.
   * @see https://github.com/storybookjs/storybook/blob/next/code/lib/core-events/src/errors/README.md#how-to-write-a-proper-error-message
   */
  abstract template(): string;

  /**
   * Data associated with the error. Used to provide additional information in the error message or to be passed to telemetry.
   */
  public readonly data = {};

  /**
   * Specifies the documentation for the error.
   * - If `true`, links to a documentation page on the Storybook website (make sure it exists before enabling).
   * - If a string, uses the provided URL for documentation (external or FAQ links).
   * - If `false` (default), no documentation link is added.
   */
  public documentation: boolean | string | string[] = false;

  /**
   * Flag used to easily determine if the error originates from Storybook.
   */
  readonly fromStorybook: true = true as const;

  get fullErrorCode() {
    const paddedCode = String(this.code).padStart(4, '0');
    return `SB_SVELTE_CSF_${this.category}_${paddedCode}` as `SB_SVELTE_CSF_${this['category']}_${string}`;
  }

  /**
   * Overrides the default `Error.name` property in the format: SB_<CATEGORY>_<CODE>.
   */
  get name() {
    const errorName = this.constructor.name;

    return `${this.fullErrorCode} (${errorName})`;
  }

  /**
   * Generates the error message along with additional documentation link (if applicable).
   */
  get message() {
    let page: string | undefined;

    if (this.documentation === true) {
      page = `https://github.com/storybookjs/addon-svelte-csf/blob/v${StorybookSvelteCSFError.packageVersion}/ERRORS.md#${this.fullErrorCode}`;
    } else if (typeof this.documentation === 'string') {
      page = this.documentation;
    } else if (Array.isArray(this.documentation)) {
      page = `\n${this.documentation.map((doc) => `\t- ${doc}`).join('\n')}`;
    }

    return `${this.template()}${page != null ? `\n\nMore info: ${page}\n` : ''}`;
  }

  /**
   * `*.stories.svelte` file path where the error has occurred.
   */
  readonly filename?: string;

  /**
   * Name of the `<Story name=">...<" />` component which caused the error.
   */
  readonly component?: SvelteAST.Component;

  constructor({
    filename,
    component: component,
  }: {
    filename?: StorybookSvelteCSFError['filename'];
    component?: StorybookSvelteCSFError['component'];
  }) {
    super();

    this.filename = filename;
    this.component = component;
  }

  // WARN: I had to duplicate logic. We already have functions for it.
  // But we can't import it, because it would create a cyclic-dependency.
  protected get storyNameFromAttribute() {
    if (!this.component) {
      return '<UnnamedComponent>';
    }

    const { attributes } = this.component;

    for (const attribute of attributes) {
      if (attribute.type !== 'Attribute') {
        // NOTE: Nothing to do with this case - invalid tbh
        continue;
      }

      if (attribute.value === true) {
        // NOTE: Nothing to do with this case - invalid tbh
        continue;
      }

      // value is SvelteAST.ExpressionTag
      if (!Array.isArray(attribute.value)) {
        return attribute.value.expression.value;
      }

      if (attribute.value[0].type === 'Text') {
        return attribute.value[0].data;
      }

      if (
        attribute.value[0].expression.type === 'Literal' &&
        typeof attribute.value[0].expression.value === 'string'
      ) {
        return attribute.value[0].expression.value;
      }
    }
  }

  public get filepathURL() {
    if (this.filename) {
      return url.pathToFileURL(this.filename);
    } else {
      return '<path not specified>';
    }
  }

  public get quickStoryRawCodeIdentifier() {
    return `<Story name="${this.storyNameFromAttribute}" />`;
  }
}
