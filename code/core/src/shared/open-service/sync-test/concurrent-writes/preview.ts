import { registerService } from 'storybook/preview-api';

import { concurrentWritesSyncServiceDef } from './definition.ts';

export const concurrentWritesSyncService = registerService(concurrentWritesSyncServiceDef);
