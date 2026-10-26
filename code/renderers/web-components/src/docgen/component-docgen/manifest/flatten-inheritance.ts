import type { ManifestClassLikeDeclaration, ManifestPackage, ManifestReference } from './types.ts';
import { isRecord, namedItems } from '../utils.ts';

const INHERITED_FIELDS = [
  'description',
  'summary',
  'deprecated',
  'default',
  'type',
  'attribute',
  'fieldName',
] as const;

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

type DeclarationLookup = (modulePath: string, name: string) => IndexedDeclaration | undefined;

type IndexedDeclaration = {
  declaration: ManifestClassLikeDeclaration;
  modulePath: string;
  references: ManifestReference[];
};

type InheritedParent = { declaration: ManifestClassLikeDeclaration; from: ManifestReference };

type ManifestNamedItem = { name: string; inheritedFrom?: ManifestReference } & Record<
  string,
  unknown
>;

export function flattenInheritance(manifest: ManifestPackage): ManifestPackage {
  const index = indexDeclarations(manifest);
  const flatten = createInheritanceResolver(index);

  return {
    ...manifest,
    modules: manifest.modules.map((module) => flattenModule(module, index, flatten)),
  };
}

function indexDeclarations(manifest: ManifestPackage): DeclarationLookup {
  const byKey = new Map<string, IndexedDeclaration>();

  for (const module of manifest.modules) {
    if (!isRecord(module) || !Array.isArray(module.declarations)) {
      continue;
    }
    const modulePath = modulePathOf(module);

    for (const declaration of module.declarations) {
      if (!isManifestClassLike(declaration)) {
        continue;
      }
      const key = keyFor(modulePath, declaration.name);
      if (!byKey.has(key)) {
        byKey.set(key, { declaration, modulePath, references: referencesOf(declaration) });
      }
    }
  }

  return (modulePath, name): IndexedDeclaration | undefined => byKey.get(keyFor(modulePath, name));
}

function isManifestClassLike(candidate: unknown): candidate is ManifestClassLikeDeclaration {
  return (
    isRecord(candidate) &&
    (candidate.kind === 'class' || candidate.kind === 'mixin') &&
    typeof candidate.name === 'string'
  );
}

function referencesOf(declaration: ManifestClassLikeDeclaration): ManifestReference[] {
  const candidates: unknown[] = [
    ...(Array.isArray(declaration.mixins) ? declaration.mixins : []),
    declaration.superclass,
  ];
  return candidates.filter(isReference);
}

function isReference(candidate: unknown): candidate is ManifestReference {
  return (
    isRecord(candidate) &&
    typeof candidate.name === 'string' &&
    (candidate.module === undefined || typeof candidate.module === 'string') &&
    (candidate.package === undefined || typeof candidate.package === 'string')
  );
}

function createInheritanceResolver(
  index: DeclarationLookup
): (entry: IndexedDeclaration) => ManifestClassLikeDeclaration {
  const flattened = new Map<ManifestClassLikeDeclaration, ManifestClassLikeDeclaration>();

  function flatten(entry: IndexedDeclaration): ManifestClassLikeDeclaration {
    const cached = flattened.get(entry.declaration);
    if (cached !== undefined) {
      return cached;
    }

    // A cycle back to this declaration sees its own items.
    flattened.set(entry.declaration, entry.declaration);
    const parents = entry.references.flatMap((reference): InheritedParent[] => {
      const parent = resolveReference(reference, index, entry.modulePath);
      if (!parent) {
        return [];
      }
      return [
        {
          declaration: flatten(parent),
          from: {
            name: parent.declaration.name,
            ...(parent.modulePath ? { module: parent.modulePath } : {}),
          },
        },
      ];
    });

    const merged = mergeInherited(entry.declaration, parents);
    flattened.set(entry.declaration, merged);
    return merged;
  }

  return flatten;
}

function flattenModule(
  module: ManifestPackage['modules'][number],
  index: DeclarationLookup,
  flatten: (entry: IndexedDeclaration) => ManifestClassLikeDeclaration
): ManifestPackage['modules'][number] {
  if (!isRecord(module) || !Array.isArray(module.declarations)) {
    return module;
  }

  const modulePath = modulePathOf(module);
  const declarations = module.declarations.map((declaration) => {
    if (!isManifestClassLike(declaration)) {
      return declaration;
    }
    const entry = index(modulePath, declaration.name);
    return entry?.declaration === declaration ? flatten(entry) : declaration;
  });

  return { ...module, declarations };
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

    for (const parent of parents) {
      for (const item of namedItems(listOf(parent.declaration, key))) {
        const existing = items.get(item.name);
        if (!existing) {
          items.set(item.name, { ...item, inheritedFrom: item.inheritedFrom ?? parent.from });
        } else if (!existing.inheritedFrom) {
          items.set(item.name, mergeOverride(existing, item));
        }
      }
    }

    if (items.size > 0) {
      lists[key] = [...items.values()];
    }
  }

  return { ...declaration, ...lists } as ManifestClassLikeDeclaration;
}

function mergeOverride(own: ManifestNamedItem, inherited: ManifestNamedItem): ManifestNamedItem {
  const merged = { ...own };
  for (const field of INHERITED_FIELDS) {
    if (!(field in merged) && field in inherited) {
      merged[field] = inherited[field];
    }
  }
  return merged;
}

function listOf(
  declaration: ManifestClassLikeDeclaration,
  key: ManifestListKey
): ManifestNamedItem[] | undefined {
  const list = (declaration as Partial<Record<ManifestListKey, unknown>>)[key];
  return Array.isArray(list) ? (list as ManifestNamedItem[]) : undefined;
}

// Lit analyzer output names the manifest's own package on every reference, so a
// `module` is looked up even when `package` is set.
function resolveReference(
  reference: ManifestReference,
  index: DeclarationLookup,
  modulePath: string
): IndexedDeclaration | undefined {
  if (reference.module !== undefined) {
    return index(reference.module, reference.name);
  }
  if (reference.package === undefined) {
    return index(modulePath, reference.name);
  }
  return undefined;
}

// Manifests disagree on a leading `./` or `/` in module paths.
function keyFor(modulePath: string, name: string): string {
  return `${modulePath.replace(/^\.?\//, '')}#${name}`;
}

// The schema requires `path`; a module without one indexes under an empty path.
function modulePathOf(module: Record<string, unknown>): string {
  return typeof module.path === 'string' ? module.path : '';
}
