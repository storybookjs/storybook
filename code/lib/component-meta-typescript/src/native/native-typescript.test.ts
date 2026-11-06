import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import ts from 'typescript';

import {
  DOCGEN_NODE_GUARDS,
  type DocgenTypeScript,
  createCompilerDocgenTypeScript,
} from '../docgen-typescript.ts';
import { loadTestNativeTypeScriptModules } from '../testing.ts';
import { type NativeTypeScriptModules, createNativeDocgenTypeScript } from './native-typescript.ts';

const MEMBERS = [
  ...DOCGEN_NODE_GUARDS,
  'canHaveDecorators',
  'canHaveModifiers',
  'createPrinter',
  'createSourceFile',
  'displayPartsToString',
  'forEachChild',
  'getDecorators',
  'getEmptyObjectType',
  'getJSDocCommentsAndTags',
  'getJSDocStart',
  'getJSDocTagCommentStart',
  'getJSDocTags',
  'getLineAndCharacterOfPosition',
  'getModifiers',
  'getSeeTagReference',
  'getTypeParameterDefault',
  'hasQuestionToken',
  'transform',
  'visitEachChild',
  'visitNode',
] as const;

const ENUMS = {
  EmitHint: ['Unspecified'],
  JsxEmit: ['ReactJSX'],
  ModuleKind: ['ESNext'],
  ModuleResolutionKind: ['Bundler'],
  ObjectFlags: ['Reference'],
  ScriptTarget: ['Latest'],
  SymbolFlags: ['Alias', 'All', 'EnumMember', 'Optional', 'Property'],
  SyntaxKind: [
    'AmpersandAmpersandToken',
    'AnyKeyword',
    'BarBarToken',
    'DeclareKeyword',
    'DefaultKeyword',
    'EqualsToken',
    'ExportKeyword',
    'ExtendsKeyword',
    'FalseKeyword',
    'KeyOfKeyword',
    'MinusToken',
    'NullKeyword',
    'PlusToken',
    'PrivateKeyword',
    'ProtectedKeyword',
    'PublicKeyword',
    'QuestionQuestionToken',
    'QuestionToken',
    'ReadonlyKeyword',
    'StaticKeyword',
    'TrueKeyword',
    'UndefinedKeyword',
    'UnknownKeyword',
  ],
  TypeFlags: [
    'Any',
    'BooleanLiteral',
    'EnumLiteral',
    'Never',
    'Null',
    'NumberLiteral',
    'Object',
    'StringLiteral',
    'TypeParameter',
    'Undefined',
    'Unknown',
  ],
  TypeFormatFlags: ['InTypeAlias', 'NoTruncation'],
} as const;

let modules: NativeTypeScriptModules;
const apis: InstanceType<NativeTypeScriptModules['sync']['API']>[] = [];

beforeAll(async () => {
  modules = await loadTestNativeTypeScriptModules();
});

afterEach(() => {
  for (const api of apis.splice(0)) {
    api.close();
  }
});

describe.each([
  ['compiler', () => createCompilerDocgenTypeScript(ts)],
  [
    'native',
    () => {
      const api = new modules.sync.API({ cwd: process.cwd() });
      apis.push(api);
      return createNativeDocgenTypeScript(modules, api);
    },
  ],
])('the %s facade', (_api, create) => {
  it('implements every function of the contract', () => {
    const typescript = create();
    for (const member of MEMBERS) {
      expect(typeof typescript[member], member).toBe('function');
    }
    for (const member of ['fileExists', 'directoryExists', 'readFile'] as const) {
      expect(typeof typescript.sys[member], `sys.${member}`).toBe('function');
    }
    for (const member of ['createLiteralTypeNode', 'createStringLiteral'] as const) {
      expect(typeof typescript.factory[member], `factory.${member}`).toBe('function');
    }
    expect(typeof typescript.sys.useCaseSensitiveFileNames).toBe('boolean');
  });

  // The numbers differ between TypeScript versions; the extractor only compares within one API.
  it('has every enum member of the contract', () => {
    const typescript = create();
    for (const [enumName, members] of Object.entries(ENUMS)) {
      for (const member of members) {
        const value = (typescript[enumName as keyof typeof ENUMS] as Record<string, unknown>)[
          member
        ];
        expect(typeof value, `${enumName}.${member}`).toBe('number');
      }
    }
  });

  describe('the node accessors', () => {
    const source = [
      '// A line comment.',
      '/* A block comment. */',
      '/**',
      ' * A box.',
      ' * @see Button',
      ' * @param value The value.',
      ' */',
      'export class Box<T = string> {',
      '  optional?: string;',
      '  definite!: string;',
      '  required: string;',
      '}',
      'interface Shape {',
      '  size?: number;',
      '}',
    ].join('\n');

    let typescript: DocgenTypeScript;
    let box: ts.ClassDeclaration;
    let shape: ts.InterfaceDeclaration;

    beforeEach(() => {
      typescript = create();
      const sourceFile = typescript.createSourceFile('/box.ts', source);
      typescript.forEachChild(sourceFile, (statement) => {
        if (typescript.isClassDeclaration(statement)) {
          box = statement;
        } else if (typescript.isInterfaceDeclaration(statement)) {
          shape = statement;
        }
      });
    });

    const jsDoc = () => typescript.getJSDocCommentsAndTags(box)[0] as ts.JSDoc;
    const tag = (name: string) => jsDoc().tags!.find((tag) => tag.tagName.text === name)!;

    it('reads the default of a type parameter', () => {
      expect(typescript.getTypeParameterDefault(box.typeParameters![0])?.getText()).toBe('string');
    });

    it('tells an optional member from a definite or required one', () => {
      const optional = Object.fromEntries(
        [...box.members, ...shape.members].map((member) => [
          member.name!.getText(),
          typescript.hasQuestionToken(member),
        ])
      );
      expect(optional).toEqual({ optional: true, definite: false, required: false, size: true });
    });

    it('reads what a @see tag refers to', () => {
      const see = tag('see');
      expect(typescript.isJSDocSeeTag(see)).toBe(true);
      expect(typescript.getSeeTagReference(see as ts.JSDocSeeTag)?.getText()).toBe('Button');
    });

    it('finds the opening of a JSDoc comment after the comments before it', () => {
      expect(typescript.getJSDocStart(jsDoc())).toBe(source.indexOf('/**'));
    });

    it("finds a tag's comment text after the tag's own parts", () => {
      const param = tag('param');
      expect(source.slice(typescript.getJSDocTagCommentStart(param), param.end)).toMatch(
        /^\s*The value\./
      );
    });
  });
});
