import { isAbsolute, resolve } from 'node:path';

import { experimental_loadStorybook as loadStorybook } from 'storybook/internal/core-server';

import * as v from 'valibot';

import { McpToolDescriptorSchema, type McpToolDescriptor, type ToolCallResult } from './types.ts';

const STORYBOOK_AI_METADATA_PRESET = 'experimental_storybookAi';

class StorybookAiMetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorybookAiMetadataError';
  }
}

export type StorybookAiMetadata = {
  instructions?: string;
  tools: McpToolDescriptor[];
  localTools?: Record<
    string,
    { call: (input?: Record<string, unknown>) => Promise<ToolCallResult> }
  >;
};

export type StorybookAiMetadataOptions = {
  cwd?: string;
  configDir?: string;
};

export function resolveStorybookConfigDir({ cwd, configDir }: StorybookAiMetadataOptions = {}) {
  const projectCwd = resolve(cwd ?? process.cwd());
  if (configDir) {
    return isAbsolute(configDir) ? configDir : resolve(projectCwd, configDir);
  }
  return resolve(projectCwd, '.storybook');
}

export async function loadStorybookAiMetadata(
  options: StorybookAiMetadataOptions = {}
): Promise<StorybookAiMetadata | undefined> {
  const configDir = resolveStorybookConfigDir(options);
  const storybook = await loadStorybook({ configDir });

  const metadata = await storybook.presets.apply<unknown>(STORYBOOK_AI_METADATA_PRESET, undefined);

  return normalizeStorybookAiMetadata(metadata);
}

function normalizeStorybookAiMetadata(metadata: unknown): StorybookAiMetadata | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }
  const rawMetadata = metadata as Record<string, unknown>;
  const tools = normalizeTools(rawMetadata.tools);

  return {
    instructions:
      typeof rawMetadata.instructions === 'string' ? rawMetadata.instructions : undefined,
    tools,
    localTools: normalizeLocalTools(rawMetadata.localTools, tools),
  };
}

function normalizeTools(metadata: unknown): McpToolDescriptor[] {
  if (metadata === undefined) {
    return [];
  }
  if (!Array.isArray(metadata)) {
    throw new StorybookAiMetadataError('Storybook AI metadata must expose `tools` as an array');
  }

  return metadata.map((tool) => {
    const result = v.safeParse(McpToolDescriptorSchema, tool);
    if (!result.success) {
      throw new StorybookAiMetadataError(
        'Storybook AI metadata contains an invalid tool descriptor'
      );
    }
    return result.output;
  });
}

function normalizeLocalTools(
  metadata: unknown,
  tools: McpToolDescriptor[]
): StorybookAiMetadata['localTools'] {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  const visibleToolNames = new Set(tools.map((tool) => tool.name));
  const entries = Object.entries(metadata as Record<string, unknown>).flatMap(([name, tool]) => {
    if (!visibleToolNames.has(name)) {
      return [];
    }
    if (!tool || typeof tool !== 'object') {
      throw new StorybookAiMetadataError(
        `Storybook AI metadata contains an invalid local tool for \`${name}\``
      );
    }
    const call = (tool as { call?: unknown }).call;
    if (typeof call !== 'function') {
      throw new StorybookAiMetadataError(
        `Storybook AI metadata contains an invalid local tool for \`${name}\``
      );
    }
    return [
      [
        name,
        {
          call: call as (input?: Record<string, unknown>) => Promise<ToolCallResult>,
        },
      ] as const,
    ];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
