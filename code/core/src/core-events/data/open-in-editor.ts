export type OpenInEditorRequestPayload = { file: string; line?: number; column?: number };

export type OpenInEditorResponsePayload = {
  file: string;
  line?: number;
  column?: number;
  error: string | null;
};
