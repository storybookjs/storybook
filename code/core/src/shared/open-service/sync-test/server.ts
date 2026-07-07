import { registerLocalCommandSyncService } from './local-command/server.ts';
import { registerRemoteCommandSyncService } from './remote-command/server.ts';
import { registerStaticLoadSyncService } from './static-load/server.ts';

export function registerOpenServiceSyncDemos() {
  return {
    localCommand: registerLocalCommandSyncService(),
    remoteCommand: registerRemoteCommandSyncService(),
    staticLoad: registerStaticLoadSyncService(),
  };
}
