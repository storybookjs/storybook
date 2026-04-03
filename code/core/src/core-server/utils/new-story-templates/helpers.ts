import { getComponentVariableName } from '../get-component-variable-name.ts';

export interface BaseTemplateData {
  /** The components file name without the extension */
  basenameWithoutExtension: string;
  componentExportName: string;
  componentIsDefaultExport: boolean;
  /** The exported name of the default story */
  exportedStoryName: string;
  /** The args to include in the story */
  args?: Record<string, any>;
}

/**
 * Resolves the component import name and statement from template data.
 * Returns an importStatement that always includes a trailing semicolon.
 */
export async function resolveComponentImport(
  data: Pick<
    BaseTemplateData,
    'componentIsDefaultExport' | 'componentExportName' | 'basenameWithoutExtension'
  >
): Promise<{ importName: string; importStatement: string }> {
  const importName = data.componentIsDefaultExport
    ? await getComponentVariableName(data.basenameWithoutExtension)
    : data.componentExportName;
  const importStatement = data.componentIsDefaultExport
    ? `import ${importName} from './${data.basenameWithoutExtension}';`
    : `import { ${importName} } from './${data.basenameWithoutExtension}';`;
  return { importName, importStatement };
}

/**
 * Serializes story args into a `args: { ... },` string, or empty string if no args.
 */
export function serializeArgs(args: Record<string, any> | undefined): string {
  return args && Object.keys(args).length > 0 ? `args: ${JSON.stringify(args, null, 2)},` : '';
}
