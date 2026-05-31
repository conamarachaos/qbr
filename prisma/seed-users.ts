/**
 * Seed ONLY the workspace, demo users, and their memberships — no accounts,
 * sources, runs, or embeddings. Run with: `npm run seed:users`.
 *
 * Idempotent: uses upserts keyed on stable fields (workspace name, user email,
 * the user+workspace membership pair) so re-running does NOT delete data or
 * change existing user IDs. Pairs with `npm run db:clean`, which preserves
 * users/workspace/memberships, to rebuild a login-ready empty database.
 */
import bcrypt from "bcryptjs";
import { type Role } from "@prisma/client";

import { prisma } from "@/lib/db";

const WORKSPACE_NAME = "Demo Workspace";

const DEMO_USERS: { email: string; name: string; role: Role }[] = [
  { email: "admin@demo", name: "Demo Admin", role: "admin" },
  { email: "am@demo", name: "Demo AM", role: "am" },
  { email: "lead@demo", name: "Demo CS Lead", role: "cs_lead" },
];

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  // Workspace has no natural unique key, so find-or-create by name.
  const workspace =
    (await prisma.workspace.findFirst({ where: { name: WORKSPACE_NAME } })) ??
    (await prisma.workspace.create({ data: { name: WORKSPACE_NAME } }));

  for (const { email, name, role } of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { name },
      create: { email, name, passwordHash },
    });

    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
      update: { role },
      create: { userId: user.id, workspaceId: workspace.id, role },
    });

    console.log(`Seeded ${email} (${role})`);
  }

  console.log(`Workspace "${WORKSPACE_NAME}" (${workspace.id}) ready — password: demo1234`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
