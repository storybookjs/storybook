/**
 * NOTE:
 *
 * 1. Why Svelte AST nodes had to be included?
 *    - During the compilation from Svelte to JS, HTML comments are removed.
 *    - Rollup' internal `this.parse()` excludes `leadingComments` from parsing.
 *      I couldn't find an option to override this behavior.
 *      I wanted to avoid adding another package for parsing _(getting AST)_ - e.g. `acorn`
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import MagicString from 'magic-string';
import { preprocess as preprocessSvelte, type PreprocessorGroup } from 'svelte/compiler';

import { transformStoriesCode } from './post-transform/index.ts';
import { getSvelteAST } from '../parser/ast.ts';
import { extractCompiledASTNodes } from '../parser/extract/compiled/nodes.ts';
import { extractSvelteASTNodes } from '../parser/extract/svelte/nodes.ts';
import { SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE } from '../constants.ts';

// The bare specifier that transformed stories files import the runtime from
export { SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE };

// Users don't depend on @storybook/svelte directly, so a strict package manager like pnpm can't
// resolve the runtime import from their stories files. Bundlers resolve it to this file instead.
export const svelteCsfRuntimeStoriesPath = fileURLToPath(
  import.meta.resolve(SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE)
);

interface TransformSvelteCsfParams {
  filename: string;
  // The stories file compiled to JS by the Svelte compiler
  compiledCode: string;
  // The ESTree AST of `compiledCode`
  compiledAST: Parameters<typeof extractCompiledASTNodes>[0]['ast'];
  // The user's Svelte preprocessors, for example from svelte.config.js
  preprocess?: PreprocessorGroup | PreprocessorGroup[];
}

// Turn the compiled JS of a `*.stories.svelte` file into a CSF module with one export per story
export async function transformSvelteCsf(params: TransformSvelteCsfParams) {
  const { filename, compiledCode, compiledAST, preprocess } = params;
  const magicCompiledCode = new MagicString(compiledCode);
  let rawCode = fs.readFileSync(filename).toString();

  if (preprocess) {
    rawCode = (await preprocessSvelte(rawCode, preprocess, { filename })).code;
  }

  const svelteAST = getSvelteAST({ code: rawCode, filename });
  const svelteASTNodes = await extractSvelteASTNodes({ ast: svelteAST, filename });
  const compiledASTNodes = await extractCompiledASTNodes({ ast: compiledAST, filename });

  await transformStoriesCode({
    code: magicCompiledCode,
    nodes: {
      svelte: svelteASTNodes,
      compiled: compiledASTNodes,
    },
    filename,
    originalCode: rawCode,
  });

  return {
    code: magicCompiledCode.toString(),
    map: magicCompiledCode.generateMap({ hires: true, source: filename }),
  };
}
