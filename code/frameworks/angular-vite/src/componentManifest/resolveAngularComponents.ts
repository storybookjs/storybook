import { existsSync } from 'node:fs';
import path from 'pathe';
import { storyNameFromExport } from 'storybook/internal/csf';
import { extractDescription, loadCsf } from 'storybook/internal/csf-tools';
import * as ts from 'typescript';

import type { Component, Directive } from './compodocTypes.ts';
import { extractJSDocInfo } from './jsdocTags.ts';
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

/** Snippet + metadata for one story. */
export interface ResolvedAngularStoryEntry {
  id: string;
  name: string;
  /**
   * Generated template snippet. For components whose selector has multiple
   * comma-separated variants (e.g. `"button[lib-btn], a[lib-btn]"`), this is the
   * first variant — the full selector is available on the component's `selector` field.
   */
  snippet?: string;
  description?: string;
  summary?: string;
  error?: { name: string; message: string };
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

/**
 * Extract story-level snippets and JSDoc metadata from a parsed CSF file.
 *
 * For Angular, the "snippet" is a generated template string built from the component's selector
 * (from Compodoc) and the story's `args`. Pass `filterStoryIds` to limit output to a subset.
 */
export function extractAngularStorySnippets(
  csf: ParsedCsf,
  compodocData: Component | Directive | null | undefined,
  _componentName: string | undefined,
  filterStoryIds?: ReadonlySet<string>
): ResolvedAngularStoryEntry[] {
  const selector = compodocData?.selector;
  const inputs = compodocData?.inputsClass ?? [];
  const outputs = compodocData?.outputsClass ?? [];

  // Parse the source file once for render-template extraction.
  // csf._code may be undefined in some storybook versions; fall back to the Babel
  // intermediate representation (_file.code) which always contains the raw source.
  const rawCode: string = (csf as ParsedCsf & { _code?: string })._code ?? csf._file?.code ?? '';
  const sourceFile = ts.createSourceFile('story.ts', rawCode, ts.ScriptTarget.Latest, true);

  return Object.entries(csf._stories)
    .filter(([, story]) => !filterStoryIds || filterStoryIds.has(story.id))
    .map(([storyExport, story]): ResolvedAngularStoryEntry => {
      const name = story.name ?? storyNameFromExport(storyExport);
      try {
        const jsdocComment = extractDescription(csf._storyStatements[storyExport]);
        const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};
        const finalDescription = (tags?.describe?.[0] || tags?.desc?.[0]) ?? description;

        // loadCsf from storybook/internal/csf-tools does not populate story.args with
        // static literal values from the source file; fall back to AST extraction.
        const loadedArgs = (story as typeof story & { args?: Record<string, unknown> }).args;
        const args = loadedArgs ?? extractStoryArgs(sourceFile, storyExport);

        // @useTemplate opt-in: use the story's parameters.docs.source.code verbatim as
        // the snippet — the same code Storybook's "Show code" panel would display —
        // falling back to render.template when no docs.source.code is set.
        // Without the tag, the snippet is always auto-generated from Compodoc + args,
        // same as a story with no render.
        const renderTemplate = extractStoryRenderTemplate(sourceFile, storyExport);
        const docsSourceCode = extractStoryDocsSourceCode(sourceFile, storyExport);
        const templateOverride = docsSourceCode ?? renderTemplate;
        const useTemplate = 'useTemplate' in (tags ?? {});
        const snippet =
          useTemplate && templateOverride
            ? templateOverride
            : buildAngularSnippet(selector, inputs, outputs, args);

        return {
          id: story.id,
          name,
          snippet,
          description: finalDescription?.trim(),
          summary: tags.summary?.[0],
        };
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        return {
          id: story.id,
          name,
          error: { name: err.name, message: err.message },
        };
      }
    });
}

// ---------------------------------------------------------------------------
// Story render template extraction
// ---------------------------------------------------------------------------

/**
 * Extract the Angular `template` string from a story's `render` function via TypeScript AST.
 *
 * Handles the two common forms:
 *   - Arrow function with parenthesised object: `render: (args) => ({ template: \`...\` })`
 *   - Arrow function with block body:           `render: (args) => { return { template: \`...\` }; }`
 *
 * Returns `undefined` when the story has no `render`, or `render` does not return a `template`.
 */
export function extractStoryRenderTemplate(
  sourceFile: ts.SourceFile,
  storyExportName: string
): string | undefined {
  const storyObject = findStoryObjectLiteral(sourceFile, storyExportName);
  if (!storyObject) return undefined;

  const renderProp = findObjectProperty(storyObject, 'render');
  if (!renderProp) return undefined;
  if (!ts.isArrowFunction(renderProp) && !ts.isFunctionExpression(renderProp)) return undefined;

  const returnObj = resolveRenderReturnObject(renderProp);
  if (!returnObj) return undefined;

  const templateProp = findObjectProperty(returnObj, 'template');
  if (!templateProp) return undefined;

  return extractStringLiteralText(templateProp, sourceFile);
}

/**
 * Extract a story's `parameters.docs.source.code` string via TypeScript AST — i.e. the same
 * code Storybook's Docs "Show code" panel would display when that parameter is set explicitly.
 *
 * Returns `undefined` when the story has no `parameters.docs.source.code`, or when any part of
 * that path isn't a plain object literal / string literal (computed values aren't evaluated).
 */
export function extractStoryDocsSourceCode(
  sourceFile: ts.SourceFile,
  storyExportName: string
): string | undefined {
  const storyObject = findStoryObjectLiteral(sourceFile, storyExportName);
  if (!storyObject) return undefined;

  let cursor: ts.ObjectLiteralExpression | undefined = storyObject;
  for (const key of ['parameters', 'docs', 'source']) {
    const prop: ts.Expression | undefined = cursor && findObjectProperty(cursor, key);
    cursor = prop && ts.isObjectLiteralExpression(prop) ? prop : undefined;
    if (!cursor) return undefined;
  }

  const codeProp = findObjectProperty(cursor, 'code');
  if (!codeProp) return undefined;

  return extractStringLiteralText(codeProp, sourceFile);
}

/** Find a story export's object literal initializer, e.g. `export const Primary = { ... };`. */
function findStoryObjectLiteral(
  sourceFile: ts.SourceFile,
  storyExportName: string
): ts.ObjectLiteralExpression | undefined {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;

    const decl = statement.declarationList.declarations.find(
      (d) => ts.isIdentifier(d.name) && (d.name as ts.Identifier).text === storyExportName
    );
    if (decl?.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
      return decl.initializer;
    }
  }

  return undefined;
}

/** Find a plain `key: value` property's initializer expression on an object literal. */
function findObjectProperty(
  obj: ts.ObjectLiteralExpression,
  key: string
): ts.Expression | undefined {
  const prop = obj.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) &&
      ts.isIdentifier(p.name) &&
      (p.name as ts.Identifier).text === key
  );
  return prop?.initializer;
}

function resolveRenderReturnObject(
  fn: ts.ArrowFunction | ts.FunctionExpression
): ts.ObjectLiteralExpression | undefined {
  const body = fn.body;

  // `(args) => ({ template: ... })`
  if (ts.isParenthesizedExpression(body)) {
    const inner = (body as ts.ParenthesizedExpression).expression;
    if (ts.isObjectLiteralExpression(inner)) return inner;
  }

  // `(args) => ({ template: ... })` without parens (rare but valid)
  if (ts.isObjectLiteralExpression(body)) return body;

  // `(args) => { return { template: ... }; }`
  if (ts.isBlock(body)) {
    for (const stmt of body.statements) {
      if (!ts.isReturnStatement(stmt) || !stmt.expression) continue;
      let expr: ts.Expression = stmt.expression;
      if (ts.isParenthesizedExpression(expr)) expr = expr.expression;
      if (ts.isObjectLiteralExpression(expr)) return expr;
    }
  }

  return undefined;
}

function extractStringLiteralText(
  node: ts.Expression,
  sourceFile: ts.SourceFile
): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    // Template literal with interpolations – return the raw source as-is
    return node.getText(sourceFile);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Angular selector parsing
// ---------------------------------------------------------------------------

/**
 * Parsed representation of one part of an Angular CSS selector.
 *
 * Examples:
 *   `app-button`        → { element: 'app-button', attributes: [] }
 *   `[lib-btn]`         → { element: undefined,    attributes: ['lib-btn'] }
 *   `button[lib-btn]`   → { element: 'button',     attributes: ['lib-btn'] }
 */
interface ParsedSelectorPart {
  element: string | undefined;
  attributes: string[];
}

/**
 * Parse a single Angular selector part (no comma) into its element + attribute parts.
 * Ignores pseudo-classes, class selectors, and everything we don't need for snippets.
 */
function parseSelectorPart(part: string): ParsedSelectorPart {
  const trimmed = part.trim();

  // Extract all attribute selectors [attr] or [attr=val]
  const attrMatches = [...trimmed.matchAll(/\[([^\]=]+)(?:=[^\]]+)?\]/g)];
  const attributes = attrMatches.map((m) => m[1]?.trim() ?? '');

  // The element tag is everything before the first [ or . or :
  const elementMatch = trimmed.match(/^([a-z][\w-]*)/i);
  const element = elementMatch?.[1];

  return { element, attributes };
}

/**
 * Parse a TypeScript expression into a static primitive value.
 *
 * Handles string, number, boolean, null, and the `undefined` identifier.
 * Returns `undefined` for complex expressions (functions, arrays, objects, etc.)
 * so that callers can distinguish "present but not a simple literal" from
 * "key not present at all" when building bindings.
 */
function parseStaticLiteralValue(node: ts.Expression): unknown {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isIdentifier(node) && node.text === 'undefined') return undefined;
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  )
    return -Number(node.operand.text);
  // Complex expression (function, array, object, reference…) — not statically evaluable
  return undefined;
}

/**
 * Statically extract the `args` object from a story export via TypeScript AST.
 *
 * `loadCsf` from storybook/internal/csf-tools does not populate `_stories[name].args`
 * with literal values from the source file. This function fills that gap by walking
 * the AST of the raw story code.
 *
 * Literal values (string, number, boolean, null, undefined) are resolved.
 * Complex expressions (functions, arrays, objects) become `undefined` in the result —
 * the key is still present so that output bindings are rendered even when the arg value
 * is a function or explicit `undefined`.
 *
 * Returns `undefined` when the story export has no `args` property.
 */
function extractStoryArgs(
  sourceFile: ts.SourceFile,
  storyExportName: string
): Record<string, unknown> | undefined {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;

    const decl = statement.declarationList.declarations.find(
      (d) => ts.isIdentifier(d.name) && (d.name as ts.Identifier).text === storyExportName
    );
    if (!decl?.initializer || !ts.isObjectLiteralExpression(decl.initializer)) continue;

    const argsProp = decl.initializer.properties.find(
      (p): p is ts.PropertyAssignment =>
        ts.isPropertyAssignment(p) &&
        ts.isIdentifier(p.name) &&
        (p.name as ts.Identifier).text === 'args'
    );
    if (!argsProp) return undefined;
    if (!ts.isObjectLiteralExpression(argsProp.initializer)) return undefined;

    const result: Record<string, unknown> = {};
    for (const prop of argsProp.initializer.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = ts.isIdentifier(prop.name)
        ? (prop.name as ts.Identifier).text
        : ts.isStringLiteral(prop.name)
          ? (prop.name as ts.StringLiteral).text
          : undefined;
      if (!key) continue;
      result[key] = parseStaticLiteralValue(prop.initializer);
    }
    return result;
  }
  return undefined;
}

/**
 * Build the attribute bindings string for Angular inputs and outputs.
 *
 * Inputs:
 * - `boolean true`  → bare attribute `disabled` (truthy shorthand)
 * - `boolean false` → property binding `[disabled]="false"`
 * - `string`        → plain attribute  `label="Click me"`
 * - other           → property binding `[count]="42"`
 * - `undefined`     → skipped (value not statically known)
 * - `required` signal with no arg value → placeholder `[name]="/* required *&#47;"`
 *
 * Outputs (from `outputsClass`):
 * - Always rendered as `(eventName)="handleEvent($event)"` regardless of arg value
 */
function buildBindings(
  inputs: import('./compodocTypes').Property[],
  outputs: import('./compodocTypes').Property[],
  args: Record<string, unknown> | undefined
): string[] {
  const inputByName = new Map(inputs.map((i) => [i.name, i]));
  const outputNames = new Set(outputs.map((o) => o.name));
  const bindings: string[] = [];

  // Required signal inputs with no provided arg value
  for (const input of inputs) {
    if (input.required && !(args && input.name in args)) {
      bindings.push(`[${input.name}]="/* required */"`);
    }
  }

  if (args) {
    for (const [key, value] of Object.entries(args)) {
      if (outputNames.has(key)) {
        // Output binding — arg value is ignored, always render event binding syntax
        bindings.push(`(${key})="handleEvent($event)"`);
      } else if (inputByName.has(key)) {
        if (value === undefined) {
        } else if (value === true) {
          bindings.push(key);
        } else if (value === false) {
          bindings.push(`[${key}]="false"`);
        } else if (typeof value === 'string') {
          bindings.push(`${key}="${value}"`);
        } else {
          bindings.push(`[${key}]="${JSON.stringify(value)}"`);
        }
      }
    }
  }

  return bindings;
}

/**
 * Render one snippet from a parsed selector part + bindings.
 *
 * - Element selector (`app-button`): `<app-button [i]="v"></app-button>`
 * - Attribute-only (`[lib-btn]`):    `<div lib-btn [i]="v"></div>`  (fallback host: div)
 * - Compound (`button[lib-btn]`):    `<button lib-btn [i]="v"></button>`
 */
function renderSnippet({ element, attributes }: ParsedSelectorPart, bindings: string[]): string {
  const host = element ?? 'div';
  const isVoid = ['input', 'br', 'hr', 'img', 'area', 'link', 'meta'].includes(host);

  const parts = [host, ...attributes, ...bindings].join(' ');

  return isVoid ? `<${parts}>` : `<${parts}></${host}>`;
}

/**
 * Generate an Angular template snippet from the component's selector.
 *
 * A selector like `"button[lib-btn], a[lib-btn]"` has multiple comma-separated
 * variants; the first one is used (the full selector is already exposed once on
 * the component's `selector` field).
 *
 * Returns `undefined` when the selector is missing (no guess is attempted).
 */
function buildAngularSnippet(
  selector: string | undefined,
  inputs: import('./compodocTypes').Property[],
  outputs: import('./compodocTypes').Property[],
  args: Record<string, unknown> | undefined
): string | undefined {
  if (!selector) {
    return undefined;
  }

  const bindings = buildBindings(inputs, outputs, args);
  const variants = selector.split(',').map((part) => parseSelectorPart(part));
  const chosen = variants[0] ?? parseSelectorPart(selector);

  return renderSnippet(chosen, bindings);
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
