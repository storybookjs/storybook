import type {
  ManifestClassLikeDeclaration,
  ManifestDeclaration,
  ManifestPackage,
  ManifestReference,
} from './types.ts';
import { isRecord, namedItems, normalizeModulePath } from '../utils.ts';

export type ResolvedDeclaration = { declaration: ManifestClassLikeDeclaration; modulePath: string };

export type DeclarationLookup = (
  modulePath: string,
  name: string
) => ResolvedDeclaration | undefined;

export type InheritanceResolver = (
  declaration: ManifestDeclaration,
  modulePath: string | undefined
) => ManifestDeclaration;

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
type LookupModule = { declarations: unknown[]; path: string };

type InheritedParent = { declaration: ManifestClassLikeDeclaration; from: ManifestReference };

export function createDeclarationLookup(manifest: ManifestPackage): DeclarationLookup {
  const modulesByPath = new Map<string, LookupModule[]>();

  for (const module of manifest.modules) {
    if (
      !isRecord(module) ||
      !Array.isArray(module.declarations) ||
      typeof module.path !== 'string'
    ) {
      continue;
    }

    const normalizedPath = normalizeModulePath(module.path);
    modulesByPath.set(normalizedPath, [
      ...(modulesByPath.get(normalizedPath) ?? []),
      { declarations: module.declarations, path: module.path },
    ]);
  }

  return (modulePath: string, name: string): ResolvedDeclaration | undefined =>
    modulesByPath
      .get(normalizeModulePath(modulePath))
      ?.flatMap((module) =>
        module.declarations.map((declaration) => ({ declaration, modulePath: module.path }))
      )
      .find(
        (resolved): resolved is ResolvedDeclaration =>
          isManifestClassLike(resolved.declaration) && resolved.declaration.name === name
      );
}

export function createInheritanceResolver(manifest: ManifestPackage): InheritanceResolver {
  const lookup = createDeclarationLookup(manifest);
  const flattened = new Map<string, ManifestClassLikeDeclaration>();
  const inProgress = new Set<string>();

  function flatten(
    declaration: ManifestClassLikeDeclaration,
    modulePath: string | undefined
  ): ManifestClassLikeDeclaration {
    const key = modulePath === undefined ? undefined : keyFor(modulePath, declaration.name);
    if (key !== undefined && flattened.has(key)) {
      return flattened.get(key)!;
    }

    if (key !== undefined) {
      inProgress.add(key);
    }

    const references: unknown[] = [
      ...(Array.isArray(declaration.mixins) ? declaration.mixins : []),
      declaration.superclass,
    ];
    const parents = references
      .filter(isRecord)
      .map((reference) => resolveReference(reference, lookup, modulePath))
      .filter((parent): parent is ResolvedDeclaration => {
        return (
          parent !== undefined &&
          !inProgress.has(keyFor(parent.modulePath, parent.declaration.name))
        );
      })
      .map(
        (parent): InheritedParent => ({
          declaration: flatten(parent.declaration, parent.modulePath),
          from: { name: parent.declaration.name, module: parent.modulePath },
        })
      );

    const merged = mergeInherited(declaration, parents);

    if (key !== undefined) {
      flattened.set(key, merged);
      inProgress.delete(key);
    }

    return merged;
  }

  return (declaration: ManifestDeclaration, modulePath: string | undefined): ManifestDeclaration =>
    flatten(declaration, modulePath) as ManifestDeclaration;
}

export function isManifestClassLike(candidate: unknown): candidate is ManifestClassLikeDeclaration {
  return (
    isRecord(candidate) &&
    (candidate.kind === 'class' || candidate.kind === 'mixin') &&
    typeof candidate.name === 'string'
  );
}

function mergeInherited<T extends ManifestClassLikeDeclaration>(
  declaration: T,
  parents: InheritedParent[]
): T {
  const merged = { ...declaration };

  for (const key of LIST_KEYS) {
    const own = listOf(declaration, key) ?? [];
    const seen = new Set(namedItems<ManifestNamedItem>(own).map((item) => item.name));
    const inherited = parents.flatMap((parent) =>
      namedItems<ManifestNamedItem>(listOf(parent.declaration, key)).flatMap((item) => {
        if (seen.has(item.name)) {
          return [];
        }
        seen.add(item.name);
        return [{ ...item, inheritedFrom: item.inheritedFrom ?? parent.from }];
      })
    );

    if (inherited.length === 0) {
      continue;
    }

    Object.assign(merged, { [key]: [...own, ...inherited] });
  }

  return merged;
}

function listOf(
  declaration: ManifestClassLikeDeclaration,
  key: ManifestListKey
): ManifestNamedItem[] | undefined {
  const list = (declaration as Partial<Record<ManifestListKey, unknown>>)[key];
  return Array.isArray(list) ? list : undefined;
}

/** Lit analyzer output names the manifest's own package on every reference, so the manifest is tried before a reference is treated as external. */
function resolveReference(
  reference: Record<string, unknown>,
  lookup: DeclarationLookup,
  modulePath: string | undefined
): ResolvedDeclaration | undefined {
  const target =
    typeof reference.module === 'string'
      ? reference.module
      : reference.module === undefined && reference.package === undefined
        ? modulePath
        : undefined;
  return typeof reference.name === 'string' && target !== undefined
    ? lookup(target, reference.name)
    : undefined;
}

function keyFor(modulePath: string, name: string): string {
  return `${normalizeModulePath(modulePath)}#${name}`;
}
