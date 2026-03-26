export interface AiInitOptions {
  configDir?: string;
  packageManager?: string;
  format?: 'markdown' | 'json';
}

export interface ProjectInfo {
  storybookVersion: string | undefined;
  majorVersion: number | undefined;
  framework: string | null;
  renderer: string | null;
  builder: string | null;
  addons: string[];
  configDir: string;
  storiesPaths: string[];
  hasCsfFactoryPreview: boolean;
}

/**
 * Represents a skill category that can be expanded in the future.
 * Each skill provides a name, description, and instructions for agents.
 */
export interface AiPrompt {
  name: string;
  description: string;
  instructions: string;
}

export interface AiPromptJsonOutput {
  project: ProjectInfo;
  docsUrl: string;
  aiPrompts: AiPrompt[];
}
