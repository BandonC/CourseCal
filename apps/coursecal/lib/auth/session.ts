import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { UserId } from "@/lib/db/ids";

// Session resolution — the single entry point for "who is the current user".
// Server components/layouts use requireUser() (redirects when absent); server
// actions use getOptionalUser() and return a typed error on null (CLAUDE.md:
// every action handles the null session explicitly). Nothing else should call
// auth() directly.

export type SessionUser = {
  userId: UserId;
  email: string;
  name: string | null;
  image: string | null;
};

export async function getOptionalUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
