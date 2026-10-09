import { redirect } from "next/navigation";
import type { AuthUser } from "#lib/auth-session.ts";

let currentUser: AuthUser | null = null;

export function setCurrentUser(user: AuthUser | null) {
  currentUser = user;
}

export async function getOptionalUser() {
  return currentUser;
}

export async function requireUser() {
  if (!currentUser) redirect("/auth/sign-in");
  return currentUser;
}

export async function requireRole(role: string) {
  const user = await requireUser();
  if (user.role !== role) throw new Error("Forbidden");
  return user;
}
