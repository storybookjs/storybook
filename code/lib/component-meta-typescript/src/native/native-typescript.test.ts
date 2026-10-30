import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import ts from 'typescript';

import { DOCGEN_NODE_GUARDS, createCompilerDocgenTypeScript } from '../docgen-typescript.ts';
import { loadNativeTypeScriptModules } from '../test-helpers.ts';
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
  'getJSDocTags',
  'getLineAndCharacterOfPosition',
  'getModifiers',
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
  modules = await loadNativeTypeScriptModules();
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
});
