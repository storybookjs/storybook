import { babelParse, babelPrint, types as t } from 'storybook/internal/babel';

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
  | { kind: 'namespace' }
  | { kind: 'default' }
  | { kind: 'named'; imported: t.Identifier | t.StringLiteral };

interface ParsedOverride {
  source: string;
  specifier?: OverrideSpecifier;
}

function preservesBindingShape(isNamespace: boolean, override: ParsedOverride) {
  return !override.specifier || (override.specifier.kind === 'namespace') === isNamespace;
}

function parseSingleImport(code: string): t.ImportDeclaration | undefined {
  try {
    const body = babelParse(code).program.body;
    return body.length === 1 && t.isImportDeclaration(body[0]) ? body[0] : undefined;
  } catch {
    return undefined;
  }
}

function parseImportOverride(code: string): ParsedOverride | undefined {
  const declaration = parseSingleImport(code);
  if (!declaration) {
    return undefined;
  }

  const source = declaration.source.value;
  if (declaration.importKind === 'type') {
    return { source };
  }
  const specifier = (declaration.specifiers ?? []).find((s) => !isTypeSpecifier(s));

  if (t.isImportNamespaceSpecifier(specifier)) {
    return { source, specifier: { kind: 'namespace' } };
  }
  if (t.isImportDefaultSpecifier(specifier)) {
    return { source, specifier: { kind: 'default' } };
  }
  if (t.isImportSpecifier(specifier)) {
    return {
      source,
      specifier: { kind: 'named', imported: t.cloneNode(specifier.imported, true, true) },
    };
  }
  return { source };
}

function valueSpecifiers(declaration: t.ImportDeclaration) {
  return declaration.importKind === 'type'
    ? []
    : declaration.specifiers.filter((specifier) => !isTypeSpecifier(specifier));
}

function overrideImport(
  override: ParsedOverride,
  localName: string
): t.ImportDeclaration | undefined {
  const { specifier } = override;
  if (!specifier) {
    return undefined;
  }

  const local = t.identifier(localName);
  const rewrittenSpecifier =
    specifier.kind === 'default'
      ? t.importDefaultSpecifier(local)
      : specifier.kind === 'namespace'
        ? t.importNamespaceSpecifier(local)
        : t.importSpecifier(local, t.cloneNode(specifier.imported, true, true));
  return t.importDeclaration([rewrittenSpecifier], t.stringLiteral(override.source));
}

export function rewriteComponentImport({
  imports,
  componentName,
  importOverride,
}: {
  imports: string;
  componentName: string;
  importOverride: string;
}): string {
  let file: t.File;
  try {
    file = babelParse(imports, { errorRecovery: true });
  } catch {
    return imports;
  }

  if (!file.program.body.every((statement) => t.isImportDeclaration(statement))) {
    return imports;
  }

  const override = parseImportOverride(importOverride);
  if (!override?.specifier) {
    return imports;
  }

  const dot = componentName.indexOf('.');
  const baseName = dot === -1 ? componentName : componentName.slice(0, dot);
  const memberName = dot === -1 ? undefined : componentName.slice(dot + 1);
  const declarations = file.program.body;
  const findMatch = (name: string) => {
    for (const [statementIndex, declaration] of declarations.entries()) {
      const specifier = valueSpecifiers(declaration).find((item) => item.local.name === name);
      if (specifier) {
        return { declaration, specifier, statementIndex };
      }
    }
    return undefined;
  };
  const match = findMatch(baseName) ?? (memberName ? findMatch(memberName) : undefined);
  if (!match) {
    return imports;
  }

  if (!preservesBindingShape(t.isImportNamespaceSpecifier(match.specifier), override)) {
    return imports;
  }

  const localName =
    match.specifier.local.name === memberName ? baseName : match.specifier.local.name;
  const rewritten = overrideImport(override, localName);
  if (!rewritten) {
    return imports;
  }

  const originalRemainingSpecifiers = match.declaration.specifiers.filter(
    (specifier) => specifier !== match.specifier
  );
  const remainingSpecifiers = originalRemainingSpecifiers.map((specifier) => {
    const clone = t.cloneNode(specifier, true, true);
    t.removeComments(clone);
    return clone;
  });
  const remaining = t.importDeclaration(
    remainingSpecifiers,
    t.cloneNode(match.declaration.source, true, true)
  );
  remaining.assertions = match.declaration.assertions;
  remaining.attributes = match.declaration.attributes;
  remaining.importKind = match.declaration.importKind;
  remaining.module = match.declaration.module;
  remaining.phase = match.declaration.phase;
  declarations.splice(
    match.statementIndex,
    1,
    rewritten,
    ...(remainingSpecifiers.length > 0 ? [remaining] : [])
  );
  return babelPrint(file);
}

interface Bucket {
  source: t.StringLiteral;
  defaults: t.Identifier[];
  namespaces: t.Identifier[];
  named: t.ImportSpecifier[];
}

function addUniqueBy<T>(list: T[], item: T, eq: (candidate: T) => boolean) {
  if (!list.find(eq)) {
    list.push(item);
  }
}

function addNamed(
  bucket: Bucket,
  local: string,
  imported: string | t.Identifier | t.StringLiteral
) {
  const importedValue = typeof imported === 'string' ? imported : importedName(imported);
  const importedNode =
    typeof imported === 'string' ? t.identifier(imported) : t.cloneNode(imported, true, true);
  addUniqueBy(
    bucket.named,
    t.importSpecifier(t.identifier(local), importedNode),
    (n) => n.local.name === local && importedName(n.imported) === importedValue
  );
}

function addSingle(list: t.Identifier[], name: string) {
  addUniqueBy(list, t.identifier(name), (n) => n.name === name);
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
      if (ref.namespace) {
        addSingle(bucket.namespaces, ref.namespace);
      }
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

function printBucket({ source, defaults, namespaces, named }: Bucket): string[] {
  const print = (
    specifiers: (t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier | t.ImportSpecifier)[]
  ) => babelPrint(t.importDeclaration(specifiers, source));

  const extraDefaults = defaults.slice(1).map((d) => print([t.importDefaultSpecifier(d)]));

  if (namespaces.length > 0) {
    const first: (t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier)[] = [];
    if (defaults[0]) {
      first.push(t.importDefaultSpecifier(defaults[0]));
    }
    first.push(t.importNamespaceSpecifier(namespaces[0]));

    return [
      print(first),
      ...(named.length > 0 ? [print(named)] : []),
      ...extraDefaults,
      ...namespaces.slice(1).map((ns) => print([t.importNamespaceSpecifier(ns)])),
    ];
  }

  if (defaults.length === 0 && named.length === 0) {
    return [];
  }

  const first: (t.ImportDefaultSpecifier | t.ImportSpecifier)[] = [];
  if (defaults[0]) {
    first.push(t.importDefaultSpecifier(defaults[0]));
  }
  first.push(...named);

  return [print(first), ...extraDefaults];
}

/**
 * Build the minimal, deduplicated set of import declarations the given references need.
 *
 * References are bucketed by their final source, which is the `importOverride` source when one
 * parses without changing the binding shape, else `packageName` when the original source is not
 * already a package, else the source as written. Sources keep first-seen order and declarations
 * keep a fixed order within a source, so repeated runs produce byte-identical output.
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

    const parsedOverride = ref.importOverride ? parseImportOverride(ref.importOverride) : undefined;
    const override =
      parsedOverride && preservesBindingShape(ref.namespace !== undefined, parsedOverride)
        ? parsedOverride
        : undefined;
    const source = override?.source ?? (packageName && !ref.isPackage ? packageName : ref.importId);

    let bucket = buckets.get(source);
    if (!bucket) {
      bucket = { source: t.stringLiteral(source), defaults: [], namespaces: [], named: [] };
      buckets.set(source, bucket);
    }

    collectSpecifier(bucket, ref, source, override);
  });

  return Array.from(buckets.values()).flatMap(printBucket);
}
