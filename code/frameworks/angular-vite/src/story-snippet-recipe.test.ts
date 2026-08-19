import { describe, expect, it } from 'vitest';

import type { StorySnippetRecipe } from './story-snippet-recipe.ts';
import {
  RECIPE_KIND,
  isStorySnippetRecipe,
  renderSnippetFromRecipe,
} from './story-snippet-recipe.ts';

const recipe: StorySnippetRecipe = {
  kind: RECIPE_KIND,
  selector: 'sb-button',
  inputs: [
    { arg: 'label', expression: "'Save'" },
    { arg: 'primary', expression: 'true' },
  ],
  outputs: ['pressed'],
  componentName: 'ButtonComponent',
  componentImport: "import { ButtonComponent } from './button.component';",
  standalone: true,
};

describe('renderSnippetFromRecipe', () => {
  it('reproduces the server expressions when no args are supplied', () => {
    expect(renderSnippetFromRecipe(recipe)).toContain(`[label]="'Save'"`);
    expect(renderSnippetFromRecipe(recipe)).toBe(renderSnippetFromRecipe(recipe, {}));
  });

  it('prints the live value for an arg and leaves the others alone', () => {
    const snippet = renderSnippetFromRecipe(recipe, { label: 'Submit' });

    expect(snippet).toContain(`[label]="'Submit'"`);
    expect(snippet).toContain(`[primary]="true"`);
  });

  it('escapes a live value for the attribute it lands in', () => {
    expect(renderSnippetFromRecipe(recipe, { label: 'say "hi"' })).toContain(
      `[label]="'say &quot;hi&quot;'"`
    );
  });

  // The layout rule measures the fully inlined tag, so a value crossing 80 characters changes the
  // tag's shape and not just its text. The preview re-runs that rule rather than substituting into
  // a finished string, which is the only reason a live snippet stays valid Angular here.
  it('re-runs the layout rule, so a long value breaks the tag the way the server would', () => {
    const oneBinding: StorySnippetRecipe = { ...recipe, inputs: [recipe.inputs[0]!], outputs: [] };

    expect(renderSnippetFromRecipe(oneBinding, { label: 'Save' })).toContain(
      `<sb-button [label]="'Save'"></sb-button>`
    );
    expect(
      renderSnippetFromRecipe(oneBinding, {
        label: 'Submit the form and continue to the checkout page now',
      })
    ).toContain(
      `<sb-button\n        [label]="'Submit the form and continue to the checkout page now'">\n    </sb-button>`
    );
  });

  // Declining hands the caller back the server's snippet whole, rather than a snippet where one
  // binding silently lags every other one.
  it('declines the whole rebuild when one live value has no Angular expression form', () => {
    expect(renderSnippetFromRecipe(recipe, { label: Symbol('x') })).toBeUndefined();
    expect(renderSnippetFromRecipe(recipe, { label: 'Save', primary: () => {} })).toBeUndefined();
  });
});

describe('isStorySnippetRecipe', () => {
  it('accepts a recipe this framework produced', () => {
    expect(isStorySnippetRecipe(recipe)).toBe(true);
  });

  it('rejects anything else, so another framework’s recipe is left alone', () => {
    expect(isStorySnippetRecipe(undefined)).toBe(false);
    expect(isStorySnippetRecipe(null)).toBe(false);
    expect(isStorySnippetRecipe('sb-button')).toBe(false);
    expect(isStorySnippetRecipe({ template: '<Button />', holes: {} })).toBe(false);
    expect(isStorySnippetRecipe({ ...recipe, kind: 'vue-sfc' })).toBe(false);
  });
});
