// The ingredients a story's Angular snippet is built from, and the builder that turns them back
// into one. The server records a recipe alongside the snippet it already rendered; the preview
// re-runs this builder over live arg values so the snippet tracks the Controls.
//
// Imported by the dev-server story-docs provider and by the preview, so this module must stay
// isomorphic: no Babel, no `csf-tools`, no `core-server`, no Node built-in, no `@angular/core`.
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
   *
   * A binding only exists when its name matches one the component declares, so the two are the same
   * string by construction rather than by coincidence.
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
  /** NgModules that stand in for a non-standalone component. */
  ngModules?: { names: string[]; importStatements: string[] };
}

/**
 * Rebuilds the snippet, printing live values for the args that have one.
 *
 * With no args it reproduces the server's snippet exactly, because the recipe carries the
 * expressions the server printed. With args it prints them through the same printer and the same
 * layout rules the server used, so the only thing that differs is the values themselves.
 */
export const renderSnippetFromRecipe = (
  recipe: StorySnippetRecipe,
  args?: Record<string, unknown>
): string | undefined => {
  const inputs: TemplateInputBinding[] = [];
  for (const { arg, expression } of recipe.inputs) {
    if (!args || !(arg in args)) {
      inputs.push({ name: arg, expression });
      continue;
    }
    const printed = printArgExpression(args[arg]);
    // One arg with no expression form makes the whole rebuild dishonest, not just its own binding:
    // the reader would see every other binding follow the Controls while this one silently showed
    // the story's declared value. Declining hands back the server's snippet intact.
    if (printed === undefined) {
      return undefined;
    }
    inputs.push({ name: arg, expression: escapeAttributeExpression(printed) });
  }

  return buildHostComponentSnippet({
    // `selfClosing` mirrors the server call site: this rebuilds the server's snippet, not the
    // legacy runtime template the preview renderer emits. The harness invariant - every fixture
    // recipe rebuilding its own snippet byte for byte - is what keeps the two call sites in step.
    template: buildTemplate(recipe.selector, {
      inputs,
      outputs: recipe.outputs,
      selfClosing: true,
    }),
    componentName: recipe.componentName,
    componentImport: recipe.componentImport,
    viaComponentOutlet: false,
    standalone: recipe.standalone,
    ngModules: recipe.ngModules,
    outputs: recipe.outputs,
  }).snippet;
};

/**
 * Whether an opaque recipe from the story-docs payload is one of ours.
 *
 * The payload carries recipes as `unknown` because snippet generation is renderer-specific, so this
 * is the boundary where that `unknown` becomes a `StorySnippetRecipe`. A single discriminator
 * answers it: a payload written by an older Storybook into a static build, which is the real skew
 * this guards, will not carry this `kind`.
 */
export const isStorySnippetRecipe = (recipe: unknown): recipe is StorySnippetRecipe =>
  typeof recipe === 'object' &&
  recipe !== null &&
  (recipe as StorySnippetRecipe).kind === RECIPE_KIND;
