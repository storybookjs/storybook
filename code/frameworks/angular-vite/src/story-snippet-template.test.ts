import { describe, expect, it } from 'vitest';

import type { StorySnippetTemplate } from './story-snippet-template.ts';
import {
  SNIPPET_TEMPLATE_KIND,
  isStorySnippetTemplate,
  renderSnippetFromTemplate,
} from './story-snippet-template.ts';

const snippetTemplate: StorySnippetTemplate = {
  kind: SNIPPET_TEMPLATE_KIND,
  selector: 'sb-button',
  inputNames: ['primary', 'label', 'size'],
  outputs: ['pressed'],
  componentName: 'ButtonComponent',
  componentImport: "import { ButtonComponent } from './button.component';",
  standalone: true,
};

const oneBinding: StorySnippetTemplate = {
  ...snippetTemplate,
  inputNames: ['label'],
  outputs: [],
};

describe('renderSnippetFromTemplate', () => {
  it('prints the live value for an arg and leaves the others alone', () => {
    const snippet = renderSnippetFromTemplate(snippetTemplate, { label: 'Submit', primary: true });

    expect(snippet).toContain(`[label]="'Submit'"`);
    expect(snippet).toContain(`[primary]="true"`);
  });

  it('escapes a live value for the attribute it lands in', () => {
    expect(renderSnippetFromTemplate(snippetTemplate, { label: 'say "hi"' })).toContain(
      `[label]="'say &quot;hi&quot;'"`
    );
  });

  it('keeps the tag shape a value cannot change, however long the value grows', () => {
    expect(renderSnippetFromTemplate(oneBinding, { label: 'Save' })).toContain(
      `<sb-button [label]="'Save'" />`
    );
    expect(renderSnippetFromTemplate(oneBinding, { label: 'x'.repeat(400) })).toContain(
      `<sb-button [label]="'${'x'.repeat(400)}'" />`
    );
  });

  it('breaks the tag one binding per line once three bindings survive', () => {
    expect(
      renderSnippetFromTemplate(snippetTemplate, { label: 'Save', primary: true, size: 'large' })
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

  it('lays out an element that carries a closing tag', () => {
    const withClosingTag: StorySnippetTemplate = {
      ...snippetTemplate,
      selector: '.card',
      inputNames: ['label'],
      outputs: [],
    };

    expect(renderSnippetFromTemplate(withClosingTag, { label: 'Save' })).toContain(
      `<div class="card" [label]="'Save'"></div>`
    );
  });

  it('declines the whole rebuild when one live value has no Angular expression form', () => {
    expect(
      renderSnippetFromTemplate(snippetTemplate, { label: Symbol('x'), primary: true })
    ).toBeUndefined();
    expect(
      renderSnippetFromTemplate(snippetTemplate, { label: 'Save', primary: () => {} })
    ).toBeUndefined();
  });
});

describe('isStorySnippetTemplate', () => {
  it('accepts a template this framework produced', () => {
    expect(isStorySnippetTemplate(snippetTemplate)).toBe(true);
  });

  it('rejects anything else, so another framework’s payload is left alone', () => {
    expect(isStorySnippetTemplate(undefined)).toBe(false);
    expect(isStorySnippetTemplate(null)).toBe(false);
    expect(isStorySnippetTemplate('sb-button')).toBe(false);
    expect(isStorySnippetTemplate({ kind: SNIPPET_TEMPLATE_KIND })).toBe(false);
    expect(isStorySnippetTemplate({ ...snippetTemplate, inputNames: ['label', 7] })).toBe(false);
    expect(isStorySnippetTemplate({ ...snippetTemplate, ngModules: { names: [] } })).toBe(false);
    expect(isStorySnippetTemplate({ ...snippetTemplate, kind: 'vue-sfc' })).toBe(false);
  });
});

describe('args the story never declared', () => {
  it('binds an input the reader switched on, in docgen order', () => {
    const snippet = renderSnippetFromTemplate(snippetTemplate, {
      label: 'Save',
      primary: true,
      size: 'large',
    })!;

    expect(snippet).toContain(`[primary]="true"`);
    expect(snippet.indexOf(`[label]=`)).toBeLessThan(snippet.indexOf(`[size]=`));
    expect(snippet).toContain(`[size]="'large'"`);
  });

  it('drops a binding the reader reset, whether that reads as undefined or as absent', () => {
    expect(renderSnippetFromTemplate(snippetTemplate, { primary: true })).not.toContain('[label]=');

    const snippet = renderSnippetFromTemplate(snippetTemplate, {
      label: undefined,
      primary: true,
    })!;

    expect(snippet).not.toContain('[label]=');
    expect(snippet).not.toContain('{{');
    expect(snippet).toContain(`[primary]="true"`);
  });

  it('collapses the tag back onto one line when a reset takes it under three bindings', () => {
    expect(
      renderSnippetFromTemplate(snippetTemplate, { label: 'Save', primary: true, size: 'large' })
    ).toContain('<sb-button\n');
    expect(renderSnippetFromTemplate(snippetTemplate, { label: 'Save' })).toContain(
      `<sb-button [label]="'Save'" (pressed)="pressed($event)" />`
    );
  });

  it('ignores a live arg the component does not declare as an input', () => {
    const args = { label: 'Save', primary: true };

    expect(renderSnippetFromTemplate(snippetTemplate, { ...args, notAnInput: 'x' })).toBe(
      renderSnippetFromTemplate(snippetTemplate, args)
    );
  });

  it('ignores inherited args', () => {
    const args = Object.assign(Object.create({ label: 'inherited' }) as Record<string, unknown>, {
      primary: true,
    });

    expect(renderSnippetFromTemplate(snippetTemplate, args)).not.toContain('[label]=');
  });
});
