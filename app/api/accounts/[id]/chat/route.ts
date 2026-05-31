import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { answerAccountQuestion } from "@/lib/repo/chat";

export const runtime = "nodejs";

const ChatRequestSchema = z.object({
  question: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = ChatRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ message: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await answerAccountQuestion(
      {
        userId: user.id,
        workspaceId: user.workspaceId,
        role: user.role,
      },
      {
        accountId: id,
        question: parsed.data.question,
        history: parsed.data.history,
      },
    );

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to answer question.";
    return Response.json({ message }, { status: 500 });
  }
}
