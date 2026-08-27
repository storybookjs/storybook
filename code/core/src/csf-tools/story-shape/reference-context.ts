import type { types as t } from 'storybook/internal/babel';

import { readFileSync } from 'node:fs';

import { createModuleResolver } from '../../common/utils/module-resolver.ts';
import { jsTsSourceExtensions } from '../../shared/constants/extensions.ts';
import { babelParseFile } from '../CsfFile.ts';
import { isSelfContained } from './resolve-arg-value.ts';
import type { ReferenceModule, StoryReferenceResolver } from './resolve-members.ts';

export interface StoryReferenceResolverOptions {
  /** Extensions tried ahead of the JS/TS set, for single-file-component formats like `.vue`. */
  extensions?: string[];
  /**
   * Rewrites a value read out of another module into one that stands on its own. Defaults to
   * accepting exactly the values that already do.
   */
  externalize?: StoryReferenceResolver['externalize'];
}

/**
 * Builds the half of a story-file reference context that lets static arg resolution leave the
 * story file.
 *
 * A story's args can spread or name a value another module owns, so resolving them reads those
 * modules too. The returned function opens a resolver for one build, which parses each module it
 * reaches at most once; module *resolutions* are cached across builds, since a specifier resolving
 * to a different file is far rarer than that file's contents changing:
 *
 * ```ts
 * const openStoryReferences = createStoryReferenceResolver();
 * // per build:
 * const resolver = createStoryArgsResolver(csf, { filePath: storyPath, ...openStoryReferences() });
 * ```
 */
export function createStoryReferenceResolver(
  options: StoryReferenceResolverOptions = {}
): () => StoryReferenceResolver {
  const resolver = createModuleResolver({
    extensions: [...(options.extensions ?? []), ...jsTsSourceExtensions],
    mainFields: ['module', 'main'],
    tsconfig: 'auto',
  });

  return function openStoryReferences(): StoryReferenceResolver {
    const parsed = new Map<string, ReferenceModule | undefined>();

    return {
      externalize: options.externalize ?? selfContained,
      resolveModule: (fromFile, specifier) => {
        let filePath: string;
        try {
          filePath = resolver.resolveFileSync(fromFile, specifier);
        } catch {
          return undefined;
        }
        if (!parsed.has(filePath)) {
          parsed.set(filePath, parseReferenceModule(filePath));
        }
        return parsed.get(filePath);
      },
    };
  };
}

/** Parses a module reached by an import, for a caller that already resolved its path. */
export const parseReferenceModule = (filePath: string): ReferenceModule | undefined => {
  try {
    const code = readFileSync(filePath, 'utf8');
    return { program: babelParseFile({ code, filename: filePath }).path, filePath };
  } catch {
    return undefined;
  }
};

const selfContained = (node: t.Node) => (isSelfContained(node) ? node : undefined);
