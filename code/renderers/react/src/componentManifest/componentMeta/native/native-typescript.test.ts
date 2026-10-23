/**
 * The native facade must fulfil every member of the extractor's contract, so a guard the extractor
 * starts using, or one TypeScript renames, fails here instead of silently in an extraction.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import ts from 'typescript';

import { DOCGEN_NODE_GUARDS, createCompilerDocgenTypeScript } from '../docgen-typescript.ts';
import { loadNativeTypeScriptModules } from '../test-helpers.ts';
import { type NativeTypeScriptModules, createNativeDocgenTypeScript } from './native-typescript.ts';

const MEMBERS = [
  ...DOCGEN_NODE_GUARDS,
  'canHaveModifiers',
  'createSourceFile',
  'displayPartsToString',
  'forEachChild',
  'getEmptyObjectType',
  'getModifiers',
] as const;

const ENUMS = {
  JsxEmit: ['ReactJSX'],
  ModuleKind: ['ESNext'],
  ModuleResolutionKind: ['Bundler'],
  ScriptTarget: ['Latest'],
  SymbolFlags: ['Alias', 'Optional', 'Property'],
  SyntaxKind: [
    'AmpersandAmpersandToken',
    'BarBarToken',
    'EqualsToken',
    'ExportKeyword',
    'FalseKeyword',
    'NullKeyword',
    'QuestionQuestionToken',
    'TrueKeyword',
  ],
  TypeFlags: ['Any', 'BooleanLiteral', 'Never', 'Undefined'],
} as const;

let modules: NativeTypeScriptModules;

beforeAll(async () => {
  modules = await loadNativeTypeScriptModules();
});

describe.each([
  ['compiler', () => createCompilerDocgenTypeScript(ts)],
  [
    'native',
    () => {
      const api = new modules.sync.API({ cwd: process.cwd() });
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
