import { types as t } from 'storybook/internal/babel';
import type {
  ImportBinding,
  ReferenceContext,
  ReferenceModule,
} from 'storybook/internal/csf-tools';
import { collectImportBindings } from 'storybook/internal/csf-tools';

/** A module whose code a template is cut from, and the names it imports. */
export interface TemplateModule {
  bindings: Map<string, ImportBinding>;
  code: string;
  program: t.Program;
  resolveModule: (specifier: string) => TemplateModule | undefined;
}

const LIT_SOURCES = [
  'lit',
  'lit-html',
  'lit-element',
  'lit/index.js',
  'lit/html.js',
  'lit-html/lit-html.js',
  'lit-element/lit-element.js',
  '@lion/core',
];
const MAX_MODULES = 64;

const modules = new WeakMap<t.Program, TemplateModule>();

export function templateModule(
  { program, filePath }: ReferenceModule,
  resolve: ReferenceContext['resolveModule']
): TemplateModule {
  const known = modules.get(program.node);
  if (known) {
    return known;
  }
  const open = (specifier: string) => {
    const found = resolve?.(filePath, specifier);
    return found && templateModule(found, resolve);
  };
  const module: TemplateModule = {
    bindings: collectImportBindings(program),
    code: (program.hub as unknown as { file: { code: string } }).file.code,
    program: program.node,
    resolveModule: open,
  };
  modules.set(program.node, module);
  return module;
}

/**
 * The imports of a module, with `html` and `nothing` as imports from `lit` wherever they are lit's:
 * from another of its entry points, or from a module of the project that exports them again.
 */
export function litBindings(module: TemplateModule): Map<string, ImportBinding> {
  const bindings = new Map(module.bindings);
  for (const [local, binding] of module.bindings) {
    const importName = ['html', 'nothing'].includes(binding.importName)
      ? litExport(module, binding, new Set())
      : undefined;
    if (importName) {
      bindings.set(local, { importId: 'lit', importName });
    }
  }
  return bindings;
}

// The name lit exports what an import binds as, also when a module of the project exports it again.
function litExport(
  from: TemplateModule,
  { importId, importName }: ImportBinding,
  seen: Set<t.Program>
): string | undefined {
  if (LIT_SOURCES.includes(importId)) {
    return importName;
  }
  const module = from.resolveModule(importId);
  if (!module || seen.has(module.program) || seen.size > MAX_MODULES) {
    return undefined;
  }
  seen.add(module.program);
  const local = localOf(module, importName);
  if (local) {
    const imported = module.bindings.get(local);
    return imported && litExport(module, imported, seen);
  }
  for (const next of exportsFrom(module, importName)) {
    const found = litExport(module, next, seen);
    if (found) {
      return found;
    }
  }
  return undefined;
}

// The local name a module exports as `name`, as a declaration or in `export { local as name }`.
const localOf = (module: TemplateModule, name: string): string | undefined =>
  exportedLocals(module).get(name);

const locals = new WeakMap<TemplateModule, Map<string, string | undefined>>();

// The local name of each name a module exports in its own code; the first export of a name wins.
function exportedLocals(module: TemplateModule): Map<string, string | undefined> {
  let found = locals.get(module);
  if (found) {
    return found;
  }
  found = new Map();
  const add = (name: string | undefined, local: string | undefined) => {
    if (name !== undefined && !found!.has(name)) {
      found!.set(name, local);
    }
  };
  for (const statement of module.program.body) {
    if (t.isExportDefaultDeclaration(statement)) {
      const { declaration } = statement;
      add(
        'default',
        t.isIdentifier(declaration)
          ? declaration.name
          : t.isFunctionDeclaration(declaration)
            ? declaration.id?.name
            : undefined
      );
    }
    if (!t.isExportNamedDeclaration(statement) || statement.source) {
      continue;
    }
    const { declaration } = statement;
    if (t.isFunctionDeclaration(declaration)) {
      add(declaration.id?.name, declaration.id?.name);
    } else if (t.isVariableDeclaration(declaration)) {
      declaration.declarations.forEach(({ id }) => t.isIdentifier(id) && add(id.name, id.name));
    }
    for (const item of statement.specifiers) {
      if (t.isExportSpecifier(item)) {
        add(exportedName(item), item.local.name);
      }
    }
  }
  locals.set(module, found);
  return found;
}

// The modules `name` may be exported from again: `export { name } from` and `export * from`.
function exportsFrom(module: TemplateModule, name: string): ImportBinding[] {
  const named: ImportBinding[] = [];
  const all: ImportBinding[] = [];
  for (const statement of module.program.body) {
    if (t.isExportAllDeclaration(statement)) {
      all.push({ importId: statement.source.value, importName: name });
    } else if (t.isExportNamedDeclaration(statement) && statement.source) {
      const specifier = statement.specifiers.find(
        (item) => t.isExportSpecifier(item) && exportedName(item) === name
      );
      if (t.isExportSpecifier(specifier)) {
        named.push({ importId: statement.source.value, importName: specifier.local.name });
      }
    }
  }
  return [...named, ...all];
}

const exportedName = ({ exported }: t.ExportSpecifier) =>
  t.isIdentifier(exported) ? exported.name : exported.value;
