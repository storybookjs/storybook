export class ManagerDocsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManagerDocsError';
  }
}

export class ManagerDocsParseError extends Error {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly construct: string;
  readonly reason: string;

  constructor(file: string, line: number, column: number, construct: string, message: string) {
    super(`${file}:${line}:${column}: ${message}`);
    this.name = 'ManagerDocsParseError';
    this.file = file;
    this.line = line;
    this.column = column;
    this.construct = construct;
    this.reason = message;
  }
}

export function parseFailure(
  file: string,
  line: number,
  column: number,
  construct: string,
  message: string
): never {
  throw new ManagerDocsParseError(file, line, column, construct, message);
}
