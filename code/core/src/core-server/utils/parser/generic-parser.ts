import { parseSync } from 'oxc-parser';

import type { Parser, ParserResult } from './types.ts';

/** A generic parser that can parse both ES and CJS modules. */
export class GenericParser implements Parser {
  /**
   * Parse the content of a file and return the exports
   *
   * @param content The content of the file
   * @returns The exports of the file
   */
  async parse(content: string): Promise<ParserResult> {
    // `.tsx` with unambiguous source type is the most permissive grammar, so any module parses.
    const { program, errors } = parseSync('file.tsx', content, { sourceType: 'unambiguous' });
    if (errors.some((error) => error.severity === 'Error')) {
      throw new SyntaxError(errors[0].message);
    }

    const exports: ParserResult['exports'] = [];

    for (const node of program.body) {
      if (node.type === 'ExportNamedDeclaration') {
        const { declaration } = node;
        // Handles function and class declarations: `export function a() {}`, `export class A {}`
        if (
          (declaration?.type === 'FunctionDeclaration' ||
            declaration?.type === 'ClassDeclaration') &&
          declaration.id
        ) {
          exports.push({ name: declaration.id.name, default: false });
        }
        // Handles export specifiers: `export { a }`
        if (declaration === null) {
          for (const specifier of node.specifiers) {
            if (specifier.exported.type === 'Identifier') {
              exports.push({ name: specifier.exported.name, default: false });
            }
          }
        }
        // Handle variable declarators: `export const a = 1;`
        if (declaration?.type === 'VariableDeclaration') {
          for (const declarator of declaration.declarations) {
            if (declarator.id.type === 'Identifier') {
              exports.push({ name: declarator.id.name, default: false });
            }
          }
        }
      } else if (node.type === 'ExportDefaultDeclaration') {
        exports.push({ name: 'default', default: true });
      }
    }

    return { exports };
  }
}
