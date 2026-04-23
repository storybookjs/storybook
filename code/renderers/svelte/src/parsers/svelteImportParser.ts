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

interface MaybeScript {
  content?: MaybeProgramRange | null;
}

interface MaybeSvelteRoot {
  instance?: MaybeScript | null;
  module?: MaybeScript | null;
}

function extractScriptSource(
  source: string,
  script: MaybeScript | null | undefined
): string | undefined {
  const range = script?.content;
  if (!range || typeof range.start !== 'number' || typeof range.end !== 'number') {
    return undefined;
  }
  if (range.start < 0 || range.end > source.length || range.end <= range.start) {
    return undefined;
  }
  return source.slice(range.start, range.end);
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
    const scripts: string[] = [];
    // Process `<script module>` first so deduplication preserves source/execution order:
    // module-scoped code initializes before the instance block.
    const moduleSource = extractScriptSource(source, root.module);
    if (moduleSource !== undefined) {
      scripts.push(moduleSource);
    }
    const instanceSource = extractScriptSource(source, root.instance);
    if (instanceSource !== undefined) {
      scripts.push(instanceSource);
    }

    if (scripts.length === 0) {
      return [];
    }

    // `.ts` virtual extension works for both TypeScript and plain JS — oxc-parser accepts
    // JS-only source via the TS syntax superset — so we do not need to introspect
    // `<script lang="...">` here.
    const virtualFilePath = `${filePath}.script.ts`;

    const edges: ImportEdge[] = [];
    const seen = new Set<string>();
    for (const script of scripts) {
      const scriptEdges = await ctx.parseScriptWithOxc(script, virtualFilePath);
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
