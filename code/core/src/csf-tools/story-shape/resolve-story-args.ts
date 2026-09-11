// The one choreography every renderer's snippet generator shares: resolve the meta's members once,
// resolve each story's binding, merge their args, and read every value through to something that
// means the same where the snippet lands.
import { types as t } from 'storybook/internal/babel';

import type { CsfFile } from '../CsfFile.ts';
import { type ImportRef } from './import-statements.ts';
import { resolveArgValue } from './resolve-arg-value.ts';
import {
  type ReferenceContext,
  type ResolvedMembers,
  type StoryReferences,
  resolveArgsRecord,
  resolveBindingMembers,
  resolveObjectMembers,
  sourceOf,
} from './resolve-members.ts';

/** Everything reading one story's args statically produced. */
export interface ResolvedStoryArgs {
  /** Meta args merged under story args, keyed by arg name, every value read through. */
  args: Record<string, t.Node>;
  /** Imports the arg values need beyond the component, from values that kept a name. */
  imports: ImportRef[];
  /** Source text of everything hiding args from this pass; empty when the merged args are known. */
  unresolved: string[];
  /** The story's own config members, spreads and names followed. */
  storyMembers: ResolvedMembers;
  /** The meta's config members, spreads and names followed. */
  metaMembers: ResolvedMembers;
}

export interface StoryArgsResolver {
  /** The context every resolution in this file runs against. */
  ctx: ReferenceContext;
  resolve: (storyExport: string) => ResolvedStoryArgs;
}

/**
 * Builds the args resolver for one story file, resolving the meta once for all of its stories.
 *
 * Pass `references` to let a story's args resolve names other modules own; without it only the
 * story file itself is read, and anything it reaches for elsewhere is reported as unresolved.
 */
export function createStoryArgsResolver(
  csf: CsfFile,
  references?: StoryReferences
): StoryArgsResolver {
  const ctx: ReferenceContext = {
    program: csf._file.path,
    filePath: csf._file.opts.filename ?? '',
    ...references,
  };

  const metaNode = csf._metaNode;
  const metaMembers =
    metaNode && t.isObjectExpression(metaNode)
      ? resolveObjectMembers(metaNode, ctx)
      : { properties: {}, shadowed: [], unresolved: [] };
  const metaArgs = resolveArgsRecord(metaMembers.properties.args, ctx);

  return {
    ctx,
    resolve: (storyExport) => {
      // A re-export documents the story under a different name than the binding it reads.
      const localName = csf._stories[storyExport]?.localName ?? storyExport;
      const storyMembers = resolveBindingMembers(ctx, localName) ?? {
        properties: {},
        shadowed: [],
        unresolved: [sourceOf(csf._storyStatements[storyExport] ?? t.identifier(storyExport))],
      };
      const storyArgs = resolveArgsRecord(storyMembers.properties.args, ctx);

      const args: Record<string, t.Node> = {};
      const imports: ImportRef[] = [];
      const unresolved = [
        ...metaMembers.unresolved,
        ...metaArgs.unresolved,
        ...storyMembers.unresolved,
        ...storyArgs.unresolved,
      ];

      for (const [key, node] of Object.entries({
        ...metaArgs.properties,
        ...storyArgs.properties,
      })) {
        const value = resolveArgValue(node, ctx);
        args[key] = value.node;
        imports.push(...value.imports);
        unresolved.push(...value.unresolved);
      }

      return { args, imports, unresolved, storyMembers, metaMembers };
    },
  };
}

/** Says which source text a static pass could not read, so a reader can see what is missing. */
export const unresolvedWarning = (unresolved: readonly string[]): string | undefined => {
  const sources = [...new Set(unresolved)];
  return sources.length === 0
    ? undefined
    : `Incomplete snippet: ${sources.map((source) => `\`${source}\``).join(', ')} could not be resolved statically.`;
};

/** {@link unresolvedWarning} for a story that gets no snippet at all instead of a partial one. */
export const noSnippetWarning = (unresolved: readonly string[]): string | undefined => {
  const sources = [...new Set(unresolved)];
  return sources.length === 0
    ? undefined
    : `No static snippet: ${sources.map((source) => `\`${source}\``).join(', ')} could not be resolved statically.`;
};
