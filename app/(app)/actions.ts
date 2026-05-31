"use server";

import {
  type ActionStatus,
  type GapStatus,
  type Lifecycle,
  type OppStage,
  type Tier,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth/session";
import {
  commitUpload,
  createAccount,
  createActionItem,
  deleteAccount,
  deleteActionItem,
  updateActionItemStatus,
  updateGapStatus,
  importDatasetAccount,
  previewUpload,
  type IngestUploadResult,
  type UploadDecision,
  type UploadFileProposal,
  updateAccount,
  updateOpportunityStage,
} from "@/lib/repo/accounts";
import { parseUploads } from "@/lib/repo/file-parse";

function parseOptionalDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function createAccountAction(formData: FormData) {
  const user = await requireCurrentUser();
  const account = await createAccount(
    {
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
    },
    {
      name: String(formData.get("name") ?? "").trim(),
      vertical: String(formData.get("vertical") ?? "").trim() || undefined,
      tier: (String(formData.get("tier") ?? "growth") as Tier) ?? "growth",
      arr: parseOptionalNumber(formData.get("arr")),
      renewalDate: parseOptionalDate(formData.get("renewalDate")),
    },
  );

  revalidatePath("/");
  revalidatePath("/portfolio");
  redirect(`/accounts/${account.id}`);
}

// Bytes, not file count, are the real ceiling: it must stay under the Next.js
// server-action bodySizeLimit (8mb in next.config.ts). We gate per-file and on
// the total so users get a clear message instead of an opaque request failure.
const MAX_FILE_BYTES = 4_000_000;
const MAX_TOTAL_BYTES = 7_500_000;

export interface UploadPreviewProposal extends UploadFileProposal {
  // Parsed text content echoed back so the commit step doesn't re-upload bytes.
  content: string;
}

export type PreviewUploadResult =
  | {
      ok: true;
      proposals: UploadPreviewProposal[];
      skipped: Array<{ filename: string; reason: string }>;
    }
  | { ok: false; error: string };

// Phase 1: parse + classify uploaded files and return proposals to confirm.
// Does NOT write to the database.
export async function previewUploadAction(formData: FormData): Promise<PreviewUploadResult> {
  const user = await requireCurrentUser();

  const entries = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (entries.length === 0) {
    return { ok: false, error: "Select at least one file to upload." };
  }

  let totalBytes = 0;
  for (const entry of entries) {
    if (entry.size > MAX_FILE_BYTES) {
      return {
        ok: false,
        error: `${entry.name} is too large (max ${Math.round(MAX_FILE_BYTES / 1_000_000)}MB per file).`,
      };
    }
    totalBytes += entry.size;
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return {
      ok: false,
      error: `Total upload is too large (max ${Math.round(MAX_TOTAL_BYTES / 1_000_000)}MB across all files). Upload in smaller batches.`,
    };
  }

  // Parse binaries (xlsx) + sanitize text + reject unsupported binaries.
  const raw = await Promise.all(
    entries.map(async (entry) => ({ filename: entry.name, bytes: await entry.arrayBuffer() })),
  );
  const { parsed, skipped } = parseUploads(raw);

  try {
    const preview = await previewUpload(
      { userId: user.id, workspaceId: user.workspaceId, role: user.role },
      parsed,
    );

    // Re-attach the parsed content (by filename) so the client can echo it back.
    const contentByName = new Map(parsed.map((file) => [file.filename, file.content]));
    const proposals: UploadPreviewProposal[] = preview.proposals.map((proposal) => ({
      ...proposal,
      content: contentByName.get(proposal.filename) ?? "",
    }));

    return {
      ok: true,
      proposals,
      skipped: [...skipped, ...preview.skipped],
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to analyze files.",
    };
  }
}

export type CommitUploadResult =
  | { ok: true; result: IngestUploadResult }
  | { ok: false; error: string };

// Phase 2: commit the user-confirmed decisions to the database.
export async function commitUploadAction(
  decisions: UploadDecision[],
): Promise<CommitUploadResult> {
  const user = await requireCurrentUser();

  if (!Array.isArray(decisions) || decisions.length === 0) {
    return { ok: false, error: "No files to save." };
  }

  try {
    const result = await commitUpload(
      { userId: user.id, workspaceId: user.workspaceId, role: user.role },
      decisions,
    );

    revalidatePath("/");
    revalidatePath("/portfolio");
    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to save files.",
    };
  }
}

export async function importDatasetAccountAction(formData: FormData) {
  const user = await requireCurrentUser();
  const transcriptAccountId = String(formData.get("transcriptAccountId") ?? "");

  const account = await importDatasetAccount(
    {
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
    },
    transcriptAccountId,
  );

  revalidatePath("/");
  revalidatePath("/portfolio");
  redirect(`/accounts/${account.id}`);
}

export async function updateAccountAction(formData: FormData) {
  const user = await requireCurrentUser();
  const accountId = String(formData.get("accountId") ?? "");

  await updateAccount(
    {
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
    },
    {
      accountId,
      name: String(formData.get("name") ?? "").trim(),
      vertical: String(formData.get("vertical") ?? "").trim() || null,
      tier: String(formData.get("tier") ?? "growth") as Tier,
      arr: parseOptionalNumber(formData.get("arr")),
      renewalDate: parseOptionalDate(formData.get("renewalDate")),
      lifecycle: String(formData.get("lifecycle") ?? "active") as Lifecycle,
    },
  );

  revalidatePath("/");
  revalidatePath("/portfolio");
  revalidatePath(`/accounts/${accountId}`);
  redirect(`/accounts/${accountId}`);
}

export async function deleteAccountAction(formData: FormData) {
  const user = await requireCurrentUser();
  const accountId = String(formData.get("accountId") ?? "");

  await deleteAccount(
    {
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
    },
    accountId,
  );

  revalidatePath("/");
  revalidatePath("/portfolio");
  redirect("/portfolio");
}

export async function createActionItemAction(formData: FormData) {
  const user = await requireCurrentUser();
  const accountId = String(formData.get("accountId") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? `/accounts/${accountId}`);

  await createActionItem(
    {
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
    },
    {
      accountId,
      qbrRunId: String(formData.get("qbrRunId") ?? "") || undefined,
      title: String(formData.get("title") ?? "").trim(),
      dueDate: parseOptionalDate(formData.get("dueDate")),
    },
  );

  revalidatePath(`/accounts/${accountId}`);
  redirect(redirectTo);
}

export async function updateActionItemStatusAction(formData: FormData) {
  const user = await requireCurrentUser();
  const accountId = String(formData.get("accountId") ?? "");
  const actionItemId = String(formData.get("actionItemId") ?? "");
  const status = String(formData.get("status") ?? "open") as ActionStatus;

  await updateActionItemStatus(
    {
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
    },
    { actionItemId, status },
  );

  revalidatePath(`/accounts/${accountId}`);
}

export async function deleteActionItemAction(formData: FormData) {
  const user = await requireCurrentUser();
  const accountId = String(formData.get("accountId") ?? "");
  const actionItemId = String(formData.get("actionItemId") ?? "");

  await deleteActionItem(
    {
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
    },
    { actionItemId },
  );

  revalidatePath(`/accounts/${accountId}`);
}

export async function updateOpportunityStageAction(formData: FormData) {
  const user = await requireCurrentUser();
  const accountId = String(formData.get("accountId") ?? "");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const stage = String(formData.get("stage") ?? "identified") as OppStage;
  const redirectTo = String(formData.get("redirectTo") ?? `/accounts/${accountId}`);

  await updateOpportunityStage(
    {
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
    },
    {
      accountId,
      opportunityId,
      stage,
    },
  );

  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/opportunities");
  redirect(redirectTo);
}

export async function moveOpportunityStageAction(input: {
  accountId: string;
  opportunityId: string;
  stage: OppStage;
}) {
  const user = await requireCurrentUser();

  await updateOpportunityStage(
    {
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
    },
    {
      accountId: input.accountId,
      opportunityId: input.opportunityId,
      stage: input.stage,
    },
  );

  revalidatePath(`/accounts/${input.accountId}`);
  revalidatePath("/opportunities");
}

export async function moveGapStatusAction(input: {
  accountId: string;
  gapId: string;
  status: GapStatus;
}) {
  const user = await requireCurrentUser();

  await updateGapStatus(
    {
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
    },
    {
      accountId: input.accountId,
      gapId: input.gapId,
      status: input.status,
    },
  );

  revalidatePath(`/accounts/${input.accountId}`);
  revalidatePath("/gaps");
}
