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
  /** `false` for a `standalone: false` component, which only its declaring NgModule can provide. */
  standalone: boolean;
  /** NgModules the story's `moduleMetadata` adds to its template scope. */
  ngModules?: { names: string[]; importStatements: string[] };
  /** Output binding names, each of which needs a handler for the template to compile. */
  outputs: string[];
  /** Args the template refers to by name, which the story supplied through `props: args`. */
  fields?: { name: string; value: string }[];
}

export interface HostComponentSnippet {
  snippet: string;
  /** Why the snippet does not compile as written; see `StoryDoc.warning`. */
  warning?: string;
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

const memberValue = (value: string): string => value.split('\n').join('\n  ');

// A template `buildTemplate` broke over lines moves onto its own lines inside the literal too.
const embedTemplate = (template: string): string =>
  template.includes('\n')
    ? `\n${template
        .split('\n')
        .map((line) => (line === '' ? line : `    ${line}`))
        .join('\n')}`
    : template;

export const buildHostComponentSnippet = ({
  template,
  componentName,
  componentImport,
  viaComponentOutlet,
  standalone,
  ngModules,
  outputs,
  fields = [],
}: HostComponentSnippetInput): HostComponentSnippet => {
  // A `standalone: false` component is only reachable through its declaring NgModule, which static
  // analysis cannot find reliably. The modules the story's own `moduleMetadata` lists are the next
  // best claim; without them the tag path leaves `imports` empty and warns why instead. A standalone
  // component imports itself and still needs those modules, since its template may depend on them.
  const importable = viaComponentOutlet || standalone;
  const moduleNames = viaComponentOutlet ? [] : (ngModules?.names ?? []);
  const imports = [
    ...(viaComponentOutlet ? ["import { NgComponentOutlet } from '@angular/common';"] : []),
    "import { Component } from '@angular/core';",
    ...(componentImport && importable ? [componentImport] : []),
    ...(moduleNames.length > 0 ? (ngModules?.importStatements ?? []) : []),
  ];

  // Under `*ngComponentOutlet` the component is referenced as a value, not matched as an element,
  // so the directive is what the host declares and the class has to be reachable from the template.
  const declared = viaComponentOutlet
    ? 'NgComponentOutlet'
    : [...(standalone ? [componentName] : []), ...moduleNames].join(', ');
  const members = [
    ...(viaComponentOutlet ? [`  protected readonly ${componentName} = ${componentName};`] : []),
    ...fields.map(({ name, value }) => `  ${memberName(name)} = ${memberValue(value)};`),
    ...outputs.map((name) => `  ${memberName(name)}(event: unknown) {}`),
  ];
  const body = members.length > 0 ? `{\n${members.join('\n')}\n}` : '{}';

  const snippet = [
    imports.join('\n'),
    '',
    '@Component({',
    `  selector: '${HOST_SELECTOR}',`,
    `  imports: [${declared}],`,
    `  template: \`${embedTemplate(escapeTemplateLiteral(template))}\`,`,
    '})',
    `export class ${HOST_CLASS} ${body}`,
  ].join('\n');

  // A story-file-local component has no import to derive, so the snippet names it without bringing
  // it into scope; it still shows the bindings the story sets, so it stays with the caveat attached.
  const warning =
    !importable && moduleNames.length === 0
      ? `${componentName} is declared with \`standalone: false\`, so it cannot be listed in the ` +
        `host component's \`imports\`. Add the NgModule that declares and exports ` +
        `${componentName} to \`imports\` to make this snippet compile.`
      : importable && componentImport === undefined
        ? `${componentName} is declared in the story file, so the snippet references it without importing it.`
        : undefined;

  return warning === undefined ? { snippet } : { snippet, warning };
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
  return match ? unescapeTemplateLiteral(unembedTemplate(match[1])) : undefined;
};

// Inverse of `embedTemplate`, so extraction returns what `buildTemplate` produced.
const unembedTemplate = (template: string): string =>
  template.startsWith('\n')
    ? template
        .slice(1)
        .split('\n')
        .map((line) => line.replace(/^ {4}/, ''))
        .join('\n')
    : template;
