import type { z } from 'zod';

import type { AgentOutput, RunRequestRecord, RunResultFile } from './schema.ts';

export type RunRequest = z.infer<typeof RunRequestRecord> & {
  outDir: string;
  monorepoDir: string;
};

export interface Outcome {
  status: RunResultFile['status'];
  error?: string;
  recoveredFrom?: string;
  cutShort?: string;
  migrationGuide?: string;
  output?: z.infer<typeof AgentOutput>;
  startSha: string;
  headSha: string | null;
  sessionSource?: string;
  bundle?: string;
}
