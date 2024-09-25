import { writeFile } from 'node:fs/promises';

import { getStorybookMetadata } from '@storybook/core/telemetry';

import type { Request, Response, Router } from 'express';

export async function extractStorybookMetadata(outputFile: string, configDir: string) {
  const storybookMetadata = await getStorybookMetadata(configDir);

  await writeFile(outputFile, JSON.stringify(storybookMetadata));
}

export function useStorybookMetadata(router: Router, configDir?: string) {
  router.use('/project.json', async (req: Request, res: Response) => {
    const storybookMetadata = await getStorybookMetadata(configDir);
    res.header('Content-Type', 'application/json');
    res.send(JSON.stringify(storybookMetadata));
  });
}
