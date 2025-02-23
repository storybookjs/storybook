import { writeFile } from 'node:fs/promises';

import { getStorybookMetadata } from '@storybook/core/telemetry';

import type { Polka } from 'polka';

export async function extractStorybookMetadata(outputFile: string, configDir: string) {
  const storybookMetadata = await getStorybookMetadata(configDir);

  await writeFile(outputFile, JSON.stringify(storybookMetadata));
}

export function useStorybookMetadata(app: Polka, configDir?: string) {
  app.use('/project.json', async (req, res) => {
    const storybookMetadata = await getStorybookMetadata(configDir);
    res.setHeader('Content-Type', 'application/json');
    res.write(JSON.stringify(storybookMetadata));
    res.end();
  });
}
