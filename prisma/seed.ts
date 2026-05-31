import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { loadSeedDataset } from "@/lib/dataset";
import {
  currentQuarter as getCurrentQuarter,
  deriveHealth,
  deriveRenewalDate,
  deriveTier,
} from "@/lib/dataset-derive";
import { isUsingFallbackEmbeddings } from "@/lib/embeddings";
import { summarizeUsageRow } from "@/lib/ingest";
import { indexAccountSources } from "@/lib/repo/chunks";

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function resetDatabase() {
  await prisma.authenticator.deleteMany();
  await prisma.authAccount.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.brief.deleteMany();
  await prisma.qbrRun.deleteMany();
  await prisma.healthScore.deleteMany();
  await prisma.usageSnapshot.deleteMany();
  await prisma.source.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.accountOwnership.deleteMany();
  await prisma.account.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();
}

async function main() {
  await resetDatabase();

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const workspace = await prisma.workspace.create({
    data: {
      name: "Demo Workspace",
    },
  });

  const [adminUser, amUser, leadUser] = await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@demo",
        name: "Demo Admin",
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        email: "am@demo",
        name: "Demo AM",
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        email: "lead@demo",
        name: "Demo CS Lead",
        passwordHash,
      },
    }),
  ]);

  await prisma.membership.createMany({
    data: [
      { userId: adminUser.id, workspaceId: workspace.id, role: "admin" },
      { userId: amUser.id, workspaceId: workspace.id, role: "am" },
      { userId: leadUser.id, workspaceId: workspace.id, role: "cs_lead" },
    ],
  });

  const dataset = await loadSeedDataset();
  const seededAccountIds: string[] = [];

  for (const [index, mapping] of dataset.mappings.entries()) {
    const transcriptAccount = dataset.transcriptAccounts.find(
      (account) => account.id === mapping.transcriptAccountId,
    );

    if (!transcriptAccount) {
      continue;
    }

    const usageOption = mapping.usageAccountName
      ? dataset.usageOptions.find((option) => option.name === mapping.usageAccountName)
      : undefined;
    const usageSummary = summarizeUsageRow(usageOption?.row);
    const health = deriveHealth({
      transcriptCount: transcriptAccount.transcriptCount,
      usageProducts: usageSummary?.ai.products.length ?? 0,
      reviewInvites: usageSummary?.reviews.invitesLast30Days,
      missedCalls: usageSummary?.phones.missedCallsLast30Days,
    });

    const account = await prisma.account.create({
      data: {
        workspaceId: workspace.id,
        createdById: amUser.id,
        name: transcriptAccount.name,
        vertical: usageSummary?.vertical ?? null,
        tier: deriveTier(usageSummary?.arrUsd),
        arr: usageSummary?.arrUsd ?? null,
        renewalDate: deriveRenewalDate(index),
        lifecycle: "active",
        ownerships: {
          create: {
            userId: amUser.id,
            role: "primary_am",
          },
        },
        sources: {
          create: [
            ...transcriptAccount.transcripts.map((transcript) => ({
              type: transcript.type,
              label: transcript.label ?? `${transcript.type} transcript`,
              content: transcript.content,
              uploadedById: amUser.id,
            })),
            ...(usageOption
              ? [
                  {
                    type: "usage" as const,
                    label: `${usageOption.name} usage snapshot`,
                    content: JSON.stringify(usageOption.row, null, 2),
                    uploadedById: amUser.id,
                  },
                ]
              : []),
          ],
        },
        usageSnapshots: {
          create: {
            period: getCurrentQuarter(),
            data: toInputJson(
              usageSummary?.raw ?? {
                note: "No usage row was provided for this transcript account in the source dataset.",
              },
            ),
          },
        },
        healthScores: {
          create: {
            overall: health.overall,
            category: health.category,
            components: toInputJson(health.components),
          },
        },
      },
    });
    seededAccountIds.push(account.id);
  }

  // Build the chat embedding index so the account Q&A panel works on first boot.
  // Guarded: a missing OPENAI_API_KEY (fallback embeddings) or any embedding error
  // must not break `npm run seed`.
  const adminContext = {
    userId: adminUser.id,
    workspaceId: workspace.id,
    role: "admin" as const,
  };
  let indexedChunks = 0;
  for (const accountId of seededAccountIds) {
    try {
      const { chunks } = await indexAccountSources(adminContext, accountId);
      indexedChunks += chunks;
    } catch (error) {
      console.warn(`Chunk indexing failed for account ${accountId}:`, error);
    }
  }

  console.log(
    `Seeded workspace, demo users, and dataset-backed customer accounts ` +
      `(${indexedChunks} source chunks indexed${isUsingFallbackEmbeddings() ? ", fallback embeddings" : ""}).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
