import { vi } from 'vitest';

import '../core/src/shared/utils/toHaveLiveRegion.ts';

vi.spyOn(console, 'warn').mockImplementation((...args) => console.log(...args));
