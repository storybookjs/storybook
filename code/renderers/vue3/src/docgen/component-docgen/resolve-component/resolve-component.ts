import { createMetaComponentResolver } from 'storybook/internal/common';
import type { CsfFile } from 'storybook/internal/csf-tools';

/** The component a story file documents, located on disk. */
export interface ResolvedVueComponent {
  /** Local identifier `meta.component` refers to in the story file. */
  localName: string;
  /** Specifier the component is imported from, as written in the story file. */
  importId: string;
  /** Absolute path of the module the component is imported from. */
  path: string;
  /** Export name inside that module — `default` for a default import. */
  exportName: string;
}

/** Reason a story file yielded no component to extract docgen from. */
export type UnresolvedComponentReason =
  | 'no-meta-component'
  | 'no-component-import'
  | 'unreadable-component-expression';

const resolveComponent = createMetaComponentResolver({ extensions: ['.vue'] });

/**
 * Locates the component behind `meta.component` in a parsed CSF file.
 *
 * `vue-component-meta` extracts from a module on disk, so the shared resolver's looser results — a
 * component declared in the story file, or a specifier that does not resolve — are reported here as
 * no component at all.
 */
export function resolveMetaComponent(
  csf: CsfFile,
  storyPath: string
): { component: ResolvedVueComponent } | { reason: UnresolvedComponentReason } {
  const resolved = resolveComponent(csf, storyPath);
  if ('reason' in resolved) {
    return resolved;
  }

  const { localName, importId, path, exportName } = resolved.component;
  if (!importId || !path) {
    return { reason: 'no-component-import' };
  }

  return { component: { localName, importId, path, exportName } };
}
