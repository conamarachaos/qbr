import { type Role } from "@prisma/client";
import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role?: Role;
      workspaceId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    workspaceId?: string;
  }
}
