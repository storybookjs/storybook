/**
 * The standalone host component a story's markup is wrapped in, for the `component` snippet format.
 *
 * The `template` format emits the markup on its own. That reads well beside a rendered story but
 * cannot be pasted anywhere, because an Angular template only exists inside a component. This
 * format adds the host, the standalone imports it needs and the members its template references, so
 * the snippet stands on its own.
 */
import { IDENTIFIER } from './template-snippet.ts';

/** Selector of the generated host, matching what the Angular CLI scaffolds for a root component. */
const HOST_SELECTOR = 'app-root';
const HOST_CLASS = 'App';
const INDENT = '  ';

/** What the host wrapper needs, all of it the same for every story under one component. */
export interface AngularHostContext {
  /** Class name the template renders and the host's `imports` lists. */
  componentName: string;
  /** Specifier the component is imported from; absent when the story file declares it inline. */
  importId?: string;
  /** The story file imports the component as a default export. */
  defaultImport?: boolean;
  /** The template renders through `*ngComponentOutlet`, because the component has no selector. */
  outlet?: boolean;
}

/** Import block for a component's snippets, carried once per payload rather than per story. */
export const angularHostImports = (context: AngularHostContext): string =>
  [
    `import { Component } from '@angular/core';`,
    ...(context.outlet ? [`import { NgComponentOutlet } from '@angular/common';`] : []),
    ...(context.importId
      ? [
          context.defaultImport
            ? `import ${context.componentName} from '${context.importId}';`
            : `import { ${context.componentName} } from '${context.importId}';`,
        ]
      : []),
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
const memberName = (name: string): string => (IDENTIFIER.test(name) ? name : `['${name}']`);

/** Escapes what would otherwise close or interpolate the host's template literal. */
const escapeTemplateLiteral = (markup: string): string =>
  markup.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
