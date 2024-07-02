import { writeJSON } from 'fs-extra';
import type { Server } from './server-connect';
import { getStorybookMetadata } from '@storybook/core/telemetry';

export async function extractStorybookMetadata(outputFile: string, configDir: string) {
  const storybookMetadata = await getStorybookMetadata(configDir);

  await writeJSON(outputFile, storybookMetadata);
}

export function useStorybookMetadata(app: Server, configDir?: string) {
  app.use('/project.json', async (req, res) => {
    const storybookMetadata = await getStorybookMetadata(configDir);
    res.setHeader('Content-Type', 'application/json');
    res.write(JSON.stringify(storybookMetadata));
    res.end();
  });
}
