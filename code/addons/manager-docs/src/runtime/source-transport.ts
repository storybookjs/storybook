import type { ChannelLike } from 'storybook/internal/channels';

import { ManagerDocsError, type ManagerDocsParseError } from '../errors.ts';

export const MDX_SOURCE_REQUEST = 'experimental-manager-docs/mdx-source-request';
export const MDX_SOURCE_RESPONSE = 'experimental-manager-docs/mdx-source-response';
export const MDX_SOURCE_CHANGED = 'experimental-manager-docs/mdx-source-changed';

export type MdxSourceError = {
  file: string;
  line: number;
  column: number;
  construct: string;
  message: string;
};

export type MdxSourceChange =
  | { importPath: string; revision: number; source: string }
  | { importPath: string; revision: number; error: MdxSourceError };

export function mdxSourceError(error: ManagerDocsParseError): MdxSourceError {
  return {
    file: error.file,
    line: error.line,
    column: error.column,
    construct: error.construct,
    message: error.reason,
  };
}

export type MdxSourceRequest = {
  id: string;
  importPath: string;
};

export type MdxSourceResponse = {
  id: string;
  importPath: string;
  source?: string;
  error?: string;
};

// The manager cannot read the docs file. Whoever serves this channel reads it and sends the text.
export function serveMdxSource(
  channel: ChannelLike,
  readFile: (importPath: string) => Promise<string>
): () => void {
  const handler = async (request: MdxSourceRequest) => {
    try {
      const source = await readFile(request.importPath);
      channel.emit(MDX_SOURCE_RESPONSE, {
        id: request.id,
        importPath: request.importPath,
        source,
      });
    } catch (error) {
      channel.emit(MDX_SOURCE_RESPONSE, {
        id: request.id,
        importPath: request.importPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  channel.on(MDX_SOURCE_REQUEST, handler);
  return () => channel.off(MDX_SOURCE_REQUEST, handler);
}

export function requestMdxSource(
  channel: ChannelLike,
  importPath: string,
  timeoutMs = 5000
): Promise<string> {
  const id = `${importPath}:${Math.random().toString(16).slice(2)}`;
  return new Promise((resolve, reject) => {
    const finish = (error?: ManagerDocsError, source?: string) => {
      clearTimeout(timer);
      channel.off(MDX_SOURCE_RESPONSE, onResponse);
      if (error) {
        reject(error);
        return;
      }
      resolve(source ?? '');
    };
    const timer = setTimeout(() => {
      finish(new ManagerDocsError(`Timed out reading "${importPath}".`));
    }, timeoutMs);
    const onResponse = (response: MdxSourceResponse) => {
      if (response.id !== id) {
        return;
      }
      if (response.error || response.source === undefined) {
        finish(new ManagerDocsError(response.error ?? `No MDX source for "${importPath}".`));
        return;
      }
      finish(undefined, response.source);
    };
    channel.on(MDX_SOURCE_RESPONSE, onResponse);
    channel.emit(MDX_SOURCE_REQUEST, { id, importPath });
  });
}
