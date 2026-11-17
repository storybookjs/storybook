// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';

type StorybookErrorSummary = { code: string; messageWithoutPath: string };

export class IndexingError extends Error {
  importPaths: string[];

  // Set when a `StorybookError` failed the file. Files with the same code and message are listed together.
  storybookError?: StorybookErrorSummary;

  constructor(
    message: string,
    importPaths: string[],
    stack?: string,
    storybookError?: StorybookErrorSummary
  ) {
    super();
    this.message = message;
    this.importPaths = importPaths;
    this.storybookError = storybookError;
    if (stack) {
      this.stack = stack;
    }
  }

  pathsString() {
    if (this.importPaths.length === 1) {
      return `${slash(this.importPaths[0])}`;
    }

    return `${this.importPaths.map(slash).join(',')}`;
  }

  toString() {
    return `${this.pathsString()}: ${this.message}`;
  }
}

export class MultipleIndexingError extends Error {
  constructor(public indexingErrors: IndexingError[]) {
    super();

    if (this.indexingErrors.length === 0) {
      throw new Error('Unexpected empty error list');
    }

    if (this.indexingErrors.length === 1) {
      const [err] = this.indexingErrors;
      this.message = `Unable to index ${err.pathsString()}`;
    } else {
      this.message = `Unable to index files:\n${groupBySameStorybookError(this.indexingErrors)
        .flatMap(([first, ...rest]) => [
          `- ${first}`,
          ...rest.map(
            (err) => `- ${err.pathsString()}: the same error as above (${err.storybookError?.code})`
          ),
        ])
        .join('\n')}`;
    }
  }

  toString() {
    if (this.indexingErrors.length === 1) {
      return `${this.message}:\n  ${this.indexingErrors[0].stack}`;
    }

    return this.message;
  }
}

// Each error without a `storybookError` is a group of its own
function groupBySameStorybookError(errors: IndexingError[]) {
  const groups = new Map<string | IndexingError, IndexingError[]>();
  for (const err of errors) {
    const key = err.storybookError
      ? `${err.storybookError.code}\n${err.storybookError.messageWithoutPath}`
      : err;
    const group = groups.get(key);
    if (group) {
      group.push(err);
    } else {
      groups.set(key, [err]);
    }
  }
  return [...groups.values()];
}
