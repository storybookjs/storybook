import type { SupportedRenderer } from 'storybook/internal/types';

export interface AiPrepareOptions {
  configDir?: string;
  packageManager?: string;
  output?: string;
  frontmatter?: boolean;
}

/**
 * Flat object mapping trait names to version strings.
 * Each trait corresponds to a conditional branch in prompt generation.
 * Active traits have a version like 'v1', 'factory-v1', etc.
 * Add new traits here as prompt.ts gains new conditional sections.
 */
export interface AiPrepareTraits {
  /** CSF syntax variant: 'factory-v1' when hasCsfFactoryPreview, else 'csf3-v1' */
  csfSyntax: string;
  /** Overall setup instructions baseline version */
  setupGenericV1: string;
  /** Extensible: add more traits as prompt.ts evolves */
  [key: string]: string;
}

export interface ProjectInfo {
  storybookVersion: string | undefined;
  majorVersion: number | undefined;
  framework: string | null;
  /** The full renderer package name, e.g. "@storybook/react" */
  rendererPackage: string | null;
  /** The short renderer name for docs URLs, e.g. "react" */
  renderer?: SupportedRenderer;
  builderPackage: string | null;
  addons: string[];
  configDir: string;
  storiesPaths: string[];
  hasCsfFactoryPreview: boolean;
  /** Whether the project uses TypeScript ('ts') or JavaScript ('js'), inferred from the main config file extension. */
  language: 'ts' | 'js';
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
