async function getPrettier() {
  return import('prettier').catch((e) => ({
    resolveConfig: async () => null,
    format: (content: string) => content,
  }));
}

/**
 * Format the content of a file using prettier. If prettier is not available in the user's project,
 * it will fallback to use editorconfig settings if available and formats the file by a
 * prettier-fallback.
 */
export async function formatFileContent(filePath: string, content: string): Promise<string> {
  try {
    const { resolveConfig, format } = await getPrettier();
    const config = await resolveConfig(filePath);

    if (!config || Object.keys(config).length === 0) {
      return await formatWithEditorConfig(filePath, content);
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

async function formatWithEditorConfig(filePath: string, content: string) {
  const { resolveConfig, format } = await getPrettier();

  const config = await resolveConfig(filePath, { editorconfig: true });

  if (!config || Object.keys(config).length === 0) {
    return content;
  }

  return format(content, {
    ...(config as any),
    filepath: filePath,
  });
}
