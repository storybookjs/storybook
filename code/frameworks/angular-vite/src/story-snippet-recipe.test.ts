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
  inputNames: ['primary', 'label', 'size'],
  componentName: 'ButtonComponent',
  componentImport: "import { ButtonComponent } from './button.component';",
  standalone: true,
};

describe('renderSnippetFromRecipe', () => {
  // The preview always hands over the story's full args, so "the same args the server saw" is the
  // case that has to reproduce the server's snippet exactly.
  it('reproduces the server snippet from its own expressions, and from the args behind them', () => {
    const fromServer = renderSnippetFromRecipe(recipe);

    expect(fromServer).toContain(`[label]="'Save'"`);
    expect(fromServer).toContain(`[primary]="true"`);
    expect(renderSnippetFromRecipe(recipe, { label: 'Save', primary: true })).toBe(fromServer);
  });

  it('prints the live value for an arg and leaves the others alone', () => {
    const snippet = renderSnippetFromRecipe(recipe, { label: 'Submit', primary: true });

    expect(snippet).toContain(`[label]="'Submit'"`);
    expect(snippet).toContain(`[primary]="true"`);
  });

  it('escapes a live value for the attribute it lands in', () => {
    expect(renderSnippetFromRecipe(recipe, { label: 'say "hi"', primary: true })).toContain(
      `[label]="'say &quot;hi&quot;'"`
    );
  });

  // Layout follows the binding count, so a reader typing into a Controls knob never reshapes the
  // tag under themselves - only the text between the quotes moves.
  it('keeps the tag shape a value cannot change, however long the value grows', () => {
    const oneBinding: StorySnippetRecipe = { ...recipe, inputs: [recipe.inputs[0]!], outputs: [] };

    expect(renderSnippetFromRecipe(oneBinding, { label: 'Save' })).toContain(
      `<sb-button [label]="'Save'" />`
    );
    expect(renderSnippetFromRecipe(oneBinding, { label: 'x'.repeat(400) })).toContain(
      `<sb-button [label]="'${'x'.repeat(400)}'" />`
    );
  });

  it('breaks the tag one binding per line once three bindings are bound', () => {
    expect(
      renderSnippetFromRecipe(recipe, { label: 'Save', primary: true, size: 'large' })
    ).toContain(
      [
        '<sb-button',
        `        [primary]="true"`,
        `        [label]="'Save'"`,
        `        [size]="'large'"`,
        '        (pressed)="pressed($event)"',
        '    />',
      ].join('\n')
    );
  });

  // Declining hands the caller back the server's snippet whole, rather than a snippet where one
  // binding silently lags every other one.
  it('declines the whole rebuild when one live value has no Angular expression form', () => {
    expect(renderSnippetFromRecipe(recipe, { label: Symbol('x'), primary: true })).toBeUndefined();
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

describe('args the story never declared', () => {
  it('binds an arg the reader switched on, in the order the component declares it', () => {
    const snippet = renderSnippetFromRecipe(recipe, {
      label: 'Save',
      primary: true,
      size: 'large',
    })!;

    // `size` is declared after `label`, so it lands after it - not appended wherever the reader
    // happened to switch it on.
    expect(snippet).toContain(`[primary]="true"`);
    expect(snippet.indexOf(`[label]=`)).toBeLessThan(snippet.indexOf(`[size]=`));
    expect(snippet).toContain(`[size]="'large'"`);
  });

  // Resetting a control deletes the key from the args store rather than setting it to `undefined`,
  // so absence has to drop the binding too - not fall back to the value the story declared.
  it('drops a binding the reader reset, whether that reads as undefined or as absent', () => {
    expect(renderSnippetFromRecipe(recipe, { primary: true })).not.toContain('[label]=');

    const snippet = renderSnippetFromRecipe(recipe, { label: undefined, primary: true })!;

    expect(snippet).not.toContain('[label]=');
    expect(snippet).not.toContain('undefined');
    expect(snippet).toContain(`[primary]="true"`);
  });

  it('ignores a live arg the component does not declare as an input', () => {
    const args = { label: 'Save', primary: true };

    expect(renderSnippetFromRecipe(recipe, { ...args, notAnInput: 'x' })).toBe(
      renderSnippetFromRecipe(recipe, args)
    );
  });
});
