/**
 * Story extracted from static analysis.
 */
export interface StoryDef {
  name: string;
  template: boolean;
  source: string;
  description?: string;
  hasArgs: boolean;
  tags: string[];
}

/**
 * Meta extracted from static analysis.
 */
export interface MetaDef {
  title?: string;
  id?: string;
  tags?: string[];
  description?: string;
}

/**
 * Informations extracted from static analysis.
 */
export interface StoriesDef {
  meta: MetaDef;
  stories: Record<string, StoryDef>;
  /**
   * All allocated ids in the svelte script section.
   */
  allocatedIds: string[];
}

/**
 * Story extracted from executing the Stories component.
 */
export interface Story {
  id: string;
  name: string;
  template: string;
  component: any;
  isTemplate: boolean;
  source: boolean;
  play?: (playStoryContext:object)=>any;
}

/**
 * Meta extracted from executing the Stories component.
 */
export interface Meta {
  name: string;
  component: any;
  parameters: any;
}
