import { getComponentIdFromEntry } from 'storybook/internal/common';
import { extractDescription } from 'storybook/internal/csf-tools';
import type { ComponentManifest, IndexEntry } from 'storybook/internal/types';

import { findComponentByName } from './compodoc.ts';
import type { CompodocJson, Component, Directive } from './compodocTypes.ts';
import { extractComponentDescription } from './extractComponentDescription.ts';
import type { ParsedCsf } from './resolveAngularComponents.ts';

/** Optimised representation of a single Angular input for docgen consumers. */
export interface CompodocInputSummary {
  name: string;
  type: string;
  optional: boolean;
  required?: boolean;
  defaultValue?: string;
  description?: string;
}

/** Optimised representation of a single Angular output for docgen consumers. */
export interface CompodocOutputSummary {
  name: string;
  type: string;
  description?: string;
}

/**
 * Lean summary of Compodoc data for a component or directive.
 *
 * Only the fields that are relevant to docgen consumers (AI tools, HTML debugger, etc.) are
 * included. Internal Compodoc details such as templates, style URLs, host bindings, class
 * properties, methods, and decorators are deliberately excluded.
 */
export interface CompodocComponentSummary {
  name: string;
  type: 'component' | 'directive';
  selector?: string;
  standalone?: boolean;
  changeDetection?: string;
  inputs: CompodocInputSummary[];
  outputs: CompodocOutputSummary[];
  description?: string;
}

/**
 * Angular docgen payload with Compodoc-specific data attached. Output shape for the Angular
 * `experimental_docgenProvider`.
 */
// Derive from the base `ComponentManifest` (which has no index signature) so `Omit` keeps the
// named props (an index signature on the source type would collapse `Omit` to just that index
// signature). We re-add the Compodoc-specific fields and the index signature explicitly, mirroring
// `ComponentDocgenFromResolved` in the React renderer's `buildReactComponentDocgen.ts`.
export type ComponentDocgenFromResolved = Omit<
  ComponentManifest,
  'stories' | 'import' | 'subcomponents'
> & {
  /** Optimised Compodoc summary — only public API fields, no internal implementation details. */
  compodoc?: CompodocComponentSummary;
  [key: string]: unknown;
};

/**
 * Build a lean {@link CompodocComponentSummary} from a raw Compodoc component/directive entry.
 *
 * Keeps only the fields that docgen consumers actually need (selector, inputs/outputs with their
 * public API metadata, standalone flag, change detection, description). Strips internal details:
 * template source, style URLs, host bindings/listeners, class properties, methods, decorators, and
 * raw JSDoc tags.
 */
function buildCompodocSummary(data: Component | Directive): CompodocComponentSummary {
  return {
    name: data.name,
    type: data.type as 'component' | 'directive',
    selector: data.selector,
    standalone: data.standalone,
    changeDetection: data.changeDetection,
    inputs: data.inputsClass.map((p) => ({
      name: p.name,
      type: p.type,
      optional: p.optional,
      ...(p.required !== undefined && { required: p.required }),
      ...(p.defaultValue !== undefined && { defaultValue: p.defaultValue }),
      description: p.rawdescription || p.description,
    })),
    outputs: data.outputsClass.map((p) => ({
      name: p.name,
      type: p.type,
      description: p.rawdescription || p.description,
    })),
    description: data.rawdescription || data.description,
  };
}

/**
 * Build a {@link ComponentDocgenFromResolved} from a resolved story file entry and the Compodoc
 * documentation output. Used by the Angular `experimental_docgenProvider`.
 */
export function buildComponentDocgenFromResolved({
  entry,
  storyFilePath,
  storyFile,
  csf,
  componentName,
  compodocJson,
}: {
  entry: IndexEntry;
  storyFilePath: string;
  storyFile: string;
  csf: ParsedCsf;
  componentName: string | undefined;
  compodocJson: CompodocJson | null;
}): ComponentDocgenFromResolved {
  const id = getComponentIdFromEntry(entry);
  const title = entry.title.split('/').at(-1)?.replace(/\s+/g, '') ?? entry.title;
  const name = componentName ?? title;

  const compodocData =
    componentName && compodocJson ? findComponentByName(componentName, compodocJson) : undefined;

  const base = {
    id,
    name,
    path: storyFilePath,
    jsDocTags: {},
  } satisfies Partial<ComponentDocgenFromResolved>;

  if (!compodocData) {
    const error = !csf._meta?.component
      ? {
          name: 'No component found',
          message:
            'We could not detect the component from your story file. Specify meta.component.',
        }
      : {
          name: 'Component not found in Compodoc output',
          message:
            `"${componentName}" was not found in the Compodoc documentation. ` +
            `Make sure your tsconfig includes all source files.\n\n${entry.importPath}:\n${storyFile}`,
        };

    return { ...base, error };
  }

  const compodocDescription = compodocData.rawdescription || compodocData.description;
  const metaJsDoc = extractDescription(csf._metaStatement) || undefined;
  const { description, summary, jsDocTags } = extractComponentDescription(
    metaJsDoc,
    compodocDescription
  );

  return {
    ...base,
    description,
    summary,
    jsDocTags,
    compodoc: buildCompodocSummary(compodocData as Component | Directive),
  };
}
