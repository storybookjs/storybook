import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import type { JsDocTagMap } from 'storybook/internal/csf-tools';
import { extractComponentDescription, extractDescription } from 'storybook/internal/csf-tools';
import type { DocgenPayload, DocgenProviderInput } from 'storybook/internal/types';

import { resolve } from 'node:path';

import { mapArgTypes } from './arg-types/map-arg-types.ts';
import type { ManifestSnapshot } from './manifest/manifest-manager.ts';
import type { ManifestDeclaration } from './manifest/types.ts';
import { parseStoryFile, resolveStoryComponent } from './resolve-component/resolve-component.ts';
import { deprecationMessage, trimmedOrUndefined } from './utils.ts';

export interface WebComponentsDocgenOptions {
  manifestPaths: string[];
  typeProperty: string;
}

export type WebComponentsDocgenPayload = DocgenPayload & {
  /** Surfaced to payload consumers such as the docs toolset; no docs block renders it yet. */
  warning?: string;
  customElementsManifest?: {
    manifestPath: string;
    declaration: ManifestDeclaration;
  };
};

export interface BuildDocgenContext {
  manifests: ManifestSnapshot;
  typeProperty: string;
}

export function buildDocgenPayload(
  input: DocgenProviderInput,
  context: BuildDocgenContext
): WebComponentsDocgenPayload | undefined {
  const storyImportPath = getStoryImportPathFromEntry(input.entry);
  if (!storyImportPath) {
    return undefined;
  }
  const id = getComponentIdFromEntry(input.entry);
  const path = storyImportPath;
  const fail = (name: string, error: DocgenPayload['error']): WebComponentsDocgenPayload => ({
    id,
    name,
    path,
    jsDocTags: {},
    error,
  });
  const storyFilePath = resolve(process.cwd(), storyImportPath);
  const csf = parseStoryFile(storyFilePath, input.entry.title);
  if (!csf) {
    return undefined;
  }

  const resolved = resolveStoryComponent(csf);
  if ('reason' in resolved) {
    if (resolved.reason === 'no-meta-component') {
      return undefined;
    }

    const componentName = input.entry.title.slice(input.entry.title.lastIndexOf('/') + 1);
    return fail(componentName, {
      name: 'component-not-a-tag',
      message: `\`meta.component\` must be the element's tag name as a string, got \`${resolved.expression}\``,
    });
  }

  const { tag } = resolved;

  const found = context.manifests.tags.get(tag);
  if (!found) {
    return fail(
      tag,
      context.manifests.errors[0] ?? {
        name: 'tag-not-found',
        message:
          `No declaration for "${tag}" was found in ${context.manifests.paths.join(', ')}. ` +
          'If the element is new, rerun the custom elements manifest analyzer.',
      }
    );
  }

  const { description, summary, jsDocTags } = extractComponentDescription(
    extractDescription(csf._metaStatement) || undefined,
    found.declaration.description,
    declarationTags(found.declaration)
  );

  return {
    id,
    name: tag,
    path,
    description,
    summary,
    jsDocTags,
    argTypes: mapArgTypes(found.declaration, context.typeProperty),
    renderer: 'web-components',
    ...(found.warning ? { warning: found.warning } : {}),
    customElementsManifest: {
      manifestPath: found.manifestPath,
      declaration: found.declaration,
    },
  };
}

function declarationTags(declaration: ManifestDeclaration): JsDocTagMap {
  const tags: JsDocTagMap = {};
  const summary = trimmedOrUndefined(declaration.summary);
  if (summary) {
    tags.summary = [summary];
  }
  const deprecated = deprecationMessage(declaration.deprecated);
  if (deprecated) {
    tags.deprecated = [deprecated];
  }
  return tags;
}
