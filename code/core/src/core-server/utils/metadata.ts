import { getStorybookMetadata } from '@storybook/core/telemetry';

import type { Request, Response, Router } from 'express';
import { writeJSON } from 'fs-extra';

export async function extractStorybookMetadata(outputFile: string, configDir: string) {
  const storybookMetadata = await getStorybookMetadata(configDir);

  await writeJSON(outputFile, storybookMetadata);
}

export function useStorybookMetadata(router: Router, configDir?: string) {
  router.use('/project.json', async (req: Request, res: Response) => {
    const storybookMetadata = await getStorybookMetadata(configDir);
    res.header('Content-Type', 'application/json');
    res.send(JSON.stringify(storybookMetadata));
  });
}
