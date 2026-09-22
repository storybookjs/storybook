import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import type { DocgenPayload, DocgenProviderInput } from 'storybook/internal/types';

import { relative, resolve } from 'node:path';

import { extractArgTypesFromDeclaration } from './arg-types/extract-arg-types.ts';
import type { ManifestLoadResult } from './manifest/load-manifest.ts';
import { resolveDeclarationForTag } from './manifest/resolve-declaration.ts';
import { resolveStoryComponent } from './resolve-component/resolve-component.ts';

export interface WebComponentsDocgenOptions {
  manifestPaths: string[];
  rootDir: string;
}

export type WebComponentsDocgenPayload = DocgenPayload & {
  customElementsManifest?: {
    manifestPath: string;
    declaration: Record<string, unknown>;
  };
};

export interface BuildDocgenContext {
  manifests: ManifestLoadResult[];
  options: WebComponentsDocgenOptions;
  resolvePath?: (importPath: string) => string;
}

const describedBy = (text: unknown): string | undefined =>
  typeof text === 'string' ? text.trim() || undefined : undefined;

const errorPayload = (
  base: Pick<DocgenPayload, 'id' | 'name' | 'path'>,
  name: string,
  message: string
): WebComponentsDocgenPayload => ({ ...base, jsDocTags: {}, error: { name, message } });

const manifestPathForPayload = (rootDir: string, manifestPath: string): string =>
  relative(rootDir, manifestPath);

const manifestListForPayload = (options: WebComponentsDocgenOptions): string =>
  options.manifestPaths.map((path) => manifestPathForPayload(options.rootDir, path)).join(', ');

const manifestErrorMessageForPayload = (
  options: WebComponentsDocgenOptions,
  error: Extract<ManifestLoadResult, { error: unknown }>
): string =>
  error.error.message.replaceAll(error.path, manifestPathForPayload(options.rootDir, error.path));

const firstManifestError = (manifests: ManifestLoadResult[]): ManifestLoadResult | undefined =>
  manifests.find((manifest) => 'error' in manifest);

export function buildDocgenPayload(
  input: DocgenProviderInput,
  context: BuildDocgenContext
): WebComponentsDocgenPayload | undefined {
  const storyImportPath = getStoryImportPathFromEntry(input.entry);
  if (!storyImportPath) {
    return undefined;
  }
  const storyFilePath = resolve(process.cwd(), storyImportPath);
  const storyFilePath = resolvePath(storyImportPath);
  const resolved = resolveStoryComponent(storyFilePath, input.entry.title);
  if ('reason' in resolved) {
    if (resolved.reason === 'no-meta-component') {
      return undefined;
    }

    const base = {
      id: getComponentIdFromEntry(input.entry),
      name: input.entry.title.split('/').at(-1) ?? input.entry.title,
      path: storyImportPath,
    };
    return errorPayload(
      base,
      'component-not-a-tag',
      `\`meta.component\` must be the element's tag name as a string, got \`${resolved.expression}\``
    );
  }

  const { tag } = resolved;
  const base = { id: getComponentIdFromEntry(input.entry), name: tag, path: storyImportPath };

  if (context.options.manifestPaths.length === 0) {
    return errorPayload(
      base,
      'no-manifest',
      'No Custom Elements Manifest paths were configured. Set the `customElementsManifest` ' +
        'framework option or package.json#customElements.'
    );
  }

  const declaration = resolveDeclarationForTag(context.manifests, tag);
  if (!declaration) {
    const error = firstManifestError(context.manifests);
    if (error && 'error' in error) {
      return errorPayload(
        base,
        error.error.name,
        manifestErrorMessageForPayload(context.options, error)
      );
    }

    return errorPayload(
      base,
      'tag-not-found',
      `No declaration for "${tag}" was found in ${manifestListForPayload(context.options)}. ` +
        'If the element is new, rerun the custom elements manifest analyzer.'
    );
  }

  return {
    ...base,
    description: describedBy(declaration.declaration.description),
    summary: describedBy(declaration.declaration.summary),
    jsDocTags: {},
    argTypes: extractArgTypesFromDeclaration(declaration.declaration),
    renderer: 'web-components',
    customElementsManifest: {
      manifestPath: manifestPathForPayload(context.options.rootDir, declaration.manifestPath),
      declaration: declaration.declaration,
    },
  };
}
