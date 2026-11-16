import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Prettier interface definition
// Note: We want to avoid importing prettier directly to prevent bundling its type import
// because prettier is an optional peer dependency and might not be available
interface Prettier {
  resolveConfig: (filePath: string, options?: { editorconfig?: boolean }) => Promise<any>;
  format: (content: string, options?: any) => Promise<string> | string;
  check: (content: string, options?: any) => Promise<boolean>;
  clearConfigCache: () => Promise<void>;
  formatWithCursor: (
    content: string,
    options?: any
  ) => Promise<{ formatted: string; cursorOffset: number }>;
  getFileInfo: (
    filePath: string,
    options?: any
  ) => Promise<{ ignored: boolean; inferredParser: string | null }>;
  getSupportInfo: () => Promise<{ languages: any[]; options: any[] }>;
  resolveConfigFile: (filePath?: string) => Promise<string | null>;
  version: string;
  AstPath: any;
  doc: any;
  util: any;
}

export async function getPrettier(): Promise<Prettier> {
  try {
    return await import('prettier');
  } catch {
    return {
      AstPath: class {} as any,
      doc: {} as any,
      util: {} as any,
      version: '0.0.0-fallback',
      resolveConfig: async () => null,
      format: (content: string) => Promise.resolve(content),
      check: () => Promise.resolve(false),
      clearConfigCache: () => Promise.resolve(undefined),
      formatWithCursor: () => Promise.resolve({ formatted: '', cursorOffset: 0 }),
      getFileInfo: async () => ({ ignored: false, inferredParser: null }),
      getSupportInfo: () => Promise.resolve({ languages: [], options: [] }),
      resolveConfigFile: async () => null,
    };
  }
}

/** The Prettier the project of `filePath` installed, if any. */
async function getProjectPrettier(filePath: string): Promise<Prettier | undefined> {
  try {
    const prettierPath = createRequire(resolve(filePath)).resolve('prettier');
    const module = await import(pathToFileURL(prettierPath).href);
    // Node exposes a CommonJS Prettier, such as prettier@3's index.cjs, only as the default export.
    return 'resolveConfig' in module ? module : module.default;
  } catch {
    return undefined;
  }
}

/**
 * Format the content of a file using prettier. If prettier is not available in the user's project,
 * it will fallback to use editorconfig settings if available and formats the file by a
 * prettier-fallback.
 */
export async function formatFileContent(filePath: string, content: string): Promise<string> {
  try {
    // The Prettier next to the file first: a CLI run through npx has none of its own.
    const prettier = (await getProjectPrettier(filePath)) ?? (await getPrettier());
    const { resolveConfig, format } = prettier;
    const config = await resolveConfig(filePath);

    if (!config || Object.keys(config).length === 0) {
      return await formatWithEditorConfig(prettier, filePath, content);
    }

    const result = await format(content, {
      ...(config as any),
      filepath: filePath,
    });

    return result;
  } catch (error) {
    return content;
  }
}

async function formatWithEditorConfig(
  { resolveConfig, format }: Prettier,
  filePath: string,
  content: string
): Promise<string> {
  const config = await resolveConfig(filePath, { editorconfig: true });

  if (!config || Object.keys(config).length === 0) {
    return content;
  }

  return format(content, {
    ...(config as any),
    filepath: filePath,
  });
}

/**
 * Format an edit of an existing file the way the project formats it: with the Prettier the project
 * installed and its Prettier config. Without such a config the content is returned as is, since
 * Prettier's defaults would restyle the whole file.
 */
export async function formatExistingFile(filePath: string, content: string): Promise<string> {
  try {
    const prettier = await getProjectPrettier(filePath);
    if (!prettier) {
      return content;
    }
    const config = await prettier.resolveConfig(filePath);
    return config ? await prettier.format(content, { ...config, filepath: filePath }) : content;
  } catch {
    return content;
  }
}
