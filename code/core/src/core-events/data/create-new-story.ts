export interface CreateNewStoryRequestPayload {
  // The filepath of the component for which the Story should be generated for (relative to the project root)
  componentFilePath: string;
  // The name of the exported component
  componentExportName: string;
  // is default export
  componentIsDefaultExport: boolean;
  // The amount of exports in the file
  componentExportCount: number;
  // Custom tags to add to the story file
  tags?: string[];
}

export interface CreateNewStoryResponsePayload {
  // Whether the story file already contains args from docgen extraction
  alreadyContainsArgs: boolean;
  // The story id
  storyId: string;
  // The story file path relative to the cwd
  storyFilePath: string;
  // The name of the story export in the file
  exportedStoryName: string;
}

export type CreateNewStoryErrorPayload = {
  type: 'STORY_FILE_EXISTS';
  kind: string;
};
