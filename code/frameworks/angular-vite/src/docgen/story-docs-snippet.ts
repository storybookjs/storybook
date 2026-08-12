// Wraps a story's template in the host component a reader would have to write to run it, so the
// snippet is copy-pasteable on its own. Server-side only: the preview renderer still emits the bare
// template, which is what the legacy runtime generator produced.
import { isValidIdentifier } from '../template-grammar.ts';

const HOST_SELECTOR = 'app-demo';
const HOST_CLASS = 'DemoComponent';

export interface HostComponentSnippetInput {
  /** Template the story renders, as `buildTemplate` or `buildComponentOutletTemplate` produced it. */
  template: string;
  /** Local name the template and the `imports` array refer to the story's component by. */
  componentName: string;
  /** Import statement for the component; absent when it is declared in the story file itself. */
  componentImport?: string;
  /** Whether the template reaches the component through `*ngComponentOutlet` rather than a tag. */
  viaComponentOutlet: boolean;
  /** Output binding names, each of which needs a handler for the template to compile. */
  outputs: string[];
}

// A template literal is the only quoting that survives a multi-line template carrying both quote
// characters, so the three sequences that would end or escape it are neutralized.
const escapeTemplateLiteral = (template: string): string =>
  template.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const unescapeTemplateLiteral = (template: string): string =>
  template
    .replace(/\\\$\{/g, '${')
    .replace(/\\`/g, '`')
    .replace(/\\\\/g, '\\');

// Mirrors `formatPropInTemplate`, which reaches a non-identifier output through `this['name']`.
const memberName = (name: string): string => (isValidIdentifier(name) ? name : `['${name}']`);

export const buildHostComponentSnippet = ({
  template,
  componentName,
  componentImport,
  viaComponentOutlet,
  outputs,
}: HostComponentSnippetInput): string => {
  const imports = [
    ...(viaComponentOutlet ? ["import { NgComponentOutlet } from '@angular/common';"] : []),
    "import { Component } from '@angular/core';",
    ...(componentImport ? [componentImport] : []),
  ];

  // Under `*ngComponentOutlet` the component is referenced as a value, not matched as an element,
  // so the directive is what the host declares and the class has to be reachable from the template.
  const declared = viaComponentOutlet ? 'NgComponentOutlet' : componentName;
  const members = [
    ...(viaComponentOutlet ? [`  protected readonly ${componentName} = ${componentName};`] : []),
    ...outputs.map((name) => `  ${memberName(name)}(event: unknown) {}`),
  ];
  const body = members.length > 0 ? `{\n${members.join('\n')}\n}` : '{}';

  return [
    imports.join('\n'),
    '',
    '@Component({',
    `  selector: '${HOST_SELECTOR}',`,
    `  imports: [${declared}],`,
    `  template: \`${escapeTemplateLiteral(template)}\`,`,
    '})',
    `export class ${HOST_CLASS} ${body}`,
  ].join('\n');
};

const TEMPLATE_LITERAL = /^ {2}template: `([\s\S]*)`,$/m;

/**
 * Recovers the template from a snippet {@link buildHostComponentSnippet} produced.
 *
 * The comparison gates read the template, not the wrapper, so they keep measuring the same thing
 * they measured when the snippet was the template alone.
 */
export const extractHostComponentTemplate = (snippet: string): string | undefined => {
  const match = TEMPLATE_LITERAL.exec(snippet);
  return match ? unescapeTemplateLiteral(match[1]) : undefined;
};
