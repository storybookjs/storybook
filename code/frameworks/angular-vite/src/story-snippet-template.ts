// Rebuilds a story's snippet from the template the server emitted for it and the args a reader is
// looking at. Imported by the dev-server story-docs provider and by the preview, so this module
// must stay free of `@angular/core` and of any other runtime-only import.
import { escapeAttributeExpression, printArgExpression } from './arg-expression.ts';
import { buildHostComponentSnippet } from './host-component-snippet.ts';
import { BREAK_AT_BINDINGS, INDENT } from './template-grammar.ts';

/** Identifies a template this framework wrote, across a version skew a static build can carry. */
export const SNIPPET_TEMPLATE_KIND = 'angular-snippet-template';

/**
 * Everything needed to rebuild a story's snippet without its source file.
 *
 * Only recorded for snippets built from the component's own bindings, where every binding's value
 * was statically evaluable. A story that supplies its own markup, reaches its component through
 * `*ngComponentOutlet`, or holds an arg that only running the story could resolve, carries no
 * template at all - a partial one would let the preview render something the server never would.
 */
export interface StorySnippetTemplate {
  kind: typeof SNIPPET_TEMPLATE_KIND;
  /**
   * The story's markup, one binding per line, with `[name]="{{name}}"` standing in for every input
   * the component declares.
   *
   * Every declared input is a hole, not just the ones the story set: a reader can turn any of the
   * others on from the Controls panel, and a template that already carries them places such a
   * binding where the component declares it rather than appending it wherever it was switched on.
   */
  template: string;
  /** Local name the template and the `imports` array refer to the component by. */
  componentName: string;
  /** Import statement for the component; absent when it is declared in the story file itself. */
  componentImport?: string;
  /** `false` for a `standalone: false` component, which only its declaring NgModule can provide. */
  standalone: boolean;
  /** Output binding names, each of which needs a handler for the template to compile. */
  outputs: string[];
  /** NgModules that stand in for a non-standalone component. */
  ngModules?: { names: string[]; importStatements: string[] };
}

// One binding whose whole attribute value is its own hole. The name is matched by backreference, so
// it needs no escaping, and the binding is matched as a unit, so a filled value that happens to
// read `[x]="{{x}}"` cannot be re-matched: `String.replace` never rescans what it inserted.
const HOLE_BINDING = /(\s*)\[([^\]]+)\]="\{\{\2\}\}"/g;

/** A template with its holes filled from live args, and how many input bindings survived. */
interface FilledTemplate {
  template: string;
  bindings: number;
}

const fillHoles = (template: string, args: Record<string, unknown>): FilledTemplate | undefined => {
  let declined = false;
  let bindings = 0;
  const filled = template.replace(HOLE_BINDING, (hole, space: string, name: string) => {
    // The args ARE the truth, and resetting a control drops the key rather than setting it to
    // `undefined`, so absence is what removes a binding. The whitespace in front of it is part of
    // the match, so a dropped binding leaves with its own line while a filled one puts the line
    // break back - without that, filling a hole would swallow it and un-break the tag.
    if (!(name in args) || args[name] === undefined) {
      return '';
    }
    const printed = printArgExpression(args[name]);
    // One arg with no expression form makes the whole rebuild dishonest, not just its own binding:
    // the reader would see every other binding follow the Controls while this one silently showed
    // the story's declared value. Declining hands back the server's snippet intact.
    if (printed === undefined) {
      declined = true;
      return hole;
    }
    bindings += 1;
    return `${space}[${name}]="${escapeAttributeExpression(printed)}"`;
  });
  return declined ? undefined : { template: filled, bindings };
};

/**
 * Puts a broken tag back on one line, the exact inverse of the break `buildTemplate` emits: an open
 * line, one indented binding per line, and an end that is either `/>` on its own line or `>` with
 * the closing tag under it.
 */
const collapseTag = (template: string): string => {
  const lines = template.split('\n');
  const end = lines.findIndex((line, index) => index > 0 && !line.startsWith(INDENT));
  if (end === -1) {
    return template;
  }
  const open =
    lines[0] +
    lines
      .slice(1, end)
      .map((line) => ` ${line.trim()}`)
      .join('');
  const tail = lines.slice(end);
  return tail[0] === '/>' ? `${open} />` : open + tail.join('');
};

export const isStorySnippetTemplate = (value: unknown): value is StorySnippetTemplate =>
  typeof value === 'object' &&
  value !== null &&
  (value as { kind?: unknown }).kind === SNIPPET_TEMPLATE_KIND;

/**
 * The story's snippet for the args in front of the reader, or `undefined` to decline the rebuild.
 *
 * Takes `unknown` because it is registered as the framework's renderer directly: declining a
 * payload another framework or an older build wrote is part of the same contract as declining a
 * value with no expression form.
 */
export const renderSnippetFromTemplate = (
  snippetTemplate: unknown,
  args: Record<string, unknown>
): string | undefined => {
  if (!isStorySnippetTemplate(snippetTemplate)) {
    return undefined;
  }
  const filled = fillHoles(snippetTemplate.template, args);
  if (filled === undefined) {
    return undefined;
  }
  // Outputs are on every tag unconditionally, so they count towards the break here exactly as they
  // did when the server laid out the snippet this rebuilds.
  const bindings = filled.bindings + snippetTemplate.outputs.length;
  return buildHostComponentSnippet({
    template: bindings >= BREAK_AT_BINDINGS ? filled.template : collapseTag(filled.template),
    componentName: snippetTemplate.componentName,
    componentImport: snippetTemplate.componentImport,
    viaComponentOutlet: false,
    standalone: snippetTemplate.standalone,
    ngModules: snippetTemplate.ngModules,
    outputs: snippetTemplate.outputs,
  }).snippet;
};
