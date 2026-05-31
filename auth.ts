import { PrismaAdapter } from "@auth/prisma-adapter";
import { type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { prisma } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(8),
});

function createAuthAdapterClient() {
  return new Proxy(prisma as typeof prisma & { account: typeof prisma.authAccount }, {
    get(target, prop, receiver) {
      if (prop === "account") {
        return Reflect.get(target, "authAccount", receiver);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

async function getPrimaryMembership(userId: string) {
  return prisma.membership.findFirst({
    where: { userId },
    orderBy: { workspaceId: "asc" },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(createAuthAdapterClient()),
  // Credentials provider requires the JWT session strategy; Auth.js v5 does not
  // support credentials sign-in with the database strategy (UnsupportedStrategy).
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });

        if (!user) {
          return null;
        }

        const passwordValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!passwordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in `user` is set; resolve workspace/role once and cache on the token.
      // On later requests re-resolve so role/ownership reassignment takes effect
      // without forcing a re-login.
      const userId = (user?.id ?? token.sub) as string | undefined;
      if (userId) {
        const membership = await getPrimaryMembership(userId);
        token.sub = userId;
        token.role = (membership?.role as Role | undefined) ?? undefined;
        token.workspaceId = membership?.workspaceId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role as Role | undefined;
        session.user.workspaceId = token.workspaceId as string | undefined;
      }
      return session;
    },
  },
});
