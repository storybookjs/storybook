import { describe, expect, it } from 'vitest';

import ts from 'typescript';

import { extractComponentJsDocInfo, resolveExportedSymbol } from './jsdoc-info.ts';

/**
 * These tests pin TypeScript's JSDoc semantics as the docgen contract (matching IDE hovers):
 *
 * - a bare `@tag` preceded by whitespace starts a tag even mid-sentence, truncating the
 *   description at that point — including inside fenced code blocks;
 * - braced inline tags (`{@link Foo}`) stay in the description or tag value, rendered with
 *   TypeScript's own formatting (a space before the closing brace, `|` captions as spaces);
 * - multi-line tag values keep their newlines.
 */
function extract(docblockBody: string) {
  const src = `/**\n${docblockBody
    .split('\n')
    .map((line) => ` * ${line}`)
    .join('\n')}\n */\nexport const Probe = () => null;\n`;

  const host = ts.createCompilerHost({});
  const readSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion) =>
    name === 'probe.ts'
      ? ts.createSourceFile(name, src, languageVersion, true)
      : readSourceFile(name, languageVersion);

  const program = ts.createProgram(['probe.ts'], { target: ts.ScriptTarget.ESNext }, host);
  const checker = program.getTypeChecker();
  const statement = program.getSourceFile('probe.ts')!.statements[0] as ts.VariableStatement;
  const symbol = checker.getSymbolAtLocation(statement.declarationList.declarations[0].name)!;

  return extractComponentJsDocInfo(ts, checker, symbol);
}

describe('extractComponentJsDocInfo', () => {
  it('extracts a line-leading block tag', () => {
    expect(extract('A button.\n\n@since 8.0')).toMatchInlineSnapshot(`
      {
        "description": "A button.",
        "jsDocTags": {
          "since": [
            "8.0",
          ],
        },
      }
    `);
  });

  it('treats a bare mid-line tag as a block tag, ending the description there', () => {
    expect(extract('Use together with @see ToggleGroup for accessibility.')).toMatchInlineSnapshot(`
        {
          "description": "Use together with",
          "jsDocTags": {
            "see": [
              "ToggleGroup for accessibility.",
            ],
          },
        }
      `);
  });

  it('keeps braced inline tags in the description', () => {
    expect(extract('Works with {@link ToggleGroup} inline.')).toMatchInlineSnapshot(`
      {
        "description": "Works with {@link ToggleGroup } inline.",
        "jsDocTags": {},
      }
    `);
  });

  it('does not treat an email address as a tag', () => {
    expect(extract('Contact dev@example.com for help.')).toMatchInlineSnapshot(`
      {
        "description": "Contact dev@example.com for help.",
        "jsDocTags": {},
      }
    `);
  });

  it('treats a decorator mention as a tag, even inside a fenced code block', () => {
    expect(extract('Usage:\n\n```ts\n@Input() foo: string;\n```')).toMatchInlineSnapshot(`
      {
        "description": "Usage:

      \`\`\`ts",
        "jsDocTags": {
          "Input": [
            "() foo: string;
      \`\`\`",
          ],
        },
      }
    `);
  });

  it('preserves newlines in multi-line tag values', () => {
    expect(extract('A button.\n\n@example\n<Button size="large">\n  Click me\n</Button>'))
      .toMatchInlineSnapshot(`
        {
          "description": "A button.",
          "jsDocTags": {
            "example": [
              "<Button size="large">
          Click me
        </Button>",
            ],
          },
        }
      `);
  });

  it('collects repeated tags in source order', () => {
    expect(extract('A button.\n\n@example <Button />\n@example <Button disabled />'))
      .toMatchInlineSnapshot(`
        {
          "description": "A button.",
          "jsDocTags": {
            "example": [
              "<Button />",
              "<Button disabled />",
            ],
          },
        }
      `);
  });

  it('reports a valueless tag as an empty string', () => {
    expect(extract('A button.\n\n@ignore')).toMatchInlineSnapshot(`
      {
        "description": "A button.",
        "jsDocTags": {
          "ignore": [
            "",
          ],
        },
      }
    `);
  });

  it('renders a {@link url|caption} inside a tag value with the caption separator as a space', () => {
    expect(extract('A button.\n\n@see {@link https://example.com|the docs} for setup.'))
      .toMatchInlineSnapshot(`
        {
          "description": "A button.",
          "jsDocTags": {
            "see": [
              "{@link https://example.com the docs} for setup.",
            ],
          },
        }
      `);
  });

  it('handles a docblock with tags and no description', () => {
    expect(extract('@deprecated Use NewButton.')).toMatchInlineSnapshot(`
      {
        "description": "",
        "jsDocTags": {
          "deprecated": [
            "Use NewButton.",
          ],
        },
      }
    `);
  });
});

describe('resolveExportedSymbol', () => {
  it('resolves a local export by name', () => {
    const sourceText = 'export const Button = () => null;';
    const sourceFile = ts.createSourceFile('button.ts', sourceText, ts.ScriptTarget.ESNext, true);
    const host = ts.createCompilerHost({});
    const readSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (name, languageVersion) =>
      name === 'button.ts' ? sourceFile : readSourceFile(name, languageVersion);

    const program = ts.createProgram(['button.ts'], { target: ts.ScriptTarget.ESNext }, host);
    const checker = program.getTypeChecker();

    expect(resolveExportedSymbol(ts, checker, sourceFile, 'Button')?.getName()).toBe('Button');
  });

  it('follows an aliased re-export to the target symbol', () => {
    const files = {
      '/button.ts': 'export const Button = () => null;',
      '/index.ts': "export { Button as PrimaryButton } from './button';",
    };
    const host = ts.createCompilerHost({});
    const readSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (name, languageVersion) =>
      name in files
        ? ts.createSourceFile(
            name,
            files[name as keyof typeof files],
            languageVersion,
            true,
            ts.ScriptKind.TS
          )
        : readSourceFile(name, languageVersion);
    host.fileExists = (name) => name in files || ts.sys.fileExists(name);
    host.readFile = (name) => files[name as keyof typeof files] ?? ts.sys.readFile(name);
    host.getCurrentDirectory = () => '/';
    host.resolveModuleNames = (moduleNames) =>
      moduleNames.map((name) =>
        name === './button'
          ? { resolvedFileName: '/button.ts', extension: ts.Extension.Ts }
          : undefined
      );

    const program = ts.createProgram(
      ['/button.ts', '/index.ts'],
      {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
      },
      host
    );
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile('/index.ts')!;
    const symbol = resolveExportedSymbol(ts, checker, sourceFile, 'PrimaryButton');

    expect(symbol?.getName()).toBe('Button');
    expect(symbol?.declarations?.[0]?.getSourceFile().fileName).toBe('/button.ts');
  });
});
