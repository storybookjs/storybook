import { NativeProject } from '@storybook/component-meta-typescript';

import type { StoryRef } from '../../getComponentImports.ts';
import type { ReactComponentMetaProject } from '../ComponentMetaProject.ts';
import { extractEntries } from '../extract-entries.ts';

/** React's component-meta project on the native API, with the extraction shared in `extract-entries.ts`. */
export class NativeComponentMetaProject extends NativeProject implements ReactComponentMetaProject {
  private warmupTimer?: ReturnType<typeof setTimeout>;
  // Replayed after a file change, so the next request finds its types resolved.
  private entries: StoryRef[] = [];

  extractPropsFromStories(entries: StoryRef[]): void {
    if (this.disposed) {
      return;
    }
    this.entries = entries;
    const allFiles = entries.flatMap((entry) =>
      entry.component?.path ? [entry.storyPath, entry.component.path] : [entry.storyPath]
    );
    this.ensureFiles(allFiles);
    this.ensureFresh(allFiles);

    try {
      extractEntries(
        {
          typescript: this.typescript,
          checker: this.getChecker(),
          program: { getSourceFile: (fileName) => this.getSourceFile(fileName) },
          resolveModule: (importId, fromFile) => this.resolveModule(importId, fromFile),
        },
        entries
      );
    } finally {
      this.typescript.releaseSourceFiles();
    }
  }

  protected override afterFilesChanged(): void {
    if (this.entries.length === 0) {
      return;
    }
    clearTimeout(this.warmupTimer);
    this.warmupTimer = setTimeout(() => {
      try {
        this.extractPropsFromStories(this.entries);
      } catch {
        // Warmup failure is non-fatal - extraction will still work on demand.
      }
    }, 100);
    this.warmupTimer?.unref?.();
  }

  override dispose(): void {
    clearTimeout(this.warmupTimer);
    super.dispose();
  }
}
