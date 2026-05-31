import { type PrismaClient, type Role } from "@prisma/client";

export interface SessionContext {
  userId: string;
  workspaceId: string;
  role: Role;
}

export type DbClient = PrismaClient;
