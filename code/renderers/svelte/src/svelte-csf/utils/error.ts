import url from 'node:url';

import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import type { Component } from 'svelte/compiler';

import { extractStoryAttributesNodes } from '#parser/extract/svelte/story/attributes';
import { getStringValueFromAttribute } from '#parser/analyse/story/svelte/attributes';

/**
 * Adopted from: {@link https://github.com/storybookjs/storybook/blob/next/code/lib/core-events/src/errors/storybook-error.ts}
 * Copied because is not exposed in the `@storybook/core-events` package,
 * and modified for this addon needs.
 */
export abstract class StorybookSvelteCSFError extends Error {
  public static packageName = pkg.name;

  public static readonly CATEGORY = {
    parserExtractSvelte: 'PARSER_EXTRACT_SVELTE',
    parserExtractCompiled: 'PARSER_EXTRACT_COMPILED',
    parserAnalyseDefineMeta: 'PARSER_ANALYSE_DEFINE_META',
    parserAnalyseStory: 'PARSER_ANALYSE_STORY',
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
      page = `https://storybook.js.org/error/${this.fullErrorCode}`;
    } else if (typeof this.documentation === 'string') {
      page = this.documentation;
    } else if (Array.isArray(this.documentation)) {
      page = `\n${this.documentation.map((doc) => `\t- ${doc}`).join('\n')}`;
    }

    return `${this.template()}${page != null ? `\n\nMore info: ${page}\n` : ''}`;
  }

  /**
   * `*.stories.svelte` file path where the error has occured.
   */
  readonly storiesFilename?: string;

  /**
   * Name of the `<Story name=">...<" />` component which caused the error.
   */
  readonly storyComponent?: Component;

  constructor({
    filename,
    storyComponent,
  }: {
    filename?: StorybookSvelteCSFError['storiesFilename'];
    storyComponent?: StorybookSvelteCSFError['storyComponent'];
  }) {
    super();

    this.storiesFilename = filename;
    this.storyComponent = storyComponent;
  }

  protected get storyNameFromAtttribute() {
    if (this.storyComponent) {
      const { name } = extractStoryAttributesNodes({
        component: this.storyComponent,
        attributes: ['name'],
        filename: this.storiesFilename,
      });

      return getStringValueFromAttribute({
        node: name,
        filename: this.storiesFilename,
      });
    }

    return '<unspecified Story name>';
  }

  public get filepathURL() {
    if (this.storiesFilename) {
      return url.pathToFileURL(this.storiesFilename);
    } else {
      return '<path not specified>';
    }
  }

  public get quickStoryRawCodeIdentifier() {
    return `<Story name="${this.storyNameFromAtttribute}" />`;
  }
}
