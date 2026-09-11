import {
  ChangeDetectionFailureError,
  type ImportEdge,
  type ImportParser,
} from 'storybook/internal/core-server';

// Vue 3.2.13+ re-exports `@vue/compiler-sfc` as `vue/compiler-sfc`, so we do NOT need
// an explicit `@vue/compiler-sfc` dependency here. `vue` is already a peer dep of the
// renderer and is guaranteed to be installed in any user project that uses Storybook
// for Vue.
type VueCompilerSfc = typeof import('vue/compiler-sfc');

let compilerSfcPromise: Promise<VueCompilerSfc> | undefined;

async function getCompilerSfc(): Promise<VueCompilerSfc> {
  if (!compilerSfcPromise) {
    compilerSfcPromise = import('vue/compiler-sfc').catch((error: unknown) => {
      compilerSfcPromise = undefined;
      throw new ChangeDetectionFailureError(
        `Failed to load 'vue/compiler-sfc'. Original error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? { cause: error } : undefined
      );
    });
  }
  return compilerSfcPromise;
}

function virtualExtensionForLang(lang: string | undefined): 'ts' | 'tsx' | 'js' | 'jsx' {
  // The virtual extension only controls how oxc parses the extracted script text —
  // TS/TSX both enable the TS superset, JS/JSX tell oxc to enable JSX syntax without
  // types. Everything else (markdown loaders, SCSS, etc.) is NOT script content and
  // we will not see it here because vue/compiler-sfc only surfaces JS-family langs
  // under `descriptor.script{,Setup}`.
  switch (lang) {
    case 'ts':
      return 'ts';
    case 'tsx':
      return 'tsx';
    case 'jsx':
      return 'jsx';
    default:
      return 'js';
  }
}

/**
 * Parser plugin for Vue single-file components. Cracks the `.vue` container via
 * `vue/compiler-sfc` and delegates actual import extraction to the built-in oxc
 * wrapper via {@link ctx.parseScriptWithOxc}.
 *
 * Handles both `<script>` and `<script setup>` blocks; `lang="ts"`/`lang="tsx"` is
 * honoured by picking the right virtual extension so oxc parses in TS mode. Template
 * imports (`<template>` expressions, `:is="..."` tag references) are NOT extracted —
 * Storybook's change-detection graph is a JS/TS import graph only.
 *
 * The `vue/compiler-sfc` dep is lazy-loaded so change-detection opt-outs do not pay
 * the import cost. It resolves to the user's installed `vue` package, which is a peer
 * dep of `@storybook/vue3`.
 */
export const vueImportParser: ImportParser = {
  extensions: ['.vue'],
  async parse({ filePath, source }, ctx) {
    const sfc = await getCompilerSfc();

    let parsed: Awaited<ReturnType<typeof sfc.parse>>;
    try {
      parsed = sfc.parse(source, { filename: filePath });
    } catch (error) {
      throw new ChangeDetectionFailureError(
        `vue/compiler-sfc failed to parse ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? { cause: error } : undefined
      );
    }

    if (parsed.errors.length > 0) {
      const first = parsed.errors[0];
      const message = first instanceof Error ? first.message : String(first);
      throw new ChangeDetectionFailureError(
        `vue/compiler-sfc reported errors for ${filePath}: ${message}`
      );
    }

    const { descriptor } = parsed;
    const blocks: { content: string; lang: string | undefined }[] = [];
    if (descriptor.script && descriptor.script.content.length > 0) {
      blocks.push({ content: descriptor.script.content, lang: descriptor.script.lang });
    }
    if (descriptor.scriptSetup && descriptor.scriptSetup.content.length > 0) {
      blocks.push({
        content: descriptor.scriptSetup.content,
        lang: descriptor.scriptSetup.lang,
      });
    }

    if (blocks.length === 0) {
      return [];
    }

    const edges: ImportEdge[] = [];
    const seen = new Set<string>();
    for (const block of blocks) {
      const ext = virtualExtensionForLang(block.lang);
      const virtualFilePath = `${filePath}.script.${ext}`;
      const scriptEdges = await ctx.parseScriptWithOxc(block.content, virtualFilePath);
      for (const edge of scriptEdges) {
        const key = `${edge.kind}:${edge.specifier}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        edges.push(edge);
      }
    }
    return edges;
  },
};
