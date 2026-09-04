import { loadCsf } from 'storybook/internal/csf-tools';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { Method, Property } from './compodocTypes.ts';
import type { ParsedCsf } from './resolveAngularComponents.ts';
import {
  extractAngularStorySnippets,
  extractStoryDocsSourceCode,
  extractStoryRenderTemplate,
} from './resolveAngularComponents.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSourceFile(code: string): ts.SourceFile {
  return ts.createSourceFile('story.ts', code, ts.ScriptTarget.Latest, true);
}

function makeParsedCsf(overrides: Record<string, unknown> = {}): ParsedCsf {
  return {
    _code: '',
    _meta: {},
    _stories: {},
    _storyStatements: {},
    _metaStatement: undefined,
    ...overrides,
  } as unknown as ParsedCsf;
}

// ---------------------------------------------------------------------------
// extractStoryRenderTemplate
// ---------------------------------------------------------------------------

describe('extractStoryRenderTemplate', () => {
  it('extracts template from arrow function with parenthesised object', () => {
    const source = makeSourceFile(`
      export const Primary = {
        render: (args) => ({ template: \`<app-button></app-button>\` }),
      };
    `);
    expect(extractStoryRenderTemplate(source, 'Primary')).toBe('<app-button></app-button>');
  });

  it('extracts template from arrow function with block body and return', () => {
    const source = makeSourceFile(`
      export const Primary = {
        render: (args) => {
          return { template: \`<app-button [label]="label"></app-button>\` };
        },
      };
    `);
    expect(extractStoryRenderTemplate(source, 'Primary')).toBe(
      '<app-button [label]="label"></app-button>'
    );
  });

  it('extracts string literal template', () => {
    const source = makeSourceFile(`
      export const WithString = {
        render: (args) => ({ template: '<app-button></app-button>' }),
      };
    `);
    expect(extractStoryRenderTemplate(source, 'WithString')).toBe('<app-button></app-button>');
  });

  it('returns undefined when story has no render function', () => {
    const source = makeSourceFile(`
      export const Primary = { args: { label: 'Click' } };
    `);
    expect(extractStoryRenderTemplate(source, 'Primary')).toBeUndefined();
  });

  it('returns undefined when render has no template property', () => {
    const source = makeSourceFile(`
      export const Primary = {
        render: (args) => ({ component: ButtonComponent }),
      };
    `);
    expect(extractStoryRenderTemplate(source, 'Primary')).toBeUndefined();
  });

  it('returns undefined for unknown story export name', () => {
    const source = makeSourceFile(`
      export const Primary = {
        render: (args) => ({ template: \`<app-button></app-button>\` }),
      };
    `);
    expect(extractStoryRenderTemplate(source, 'Secondary')).toBeUndefined();
  });

  it('handles template with interpolations', () => {
    const source = makeSourceFile(`
      export const Dynamic = {
        render: (args) => ({ template: \`<app-button [label]="\${args.label}"></app-button>\` }),
      };
    `);
    const result = extractStoryRenderTemplate(source, 'Dynamic');
    expect(result).toContain('<app-button');
    expect(result).toContain('args.label');
  });
});

// ---------------------------------------------------------------------------
// extractStoryDocsSourceCode
// ---------------------------------------------------------------------------

describe('extractStoryDocsSourceCode', () => {
  it('extracts parameters.docs.source.code as a template literal', () => {
    const source = makeSourceFile(`
      export const Primary = {
        parameters: {
          docs: { source: { code: \`<app-button></app-button>\` } },
        },
      };
    `);
    expect(extractStoryDocsSourceCode(source, 'Primary')).toBe('<app-button></app-button>');
  });

  it('extracts parameters.docs.source.code as a string literal', () => {
    const source = makeSourceFile(`
      export const Primary = {
        parameters: {
          docs: { source: { code: '<app-button></app-button>' } },
        },
      };
    `);
    expect(extractStoryDocsSourceCode(source, 'Primary')).toBe('<app-button></app-button>');
  });

  it('returns undefined when parameters is missing', () => {
    const source = makeSourceFile(`
      export const Primary = { args: { label: 'Click' } };
    `);
    expect(extractStoryDocsSourceCode(source, 'Primary')).toBeUndefined();
  });

  it('returns undefined when parameters.docs is missing', () => {
    const source = makeSourceFile(`
      export const Primary = { parameters: {} };
    `);
    expect(extractStoryDocsSourceCode(source, 'Primary')).toBeUndefined();
  });

  it('returns undefined when parameters.docs.source.code is missing', () => {
    const source = makeSourceFile(`
      export const Primary = {
        parameters: { docs: { source: {} } },
      };
    `);
    expect(extractStoryDocsSourceCode(source, 'Primary')).toBeUndefined();
  });

  it('returns undefined for unknown story export name', () => {
    const source = makeSourceFile(`
      export const Primary = {
        parameters: { docs: { source: { code: \`<app-button></app-button>\` } } },
      };
    `);
    expect(extractStoryDocsSourceCode(source, 'Secondary')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// extractAngularStorySnippets — snippet generation
// ---------------------------------------------------------------------------

const compodocButton = {
  name: 'ButtonComponent',
  type: 'component' as const,
  selector: 'app-button',
  inputsClass: [
    { name: 'label', type: 'string', optional: true },
    { name: 'disabled', type: 'boolean', optional: true },
    { name: 'count', type: 'number', optional: true },
  ],
  outputsClass: [{ name: 'clicked', type: 'EventEmitter<void>', optional: true }],
  propertiesClass: [] as Property[],
  methodsClass: [] as Method[],
};

describe('extractAngularStorySnippets — element selector', () => {
  it('generates snippet with element selector and no args', () => {
    const csf = makeParsedCsf({
      _code: 'export const Primary = {};',
      _stories: { Primary: { id: 'button--primary', name: 'Primary' } },
      _storyStatements: { Primary: undefined },
    });

    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toBe('<app-button></app-button>');
  });

  it('renders string args as plain attributes', () => {
    const csf = makeParsedCsf({
      _code: "export const WithLabel = { args: { label: 'Click me' } };",
      _stories: {
        WithLabel: {
          id: 'button--with-label',
          name: 'With Label',
          args: { label: 'Click me' },
        },
      },
      _storyStatements: { WithLabel: undefined },
    });

    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toContain('label="Click me"');
  });

  it('renders boolean true as bare attribute', () => {
    const csf = makeParsedCsf({
      _code: 'export const Disabled = { args: { disabled: true } };',
      _stories: {
        Disabled: {
          id: 'button--disabled',
          name: 'Disabled',
          args: { disabled: true },
        },
      },
      _storyStatements: { Disabled: undefined },
    });

    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toContain(' disabled');
    expect(entry?.snippet).not.toContain('[disabled]');
  });

  it('renders boolean false as property binding', () => {
    const csf = makeParsedCsf({
      _code: 'export const Enabled = { args: { disabled: false } };',
      _stories: {
        Enabled: {
          id: 'button--enabled',
          name: 'Enabled',
          args: { disabled: false },
        },
      },
      _storyStatements: { Enabled: undefined },
    });

    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toContain('[disabled]="false"');
  });

  it('renders number args as property bindings', () => {
    const csf = makeParsedCsf({
      _code: 'export const WithCount = { args: { count: 42 } };',
      _stories: {
        WithCount: {
          id: 'button--with-count',
          name: 'With Count',
          args: { count: 42 },
        },
      },
      _storyStatements: { WithCount: undefined },
    });

    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toContain('[count]="42"');
  });

  it('renders outputs as event bindings', () => {
    const csf = makeParsedCsf({
      _code: 'export const WithClick = { args: { clicked: () => {} } };',
      _stories: {
        WithClick: {
          id: 'button--with-click',
          name: 'With Click',
          args: { clicked: () => {} },
        },
      },
      _storyStatements: { WithClick: undefined },
    });

    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toContain('(clicked)="handleEvent($event)"');
  });

  it('ignores args not in inputs or outputs', () => {
    const csf = makeParsedCsf({
      _code: "export const Primary = { args: { unknown: 'value' } };",
      _stories: {
        Primary: {
          id: 'button--primary',
          name: 'Primary',
          args: { unknown: 'value' },
        },
      },
      _storyStatements: { Primary: undefined },
    });

    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toBe('<app-button></app-button>');
  });
});

describe('extractAngularStorySnippets — required signal inputs', () => {
  const compodocRequired = {
    ...compodocButton,
    inputsClass: [
      { name: 'label', type: 'string', optional: false, required: true },
      { name: 'count', type: 'number', optional: true },
    ],
    outputsClass: [] as Property[],
  };

  it('adds placeholder for required inputs with no provided arg', () => {
    const csf = makeParsedCsf({
      _code: 'export const Primary = {};',
      _stories: { Primary: { id: 'button--primary', name: 'Primary' } },
      _storyStatements: { Primary: undefined },
    });

    const [entry] = extractAngularStorySnippets(csf, compodocRequired, 'ButtonComponent');
    expect(entry?.snippet).toContain('[label]="/* required */"');
  });

  it('does not add placeholder when required input has arg value', () => {
    const csf = makeParsedCsf({
      _code: "export const Primary = { args: { label: 'Click' } };",
      _stories: {
        Primary: {
          id: 'button--primary',
          name: 'Primary',
          args: { label: 'Click' },
        },
      },
      _storyStatements: { Primary: undefined },
    });

    const [entry] = extractAngularStorySnippets(csf, compodocRequired, 'ButtonComponent');
    expect(entry?.snippet).not.toContain('/* required */');
    expect(entry?.snippet).toContain('label="Click"');
  });
});

describe('extractAngularStorySnippets — attribute-only selector', () => {
  const compodocAttrDir = {
    name: 'LibBtnDirective',
    type: 'directive' as const,
    selector: '[lib-btn]',
    inputsClass: [{ name: 'color', type: 'string', optional: true }],
    outputsClass: [] as Property[],
    propertiesClass: [] as Property[],
    methodsClass: [] as Method[],
  };

  it('uses div as fallback host for attribute-only selector', () => {
    const csf = makeParsedCsf({
      _code: 'export const Primary = {};',
      _stories: { Primary: { id: 'dir--primary', name: 'Primary' } },
      _storyStatements: { Primary: undefined },
    });

    const [entry] = extractAngularStorySnippets(csf, compodocAttrDir, 'LibBtnDirective');
    expect(entry?.snippet).toBe('<div lib-btn></div>');
  });
});

describe('extractAngularStorySnippets — compound selector (multiple variants)', () => {
  const compodocMulti = {
    name: 'LibBtnDirective',
    type: 'directive' as const,
    selector: 'button[lib-btn], a[lib-btn]',
    inputsClass: [] as Property[],
    outputsClass: [] as Property[],
    propertiesClass: [] as Property[],
    methodsClass: [] as Method[],
  };

  it('uses the first selector variant as the snippet', () => {
    const csf = makeParsedCsf({
      _code: 'export const Primary = {};',
      _stories: { Primary: { id: 'dir--primary', name: 'Primary' } },
      _storyStatements: { Primary: undefined },
    });

    const [entry] = extractAngularStorySnippets(csf, compodocMulti, 'LibBtnDirective');
    expect(entry?.snippet).toBe('<button lib-btn></button>');
  });

  it('still uses the first selector variant when the story has its own render template', () => {
    const compodocMultiWithInput = {
      ...compodocMulti,
      inputsClass: [{ name: 'variant', type: 'string', optional: true }],
    };
    const csf = makeParsedCsf({
      _code: `
				export const AsLink = {
					args: { variant: "secondary" },
					render: (args) => ({ template: \`<a lib-btn></a>\` }),
				};
			`,
      _stories: { AsLink: { id: 'dir--as-link', name: 'As Link' } },
      _storyStatements: { AsLink: undefined },
    });

    const [entry] = extractAngularStorySnippets(csf, compodocMultiWithInput, 'LibBtnDirective');
    // No root-tag detection: the first variant is used regardless of the render
    // template's own root tag, and the binding is still generated from args.
    expect(entry?.snippet).toBe('<button lib-btn variant="secondary"></button>');
  });
});

describe('extractAngularStorySnippets — void elements', () => {
  const compodocInput = {
    name: 'InputDirective',
    type: 'directive' as const,
    selector: 'input[lib-input]',
    inputsClass: [{ name: 'placeholder', type: 'string', optional: true }],
    outputsClass: [] as Property[],
    propertiesClass: [] as Property[],
    methodsClass: [] as Method[],
  };

  it('renders void elements as self-closing', () => {
    const csf = makeParsedCsf({
      _code: "export const Primary = { args: { placeholder: 'Type here' } };",
      _stories: {
        Primary: {
          id: 'input--primary',
          name: 'Primary',
          args: { placeholder: 'Type here' },
        },
      },
      _storyStatements: { Primary: undefined },
    });

    const [entry] = extractAngularStorySnippets(csf, compodocInput, 'InputDirective');
    expect(entry?.snippet).toBe('<input lib-input placeholder="Type here">');
    expect(entry?.snippet).not.toContain('</input>');
  });
});

describe('extractAngularStorySnippets — no selector', () => {
  it('returns undefined snippet when compodoc has no selector', () => {
    const csf = makeParsedCsf({
      _code: 'export const Primary = {};',
      _stories: { Primary: { id: 'btn--primary', name: 'Primary' } },
      _storyStatements: { Primary: undefined },
    });

    const compodocNoSelector = { ...compodocButton, selector: undefined as string | undefined };
    const [entry] = extractAngularStorySnippets(csf, compodocNoSelector, 'ButtonComponent');
    expect(entry?.snippet).toBeUndefined();
  });
});

describe('extractAngularStorySnippets — @useTemplate', () => {
  it('uses render.template as snippet when @useTemplate is present', () => {
    // loadCsf is needed so _storyStatements has real AST nodes with JSDoc attached
    // (required for extractDescription to detect @useTemplate).
    // _code must also contain the render function so extractStoryRenderTemplate can parse it.
    const code = `
export default { title: 'Button', component: 'ButtonComponent' };

/** @useTemplate */
export const WithTemplate = {
  render: (args) => ({ template: \`<app-button label="custom"></app-button>\` }),
};
`;
    const csf = loadCsf(code, { makeTitle: () => 'Button' }).parse();

    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toBe('<app-button label="custom"></app-button>');
  });

  it('uses Compodoc snippet when @useTemplate is absent even with a render function', () => {
    // loadCsf does not evaluate args statically, so we use makeParsedCsf with manual args.
    // This verifies that without @useTemplate the Compodoc path is taken (no render template).
    const csf = makeParsedCsf({
      _code: `
export const WithRender = {
  args: { label: 'Click' },
  render: (args) => ({ template: \`<app-button label="IGNORED"></app-button>\` }),
};`,
      _stories: {
        WithRender: {
          id: 'button--with-render',
          name: 'With Render',
          args: { label: 'Click' },
        },
      },
      _storyStatements: { WithRender: undefined },
    });

    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    // Compodoc snippet uses the args, not the render template
    expect(entry?.snippet).toContain('app-button');
    expect(entry?.snippet).toContain('label="Click"');
    expect(entry?.snippet).not.toContain('IGNORED');
  });

  it('prefers parameters.docs.source.code over render.template when both are present', () => {
    const code = `
export default { title: 'Button', component: 'ButtonComponent' };

/** @useTemplate */
export const WithDocsSource = {
  render: (args) => ({ template: \`<app-button label="IGNORED"></app-button>\` }),
  parameters: {
    docs: {
      source: {
        code: \`<app-button label="from docs"></app-button>\`,
      },
    },
  },
};
`;
    const csf = loadCsf(code, { makeTitle: () => 'Button' }).parse();

    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toBe('<app-button label="from docs"></app-button>');
  });

  it('falls back to render.template when @useTemplate is present but no docs.source.code is set', () => {
    const code = `
export default { title: 'Button', component: 'ButtonComponent' };

/** @useTemplate */
export const WithTemplateOnly = {
  render: (args) => ({ template: \`<app-button label="custom"></app-button>\` }),
};
`;
    const csf = loadCsf(code, { makeTitle: () => 'Button' }).parse();

    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toBe('<app-button label="custom"></app-button>');
  });
});

// ---------------------------------------------------------------------------
// extractAngularStorySnippets — static AST args extraction
// (when loadCsf does not populate _stories[name].args)
// ---------------------------------------------------------------------------

describe('extractAngularStorySnippets — static AST arg extraction', () => {
  function makeCsfWithoutStoredArgs(
    code: string,
    stories: Record<string, { id: string; name: string }>
  ): ParsedCsf {
    return makeParsedCsf({
      _code: code,
      _stories: Object.fromEntries(Object.entries(stories)),
      _storyStatements: Object.fromEntries(
        Object.keys(stories).map((k): [string, undefined] => [k, undefined])
      ),
    });
  }

  it('extracts string arg from AST when _stories has no args', () => {
    const csf = makeCsfWithoutStoredArgs("export const WithLabel = { args: { label: 'Hello' } };", {
      WithLabel: { id: 'btn--with-label', name: 'With Label' },
    });
    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toContain('label="Hello"');
  });

  it('extracts boolean false arg from AST and renders property binding', () => {
    const csf = makeCsfWithoutStoredArgs('export const Enabled = { args: { disabled: false } };', {
      Enabled: { id: 'btn--enabled', name: 'Enabled' },
    });
    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toContain('[disabled]="false"');
  });

  it('extracts boolean true arg from AST and renders bare attribute', () => {
    const csf = makeCsfWithoutStoredArgs('export const Disabled = { args: { disabled: true } };', {
      Disabled: { id: 'btn--disabled', name: 'Disabled' },
    });
    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toContain(' disabled');
    expect(entry?.snippet).not.toContain('[disabled]');
  });

  it('extracts number arg from AST and renders property binding', () => {
    const csf = makeCsfWithoutStoredArgs('export const WithCount = { args: { count: 42 } };', {
      WithCount: { id: 'btn--with-count', name: 'With Count' },
    });
    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toContain('[count]="42"');
  });

  it('renders output binding when arg value is undefined in AST', () => {
    const csf = makeCsfWithoutStoredArgs(
      'export const WithOutput = { args: { clicked: undefined } };',
      { WithOutput: { id: 'btn--with-output', name: 'With Output' } }
    );
    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toContain('(clicked)="handleEvent($event)"');
  });

  it('renders output binding when arg value is a function expression', () => {
    const csf = makeCsfWithoutStoredArgs(
      'export const WithOutput = { args: { clicked: () => {} } };',
      { WithOutput: { id: 'btn--with-output', name: 'With Output' } }
    );
    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toContain('(clicked)="handleEvent($event)"');
  });

  it('skips input binding when arg value is a non-literal expression', () => {
    const csf = makeCsfWithoutStoredArgs(
      'export const Dynamic = { args: { label: someVariable } };',
      { Dynamic: { id: 'btn--dynamic', name: 'Dynamic' } }
    );
    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    // Can't resolve label statically — should not render any label binding
    expect(entry?.snippet).not.toContain('label=');
    expect(entry?.snippet).not.toContain('[label]');
  });

  it('produces no bindings when story has no args property in AST', () => {
    const csf = makeCsfWithoutStoredArgs('export const Primary = {};', {
      Primary: { id: 'btn--primary', name: 'Primary' },
    });
    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toBe('<app-button></app-button>');
  });

  it('extracts multiple args from AST and renders all bindings', () => {
    const csf = makeCsfWithoutStoredArgs(
      "export const Full = { args: { label: 'Click me', disabled: false } };",
      { Full: { id: 'btn--full', name: 'Full' } }
    );
    const [entry] = extractAngularStorySnippets(csf, compodocButton, 'ButtonComponent');
    expect(entry?.snippet).toContain('label="Click me"');
    expect(entry?.snippet).toContain('[disabled]="false"');
  });
});

describe('extractAngularStorySnippets — filterStoryIds', () => {
  it('only returns entries matching the filter set', () => {
    const csf = makeParsedCsf({
      _code: 'export const Primary = {}; export const Secondary = {};',
      _stories: {
        Primary: { id: 'btn--primary', name: 'Primary' },
        Secondary: { id: 'btn--secondary', name: 'Secondary' },
      },
      _storyStatements: {
        Primary: undefined,
        Secondary: undefined,
      },
    });

    const entries = extractAngularStorySnippets(
      csf,
      compodocButton,
      'ButtonComponent',
      new Set(['btn--primary'])
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe('btn--primary');
  });
});
