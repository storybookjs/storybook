import { readFileSync, statSync } from 'node:fs';

import type { ComponentMetaChecker } from 'vue-component-meta';

/**
 * Keeps a long-lived `vue-component-meta` checker in sync with the filesystem
 */
export class CheckerFreshness {
  /**
   *
   * Modification time of the text the checker currently holds, per absolute path.
   */
  private readonly mtimes = new Map<string, number>();

  constructor(private readonly checker: ComponentMetaChecker) {}

  /**
   *  Re-reads every program file whose mtime moved since the checker last saw it.
   */
  sweep(): void {
    const program = this.checker.getProgram();
    if (!program) {
      return;
    }

    for (const sourceFile of program.getSourceFiles()) {
      if (sourceFile.fileName.includes('/node_modules/')) {
        continue;
      }
      this._refresh(sourceFile.fileName);
    }
  }

  private _refresh(fileName: string): void {
    const mtime = mtimeOf(fileName);

    if (mtime === undefined) {
      if (this.mtimes.delete(fileName)) {
        this.checker.deleteFile(fileName);
      }
      return;
    }

    const previous = this.mtimes.get(fileName);
    if (previous === undefined) {
      // First sighting: the checker read this file itself, so its snapshot is already current as of
      // now. Record the mtime so the next real edit registers as a change.
      this.mtimes.set(fileName, mtime);
      return;
    }

    if (previous === mtime) {
      return;
    }

    let text: string;
    try {
      text = readFileSync(fileName, 'utf8');
    } catch {
      // Vanished between the stat and the read; the next sweep deletes it.
      return;
    }
    this.checker.updateFile(fileName, text);
    // Re-stat rather than reusing `mtime`: a write that landed between the two reads would otherwise
    // be recorded as already applied.
    this.mtimes.set(fileName, mtimeOf(fileName) ?? mtime);
  }
}

function mtimeOf(fileName: string): number | undefined {
  try {
    return statSync(fileName).mtimeMs;
  } catch {
    return undefined;
  }
}
