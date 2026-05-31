/**
 * Truncate every table in the public schema EXCEPT the User table (and the
 * Prisma migrations bookkeeping table). Run with: `npm run db:clean`.
 *
 * Discovers tables dynamically so it stays correct as the schema evolves.
 * Uses TRUNCATE ... CASCADE so FK dependents are cleared too; rows in `User`
 * are preserved (their dependent rows in other tables are removed).
 */
import { prisma } from "../lib/db";

// Preserve the User table AND the tables login depends on. Login resolves a
// role/workspaceId from Membership -> Workspace; wiping those leaves users
// unable to get past /login even though their credentials are intact.
const KEEP = new Set([
  "User",
  "Workspace",
  "Membership",
  "sessions",
  "auth_accounts",
  "authenticators",
  "_prisma_migrations",
]);

async function main() {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;

  const targets = rows
    .map((r) => r.tablename)
    .filter((name) => !KEEP.has(name));

  if (targets.length === 0) {
    console.log("No tables to truncate.");
    return;
  }

  const quoted = targets.map((t) => `"public"."${t}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
  );

  console.log(`Truncated ${targets.length} table(s), preserved User:`);
  console.log(targets.sort().join(", "));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
