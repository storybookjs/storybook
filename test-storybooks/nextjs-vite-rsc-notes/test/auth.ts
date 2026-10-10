import { db } from "#lib/db.ts";
import * as authSessionModule from "#lib/auth-session.ts";
import type { AuthUser } from "#lib/auth-session.ts";
import { user as userTable } from "#db/schema.ts";

const { setCurrentUser } = authSessionModule as typeof import("#lib/__mocks__/auth-session.ts");

const now = new Date("2026-01-01T00:00:00.000Z");

export const testUser = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  image: null,
  role: "user",
  createdAt: now,
  updatedAt: now,
} satisfies AuthUser;

export const otherUser = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Other User",
  email: "other@example.com",
  emailVerified: true,
  image: null,
  role: "user",
  createdAt: now,
  updatedAt: now,
} satisfies AuthUser;

export async function signInAs(user: AuthUser = testUser) {
  await db
    .insert(userTable)
    .values({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .onConflictDoNothing();
  setCurrentUser(user);
}

export function signOut() {
  setCurrentUser(null);
}
