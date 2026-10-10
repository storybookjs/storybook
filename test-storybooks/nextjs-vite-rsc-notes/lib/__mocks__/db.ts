import type { DB } from "#lib/db.types.ts";

let db: DB;

function resetDb(value: DB) {
  db = value;
}

export { db, resetDb };
