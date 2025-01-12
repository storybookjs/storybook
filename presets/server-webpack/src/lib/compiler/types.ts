export interface CompileStorybookStoryArgs {
  name: string;
  [x: string]: any;
}

export interface CompileStorybookSectionArgs {
  title: string;
  stories: CompileStorybookStoryArgs[];
  [x: string]: any;
}

export interface CompileCsfModuleArgs extends CompileStorybookSectionArgs {
  addons?: string[];
}

export interface StorybookStory {
  name: string;
  decorators?: string[];
  [x: string]: any;
}

export interface StorybookSection {
  imports: Record<string, string[]>;
  decorators?: string[];
  title: string;
  stories: StorybookStory[];
  [x: string]: any;
}
