/**
 * Host component the `component` snippet format wraps a story's markup in. An Angular template only
 * exists inside a component, so the bare markup the `template` format emits has nowhere to be
 * pasted; this adds the smallest standalone host that compiles it.
 */

import { isValidIdentifier } from './story-docs-snippet.ts';

/** Selector of the generated host, matching what the Angular CLI scaffolds for a root component. */
const HOST_SELECTOR = 'app-root';
const HOST_CLASS = 'App';
const INDENT = '  ';

/** What the host wrapper needs, all of it the same for every story under one component. */
export interface AngularHostContext {
  /** Class name the template renders and the host's `imports` lists. */
  componentName: string;
  /** Name the declaring module exports the class under: `default`, or a named export. */
  exportName: string;
  /** Specifier the component is imported from; absent when the story file declares it inline. */
  importId?: string;
  /** The template renders through `*ngComponentOutlet`, because the component has no selector. */
  outlet?: boolean;
}

/**
 * Import that brings the class into scope under `componentName`, which is the name the template and
 * the `imports` array use. A default import binds to any local name; a named export is aliased back
 * to the class's own name when the two differ.
 */
const componentImport = (context: AngularHostContext, importId: string): string => {
  const { componentName, exportName } = context;
  if (exportName === 'default') {
    return `import ${componentName} from '${importId}';`;
  }
  const named = exportName === componentName ? componentName : `${exportName} as ${componentName}`;
  return `import { ${named} } from '${importId}';`;
};

/** Import block for a component's snippets, carried once per payload rather than per story. */
export const angularHostImports = (context: AngularHostContext): string =>
  [
    `import { Component } from '@angular/core';`,
    ...(context.outlet ? [`import { NgComponentOutlet } from '@angular/common';`] : []),
    ...(context.importId ? [componentImport(context, context.importId)] : []),
  ].join('\n');

/**
 * Wraps one story's markup in its host component.
 *
 * `handlers` are the output names the markup binds. Angular's template type checking resolves them
 * against the host class, so a snippet that binds an output without declaring the method would not
 * compile - which is the whole point of this format.
 */
export const angularHostComponent = (
  template: string,
  handlers: readonly string[],
  context: AngularHostContext
): string => {
  const members = [
    // `*ngComponentOutlet` reads the class as a template expression, so the host has to expose it.
    ...(context.outlet ? [`readonly ${context.componentName} = ${context.componentName};`] : []),
    ...handlers.map((name) => `${memberName(name)}(event: unknown) {}`),
  ];

  return [
    '@Component({',
    `${INDENT}selector: '${HOST_SELECTOR}',`,
    `${INDENT}template: \`${escapeTemplateLiteral(template)}\`,`,
    `${INDENT}imports: [${context.outlet ? 'NgComponentOutlet' : context.componentName}],`,
    '})',
    members.length === 0
      ? `export class ${HOST_CLASS} {}`
      : `export class ${HOST_CLASS} {\n${members.map((member) => INDENT + member).join('\n')}\n}`,
  ].join('\n');
};

/** Class member name: written plainly when it is an identifier, quoted otherwise. */
const memberName = (name: string): string => (isValidIdentifier(name) ? name : `['${name}']`);

/** Escapes what would otherwise close or interpolate the host's template literal. */
const escapeTemplateLiteral = (markup: string): string =>
  markup.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
