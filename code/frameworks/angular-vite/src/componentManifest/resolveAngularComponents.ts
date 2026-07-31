import { existsSync } from 'node:fs';
import path from 'pathe';
import { loadCsf } from 'storybook/internal/csf-tools';
import * as ts from 'typescript';

import { cachedReadTextFileSync } from './utils.ts';

export type ParsedCsf = ReturnType<ReturnType<typeof loadCsf>['parse']>;

/** Minimal reference to an Angular component resolved from a story file. */
export interface AngularComponentRef {
  /** Class name, e.g. "ButtonComponent". */
  componentName: string;
  /** Absolute path to the component source file, when resolvable. */
  path: string | undefined;
  /** Raw import specifier from the story file, e.g. "./button.component". */
  importSpecifier: string | undefined;
}

export interface ResolvedAngularStory {
  storyPath: string;
  storyFile: string;
  csf: ParsedCsf;
  /** `meta.component`'s local identifier if declared. */
  componentName: string | undefined;
  /** Resolved primary component reference, or undefined when unresolvable. */
  component: AngularComponentRef | undefined;
}

/**
 * Parse a single Angular CSF story file and resolve the primary component reference.
 *
 * Reads the file, extracts `meta.component`, finds the matching import declaration, and resolves
 * the import specifier to an absolute path.
 */
export async function resolveAngularStoryComponent(options: {
  storyPath: string;
  title: string;
}): Promise<ResolvedAngularStory> {
  const { storyPath, title } = options;

  const storyFile = cachedReadTextFileSync(storyPath);
  const csf = loadCsf(storyFile, { makeTitle: () => title }).parse();
  const componentName = csf._meta?.component;

  let component: AngularComponentRef | undefined;

  if (componentName) {
    const importSpecifier = findImportSpecifier(storyFile, storyPath, componentName);
    const resolvedPath = importSpecifier ? resolveLocalPath(importSpecifier, storyPath) : undefined;

    component = { componentName, path: resolvedPath, importSpecifier };
  }

  return { storyPath, storyFile, csf, componentName, component };
}

// ---------------------------------------------------------------------------
// Import resolution helpers
// ---------------------------------------------------------------------------

const TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'] as const;

/**
 * Scan the TypeScript source of a story file and find the module specifier for an import that
 * brings `localName` into scope (named or default import).
 */
function findImportSpecifier(
  source: string,
  filePath: string,
  localName: string
): string | undefined {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);

  let found: string | undefined;

  ts.forEachChild(sourceFile, (node) => {
    if (found) {
      return;
    }
    if (!ts.isImportDeclaration(node)) {
      return;
    }

    const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
    const clause = node.importClause;
    if (!clause) {
      return;
    }

    // import { ButtonComponent } from '...' or import { Foo as ButtonComponent } from '...'
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) {
        const boundName = el.name.text;
        const originalName = el.propertyName ? el.propertyName.text : boundName;
        if (boundName === localName || originalName === localName) {
          found = specifier;
          return;
        }
      }
    }

    // import ButtonComponent from '...'
    if (clause.name?.text === localName) {
      found = specifier;
    }
  });

  return found;
}

/** Resolve a relative import specifier to an absolute filesystem path, or return undefined. */
function resolveLocalPath(importSpecifier: string, fromFile: string): string | undefined {
  if (!importSpecifier.startsWith('.')) {
    return undefined;
  }

  const base = path.resolve(path.dirname(fromFile), importSpecifier);

  if (existsSync(base)) {
    return base;
  }

  for (const ext of TS_EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}
