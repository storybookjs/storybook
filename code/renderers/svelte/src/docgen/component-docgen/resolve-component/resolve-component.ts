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

export interface ResolveComponentContext {
  resolvePath?: (specifier: string, from: string) => string | undefined;
}

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

export async function resolveStoryComponent(
  entry: IndexEntry,
  context: ResolveComponentContext = {}
) {
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
    const componentPath = (context.resolvePath ?? resolveImport)(
      declaration.source.value,
      storyPath
    );
    if (!componentPath || !specifier) {
      throw new Error(`Could not resolve ${declaration.source.value} from ${importPath}`);
    }
    return {
      componentPath,
      exportName:
        specifier.type === 'ImportSpecifier'
          ? specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : String(specifier.imported.value)
          : 'default',
      name: component.name,
    };
  }
  const csf = loadCsf(source, { makeTitle: () => entry.title }).parse();
  if (!csf._meta?.component) {
    return undefined;
  }
  const ref = resolveComponentImport(csf._meta.component, collectImportBindings(csf._file.path));
  if (!ref.importId) {
    return undefined;
  }
  const componentPath = (context.resolvePath ?? resolveImport)(ref.importId, storyPath);
  if (!componentPath) {
    throw new Error(`Could not resolve ${ref.importId} from ${importPath}`);
  }
  return { componentPath, exportName: ref.importName ?? 'default', name: csf._meta.component };
}
