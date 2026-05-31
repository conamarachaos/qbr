import { type Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

export interface CurrentUser {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  workspaceId: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();

  if (
    !session?.user?.id ||
    !session.user.email ||
    !session.user.role ||
    !session.user.workspaceId
  ) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    workspaceId: session.user.workspaceId,
  };
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireRole(roles: Role | Role[]) {
  const user = await requireCurrentUser();
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!allowedRoles.includes(user.role)) {
    throw new Error("Forbidden");
  }

  return user;
}
