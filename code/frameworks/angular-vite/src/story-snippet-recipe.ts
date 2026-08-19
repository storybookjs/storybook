import { escapeAttributeExpression, printArgExpression } from './arg-expression.ts';
import { buildHostComponentSnippet } from './host-component-snippet.ts';
import type { TemplateInputBinding } from './template-grammar.ts';
import { buildTemplate } from './template-grammar.ts';

/** Identifies a recipe this framework wrote, across a version skew a static build can carry. */
export const RECIPE_KIND = 'angular-host-component';

/** One input binding, and the arg whose live value replaces the server's expression. */
export interface RecipeInput {
  /**
   * The arg's name, which is also the binding's name.
   */
  arg: string;
  /** What the server printed for this binding, used whenever no live value is supplied. */
  expression: string;
}

/**
 * Everything needed to rebuild a story's snippet without its source file.
 *
 * A recipe is only recorded for snippets built from the component's own bindings, where every
 * binding's value was statically evaluable. A story that supplies its own markup, reaches its
 * component through `*ngComponentOutlet`, or holds an arg that only running the story could
 * resolve, carries no recipe at all - a partial one would let the preview render something the
 * server never would.
 */
export interface StorySnippetRecipe {
  kind: typeof RECIPE_KIND;
  /** Element selector the bindings hang off. */
  selector: string;
  inputs: RecipeInput[];
  outputs: string[];
  /** Local name the template and the `imports` array refer to the component by. */
  componentName: string;
  /** Import statement for the component; absent when it is declared in the story file itself. */
  componentImport?: string;
  /** `false` for a `standalone: false` component, which only its declaring NgModule can provide. */
  standalone: boolean;
  /**
   * Every input the component declares, in declaration order.
   *
   * `inputs` covers only what the story itself set. A reader can turn on any of the others from the
   * Controls panel, and this is what lets the rebuild place such a binding where the component
   * declares it rather than appending it wherever it happened to be switched on.
   */
  inputNames: string[];
  /** NgModules that stand in for a non-standalone component. */
  ngModules?: { names: string[]; importStatements: string[] };
}

export const renderSnippetFromRecipe = (
  recipe: StorySnippetRecipe,
  args?: Record<string, unknown>
): string | undefined => {
  const authored = new Map(recipe.inputs.map(({ arg, expression }) => [arg, expression]));
  const inputs: TemplateInputBinding[] = [];

  for (const name of recipe.inputNames) {
    // Without live args there is nothing to follow, so the server's own expressions reproduce its
    // snippet exactly. With them, the args ARE the truth: an input missing from them is one the
    // reader reset, and resetting a control drops the key rather than setting it to `undefined`, so
    // absence is what has to remove the binding.
    if (args === undefined) {
      const expression = authored.get(name);
      if (expression !== undefined) {
        inputs.push({ name, expression });
      }
      continue;
    }
    if (!(name in args) || args[name] === undefined) {
      continue;
    }
    const printed = printArgExpression(args[name]);
    // One arg with no expression form makes the whole rebuild dishonest, not just its own binding:
    // the reader would see every other binding follow the Controls while this one silently showed
    // the story's declared value. Declining hands back the server's snippet intact.
    if (printed === undefined) {
      return undefined;
    }
    inputs.push({ name, expression: escapeAttributeExpression(printed) });
  }

  return buildHostComponentSnippet({
    // The style mirrors the server call site: this rebuilds the server's snippet, not the legacy
    // runtime template the preview renderer emits. The harness invariant - every fixture recipe
    // rebuilding its own snippet byte for byte - is what keeps the two call sites in step.
    template: buildTemplate(recipe.selector, {
      inputs,
      outputs: recipe.outputs,
      style: 'snippet',
    }),
    componentName: recipe.componentName,
    componentImport: recipe.componentImport,
    viaComponentOutlet: false,
    standalone: recipe.standalone,
    ngModules: recipe.ngModules,
    outputs: recipe.outputs,
  }).snippet;
};

export const isStorySnippetRecipe = (recipe: unknown): recipe is StorySnippetRecipe =>
  typeof recipe === 'object' &&
  recipe !== null &&
  (recipe as StorySnippetRecipe).kind === RECIPE_KIND;
