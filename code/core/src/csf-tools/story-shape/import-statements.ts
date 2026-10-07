import { type E, parseModule } from '../estree/ast.ts';
import { type ImportBinding, importedName, isTypeSpecifier } from './imports.ts';

/** A component reference resolved to the module binding it comes from. */
export interface ImportRef {
  /** Module specifier. Refs without one contribute no import statement. */
  importId?: string;
  /** Exported name; `'default'` for default imports and `'*'` for whole-namespace bindings. */
  importName?: string;
  /** Local identifier the import is bound to. */
  localImportName?: string;
  /** Local identifier of the `import * as` binding this ref reaches through. */
  namespace?: string;
  /** Import statement replacing the derived source and specifier, e.g. from an `@import` tag. */
  importOverride?: string;
  /** Whether `importId` already resolves as a package, which suppresses `packageName` rewriting. */
  isPackage?: boolean;
}

/** An {@link ImportRef} together with the component expression it was resolved from. */
export interface ComponentImportRef extends ImportRef {
  /** Component as written in the story file, e.g. `Button` or `Accordion.Root`. */
  componentName: string;
  /** Accessed member of a compound name, e.g. `Root` for `Accordion.Root`. */
  member?: string;
}

/**
 * Resolve a component expression as written in a story file to the import it binds to.
 *
 * A compound name resolves through its base identifier, so `Accordion.Root` reached through
 * `import * as Accordion` exports `Root`, while the same name reached through
 * `import { Accordion }` exports `Accordion` and carries `Root` as the member.
 */
export function resolveComponentImport(
  componentName: string,
  bindings: Map<string, ImportBinding>
): ComponentImportRef {
  const dot = componentName.indexOf('.');
  const base = dot === -1 ? componentName : componentName.slice(0, dot);
  const member = dot === -1 ? undefined : componentName.slice(dot + 1);
  const binding = bindings.get(base);

  if (!binding) {
    return { componentName, ...(member ? { member } : {}) };
  }

  const isNamespace = binding.importName === '*';
  return {
    componentName,
    ...(member ? { member } : {}),
    localImportName: base,
    importId: binding.importId,
    importName: isNamespace && member ? member : binding.importName,
    ...(isNamespace ? { namespace: base } : {}),
  };
}

type OverrideSpecifier =
  | { kind: 'namespace'; local: string }
  | { kind: 'default' }
  | { kind: 'named'; imported: string };

interface ParsedOverride {
  source: string;
  specifier?: OverrideSpecifier;
}

function parseImportOverride(code: string): ParsedOverride | undefined {
  let declaration: E.ImportDeclaration | undefined;
  try {
    declaration = parseModule(code).program.body.find(
      (node): node is E.ImportDeclaration => node.type === 'ImportDeclaration'
    );
  } catch {
    return undefined;
  }

  if (!declaration) {
    return undefined;
  }

  const source = declaration.source.value;
  const specifier = declaration.specifiers.find((s) => !isTypeSpecifier(s));

  if (specifier?.type === 'ImportNamespaceSpecifier') {
    return { source, specifier: { kind: 'namespace', local: specifier.local.name } };
  }
  if (specifier?.type === 'ImportDefaultSpecifier') {
    return { source, specifier: { kind: 'default' } };
  }
  if (specifier?.type === 'ImportSpecifier') {
    return { source, specifier: { kind: 'named', imported: importedName(specifier.imported) } };
  }
  return { source };
}

interface NamedSpecifier {
  local: string;
  imported: string;
}

interface Bucket {
  source: string;
  defaults: string[];
  namespaces: string[];
  named: NamedSpecifier[];
}

function addUniqueBy<T>(list: T[], item: T, eq: (candidate: T) => boolean) {
  if (!list.find(eq)) {
    list.push(item);
  }
}

function addNamed(bucket: Bucket, local: string, imported: string) {
  addUniqueBy(
    bucket.named,
    { local, imported },
    (n) => n.local === local && n.imported === imported
  );
}

function addSingle(list: string[], name: string) {
  addUniqueBy(list, name, (n) => n === name);
}

function collectSpecifier(
  bucket: Bucket,
  ref: ImportRef,
  source: string,
  override: ParsedOverride | undefined
) {
  const rewritten = source !== ref.importId;

  if (override?.specifier) {
    const { specifier } = override;
    if (specifier.kind === 'namespace') {
      addSingle(bucket.namespaces, specifier.local);
      return;
    }
    if (!ref.localImportName) {
      return;
    }
    if (specifier.kind === 'default') {
      addSingle(bucket.defaults, ref.localImportName);
    } else {
      addNamed(bucket, ref.localImportName, specifier.imported);
    }
    return;
  }

  if (ref.namespace) {
    // A rewritten source no longer exposes the module object, so a single member reached through
    // the namespace becomes a named import. A deeper path still needs the module object.
    const member = rewritten ? ref.importName : undefined;
    if (member && member !== '*' && !member.includes('.')) {
      addNamed(bucket, member, member);
    } else {
      addSingle(bucket.namespaces, ref.namespace);
    }
    return;
  }

  if (!ref.localImportName) {
    return;
  }

  if (ref.importName === 'default') {
    if (rewritten) {
      addNamed(bucket, ref.localImportName, ref.localImportName);
    } else {
      addSingle(bucket.defaults, ref.localImportName);
    }
    return;
  }

  if (ref.importName) {
    addNamed(bucket, ref.localImportName, ref.importName);
  }
}

const WRAP_COLUMN = 80;

/** Prints an import declaration the way the formatter it replaces did, wrapping long lists. */
function printImport(
  source: string,
  {
    defaultName,
    namespace,
    named,
  }: { defaultName?: string; namespace?: string; named?: NamedSpecifier[] }
): string {
  const from = `from '${source.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}';`;
  const leading = [defaultName, namespace && `* as ${namespace}`].filter(Boolean);
  const names = (named ?? []).map(({ local, imported }) =>
    local === imported ? local : `${imported} as ${local}`
  );
  if (names.length === 0) {
    return `import ${leading.join(', ')} ${from}`;
  }
  const head = leading.length > 0 ? `${leading.join(', ')}, ` : '';
  const braced = `{ ${names.join(', ')} }`;
  // Only the specifier list wraps, so a long path alone keeps the import on one line.
  return braced.length <= WRAP_COLUMN
    ? `import ${head}${braced} ${from}`
    : `import ${head}{\n${names.map((name) => `  ${name},`).join('\n')}\n} ${from}`;
}

function printBucket({ source, defaults, namespaces, named }: Bucket): string[] {
  const extraDefaults = defaults.slice(1).map((d) => printImport(source, { defaultName: d }));

  if (namespaces.length > 0) {
    return [
      printImport(source, { defaultName: defaults[0], namespace: namespaces[0] }),
      ...(named.length > 0 ? [printImport(source, { named })] : []),
      ...extraDefaults,
      ...namespaces.slice(1).map((ns) => printImport(source, { namespace: ns })),
    ];
  }

  if (defaults.length === 0 && named.length === 0) {
    return [];
  }

  return [printImport(source, { defaultName: defaults[0], named }), ...extraDefaults];
}

/**
 * Build the minimal, deduplicated set of import declarations the given references need.
 *
 * References are bucketed by their final source, which is the `importOverride` source when one
 * parses, else `packageName` when the original source is not already a package, else the source as
 * written. Sources keep first-seen order and declarations keep a fixed order within a source, so
 * repeated runs produce byte-identical output.
 */
export function buildImportStatements({
  refs,
  packageName,
}: {
  refs: ImportRef[];
  packageName?: string;
}): string[] {
  const buckets = new Map<string, Bucket>();

  refs.forEach((ref) => {
    if (!ref.importId) {
      return;
    }

    const override = ref.importOverride ? parseImportOverride(ref.importOverride) : undefined;
    const source = override?.source ?? (packageName && !ref.isPackage ? packageName : ref.importId);

    let bucket = buckets.get(source);
    if (!bucket) {
      bucket = { source, defaults: [], namespaces: [], named: [] };
      buckets.set(source, bucket);
    }

    collectSpecifier(bucket, ref, source, override);
  });

  return Array.from(buckets.values()).flatMap(printBucket);
}
