import { registerService } from '../../server.ts';
import { docsServiceDef } from './definition.ts';

export function registerDocsService() {
  return registerService(docsServiceDef);
}
