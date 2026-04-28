import {
  ChangeDetectionFailureError,
  type ImportEdge,
  type ImportParser,
} from 'storybook/internal/core-server';

type SvelteCompiler = typeof import('svelte/compiler');

let svelteCompilerPromise: Promise<SvelteCompiler> | undefined;

async function getSvelteCompiler(): Promise<SvelteCompiler> {
  if (!svelteCompilerPromise) {
    svelteCompilerPromise = import('svelte/compiler').catch((error: unknown) => {
      svelteCompilerPromise = undefined;
      throw new ChangeDetectionFailureError(
        `Failed to load 'svelte/compiler'; is 'svelte' installed? Original error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? { cause: error } : undefined
      );
    });
  }
  return svelteCompilerPromise;
}

interface MaybeProgramRange {
  start?: number;
  end?: number;
}

/** Loose shape of a single attribute node from the Svelte AST (`Attribute[]` on `Script`). */
interface MaybeAstAttribute {
  name?: unknown;
  /** `true` for boolean attrs; array of text/expression nodes for string attrs. */
  value?: unknown;
}

interface MaybeScript {
  content?: MaybeProgramRange | null;
  /** Svelte AST `Script.attributes` — an array of `Attribute` nodes. */
  attributes?: MaybeAstAttribute[] | null;
}

interface MaybeSvelteRoot {
  instance?: MaybeScript | null;
  module?: MaybeScript | null;
}

/**
 * Reads the `lang` attribute from a Svelte AST `Script.attributes` array.
 * Each attribute is `{ name, value }` where value is `true` (boolean attr) or an array
 * of text/expression nodes — `[{ data: "ts" }]` for `lang="ts"`.
 */
function readLangFromAttributes(attributes: MaybeAstAttribute[] | null | undefined): string | undefined {
  if (!Array.isArray(attributes)) {
    return undefined;
  }
  for (const attr of attributes) {
    if (attr.name !== 'lang') {
      continue;
    }
    // Boolean attribute (`lang` without value) — no practical meaning, skip.
    if (attr.value === true) {
      return undefined;
    }
    // String attribute: value is an array of text/expression nodes.
    if (Array.isArray(attr.value) && attr.value.length > 0) {
      const first = attr.value[0] as { data?: unknown } | undefined;
      if (typeof first?.data === 'string') {
        return first.data;
      }
    }
    return undefined;
  }
  return undefined;
}

function extractScriptSource(
  source: string,
  script: MaybeScript | null | undefined
): { scriptSource: string; lang: string | undefined } | undefined {
  const range = script?.content;
  if (!range || typeof range.start !== 'number' || typeof range.end !== 'number') {
    return undefined;
  }
  if (range.start < 0 || range.end > source.length || range.end <= range.start) {
    return undefined;
  }
  const lang = readLangFromAttributes(script?.attributes);
  return { scriptSource: source.slice(range.start, range.end), lang };
}

/**
 * Maps the `lang` attribute of a `<script>` block to a virtual file extension so oxc
 * parses the extracted script in the right mode (TS superset vs plain JS, with/without JSX).
 */
function virtualExtensionForLang(lang: string | undefined): 'ts' | 'tsx' | 'jsx' | 'js' {
  switch (lang) {
    case 'ts':
      return 'ts';
    case 'tsx':
      return 'tsx';
    case 'jsx':
      return 'jsx';
    default:
      // No lang or unrecognised value — plain JS is the safe default.
      return 'js';
  }
}

/**
 * Parser plugin for Svelte single-file components. Delegates the heavy lifting of AST-level
 * import extraction to the built-in oxc wrapper: we only crack the `.svelte` container,
 * pull the `<script>` and `<script module>` bodies, and hand each one back to oxc via the
 * {@link ctx.parseScriptWithOxc} service.
 *
 * Intentionally does NOT walk template markup. Storybook's change-detection graph tracks
 * JS/TS import edges only; template-level component references would require rich AST
 * handling that is out of scope for change detection today.
 *
 * The `svelte/compiler` dep is lazy-loaded so change-detection opt-outs do not pay the
 * import cost. Svelte is a peer dep of `@storybook/svelte`, so it is always present in
 * user projects that enable this parser.
 */
export const svelteImportParser: ImportParser = {
  extensions: ['.svelte'],
  async parse({ filePath, source }, ctx) {
    const compiler = await getSvelteCompiler();

    let ast: unknown;
    try {
      ast = compiler.parse(source, { filename: filePath, modern: true });
    } catch (error) {
      throw new ChangeDetectionFailureError(
        `svelte/compiler failed to parse ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? { cause: error } : undefined
      );
    }

    const root = (ast ?? {}) as MaybeSvelteRoot;
    // Process `<script module>` first so deduplication preserves source/execution order:
    // module-scoped code initializes before the instance block.
    const scripts: { scriptSource: string; lang: string | undefined }[] = [];
    const moduleResult = extractScriptSource(source, root.module);
    if (moduleResult !== undefined) {
      scripts.push(moduleResult);
    }
    const instanceResult = extractScriptSource(source, root.instance);
    if (instanceResult !== undefined) {
      scripts.push(instanceResult);
    }

    if (scripts.length === 0) {
      return [];
    }

    const edges: ImportEdge[] = [];
    const seen = new Set<string>();
    for (const { scriptSource, lang } of scripts) {
      const ext = virtualExtensionForLang(lang);
      const virtualFilePath = `${filePath}.script.${ext}`;
      const scriptEdges = await ctx.parseScriptWithOxc(scriptSource, virtualFilePath);
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
