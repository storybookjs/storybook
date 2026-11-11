import { access, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { dirname, join } from 'pathe';
import { describe, expect, it, vi } from 'vitest';

import {
  managerCoreServiceDefs,
  previewCoreServiceDefs,
  serverCoreServiceDefs,
} from './core-service-types.ts';

const SERVICES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'services');

// Reads the service id a directory registers from its colocated `definition.ts`. We deliberately do
// not assume the directory name matches the id (e.g. `core/docgen` need not live in `services/docgen/`)
// — the only convention relied on is that each service directory has a `definition.ts` exporting a
// definition object with an `id`.
async function readServiceId(serviceDirectory: string): Promise<string> {
  const definitionModule = await import(
    pathToFileURL(join(SERVICES_DIR, serviceDirectory, 'definition.ts')).href
  );
  for (const exported of Object.values(definitionModule)) {
    if (
      typeof exported === 'object' &&
      exported !== null &&
      'id' in exported &&
      typeof exported.id === 'string'
    ) {
      return exported.id;
    }
  }
  throw new Error(
    `No service definition with an id was found in services/${serviceDirectory}/definition.ts`
  );
}

/** Ids of the services whose directory contains the given runtime registrar file (e.g. `server.ts`). */
async function registeredServiceIds(registrarFile: string): Promise<string[]> {
  const entries = await readdir(SERVICES_DIR, { withFileTypes: true });
  const ids = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const hasRegistrar = await access(join(SERVICES_DIR, entry.name, registrarFile)).then(
          () => true,
          () => false
        );
        return hasRegistrar ? readServiceId(entry.name) : undefined;
      })
  );
  return ids.filter((id) => id !== undefined);
}

// Asserts a runtime's def list contains exactly the services whose directory has that runtime's
// registrar file. `vi.defineHelper` makes a failure point at the calling `it`, not in here.
const expectDefsToMatchRegistrars = vi.defineHelper(
  async (defs: readonly { id: string }[], registrarFile: string) => {
    const idsFromDefs = defs.map((def) => def.id).sort();
    const idsOnDisk = (await registeredServiceIds(registrarFile)).sort();

    expect(
      idsFromDefs,
      `core-service-types.ts is out of sync with services/*/${registrarFile}. Every service with a ` +
        `services/<name>/${registrarFile} registrar must appear in the matching def list, and vice ` +
        `versa (see open-service/README.md).`
    ).toEqual(idsOnDisk);
  }
);

describe('core-service-types membership', () => {
  it('manager def list matches manager registrars', () =>
    expectDefsToMatchRegistrars(managerCoreServiceDefs, 'manager.tsx'));

  it('preview def list matches preview registrars', () =>
    expectDefsToMatchRegistrars(previewCoreServiceDefs, 'preview.ts'));

  it('server def list matches server registrars', () =>
    expectDefsToMatchRegistrars(serverCoreServiceDefs, 'server.ts'));
});
