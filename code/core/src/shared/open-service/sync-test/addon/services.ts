import type { ServiceInstanceOf } from 'storybook/open-service';

import type { localCommandSyncServiceDef } from '../local-command/definition.ts';
import type { remoteCommandSyncServiceDef } from '../remote-command/definition.ts';
import type { staticLoadSyncServiceDef } from '../static-load/definition.ts';

export type LocalCommandSyncService = ServiceInstanceOf<typeof localCommandSyncServiceDef>;
export type RemoteCommandSyncService = ServiceInstanceOf<typeof remoteCommandSyncServiceDef>;
export type StaticLoadSyncService = ServiceInstanceOf<typeof staticLoadSyncServiceDef>;

export type OpenServiceDemoServices = {
  localCommand: LocalCommandSyncService;
  remoteCommand: RemoteCommandSyncService;
  staticLoad: StaticLoadSyncService;
};
