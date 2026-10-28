import {
  getComponentIdFromEntry,
  getStoryImportPathFromEntry,
} from '@storybook/core/internal/common';
import {
  type JsDocTagMap,
  extractComponentDescription,
  extractDescription,
} from '@storybook/core/internal/csf-tools';
import type { DocgenPayload, DocgenProviderInput } from '@storybook/core/internal/types';

import { resolve } from 'pathe';

import { buildApiDescription } from './api-description.ts';
import { mapArgTypes } from './arg-types/map-arg-types.ts';
import type { ManifestDeclaration } from './manifest/types.ts';
import { parseStoryFile, resolveStoryComponent } from './resolve-component/resolve-component.ts';
import type { TagResolver } from './tag-resolver.ts';
import { deprecationMessage, trimmedOrUndefined } from './utils.ts';

export interface WebComponentsDocgenOptions {
  manifestPaths: string[];
  /** Also searched for element registrations when generating from sources. */
  previewFilePath?: string;
}

export type WebComponentsDocgenPayload = DocgenPayload & {
  /** Set while the manifest is served from its last valid version after a failed reload. */
  warning?: string;
  customElementsManifest?: {
    manifestPath: string;
    declaration: ManifestDeclaration;
  };
};

export interface BuildDocgenContext {
  resolver: TagResolver;
}

export async function buildDocgenPayload(
  input: DocgenProviderInput,
  context: BuildDocgenContext
): Promise<WebComponentsDocgenPayload | undefined> {
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
    if (resolved.reason === 'unresolvable-meta-spread') {
      return fail(componentName, {
        name: 'unresolvable-meta-spread',
        message:
          `\`meta.component\` could not be read because \`${resolved.spread}\` is not a local object literal. ` +
          "Set `component: '<tag-name>'` on the default export.",
      });
    }
    return fail(componentName, {
      name: 'component-not-a-tag',
      message: `\`meta.component\` must be the element's tag name as a string, got \`${resolved.expression}\``,
    });
  }

  const { tag } = resolved;
  const found = await context.resolver.find(tag, { storyFilePath });
  if (!('declaration' in found)) {
    return fail(tag, found);
  }

  const { description, summary, jsDocTags } = extractComponentDescription(
    extractDescription(csf._metaStatement, csf.editor) || undefined,
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
    argTypes: mapArgTypes(found.declaration),
    apiDescription: buildApiDescription(found.declaration),
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
