import { writeFile } from 'node:fs/promises';

import { getStorybookMetadata } from 'storybook/internal/telemetry';
import type { MiddlewareHost } from 'storybook/internal/types';

export async function extractStorybookMetadata(
  outputFile: string,
  configDir: string
): Promise<void> {
  const storybookMetadata = await getStorybookMetadata(configDir);

  await writeFile(outputFile, JSON.stringify(storybookMetadata));
}

export function useStorybookMetadata(app: MiddlewareHost, configDir?: string): void {
  app.use('/project.json', async (req, res) => {
    const storybookMetadata = await getStorybookMetadata(configDir);
    res.setHeader('Content-Type', 'application/json');
    res.write(JSON.stringify(storybookMetadata));
    res.end();
  });
}
