import { docgenServiceDef } from './services/docgen/definition.ts';
import { moduleGraphServiceDef } from './services/module-graph/definition.ts';
import { reviewServiceDef } from './services/review/definition.ts';
import { storyDocsServiceDef } from './services/story-docs/definition.ts';
import { testServiceDef } from './services/test/definition.ts';
import type {
  AnyServiceDefinition,
  RuntimeService,
  ServiceId,
  ServiceInstanceOf,
} from './types.ts';

/**
 * The core services registered in each runtime.
 *
 * These lists are the single source of truth: the `*CoreServices` types below derive their keys
 * from each definition's `id` (so `getService` typing follows the list), and
 * `core-service-types.test.ts` checks the lists against the per-runtime registrar-file convention
 * (a `services/<name>/<runtime>.{ts,tsx}` file exists for each listed service, and vice versa) to
 * catch a service being added to one without the other. Note this guards the convention, not the
 * actual call: a service can have a registrar file yet still not be wired up by its caller.
 *
 * Each list only references definitions already loaded in that runtime, and the runtime entrypoints
 * import the derived *types* (`import type`), so these value imports add no runtime cost to the
 * manager/preview/server bundles — only the membership test pulls them in as values.
 *
 * Capability services (`core/test`, `core/review`) are server-only. Runtime
 * handlers are supplied by dependency owners (core-server, addon-vitest, addon-mcp) via the
 * colocated `register*Service` helpers.
 */
export const managerCoreServiceDefs = [docgenServiceDef];
export const previewCoreServiceDefs = [docgenServiceDef, storyDocsServiceDef];
export const serverCoreServiceDefs = [
  docgenServiceDef,
  storyDocsServiceDef,
  moduleGraphServiceDef,
  testServiceDef,
  reviewServiceDef,
];
/** Maps a list of service definitions to `{ [id]: instance }`, keyed by each definition's id. */
type CoreServices<TDefs extends readonly AnyServiceDefinition[]> = {
  [Def in TDefs[number] as Def['id']]: ServiceInstanceOf<Def>;
};

/** Core services registered in the Storybook manager. */
export type ManagerCoreServices = CoreServices<typeof managerCoreServiceDefs>;

/** Core services registered in the preview. */
export type PreviewCoreServices = CoreServices<typeof previewCoreServiceDefs>;

/** Core services registered on the dev server. */
export type ServerCoreServices = CoreServices<typeof serverCoreServiceDefs>;

/** Module-level `getService` overloads keyed by a per-runtime core-service map. */
export interface TypedGetService<TMap> {
  <K extends keyof TMap & ServiceId>(serviceId: K): TMap[K];
  <TInstance = RuntimeService>(serviceId: ServiceId): TInstance;
}
