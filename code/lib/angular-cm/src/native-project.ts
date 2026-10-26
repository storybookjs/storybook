import { slash } from 'storybook/internal/common';

import { NativeProject } from '@storybook/component-meta-typescript';

import {
  type ComponentNames,
  debugExtraction,
  extractComponent,
  importClosure,
} from './extract-component.ts';
import type { AngularComponentMetaResult } from './types.ts';

/** Angular's component-meta project on the native API of TypeScript 7.1 and newer. */
export class NativeAngularComponentMetaProject extends NativeProject {
  extract(componentPath: string, names: ComponentNames): AngularComponentMetaResult | undefined {
    if (this.disposed) {
      return undefined;
    }
    const fileName = slash(componentPath);
    this.ensureFiles([fileName]);
    this.ensureFresh([fileName]);

    let sourceFile = this.getSourceFile(fileName);
    if (!sourceFile) {
      this.debug(`${fileName} is in no TypeScript program, so nothing was extracted from it`);
      return undefined;
    }
    // Sweeping every file the program has instead costs one stat per project file per component.
    if (this.ensureFresh(importClosure(this.typescript, this.getChecker(), sourceFile))) {
      sourceFile = this.getSourceFile(fileName);
      if (!sourceFile) {
        this.debug(`${fileName} left the program while being refreshed`);
        return undefined;
      }
    }
    return extractComponent(this.typescript, this.getChecker(), sourceFile, names, (message) =>
      this.debug(message)
    );
  }

  private debug(message: string): void {
    debugExtraction(this.configFileName, message);
  }
}
