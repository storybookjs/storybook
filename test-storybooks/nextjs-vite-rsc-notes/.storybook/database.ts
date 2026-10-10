import { PGlite } from "@electric-sql/pglite";

// The database of the stories: one PGlite per tab, which preview.ts empties
// before every story. Emptying it takes a few ms. A tab makes it from a dump
// of the schema that main.ts makes in Node: Postgres's initdb in the browser
// takes about 1 s and over 500 MB of memory on an iPhone, the dump a third
// of the time and 300 MB.

/**
 * Where Storybook serves the dump: at its root, as MSW's worker. A .tgz, not a
 * .tar.gz: `storybook dev` sends a .gz file with `Content-Encoding: gzip`, so
 * the browser would unzip it, and keep the 40 MB tar.
 */
export const dumpPath = "/notes-db.tgz";

// Emptying the tables does not undo a schema change. This event trigger marks
// every committed DDL statement in a session setting (also under the replica
// role); the reset then fails on purpose and the next story gets a fresh
// database. Other session state (SET, PREPARE, LISTEN, advisory locks) is not
// reset; no story uses it.
const trackSchemaChanges = `
  CREATE FUNCTION "markSchemaChanged"() RETURNS event_trigger LANGUAGE plpgsql AS $$
  BEGIN
    PERFORM set_config('storybook.schema_changed', 'true', false);
  END $$;
  CREATE EVENT TRIGGER "markSchemaChanged" ON ddl_command_end EXECUTE FUNCTION "markSchemaChanged"();
  ALTER EVENT TRIGGER "markSchemaChanged" ENABLE ALWAYS;
`;
const failIfSchemaChanged = `
  DO $$
  BEGIN
    IF current_setting('storybook.schema_changed', true) = 'true' THEN
      RAISE EXCEPTION 'The previous story changed the schema';
    END IF;
  END $$`;

/** The database with the schema and the event trigger, as a gzipped tar: main.ts makes it, in Node. */
export async function dumpDatabase(schemaSQL: string) {
  const client = await PGlite.create("memory://");
  try {
    await client.exec(schemaSQL);
    // initdb takes the time zone of the machine that runs it: UTC, wherever
    // Storybook is built.
    await client.exec(`ALTER SYSTEM SET timezone = 'UTC'`);
    await client.exec(trackSchemaChanges);
    // A database from the dump then starts without replaying the WAL.
    await client.exec("CHECKPOINT");
    return await client.dumpDataDir("gzip");
  } finally {
    await client.close();
  }
}

// DELETE instead of TRUNCATE: TRUNCATE rewrites every table and index file,
// DELETE on a few rows is near free. The replica role turns off the foreign
// key triggers, so the order of the tables does not matter. DELETE does not
// restart sequences, so setval does (the ids of the schema are random uuids:
// it has none today). setval, not ALTER SEQUENCE: that is DDL and would trip
// the trigger.
async function createEmptyAllTables(client: PGlite) {
  const { rows: tables } = await client.query<{ statement: string }>(
    `SELECT format('DELETE FROM %I.%I', schemaname, tablename) AS statement FROM pg_tables WHERE schemaname = 'public'`,
  );
  const { rows: sequences } = await client.query<{ statement: string }>(
    `SELECT format('SELECT setval(%L, %s, false)', format('%I.%I', schemaname, sequencename), start_value) AS statement FROM pg_sequences`,
  );
  return [
    failIfSchemaChanged,
    "SET session_replication_role = replica",
    ...tables.map(({ statement }) => statement),
    "SET session_replication_role = DEFAULT",
    ...sequences.map(({ statement }) => statement),
  ].join(";\n");
}

// The dump, fetched once per tab, and the database made from it.
let dump: Promise<Blob> | undefined;
let current: { client: PGlite; emptyAllTables: string } | undefined;
let resetting: Promise<unknown> = Promise.resolve();

async function fetchDump() {
  const response = await fetch(dumpPath);
  if (!response.ok) throw new Error(`Could not fetch ${dumpPath}: ${response.status}`);
  // PGlite unzips a dump by its type. A server may send it with any type, or
  // with `Content-Encoding: gzip`, which the browser unzips.
  const blob = await response.blob();
  const [first, second] = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  const gzipped = first === 0x1f && second === 0x8b;
  return new Blob([blob], { type: gzipped ? "application/gzip" : "application/x-tar" });
}

async function emptyDatabase({ client, emptyAllTables }: NonNullable<typeof current>) {
  // A story that left a transaction open (or aborted) would otherwise leak its
  // writes into the next story, or make the DELETEs fail. A PGlite that
  // crashed throws.
  try {
    if (client.closed || client.isInTransaction()) return false;
    await client.exec(emptyAllTables);
    return true;
  } catch {
    return false;
  }
}

async function reset() {
  if (current && (await emptyDatabase(current))) return current.client;

  if (current && !current.client.closed) await current.client.close().catch(() => {});
  current = undefined;
  // A dump that did not arrive is fetched again for the next story.
  dump ??= fetchDump().catch((error: unknown) => {
    dump = undefined;
    throw error;
  });
  const client = await PGlite.create("memory://", { loadDataDir: await dump });
  current = { client, emptyAllTables: await createEmptyAllTables(client) };
  return client;
}

/**
 * The database of the tab, empty. A fresh one if the previous story changed
 * the schema, left a transaction open or closed it. The stories of a docs
 * page share it: they reset it one after the other, and a story can empty
 * what another one seeded.
 */
export function resetDatabase(): Promise<PGlite> {
  const client = resetting.then(reset);
  resetting = client.catch(() => {});
  return client;
}
