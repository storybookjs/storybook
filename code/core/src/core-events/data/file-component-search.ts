export interface FileComponentSearchRequestPayload {}

export interface FileComponentSearchResponsePayload {
  files: Array<{
    // The filepath relative to the project root
    filepath: string;
    // Whether a corresponding story file exists
    storyFileExists: boolean;
    // A list of exported components
    exportedComponents: Array<{
      // the name of the exported component
      name: string;
      // True, if the exported component is a default export
      default: boolean;
    }> | null;
  }> | null;
}
