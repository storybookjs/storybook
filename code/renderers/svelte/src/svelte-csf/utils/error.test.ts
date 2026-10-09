import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { describe, expect, it } from 'vitest';

import rendererPkg from '@storybook/svelte/package.json' with { type: 'json' };

import { MissingModuleTagError } from './error/parser/extract/svelte.ts';
import { StorybookSvelteCSFError } from './error.ts';
import * as analyseDefineMeta from './error/parser/analyse/define-meta.ts';
import * as analyseStory from './error/parser/analyse/story.ts';
import * as extractCompiled from './error/parser/extract/compiled.ts';
import * as extractSvelte from './error/parser/extract/svelte.ts';

describe('StorybookSvelteCSFError', () => {
  it('links to ERRORS.md in the Storybook monorepo, at the tag of the installed version', () => {
    const error = new MissingModuleTagError('Button.stories.svelte');

    expect(error.message).toContain(
      `More info: https://github.com/storybookjs/storybook/blob/v${rendererPkg.version}/code/renderers/svelte/src/svelte-csf/ERRORS.md#SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0001`
    );
  });

  it('has an ERRORS.md heading for the link of every error class', () => {
    const errorsMd = fs.readFileSync(
      path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../ERRORS.md'),
      'utf8'
    );
    const headings = new Set(
      [...errorsMd.matchAll(/^#{1,6} `?([A-Z0-9_]+)`?\s*$/gm)].map((match) => match[1])
    );
    const modules = [analyseDefineMeta, analyseStory, extractCompiled, extractSvelte];
    const missing: string[] = [];
    let checked = 0;

    for (const module of modules) {
      for (const ErrorClass of Object.values<unknown>(module)) {
        if (
          typeof ErrorClass !== 'function' ||
          !(ErrorClass.prototype instanceof StorybookSvelteCSFError)
        ) {
          continue;
        }
        const error = new (ErrorClass as new (...args: unknown[]) => StorybookSvelteCSFError)(
          {},
          {}
        );
        checked++;

        expect(error.documentation).toBe(true);
        // Read the link without `template()`, which needs real constructor arguments
        const message = Object.getOwnPropertyDescriptor(
          StorybookSvelteCSFError.prototype,
          'message'
        )?.get?.call({ ...error, fullErrorCode: error.fullErrorCode, template: () => '' });
        expect(message).toBe(
          `\n\nMore info: https://github.com/storybookjs/storybook/blob/v${rendererPkg.version}/code/renderers/svelte/src/svelte-csf/ERRORS.md#${error.fullErrorCode}\n`
        );
        if (!headings.has(error.fullErrorCode)) {
          missing.push(error.fullErrorCode);
        }
      }
    }

    expect(checked).toBeGreaterThan(25);
    expect(missing).toEqual([]);
  });
});
