/**
 * Shared types for the devtools spike — the contract between the injected
 * client (capture) and the node side (serialize + story write). Shapes follow
 * the Stage 0+1 spike spec code samples exactly.
 */

export interface SourceLocation {
  file: string; // workspace-relative path when resolvable
  line: number;
  column: number;
  regime: 'debugSource' | 'componentStack'; // which React path resolved it
}

export interface CapturedProp {
  name: string;
  kind: 'primitive' | 'array' | 'object' | 'function' | 'class-instance' | 'symbol' | 'unknown';
  value?: unknown; // present only when serializable
  preview?: string; // display fallback, e.g. "ƒ onToggle"
}

export interface CapturePayload {
  componentName: string; // displayName ?? function name
  source: SourceLocation | null; // null renders as "source unknown", never fabricated
  props: CapturedProp[];
  reactVersion: string; // regime provenance
  capturedAt: number;
}

export interface FlaggedProp {
  name: string;
  reason: 'function' | 'class-instance' | 'symbol' | 'unknown';
  guidance: string; // shown in the panel's flagged list and as an argType description
}

/**
 * Minimal argType definition for flagged props. Guidance is always present —
 * the visible-degradation rule forbids a silent argType. Control mirrors the
 * relevant slice of Storybook's `Control` union (core/src/csf/story.ts): a
 * named control type, or `false` to disable the control.
 */
export interface ArgTypeDef {
  control?: { type: string } | false;
  description: string;
}

export interface StoryGenerationResult {
  storyName: string; // 'Primary' or the next free variant name
  args: Record<string, unknown>; // serializable props only
  argTypes: Record<string, ArgTypeDef>; // control types for flagged props
  flagged: FlaggedProp[]; // surfaced in the panel, never silent
}

/**
 * Response contract of POST /__sb-devtools/capture. Failures are explicit —
 * the panel renders the message (and the attempted path, when known) rather
 * than failing silently.
 */
export type CaptureErrorKind =
  | 'invalid_payload'
  | 'source_unknown'
  | 'component_not_found'
  | 'write_failed';

export interface CaptureFailureResponse {
  error: CaptureErrorKind;
  message: string;
  filePath?: string; // the story file the failure is about, when known
}

export interface CaptureSuccessResponse {
  storyId: string; // toId(title, storyName) — the embed navigates ?id=<storyId>
  storyName: string;
  filePath: string; // where the story was written (cwd-relative for display)
  flagged: FlaggedProp[];
}

export type CaptureResponse = CaptureSuccessResponse | CaptureFailureResponse;
