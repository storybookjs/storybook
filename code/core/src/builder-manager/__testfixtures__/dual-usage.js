import imported from 'dual-package';

import { required } from './dual-usage-required.cjs';

globalThis.result = { type: typeof imported, once: imported === required };
