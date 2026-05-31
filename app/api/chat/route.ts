import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { answerAccountQuestion, resolveAccountByName } from "@/lib/repo/chat";
import { listPortfolioAccounts } from "@/lib/repo/accounts";
import { type SessionContext } from "@/lib/repo/types";

export const runtime = "nodejs";

const ChatRequestSchema = z.object({
  question: z.string().min(1),
  accountId: z.string().optional(),
  accountName: z.string().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional(),
});

/**
 * Find an account name mentioned inside the question by checking the user's
 * visible account names against it (longest name first, so "Meridian Furniture"
 * wins over "Meridian"). Returns the matched name or null.
 */
function findAccountNameInText(question: string, accountNames: string[]): string | null {
  const haystack = question.toLowerCase();
  const sorted = [...accountNames].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (haystack.includes(name.toLowerCase())) {
      return name;
    }
  }
  return null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const parsed = ChatRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ message: "Invalid request" }, { status: 400 });
  }

  const context: SessionContext = {
    userId: user.id,
    workspaceId: user.workspaceId,
    role: user.role,
  };
  const { question, history } = parsed.data;

  // 1. Explicit account from the picker wins.
  let accountId = parsed.data.accountId;
  let accountName: string | undefined;

  // 2. Otherwise resolve a typed account name, or one mentioned in the question.
  if (!accountId) {
    let nameToResolve = parsed.data.accountName?.trim();

    if (!nameToResolve) {
      const visible = await listPortfolioAccounts(context);
      const found = findAccountNameInText(
        question,
        visible.map((account) => account.name),
      );
      if (found) {
        nameToResolve = found;
      }
    }

    if (!nameToResolve) {
      return Response.json({
        needsAccount: true,
        message:
          "Which account is this about? Pick one above or include the account name in your question.",
      });
    }

    const resolved = await resolveAccountByName(context, nameToResolve);
    if (resolved.status === "not_found") {
      return Response.json({
        needsAccount: true,
        message: `I couldn't find an account matching "${nameToResolve}". Pick one above.`,
      });
    }
    if (resolved.status === "ambiguous") {
      return Response.json({
        needsAccount: true,
        message: `"${nameToResolve}" matches multiple accounts: ${resolved.candidates
          .map((candidate) => candidate.name)
          .join(", ")}. Please pick one.`,
        candidates: resolved.candidates,
      });
    }
    accountId = resolved.accountId;
    accountName = resolved.accountName;
  }

  try {
    const result = await answerAccountQuestion(context, {
      accountId,
      question,
      history,
    });
    return Response.json({ ...result, accountId, accountName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to answer question.";
    return Response.json({ message }, { status: 500 });
  }
}
