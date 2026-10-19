import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { getStoryImportPathFromEntry } from 'storybook/internal/common';
import {
  collectImportBindings,
  loadCsf,
  resolveComponentImport,
} from 'storybook/internal/csf-tools';
import type { IndexEntry } from 'storybook/internal/types';

import ts from 'typescript';

import { getSvelteAST } from '../../../svelte-csf/parser/ast.ts';
import { getDefineMetaComponentValue } from '../../../svelte-csf/parser/analyse/define-meta/component-identifier.ts';
import { extractSvelteASTNodes } from '../../../svelte-csf/parser/extract/svelte/nodes.ts';

function resolveImport(specifier: string, from: string): string | undefined {
  const configPath = ts.findConfigFile(dirname(from), ts.sys.fileExists);
  const options = configPath
    ? ts.parseJsonConfigFileContent(
        ts.readConfigFile(configPath, ts.sys.readFile).config,
        ts.sys,
        dirname(configPath),
        undefined,
        configPath
      ).options
    : {};
  const host: ts.ModuleResolutionHost = {
    ...ts.sys,
    fileExists: (filename) =>
      ts.sys.fileExists(filename) ||
      (filename.endsWith('.svelte.ts') && ts.sys.fileExists(filename.slice(0, -3))),
  };
  const module = ts.resolveModuleName(specifier, from, options, host).resolvedModule;
  if (!module) {
    return undefined;
  }
  return module.resolvedFileName.replace(/\.svelte\.ts$/, '.svelte');
}

async function resolveExport(
  filename: string,
  exportName: string,
  visited = new Set<string>()
): Promise<string | undefined> {
  if (filename.endsWith('.svelte')) {
    return filename;
  }
  const key = `${filename}:${exportName}`;
  if (visited.has(key)) {
    return undefined;
  }
  visited.add(key);
  const source = ts.createSourceFile(
    filename,
    await readFile(filename, 'utf8'),
    ts.ScriptTarget.Latest
  );
  for (const statement of source.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.isTypeOnly
    ) {
      continue;
    }
    const clause = statement.exportClause;
    const binding =
      clause && ts.isNamedExports(clause)
        ? clause.elements.find((element) => element.name.text === exportName && !element.isTypeOnly)
        : undefined;
    if ((clause && !binding) || (!clause && exportName === 'default')) {
      continue;
    }
    const target = resolveImport(statement.moduleSpecifier.text, filename);
    if (target) {
      const resolved = await resolveExport(
        target,
        binding?.propertyName?.text ?? exportName,
        visited
      );
      if (resolved) return resolved;
    }
  }
  const localName = source.statements.flatMap((statement) =>
    ts.isExportDeclaration(statement) &&
    !statement.moduleSpecifier &&
    statement.exportClause &&
    ts.isNamedExports(statement.exportClause)
      ? statement.exportClause.elements
          .filter((element) => element.name.text === exportName)
          .map((element) => element.propertyName?.text ?? element.name.text)
      : ts.isExportAssignment(statement) &&
          exportName === 'default' &&
          ts.isIdentifier(statement.expression)
        ? [statement.expression.text]
        : []
  )[0];
  if (localName) {
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
        continue;
      const clause = statement.importClause;
      const bindings = clause?.namedBindings;
      const binding =
        bindings && ts.isNamedImports(bindings)
          ? bindings.elements.find((element) => element.name.text === localName)
          : undefined;
      const importedName =
        clause?.name?.text === localName
          ? 'default'
          : (binding?.propertyName?.text ?? binding?.name.text);
      if (!importedName) continue;
      const target = resolveImport(statement.moduleSpecifier.text, filename);
      if (target) return resolveExport(target, importedName, visited);
    }
  }
  return undefined;
}

async function resolveComponent(specifier: string, from: string, exportName: string) {
  const filename = resolveImport(specifier, from);
  const componentPath = filename && (await resolveExport(filename, exportName));
  if (!componentPath) {
    throw new Error(`Could not resolve ${specifier} export ${exportName} from ${from}`);
  }
  return componentPath;
}

export async function resolveStoryComponent(entry: IndexEntry) {
  const importPath = getStoryImportPathFromEntry(entry);
  if (!importPath) {
    return undefined;
  }
  const storyPath = resolve(importPath);
  const source = await readFile(storyPath, 'utf8');
  if (storyPath.endsWith('.svelte')) {
    const ast = getSvelteAST({ code: source, filename: storyPath });
    const nodes = await extractSvelteASTNodes({ ast, filename: storyPath });
    const component = getDefineMetaComponentValue({ nodes, filename: storyPath });
    if (!component) {
      return undefined;
    }
    const declaration = ast.module?.content.body.find(
      (node) =>
        node.type === 'ImportDeclaration' &&
        node.specifiers.some((s) => s.local.name === component.name)
    );
    if (declaration?.type !== 'ImportDeclaration' || typeof declaration.source.value !== 'string') {
      return undefined;
    }
    const specifier = declaration.specifiers.find((s) => s.local.name === component.name);
    if (!specifier) return undefined;
    const exportName =
      specifier.type === 'ImportSpecifier'
        ? specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : String(specifier.imported.value)
        : 'default';
    const componentPath = await resolveComponent(declaration.source.value, storyPath, exportName);
    return { componentPath, exportName, name: component.name };
  }
  const csf = loadCsf(source, { makeTitle: () => entry.title }).parse();
  if (!csf._meta?.component) {
    return undefined;
  }
  const ref = resolveComponentImport(csf._meta.component, collectImportBindings(csf._file.path));
  if (ref.member && !ref.namespace) {
    throw new Error(`Cannot resolve member access \`${csf._meta.component}\` from ${storyPath}`);
  }
  if (!ref.importId) {
    return undefined;
  }
  const exportName = ref.importName ?? 'default';
  const componentPath = await resolveComponent(ref.importId, storyPath, exportName);
  return { componentPath, exportName, name: csf._meta.component };
}
