import { getComponentVariableName } from '../get-component-variable-name.ts';

export interface BaseTemplateData {
  basenameWithoutExtension: string;
  componentExportName: string;
  componentIsDefaultExport: boolean;
  exportedStoryName: string;
  args?: Record<string, any>;
}

export async function resolveComponentImport(
  data: {
    basenameWithoutExtension: string;
    componentExportName: string;
    componentIsDefaultExport: boolean;
  },
  options?: { trailingSemicolon?: boolean }
): Promise<{ importName: string; importStatement: string }> {
  const trailingSemicolon = options?.trailingSemicolon ?? true;

  const importName = data.componentIsDefaultExport
    ? await getComponentVariableName(data.basenameWithoutExtension)
    : data.componentExportName;
  const importStatement = data.componentIsDefaultExport
    ? `import ${importName} from './${data.basenameWithoutExtension}'${trailingSemicolon ? ';' : ''}`
    : `import { ${importName} } from './${data.basenameWithoutExtension}'${trailingSemicolon ? ';' : ''}`;

  return { importName, importStatement };
}

export function serializeArgs(args?: Record<string, any>): {
  hasArgs: boolean;
  argsString: string;
} {
  const hasArgs = Boolean(args && Object.keys(args).length > 0);
  const argsString = hasArgs ? `args: ${JSON.stringify(args, null, 2)},` : '';

  return { hasArgs, argsString };
}
