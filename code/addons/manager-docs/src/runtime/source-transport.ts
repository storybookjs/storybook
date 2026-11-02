import type { ManagerDocsParseError } from '../errors.ts';

export const MDX_SOURCE_CHANGED = 'experimental-manager-docs/mdx-source-changed';

export type MdxSourceError = {
  file: string;
  line: number;
  column: number;
  construct: string;
  message: string;
};

export type MdxSourceChange =
  | { importPath: string; revision: number; source: string }
  | { importPath: string; revision: number; error: MdxSourceError };

export function mdxSourceError(error: ManagerDocsParseError): MdxSourceError {
  return {
    file: error.file,
    line: error.line,
    column: error.column,
    construct: error.construct,
    message: error.reason,
  };
}
