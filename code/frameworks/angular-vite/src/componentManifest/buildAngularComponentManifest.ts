import { readFileSync } from 'node:fs';
import { up as findPackageJson } from 'empathic/package';
import { getComponentIdFromEntry } from 'storybook/internal/common';
import { extractDescription } from 'storybook/internal/csf-tools';
import type { ComponentManifest, IndexEntry } from 'storybook/internal/types';

import { findComponentByName } from './compodoc.ts';
import type { CompodocJson, Component, Directive } from './compodocTypes.ts';
import { extractComponentDescription } from './extractComponentDescription.ts';
import { extractAngularStorySnippets } from './resolveAngularComponents.ts';
import type {
  AngularComponentRef,
  ParsedCsf,
  ResolvedAngularStoryEntry,
} from './resolveAngularComponents.ts';

/** Optimised representation of a single Angular input for manifest consumers. */
export interface CompodocInputSummary {
  name: string;
  type: string;
  optional: boolean;
  required?: boolean;
  defaultValue?: string;
  description?: string;
}

/** Optimised representation of a single Angular output for manifest consumers. */
export interface CompodocOutputSummary {
  name: string;
  type: string;
  description?: string;
}

/**
 * Lean summary of Compodoc data for a component or directive.
 *
 * Only the fields that are relevant to manifest consumers (AI tools, HTML debugger, etc.)
 * are included. Internal Compodoc details such as templates, style URLs, host bindings,
 * class properties, methods, and decorators are deliberately excluded.
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
 * Angular component manifest with Compodoc-specific docgen data attached.
 *
 * Extends the base `ComponentManifest` with Angular-specific metadata from Compodoc 2.0
 * so that consumers (e.g. the HTML debugger, AI tools) can render rich documentation.
 */
export interface AngularComponentManifest extends ComponentManifest {
  /** Optimised Compodoc summary — only public API fields, no internal implementation details. */
  compodoc?: CompodocComponentSummary;
  /** `true` for standalone components/directives/pipes (Compodoc 2.0). */
  standalone?: boolean;
  /** Change detection strategy, e.g. `"ChangeDetectionStrategy.OnPush"`. */
  changeDetection?: string;
  /** Raw Angular selector, e.g. `"button[lib-btn], a[lib-btn]"`. */
  selector?: string;
  /** Angular story entries with generated template snippets. */
  stories: ResolvedAngularStoryEntry[];
  [key: string]: unknown;
}

/**
 * Build a lean {@link CompodocComponentSummary} from a raw Compodoc component/directive entry.
 *
 * Keeps only the fields that manifest consumers actually need (selector, inputs/outputs
 * with their public API metadata, standalone flag, change detection, description).
 * Strips internal details: template source, style URLs, host bindings/listeners,
 * class properties, methods, decorators, and raw JSDoc tags.
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
 * Resolve the best import specifier for a component: the nearest package.json `name` field
 * when the component lives inside a published package, or the raw story-relative specifier.
 */
function resolveImportSpecifier(component: AngularComponentRef | undefined): string | undefined {
  if (!component?.importSpecifier) return undefined;

  if (component.path) {
    const pkgJsonPath = findPackageJson({ cwd: component.path });
    if (pkgJsonPath) {
      try {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
          name?: string;
        };
        if (pkg.name) return pkg.name;
      } catch {
        // fall through to raw specifier
      }
    }
  }

  return component.importSpecifier;
}

/** Build an import statement string for the component. */
function buildImportStatement(
  componentName: string | undefined,
  component: AngularComponentRef | undefined
): string {
  if (!componentName) return '';
  const specifier = resolveImportSpecifier(component);
  if (!specifier) return '';
  return `import { ${componentName} } from "${specifier}";`;
}

/**
 * Build an {@link AngularComponentManifest} from a resolved story file entry and the Compodoc
 * documentation output. This is the output shape for the Angular `experimental_manifests` preset.
 */
export function buildAngularComponentManifest({
  entry,
  storyFilePath,
  storyFile,
  csf,
  componentName,
  component,
  compodocJson,
  filterStoryIds,
}: {
  entry: IndexEntry;
  storyPath: string;
  storyFilePath: string;
  storyFile: string;
  csf: ParsedCsf;
  componentName: string | undefined;
  component: AngularComponentRef | undefined;
  compodocJson: CompodocJson | null;
  filterStoryIds?: ReadonlySet<string>;
}): AngularComponentManifest {
  const id = getComponentIdFromEntry(entry);
  const title = entry.title.split('/').at(-1)?.replace(/\s+/g, '') ?? entry.title;
  const name = componentName ?? title;

  const compodocData =
    componentName && compodocJson ? findComponentByName(componentName, compodocJson) : undefined;

  const stories: ResolvedAngularStoryEntry[] = extractAngularStorySnippets(
    csf,
    compodocData as Component | Directive | undefined,
    componentName,
    filterStoryIds
  );

  const importStatement = buildImportStatement(componentName, component);

  const base = {
    id,
    name,
    path: storyFilePath,
    stories,
    import: importStatement || undefined,
    jsDocTags: {},
  } satisfies Partial<AngularComponentManifest>;

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

  const dir = compodocData as Directive | undefined;

  return {
    ...base,
    description,
    summary,
    jsDocTags,
    compodoc: buildCompodocSummary(compodocData as Component | Directive),
    standalone: dir?.standalone,
    changeDetection: dir?.changeDetection,
    selector: dir?.selector,
  };
}
