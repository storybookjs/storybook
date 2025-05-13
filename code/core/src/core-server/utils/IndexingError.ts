import slash from 'slash';

export class IndexingError extends Error {
  importPaths: string[];

  constructor(message: string, importPaths: string[], stack?: string) {
    super();
    this.message = message;
    this.importPaths = importPaths;
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
      this.message = `Unable to index files:\n${this.indexingErrors
        .map((err) => `- ${err}`)
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
