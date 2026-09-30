import type { DeclarationIndex, IndexedDeclaration } from './declaration-index.ts';
import type { ManifestClassLikeDeclaration, ManifestReference } from './types.ts';
import { namedItems } from '../utils.ts';

export type InheritanceResolver = (entry: IndexedDeclaration) => ManifestClassLikeDeclaration;

const IN_PROGRESS = Symbol('in progress');

const LIST_KEYS = [
  'members',
  'attributes',
  'events',
  'slots',
  'cssParts',
  'cssProperties',
  'cssStates',
] as const;

type ManifestListKey = (typeof LIST_KEYS)[number];

type ManifestNamedItem = { name: string; inheritedFrom?: ManifestReference };

type InheritedParent = { declaration: ManifestClassLikeDeclaration; from: ManifestReference };

export function createInheritanceResolver(index: DeclarationIndex): InheritanceResolver {
  const flattened = new Map<
    ManifestClassLikeDeclaration,
    ManifestClassLikeDeclaration | typeof IN_PROGRESS
  >();

  function flatten(entry: IndexedDeclaration): ManifestClassLikeDeclaration {
    const cached = flattened.get(entry.declaration);
    if (cached !== undefined && cached !== IN_PROGRESS) {
      return cached;
    }

    flattened.set(entry.declaration, IN_PROGRESS);
    const parents: InheritedParent[] = [];
    for (const reference of entry.references) {
      const parent = resolveReference(reference, index, entry.modulePath);
      if (parent && flattened.get(parent.declaration) !== IN_PROGRESS) {
        parents.push({
          declaration: flatten(parent),
          from: {
            name: parent.declaration.name,
            ...(parent.modulePath ? { module: parent.modulePath } : {}),
          },
        });
      }
    }

    const merged = mergeInherited(entry.declaration, parents);
    flattened.set(entry.declaration, merged);
    return merged;
  }

  return flatten;
}

function mergeInherited(
  declaration: ManifestClassLikeDeclaration,
  parents: InheritedParent[]
): ManifestClassLikeDeclaration {
  const lists: Partial<Record<ManifestListKey, ManifestNamedItem[]>> = {};

  for (const key of LIST_KEYS) {
    const own = namedItems(listOf(declaration, key));
    const items = new Map<string, ManifestNamedItem>();
    for (const item of own) {
      const existing = items.get(item.name);
      if (!existing || (existing.inheritedFrom && !item.inheritedFrom)) {
        items.set(item.name, item);
      }
    }

    let changed = items.size !== own.length;
    for (const parent of parents) {
      for (const item of namedItems(listOf(parent.declaration, key))) {
        const existing = items.get(item.name);
        if (!existing) {
          items.set(item.name, { ...item, inheritedFrom: item.inheritedFrom ?? parent.from });
          changed = true;
        } else if (!existing.inheritedFrom) {
          // Like the analyzer, an override keeps the documentation it does not redeclare.
          const { inheritedFrom: _, ...parentFields } = item;
          items.set(item.name, { ...parentFields, ...existing });
          changed = true;
        }
      }
    }

    if (changed) {
      lists[key] = [...items.values()];
    }
  }

  return { ...declaration, ...lists } as ManifestClassLikeDeclaration;
}

function listOf(
  declaration: ManifestClassLikeDeclaration,
  key: ManifestListKey
): ManifestNamedItem[] | undefined {
  const list = (declaration as Partial<Record<ManifestListKey, unknown>>)[key];
  return Array.isArray(list) ? list : undefined;
}

// Lit analyzer output names the manifest's own package on every reference,
// so a `module` is looked up in the manifest even when `package` is set.
function resolveReference(
  reference: ManifestReference,
  index: DeclarationIndex,
  modulePath: string
): IndexedDeclaration | undefined {
  if (reference.module !== undefined) {
    return index.get(reference.module, reference.name);
  }
  if (reference.package === undefined) {
    return index.get(modulePath, reference.name);
  }
  return undefined;
}
