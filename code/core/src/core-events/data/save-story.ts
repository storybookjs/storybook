export interface SaveStoryRequestPayload {
  args: string | undefined;
  csfId: string;
  importPath: string;
  name?: string;
  tags?: string[];
}

export interface SaveStoryResponsePayload {
  csfId: string;
  newStoryId?: string;
  newStoryName?: string;
  newStoryExportName?: string;
  sourceFileContent?: string;
  sourceFileName?: string;
  sourceStoryName?: string;
  sourceStoryExportName?: string;
}
