import { vi } from 'vitest';

import '../core/src/utils/toHaveLiveRegion.ts';

vi.spyOn(console, 'warn').mockImplementation((...args) => console.log(...args));
