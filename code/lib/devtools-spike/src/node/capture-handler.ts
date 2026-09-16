/**
 * Node-side capture flow: payload validation, the source-file → story-file
 * mapping, and the serialize → write orchestration. Pure node logic — the
 * HTTP layer (routing, body reading, responding) stays in vite-plugin.ts.
 */

import { existsSync } from 'node:fs';
import { dirname, isAbsolute, posix, relative, resolve, sep } from 'node:path';

import { toId } from 'storybook/internal/csf';
import { readCsf } from 'storybook/internal/csf-tools';

import { serializeCapture } from '../serialize/serialize-capture.ts';
import {
  appendVariant,
  writeStoryFile,
  type ComponentImport,
} from '../story-writer/write-story.ts';
import type { CaptureFailureResponse, CapturePayload, CaptureSuccessResponse, StoryGenerationResult } from '../types.ts';

/**
 * Request-level failure carrying the panel-facing error kind. The middleware
 * maps this onto the CaptureFailureResponse contract (write failures → 500,
 * everything else → 400).
 */
export class CaptureRequestError extends Error {
  constructor(
    readonly kind: CaptureFailureResponse['error'],
    message: string,
    readonly filePath?: string
  ) {
    super(message);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isCapturePayload = (value: unknown): value is CapturePayload => {
  if (!isRecord(value)) {
    return false;
  }
  // Component names become story file names, so path separators are rejected
  // outright rather than sanitized into something the user did not ask for.
  return (
    typeof value.componentName === 'string' &&
    value.componentName.length > 0 &&
    !/[\\/]/.test(value.componentName) &&
    (value.source === null || isRecord(value.source)) &&
    Array.isArray(value.props) &&
    value.props.every((prop) => isRecord(prop) && typeof prop.name === 'string') &&
    typeof value.reactVersion === 'string' &&
    typeof value.capturedAt === 'number'
  );
};

/** Boundary parse of the POST body — malformed requests never reach the writer. */
export function parseCaptureBody(text: string): CapturePayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CaptureRequestError('invalid_payload', 'Request body is not valid JSON');
  }
  if (!isCapturePayload(parsed)) {
    throw new CaptureRequestError('invalid_payload', 'Request body is not a valid CapturePayload');
  }
  return parsed;
}

export interface PathRoots {
  /** The workspace root — the client's `relativizeWorkspacePath` output. */
  workspaceRoot: string;
  /** The repo's `code/` directory. */
  codeRoot: string;
  /** The dev server's working directory (the demo app root). */
  cwd: string;
}

/**
 * Locate the component file on disk. Source locations arrive absolute,
 * demo-cwd relative, workspace-root relative, or code-root-relative; the
 * first existing candidate wins, else null — never a guess.
 */
export function resolveComponentFile(
  sourceFile: string,
  roots: PathRoots,
  fileExists: (path: string) => boolean = existsSync
): string | null {
  const candidates = isAbsolute(sourceFile)
    ? [sourceFile]
    : [
        resolve(roots.cwd, sourceFile),
        resolve(roots.workspaceRoot, sourceFile),
        resolve(roots.codeRoot, sourceFile),
      ];
  return candidates.find((candidate) => fileExists(candidate)) ?? null;
}

/** Stories are written next to the component, named after it. */
export function storyPathFor(componentFile: string, componentName: string): string {
  return resolve(dirname(componentFile), `${componentName}.stories.ts`);
}

/** Import specifier of the component as written from the story file's directory. */
export function componentImportFor(
  storyPath: string,
  componentFile: string,
  componentName: string
): ComponentImport {
  const relativePath = relative(dirname(storyPath), componentFile).split(sep).join(posix.sep);
  return {
    componentName,
    importPath: relativePath.startsWith('.') ? relativePath : `./${relativePath}`,
  };
}

interface ExistingStories {
  exists: boolean;
  storyNames: string[];
  title?: string;
}

/**
 * Reads the existing story file (if any) so serialization can pick the next
 * free variant name and the response can compute the real story id.
 */
export async function readExistingStories(storyPath: string): Promise<ExistingStories> {
  if (!existsSync(storyPath)) {
    return { exists: false, storyNames: [] };
  }
  const csf = await readCsf(storyPath, {
    makeTitle: (userTitle) => userTitle || 'devtools-spike',
  });
  const parsed = csf.parse();
  return {
    exists: true,
    storyNames: Object.keys(parsed._storyExports),
    title: parsed._meta?.title,
  };
}

export interface CaptureHandlerOptions {
  storiesGlob: string;
  roots: PathRoots;
}

/**
 * The full capture flow: parse → locate component → serialize → write →
 * describe the response. Throws CaptureRequestError with the panel-facing
 * kind; write failures carry the attempted story file path.
 */
export async function handleCapture(
  text: string,
  options: CaptureHandlerOptions
): Promise<CaptureSuccessResponse> {
  const payload = parseCaptureBody(text);
  if (!payload.source) {
    throw new CaptureRequestError(
      'source_unknown',
      'The component source could not be resolved, so there is nowhere to write the story. Hover the component again (its source row shows in the panel) and retry.'
    );
  }
  const componentFile = resolveComponentFile(payload.source.file, options.roots);
  if (!componentFile) {
    throw new CaptureRequestError(
      'component_not_found',
      `The component file "${payload.source.file}" could not be located on disk.`,
      payload.source.file
    );
  }
  const storyPath = storyPathFor(componentFile, payload.componentName);
  const componentImport = componentImportFor(storyPath, componentFile, payload.componentName);

  let existing: ExistingStories;
  let generation: StoryGenerationResult;
  try {
    existing = await readExistingStories(storyPath);
    generation = serializeCapture(payload, { existingStoryNames: existing.storyNames });
    if (existing.exists) {
      await appendVariant(storyPath, generation, {
        storiesGlob: options.storiesGlob,
        component: componentImport,
      });
    } else {
      await writeStoryFile(storyPath, generation, {
        storiesGlob: options.storiesGlob,
        title: payload.componentName,
        component: componentImport,
      });
    }
  } catch (error) {
    throw new CaptureRequestError(
      'write_failed',
      error instanceof Error ? error.message : String(error),
      storyPath
    );
  }

  return {
    storyId: toId(existing.title ?? payload.componentName, generation.storyName),
    storyName: generation.storyName,
    filePath: relative(options.roots.cwd, storyPath).split(sep).join(posix.sep),
    flagged: generation.flagged,
  };
}
