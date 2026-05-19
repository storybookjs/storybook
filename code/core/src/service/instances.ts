// Global registry of running service instances, keyed by `definition.id`.
// Lives in its own module so it can be mocked in tests (mirroring the UniversalStore pattern).
import type { ServiceRuntime } from './service-runtime.ts';

export const instances: Map<string, ServiceRuntime<any>> = new Map();
