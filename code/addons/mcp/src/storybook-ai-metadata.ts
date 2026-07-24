import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import type { Options } from 'storybook/internal/types';
import * as v from 'valibot';
import { resolveServerlessCompositionSources } from './auth/resolve-composition-sources.ts';
import { buildServerInstructions } from './instructions/build-server-instructions.ts';
import { AddonOptions, type AddonOptionsInput } from './types.ts';
import {
  getAddonLocalTools,
  getAddonToolMetadata,
  type StorybookAiLocalTool,
  type ToolMetadata,
} from './tools/tool-registry.ts';
import {
  getEffectiveToolAvailability,
  getToolAvailability,
} from './utils/get-tool-availability.ts';
import { isModuleGraphSupportedByBuilder } from './utils/module-graph.ts';

type StorybookAiMetadataPresetOptions = Options & AddonOptionsInput;

export type StorybookAiToolDescriptor = {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

export type StorybookAiMetadata = {
  instructions: string;
  tools: StorybookAiToolDescriptor[];
  localTools: Record<string, StorybookAiLocalTool>;
};

const createEmptyInputSchema = () => ({ type: 'object', properties: {} });

export async function buildStorybookAiMetadata(
  options: StorybookAiMetadataPresetOptions,
  existingMetadata?: StorybookAiMetadata
): Promise<StorybookAiMetadata> {
  const addonOptions = v.parse(AddonOptions, {
    endpoint: options.endpoint,
    toolsets: options.toolsets ?? {},
  });
  const toolsets = addonOptions.toolsets;
  const features = (await options.presets.apply('features', {})) as
    | { changeDetection?: boolean; experimentalReview?: boolean }
    | undefined;
  const devEnabled = toolsets?.dev ?? true;
  const moduleGraphSupported = await isModuleGraphSupportedByBuilder(options);
  const rawAvailability = await getToolAvailability(options, {
    features,
    moduleGraphSupported,
  });
  // This metadata is only ever consumed by the `storybook ai` CLI (the
  // Claude/Codex plugins), where review is on by default — so the CLI gate
  // drives everything derived from it: instructions, tool descriptions, and
  // which tools are included.
  const availability = {
    ...rawAvailability,
    reviewEnabled: rawAvailability.reviewEnabledForCli,
  };
  const testEnabled = (toolsets?.test ?? true) && availability.testSupported;
  const docsToolsetEnabled = toolsets?.docs ?? true;
  const multiSource = docsToolsetEnabled
    ? (await resolveServerlessCompositionSources(options)).multiSource
    : false;
  const registryAvailability = getEffectiveToolAvailability(availability, { multiSource });
  const docsEnabled = docsToolsetEnabled && registryAvailability.docsEnabled;
  const registryContext = { availability: registryAvailability, multiSource, toolsets };
  const toolMetadata = getAddonToolMetadata(registryContext);
  const localTools: Record<string, StorybookAiLocalTool> = {
    ...existingMetadata?.localTools,
    ...getAddonLocalTools({ ...registryContext, options }),
  };

  return {
    instructions: joinInstructions(
      existingMetadata?.instructions,
      buildServerInstructions({
        devEnabled,
        testEnabled,
        docsEnabled,
        changeDetectionEnabled: availability.changeDetectionEnabled,
        moduleGraphSupported: availability.moduleGraphSupported,
        reviewEnabled: availability.reviewEnabled,
      })
    ),
    tools: mergeToolDescriptors(
      existingMetadata?.tools ?? [],
      await toToolDescriptors(toolMetadata)
    ),
    localTools,
  };
}

async function toToolDescriptors(
  toolMetadata: ToolMetadata[]
): Promise<StorybookAiToolDescriptor[]> {
  const adapter = new ValibotJsonSchemaAdapter();

  return Promise.all(
    toolMetadata.map(async ({ schema, outputSchema, ...metadata }) => ({
      ...metadata,
      inputSchema: schema ? await toJsonSchema(adapter, schema) : createEmptyInputSchema(),
      ...(outputSchema ? { outputSchema: await toJsonSchema(adapter, outputSchema) } : {}),
    }))
  );
}

async function toJsonSchema(
  adapter: ValibotJsonSchemaAdapter,
  schema: unknown
): Promise<Record<string, unknown>> {
  return (await adapter.toJsonSchema(
    schema as Parameters<ValibotJsonSchemaAdapter['toJsonSchema']>[0]
  )) as Record<string, unknown>;
}

function joinInstructions(...sections: Array<string | undefined>): string {
  const uniqueSections: string[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    const trimmed = section?.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      uniqueSections.push(trimmed);
    }
  }
  return uniqueSections.join('\n\n');
}

function mergeToolDescriptors(
  ...groups: StorybookAiToolDescriptor[][]
): StorybookAiToolDescriptor[] {
  const toolsByName = new Map<string, StorybookAiToolDescriptor>();
  for (const tool of groups.flat()) {
    if (toolsByName.has(tool.name)) {
      // Later preset layers override earlier descriptors and keep their own ordering.
      toolsByName.delete(tool.name);
    }
    toolsByName.set(tool.name, tool);
  }
  return [...toolsByName.values()];
}
