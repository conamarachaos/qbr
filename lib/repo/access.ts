import { type Prisma } from "@prisma/client";

import { type SessionContext } from "@/lib/repo/types";

export function canManageWorkspaceWideData(context: SessionContext) {
  return context.role === "admin" || context.role === "cs_lead";
}

export function buildVisibleAccountsWhere(context: SessionContext): Prisma.AccountWhereInput {
  if (canManageWorkspaceWideData(context)) {
    return {
      workspaceId: context.workspaceId,
    };
  }

  return {
    workspaceId: context.workspaceId,
    ownerships: {
      some: {
        userId: context.userId,
      },
    },
  };
}

export function buildAccountAccessWhere(
  context: SessionContext,
  accountId: string,
): Prisma.AccountWhereInput {
  return {
    id: accountId,
    ...buildVisibleAccountsWhere(context),
  };
}
