export * from './root.tsx';

export { UniversalStore as experimental_UniversalStore } from '../shared/universal-store/index.ts';
export { useUniversalStore as experimental_useUniversalStore } from '../shared/universal-store/use-universal-store-manager.ts';
export { MockUniversalStore as experimental_MockUniversalStore } from '../shared/universal-store/mock.ts';

export {
  getStatusStoreByTypeId as experimental_getStatusStore,
  useStatusStore as experimental_useStatusStore,
  fullStatusStore as internal_fullStatusStore,
  universalStatusStore as internal_universalStatusStore,
} from './stores/status.ts';

export {
  getTestProviderStoreById as experimental_getTestProviderStore,
  useTestProviderStore as experimental_useTestProviderStore,
  fullTestProviderStore as internal_fullTestProviderStore,
  universalTestProviderStore as internal_universalTestProviderStore,
} from './stores/test-provider.ts';

export {
  checklistStore as internal_checklistStore,
  universalChecklistStore as internal_universalChecklistStore,
} from './stores/checklist.ts';

export { Tag } from '../shared/constants/tags.ts';

/** OPEN SERVICE API (manager relay hub + React hooks) */
export {
  clearRegistry,
  defineService,
  generateClientId,
  getServiceChannel,
  registerService,
  SERVICE_COMMAND_ERROR,
  SERVICE_COMMAND_INVOKE,
  SERVICE_COMMAND_RESULT,
  SERVICE_PATCHES,
  SERVICE_SYNC_START,
  SERVICE_SYNC_START_REPLY,
  serviceRegistryApi,
  unregisterService,
  useServiceCommand,
  useServiceQuery,
} from '../shared/open-service/manager.ts';
export type {
  AnyServiceDefinition,
  Command,
  CommandCtx,
  CommandDefinition,
  CommandSelf,
  CommandErrorPayload,
  CommandInvokePayload,
  CommandResultPayload,
  LoadCtx,
  LoadSelf,
  OperationDescriptor,
  PatchesPayload,
  Query,
  QueryCtx,
  QueryDefinition,
  QuerySelf,
  RuntimeService,
  SchemaDescriptor,
  ServerServiceRegistration,
  ServiceChannel,
  ServiceDefinition,
  ServiceDescriptor,
  ServiceId,
  ServiceInstance,
  ServiceInstanceOf,
  ServiceRegistrationOptions,
  ServiceSummary,
  StaticStore,
  SyncStartPayload,
  SyncStartReplyPayload,
} from '../shared/open-service/manager.ts';
