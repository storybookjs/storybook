import { stringifySection } from './stringifier';
import type { CompileCsfModuleArgs, CompileStorybookSectionArgs, StorybookSection } from './types';

function createSection(args: CompileStorybookSectionArgs): StorybookSection {
  return {
    imports: {},
    decorators: [],
    ...args,
  };
}

export function compileCsfModule(args: CompileCsfModuleArgs): string {
  return stringifySection(createSection(args));
}
