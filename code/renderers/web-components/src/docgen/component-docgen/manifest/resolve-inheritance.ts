import {
  declarationKey,
  type DeclarationIndex,
  type IndexedDeclaration,
} from './declaration-index.ts';
import type { ManifestClassLikeDeclaration, ManifestReference } from './types.ts';
import { isRecord, namedItems } from '../utils.ts';

export type InheritanceResolver = <T extends ManifestClassLikeDeclaration>(
  declaration: T,
  modulePath: string
) => T;

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

export function createInheritanceResolver(declarations: DeclarationIndex): InheritanceResolver {
  const flattened = new Map<ManifestClassLikeDeclaration, ManifestClassLikeDeclaration>();
  const inProgress = new Set<ManifestClassLikeDeclaration>();

  function flatten(
    declaration: ManifestClassLikeDeclaration,
    modulePath: string
  ): ManifestClassLikeDeclaration {
    const cached = flattened.get(declaration);
    if (cached) {
      return cached;
    }

    inProgress.add(declaration);
    const references: unknown[] = [
      ...(Array.isArray(declaration.mixins) ? declaration.mixins : []),
      declaration.superclass,
    ];
    const parents = references
      .filter(isRecord)
      .map((reference) => resolveReference(reference, declarations, modulePath))
      .filter(
        (parent): parent is IndexedDeclaration =>
          parent !== undefined && !inProgress.has(parent.declaration)
      )
      .map(
        (parent): InheritedParent => ({
          declaration: flatten(parent.declaration, parent.modulePath),
          from: { name: parent.declaration.name, module: parent.modulePath },
        })
      );
    const merged = mergeInherited(declaration, parents);
    inProgress.delete(declaration);
    flattened.set(declaration, merged);

    return merged;
  }

  // Flattening only appends list items, so the result keeps the declaration's own kind.
  return <T extends ManifestClassLikeDeclaration>(declaration: T, modulePath: string): T =>
    flatten(declaration, modulePath) as T;
}

function mergeInherited(
  declaration: ManifestClassLikeDeclaration,
  parents: InheritedParent[]
): ManifestClassLikeDeclaration {
  const lists: Partial<Record<ManifestListKey, ManifestNamedItem[]>> = {};

  for (const key of LIST_KEYS) {
    const own = listOf(declaration, key) ?? [];
    const seen = new Set(namedItems(own).map((item) => item.name));
    const inherited: ManifestNamedItem[] = [];

    for (const parent of parents) {
      for (const item of namedItems(listOf(parent.declaration, key))) {
        if (!seen.has(item.name)) {
          seen.add(item.name);
          inherited.push({ ...item, inheritedFrom: item.inheritedFrom ?? parent.from });
        }
      }
    }

    if (inherited.length > 0) {
      lists[key] = [...own, ...inherited];
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
  reference: Record<string, unknown>,
  declarations: DeclarationIndex,
  modulePath: string
): IndexedDeclaration | undefined {
  if (typeof reference.name !== 'string') {
    return undefined;
  }
  if (typeof reference.module === 'string') {
    return declarations.get(declarationKey(reference.module, reference.name));
  }
  if (reference.module === undefined && reference.package === undefined) {
    return declarations.get(declarationKey(modulePath, reference.name));
  }
  return undefined;
}
