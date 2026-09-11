import { stringifySection } from './stringifier.ts';
import type {
  CompileCsfModuleArgs,
  CompileStorybookSectionArgs,
  StorybookSection,
} from './types.ts';

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
