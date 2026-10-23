import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  createMetaComponentResolver,
  createModuleResolver,
  getStoryImportPathFromEntry,
  jsTsSourceExtensions,
} from 'storybook/internal/common';
import {
  type ESTree as E,
  collectImportBindings,
  loadCsf,
  metaObject,
  parseExpression,
  parseModule,
  propertyValue,
  staticKey,
} from 'storybook/internal/csf-tools';
import type { IndexEntry } from 'storybook/internal/types';

import { getIndexableAST } from '../../../svelte-csf/indexer/parser.ts';
import { getSvelteAST } from '../../../svelte-csf/parser/ast.ts';
import { getDefineMetaComponentValue } from '../../../svelte-csf/parser/analyse/define-meta/component-identifier.ts';
import { getDefineMetaFirstArgumentObjectExpression } from '../../../svelte-csf/parser/extract/svelte/define-meta.ts';
import { extractSvelteASTNodes } from '../../../svelte-csf/parser/extract/svelte/nodes.ts';

export interface ResolvedSvelteComponent {
  componentPath: string;
  exportName: string;
  name: string;
}

const resolveMetaComponent = createMetaComponentResolver({ extensions: ['.svelte'] });
const moduleResolver = createModuleResolver({
  extensions: ['.svelte', ...jsTsSourceExtensions],
  // TypeScript projects import `./index.ts` as `./index.js`, as SvelteKit's packaging requires.
  extensionAlias: { '.js': ['.ts', '.js'] },
  mainFields: ['svelte', 'module', 'main'],
  conditionNames: ['svelte', 'import', 'module', 'default'],
  tsconfig: 'auto',
});

function resolveImport(fromFile: string, specifier: string): string | undefined {
  try {
    return moduleResolver.resolveFileSync(fromFile, specifier);
  } catch {
    return undefined;
  }
}

// Takes the import specifiers of both oxc and the Svelte parser, which type them differently.
function importedName(specifier: {
  type: string;
  imported?: { type: string; name?: string; value?: unknown };
}): string {
  if (specifier.type === 'ImportDefaultSpecifier') return 'default';
  if (specifier.type === 'ImportNamespaceSpecifier') return '*';
  return specifier.imported?.type === 'Identifier'
    ? String(specifier.imported.name)
    : String(specifier.imported?.value);
}

function exportedName(node: E.ModuleExportName): string {
  return node.type === 'Identifier' ? node.name : String(node.value);
}

function followExport(
  filePath: string,
  exportName: string,
  seen = new Set<string>()
): string | undefined {
  // A component is the default export of a `.svelte` file; its module script exports the rest.
  if (filePath.endsWith('.svelte') && exportName === 'default') return filePath;
  const key = `${filePath}#${exportName}`;
  if (seen.has(key)) return undefined;
  seen.add(key);

  const program = moduleProgram(filePath);
  if (!program) return undefined;
  const follow = (specifier: string, name: string) => {
    const target = resolveImport(filePath, specifier);
    return target ? followExport(target, name, seen) : undefined;
  };

  const followLocal = (localName: string) => {
    for (const declaration of program.body) {
      if (declaration.type !== 'ImportDeclaration' || declaration.importKind === 'type') continue;
      const imported = declaration.specifiers.find(
        (candidate) => candidate.local.name === localName
      );
      if (imported) return follow(declaration.source.value, importedName(imported));
    }
    return undefined;
  };

  for (const statement of program.body) {
    if (
      statement.type === 'ExportDefaultDeclaration' &&
      exportName === 'default' &&
      statement.declaration.type === 'Identifier'
    ) {
      return followLocal(statement.declaration.name);
    }
    if (statement.type === 'ExportAllDeclaration' && !statement.exported) {
      const found =
        exportName !== 'default' &&
        statement.exportKind !== 'type' &&
        follow(statement.source.value, exportName);
      if (found) return found;
    }
    if (statement.type !== 'ExportNamedDeclaration' || statement.exportKind === 'type') continue;
    const specifier = statement.specifiers.find(
      (candidate) => exportedName(candidate.exported) === exportName
    );
    if (!specifier || specifier.exportKind === 'type') continue;
    const localName = exportedName(specifier.local);
    return statement.source ? follow(statement.source.value, localName) : followLocal(localName);
  }
  return undefined;
}

function moduleProgram(filePath: string) {
  const source = readFileSync(filePath, 'utf8');
  if (!filePath.endsWith('.svelte')) return parseModule(source, filePath).program;
  const module = getIndexableAST(source, filePath).module?.content as
    | { start: number; end: number }
    | undefined;
  return module && parseModule(source.slice(module.start, module.end), `${filePath}.ts`).program;
}

function locate(storyPath: string, specifier: string, exportName: string, name: string) {
  const filePath = resolveImport(storyPath, specifier);
  const componentPath = filePath && followExport(filePath, exportName);
  if (!componentPath) {
    throw new Error(`Could not resolve \`${specifier}\` export \`${exportName}\``);
  }
  return { componentPath, exportName, name };
}

export async function resolveStoryComponent(
  entry: IndexEntry
): Promise<ResolvedSvelteComponent | undefined> {
  const importPath = getStoryImportPathFromEntry(entry);
  if (!importPath) return undefined;
  const storyPath = resolve(importPath);
  const source = await readFile(storyPath, 'utf8');

  if (storyPath.endsWith('.svelte')) {
    const ast = getSvelteAST({ code: source, filename: storyPath });
    const nodes = await extractSvelteASTNodes({ ast, filename: storyPath });
    const component = getDefineMetaComponentValue({ nodes, filename: storyPath });
    if (!component) return undefined;
    for (const statement of ast.module?.content.body ?? []) {
      if (statement.type !== 'ImportDeclaration') continue;
      const specifier = statement.specifiers.find(
        (candidate) => candidate.local.name === component.name
      );
      if (specifier) {
        return locate(
          storyPath,
          String(statement.source.value),
          importedName(specifier),
          component.name
        );
      }
    }
    return undefined;
  }

  const resolved = resolveMetaComponent(
    loadCsf(source, { makeTitle: () => entry.title }).parse(),
    storyPath
  );
  if ('reason' in resolved) {
    if (resolved.reason === 'unreadable-component-expression') {
      throw new Error(`Cannot resolve the component \`${resolved.expression}\``);
    }
    return undefined;
  }
  const { importId, exportName, localName } = resolved.component;
  return importId ? locate(storyPath, importId, exportName, localName) : undefined;
}

// The components a meta lists in `subcomponents`, by the name it lists them under. One that does
// not resolve is left out, so it does not cost the main component its docs.
export async function resolveStorySubcomponents(
  entry: IndexEntry
): Promise<Record<string, ResolvedSvelteComponent>> {
  const importPath = getStoryImportPathFromEntry(entry);
  if (!importPath) return {};
  const storyPath = resolve(importPath);
  const source = await readFile(storyPath, 'utf8');
  const { meta, program } = storyPath.endsWith('.svelte')
    ? await readSvelteMeta(source, storyPath)
    : readCsfMeta(source, entry);
  const subcomponents = propertyValue(meta, 'subcomponents');
  if (subcomponents?.type !== 'ObjectExpression') return {};
  const bindings = collectImportBindings(program);
  const resolved: Record<string, ResolvedSvelteComponent> = {};
  for (const property of subcomponents.properties) {
    const name = property.type === 'Property' ? staticKey(property) : undefined;
    const value = property.type === 'Property' ? property.value : undefined;
    const binding = value?.type === 'Identifier' ? bindings.get(value.name) : undefined;
    if (!name || !binding) continue;
    try {
      resolved[name] = locate(storyPath, binding.importId, binding.importName, name);
    } catch {
      continue;
    }
  }
  return resolved;
}

function readCsfMeta(source: string, entry: IndexEntry) {
  const csf = loadCsf(source, { makeTitle: () => entry.title }).parse();
  return { meta: metaObject(csf), program: csf.program };
}

async function readSvelteMeta(source: string, storyPath: string) {
  const ast = getSvelteAST({ code: source, filename: storyPath });
  const nodes = await extractSvelteASTNodes({ ast, filename: storyPath });
  const { start, end } = getDefineMetaFirstArgumentObjectExpression({
    nodes,
    filename: storyPath,
  }) as unknown as { start: number; end: number };
  const module = ast.module!.content as unknown as { start: number; end: number };
  const meta = parseExpression(source.slice(start, end));
  return {
    meta: meta.type === 'ObjectExpression' ? meta : undefined,
    program: parseModule(source.slice(module.start, module.end), `${storyPath}.ts`).program,
  };
}
