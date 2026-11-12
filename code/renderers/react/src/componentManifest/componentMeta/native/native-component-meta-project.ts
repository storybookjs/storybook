import { NativeProject } from '@storybook/component-meta-typescript';

import type { StoryRef } from '../../getComponentImports.ts';
import type { ReactComponentMetaProject } from '../ComponentMetaProject.ts';
import { extractEntries } from '../extract-entries.ts';

export const WARMUP_DELAY_MS = 100;

export class NativeComponentMetaProject extends NativeProject implements ReactComponentMetaProject {
  private warmupTimer?: ReturnType<typeof setTimeout>;
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
    }, WARMUP_DELAY_MS);
    this.warmupTimer?.unref?.();
  }

  override dispose(): void {
    clearTimeout(this.warmupTimer);
    super.dispose();
  }
}
